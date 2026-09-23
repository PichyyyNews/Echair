const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const ActiveSession = require('../models/ActiveSession');
const SystemSettings = require('../models/SystemSettings');
const admin = require('../config/firebase');
const transporter = require('../config/email');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const createLogger = require('../utils/logger');
const { formatLoginInfo } = require('../utils/loginTracking');
const { saveUploadedFile, deleteStoredFile } = require('../utils/storage');
const { getCache, setCache, delCache } = require('../utils/cache');
const { enqueueEmail } = require('../jobs/queue');
const logger = createLogger('AuthController');

exports.googleLoginVerify = async (req, res) => {
    logger.info('Processing Google login verification...');
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ msg: 'ID token is required' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid, email, picture, name } = decodedToken;
        logger.success(`Google token verified for user: ${email}`);

        let user = await User.findOne({ email });

        // System Settings Checks
        const settings = await SystemSettings.getSettings();

        // Maintenance Check
        if (user && settings.site.maintenanceMode && user.role !== 'admin') {
            return res.status(503).json({ msg: settings.site.maintenanceMessage });
        }

        let isNewUser = false;

        if (!user) {
            // Registration Check
            if (!settings.security.allowRegistration) {
                return res.status(403).json({ msg: 'New user registration is currently disabled.' });
            }

            isNewUser = true;
            user = new User({
                email,
                displayName: name || email.split('@')[0],
                photoURL: picture || `https://api.dicebear.com/9.x/toon-head/svg?seed=${encodeURIComponent(email)}`,
                uid
            });
            await user.save();
        } else {
            let needsUpdate = false;
            if (!user.uid) {
                user.uid = uid;
                needsUpdate = true;
            }
            if (picture && (!user.photoURL || user.photoURL === '' || user.photoURL.startsWith('https://'))) {
                user.photoURL = picture;
                needsUpdate = true;
            }
            if (name && user.displayName !== name) {
                user.displayName = name;
                needsUpdate = true;
            }
            if (needsUpdate) {
                await user.save();
            }
        }

        // Get detailed login info
        const loginInfo = formatLoginInfo(req);

        // Save login history with detailed information
        await LoginHistory.create({
            userId: user._id,
            action: 'login',
            ipAddress: loginInfo.ip,
            location: loginInfo.location,
            device: {
                type: loginInfo.userAgent.device.type,
                vendor: loginInfo.userAgent.device.vendor,
                model: loginInfo.userAgent.device.model,
                icon: loginInfo.deviceIcon,
            },
            browser: {
                name: loginInfo.userAgent.browser.name,
                version: loginInfo.userAgent.browser.version,
                icon: loginInfo.browserIcon,
            },
            os: {
                name: loginInfo.userAgent.os.name,
                version: loginInfo.userAgent.os.version,
            },
            userAgent: req.get('User-Agent'),
            success: true,
        });

        logger.info(`Google login successful for ${email} from ${loginInfo.location.city}, ${loginInfo.location.country} (${loginInfo.userAgent.device.type})`);

        const payload = {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                uid: user.uid,
                role: user.role || 'user'
            },
        };

        // Emit Login Notification
        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(req.io, user.id, 'Login Successful', `Welcome back, ${user.displayName}!`, 'login');

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: payload.user,
                    isNewUser
                });
            }
        );
    } catch (error) {
        logger.error(`Google authentication error: ${error.message}`, error);
        if (error.code === 'auth/id-token-expired') {
            res.status(401).json({ msg: 'Google token has expired. Please sign in again.' });
        } else if (error.code === 'auth/invalid-id-token') {
            res.status(401).json({ msg: 'Invalid Google token.' });
        } else {
            res.status(500).json({ msg: 'Server error during Google authentication', error: error.message });
        }
    }
};

exports.register = async (req, res) => {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ msg: 'Password must be at least 8 characters long.' });
    }

    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
        return res.status(400).json({ msg: 'Password must include uppercase, lowercase, number, and special character.' });
    }

    try {
        // Validation: Check if registration is allowed
        const settings = await SystemSettings.getSettings();
        if (!settings.security.allowRegistration) {
            return res.status(403).json({ msg: 'New user registration is currently disabled.' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user = await User.findOne({
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        });

        if (user) {
            return res.status(400).json({ msg: 'User already exists with this email.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Check if this is the first user - make them admin
        const userCount = await User.countDocuments();
        const isFirstUser = userCount === 0;

        if (isFirstUser) {
            logger.info('First user registration - assigning admin role');
        }

        user = new User({
            email: normalizedEmail,
            password: hashedPassword,
            displayName: displayName || normalizedEmail.split('@')[0],
            photoURL: `https://api.dicebear.com/9.x/toon-head/svg?seed=${encodeURIComponent(normalizedEmail)}`,
            uid: new mongoose.Types.ObjectId().toString(),
            role: isFirstUser ? 'admin' : 'user'
        });

        await user.save();

        const payload = {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                uid: user.uid,
                role: user.role
            },
        };

        // Emit Welcome Notification
        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(req.io, user.id, 'Welcome!', `Welcome to EChair, ${user.displayName}!`, 'system');

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.status(201).json({
                    msg: 'User registered successfully!',
                    token,
                    user: payload.user
                });
            }
        );
    } catch (err) {
        logger.error('User registration error:', err);
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(__dirname, '../server_error.log');
            fs.appendFileSync(logPath, `${new Date().toISOString()} - Registration Error: ${err.stack || err}\n`);
        } catch (logErr) {
            logger.error('Failed to write error log:', logErr);
        }
        if (err.code === 11000) {
            if (err.keyPattern && err.keyPattern.email) {
                return res.status(400).json({ msg: 'User already exists with this email.' });
            }
            return res.status(400).json({ msg: 'User already exists.' });
        }
        res.status(500).json({ msg: 'Server error during registration', error: err.message });
    }
};

exports.login = async (req, res) => {
    const { email, password, otpCode } = req.body;

    try {
        let user = await User.findOne({ email }).select('+password +twoFactorEnabled +loginOtpCode +loginOtpExpires +role');
        if (!user) {
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        // Maintenance Mode Check
        const settings = await SystemSettings.getSettings();
        if (settings.site.maintenanceMode && user.role !== 'admin') {
            return res.status(503).json({ msg: settings.site.maintenanceMessage });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid Credentials.' });
        }

        if (user.twoFactorEnabled) {
            if (!otpCode) {
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

                await User.findByIdAndUpdate(user._id, {
                    loginOtpCode: otp,
                    loginOtpExpires: otpExpires
                });

                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: 'Chair App - Login Verification Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #4CAF50;">Login Verification Required</h2>
                            <p>Hello ${user.displayName || 'User'},</p>
                            <p>Verification Code:</p>
                            <h1 style="color: #4CAF50;">${otp}</h1>
                        </div>
                    `
                };

                await enqueueEmail(mailOptions);

                return res.json({
                    requiresOtp: true,
                    message: 'OTP sent to your email. Please verify to complete login.',
                    tempUserId: user._id
                });
            }

            if (otpCode) {
                if (!user.loginOtpCode || !user.loginOtpExpires) {
                    return res.status(400).json({ msg: 'No OTP found. Please request a new one.' });
                }
                if (new Date() > user.loginOtpExpires) {
                    return res.status(400).json({ msg: 'OTP has expired. Please request a new one.' });
                }
                if (otpCode !== user.loginOtpCode) {
                    return res.status(400).json({ msg: 'Invalid OTP code.' });
                }

                await User.findByIdAndUpdate(user._id, {
                    $unset: { loginOtpCode: 1, loginOtpExpires: 1 }
                });
            }
        }

        // Get detailed login info
        const loginInfo = formatLoginInfo(req);

        // Save login history with detailed information (non-blocking)
        try {
            await LoginHistory.create({
                userId: user._id,
                action: 'login',
                ipAddress: loginInfo.ip,
                location: loginInfo.location,
                device: {
                    type: loginInfo.userAgent.device.type,
                    vendor: loginInfo.userAgent.device.vendor,
                    model: loginInfo.userAgent.device.model,
                    icon: loginInfo.deviceIcon,
                },
                browser: {
                    name: loginInfo.userAgent.browser.name,
                    version: loginInfo.userAgent.browser.version,
                    icon: loginInfo.browserIcon,
                },
                os: {
                    name: loginInfo.userAgent.os.name,
                    version: loginInfo.userAgent.os.version,
                },
                userAgent: req.get('User-Agent'),
                success: true,
            });
        } catch (historyError) {
            logger.error('Failed to save login history:', { message: historyError.message, stack: historyError.stack });
            // Don't fail login if history logging fails
        }

        const payload = {
            user: {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                uid: user.uid,
                role: user.role || 'user',
                twoFactorEnabled: user.twoFactorEnabled
            },
        };

        // Emit Login Notification
        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(req.io, user.id, 'Login Successful', `Welcome back, ${user.displayName}!`, 'login');

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user });
            }
        );
    } catch (err) {
        logger.error('Login error:', err.message, { stack: err.stack });
        res.status(500).json({ msg: 'Server error during login' });
    }
};

exports.logout = async (req, res) => {
    try {
        const userId = req.user.id;

        // Emit Logout Notification
        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(req.io, userId, 'Logged Out', `You have successfully logged out.`, 'system');

        res.json({ msg: 'Logged out successfully' });
    } catch (err) {
        logger.error('Logout error:', err.message);
        res.status(500).json({ msg: 'Server error during logout' });
    }
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: 'Email is required.' });

    try {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await User.findOne({ email: normalizedEmail });

        if (!user) {
            return res.json({ msg: 'If an account with that email exists, we have sent a password reset link.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
        await user.save();

        const resetURL = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: 'Password Reset Request - Chair App',
            html: `
                <p>Hello ${user.displayName || 'User'},</p>
                <p>Click here to reset your password: <a href="${resetURL}">Reset Password</a></p>
            `
        };

        await enqueueEmail(mailOptions);
        res.json({ msg: 'If an account with that email exists, we have sent a password reset link.' });
    } catch (err) {
        logger.error('Forgot password error:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
};

exports.getResetTokenInfo = async (req, res) => {
    try {
        const { token } = req.params;
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(404).json({ msg: 'Token is invalid or has expired.' });
        }

        res.json({ email: user.email, username: user.displayName });
    } catch (error) {
        logger.error('Error fetching reset token info:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ msg: 'Password is required.' });
    if (password.length < 8) return res.status(400).json({ msg: 'Password must be at least 8 characters long.' });

    try {
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: resetTokenHash,
            resetPasswordExpires: { $gt: Date.now() }
        }).select('+password +resetPasswordToken +resetPasswordExpires');

        if (!user) return res.status(400).json({ msg: 'Password reset token is invalid or has expired.' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ msg: 'Password has been reset successfully.' });
    } catch (err) {
        logger.error('Reset password error:', err);
        res.status(500).json({ msg: 'Server error', error: err.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id; // Corrected to use req.user.id directly, assuming authMiddleware populates req.user object

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ msg: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ msg: 'New password must be at least 6 characters long' });
        }

        // Must re-fetch user including password
        const user = await User.findById(userId).select('+password');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Current password is incorrect' });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        await LoginHistory.create({
            userId: userId,
            action: 'password_changed',
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        });

        res.json({ msg: 'Password changed successfully' });
    } catch (error) {
        logger.error('Change password error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.toggle2FA = async (req, res) => {
    try {
        const { enable } = req.body;
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (enable) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            user.twoFactorEnabled = true;
            user.twoFactorCode = code;
            user.twoFactorExpires = expiresAt;
            await user.save();

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: user.email,
                subject: 'Two-Factor Authentication Setup',
                html: `<h1>${code}</h1>`
            };
            await enqueueEmail(mailOptions);
            res.json({ msg: '2FA enabled. Check email for code.' });
        } else {
            user.twoFactorEnabled = false;
            user.twoFactorCode = null;
            user.twoFactorExpires = null;
            await user.save();
            res.json({ msg: '2FA disabled.' });
        }
    } catch (error) {
        logger.error('2FA toggle error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.verify2FA = async (req, res) => {
    try {
        const { code } = req.body;
        const userId = req.user.id;
        const user = await User.findById(userId); // Need to fetch fields if not selected by default in auth middleware? User model usually selects fields.
        // But need 2fa code which might be select: false
        const userWithCode = await User.findById(userId).select('+twoFactorCode +twoFactorExpires');

        if (!userWithCode) return res.status(404).json({ msg: 'User not found' });

        if (!userWithCode.twoFactorCode || userWithCode.twoFactorExpires < new Date()) {
            return res.status(400).json({ msg: 'Code expired' });
        }
        if (userWithCode.twoFactorCode !== code) {
            return res.status(400).json({ msg: 'Invalid code' });
        }

        userWithCode.twoFactorCode = null; // Clear code
        userWithCode.twoFactorExpires = null;
        await userWithCode.save();

        res.json({ msg: '2FA verified successfully' });
    } catch (error) {
        logger.error('2FA verify error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getLoginHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const history = await LoginHistory.find({ userId })
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await LoginHistory.countDocuments({ userId });

        res.json({
            history,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                hasNext: skip + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        logger.error('Get login history error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getActiveSessions = async (req, res) => {
    try {
        const userId = req.user.id;
        const sessions = await ActiveSession.find({ userId }).sort({ lastActivity: -1 });
        res.json({ sessions });
    } catch (error) {
        logger.error('Get active sessions error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.terminateSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;
        await ActiveSession.findOneAndDelete({ _id: sessionId, userId });
        res.json({ msg: 'Session terminated' });
    } catch (error) {
        logger.error('Terminate session error:', error);
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const cacheKey = `user:${req.user.id}`;
        const cachedUser = await getCache(cacheKey);
        if (cachedUser) {
            return res.json(cachedUser);
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });
        
        const userData = {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            uid: user.uid,
            createdClasses: user.createdClasses,
            enrolledClasses: user.enrolledClasses,
            pinnedClasses: user.pinnedClasses
        };

        // Cache user profile for 5 minutes (300 seconds)
        await setCache(cacheKey, userData, 300);

        res.json(userData);
    } catch (err) {
        res.status(500).send('Server error');
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updateData = req.body;
        delete updateData.email;
        delete updateData.password;
        delete updateData._id;
        delete updateData.uid;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        // Invalidate cache
        await delCache(`user:${userId}`);

        res.json({ msg: 'Profile updated', user: updatedUser });
    } catch (error) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.updatePhoto = async (req, res) => {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded.' });

    try {
        const user = req.user;
        if (user.photoURL && !user.photoURL.startsWith('http')) {
            await deleteStoredFile(user.photoURL);
        }

        const savedResult = await saveUploadedFile({
            buffer: req.file.buffer,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            folder: 'profile_photos',
            optimize: true,
            type: 'avatar'
        });

        const newPhotoURL = savedResult.url;
        user.photoURL = newPhotoURL;
        await user.save();

        // Invalidate user cache
        await delCache(`user:${user._id}`);

        res.json({
            msg: 'Profile photo updated',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: newPhotoURL,
                uid: user.uid
            }
        });
    } catch (error) {
        logger.error(`Update photo error: ${error.message}`);
        res.status(500).send('Server error');
    }
};

exports.deletePhoto = async (req, res) => {
    try {
        const user = req.user;
        if (user.photoURL && !user.photoURL.startsWith('http')) {
            await deleteStoredFile(user.photoURL);
        }

        user.photoURL = `https://api.dicebear.com/9.x/toon-head/svg?seed=${encodeURIComponent(user.email)}`;
        await user.save();

        // Invalidate user cache
        await delCache(`user:${user._id}`);

        res.json({
            msg: 'Profile photo deleted',
            user: {
                id: user._id,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                uid: user.uid
            }
        });
    } catch (error) {
        logger.error(`Delete photo error: ${error.message}`);
        res.status(500).send('Server error');
    }
};
