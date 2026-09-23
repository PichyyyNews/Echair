const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const LoginHistory = require('../models/LoginHistory');
const ActiveSession = require('../models/ActiveSession');
const Class = require('../models/Class');
const SystemSettings = require('../models/SystemSettings');
const createLogger = require('../utils/logger');
const logger = createLogger('AdminController');

/**
 * Get Dashboard Statistics
 * @route GET /api/admin/stats
 * @access Admin only
 */
exports.getDashboardStats = async (req, res) => {
    logger.info('Fetching admin dashboard stats...');

    try {
        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0));
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        // 1. User Metrics
        const totalUsers = await User.countDocuments();
        const newUsersThisWeek = await User.countDocuments({
            createdAt: { $gte: oneWeekAgo }
        });

        // 2. Engagement Metrics (WAU - Weekly Active Users)
        const activeUsersList = await LoginHistory.distinct('userId', {
            timestamp: { $gte: oneWeekAgo }
        });
        const wau = activeUsersList.length;
        const retentionRate = totalUsers > 0 ? Math.round((wau / totalUsers) * 100) : 0;

        // 3. Classroom Metrics
        const totalClasses = await Class.countDocuments();
        const newClassesThisWeek = await Class.countDocuments({
            createdAt: { $gte: oneWeekAgo }
        });

        // 4. Activity Metrics
        const loginsToday = await LoginHistory.countDocuments({
            timestamp: { $gte: startOfDay },
            action: 'login',
            success: true
        });

        const activeSessions = await ActiveSession.countDocuments();

        const stats = {
            totalUsers,
            newUsersThisWeek,
            wau,
            retentionRate,
            totalClasses,
            newClassesThisWeek,
            loginsToday,
            activeSessions
        };

        logger.success(`Dashboard metrics: ${wau} WAU, ${retentionRate}% Retention, ${newUsersThisWeek} new users`);
        res.json(stats);
    } catch (error) {
        logger.error('Error fetching dashboard stats:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching dashboard stats' });
    }
};

/**
 * Get All Users with Pagination
 * @route GET /api/admin/users
 * @access Admin only
 */
exports.getAllUsers = async (req, res) => {
    logger.info(`Fetching users list - Page: ${req.query.page || 1}`);

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build query
        let query = {};
        if (search) {
            query = {
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { displayName: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Fetch users
        const users = await User.find(query)
            .select('email displayName photoURL role createdClasses enrolledClasses')
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Get last login for each user
        const usersWithLastLogin = await Promise.all(users.map(async (user) => {
            const lastLogin = await LoginHistory.findOne({
                userId: user._id,
                action: 'login',
                success: true
            }).sort({ timestamp: -1 }).lean();

            return {
                ...user,
                lastLogin: lastLogin ? lastLogin.timestamp : null,
                status: lastLogin && (Date.now() - new Date(lastLogin.timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000
                    ? 'active'
                    : 'inactive'
            };
        }));

        const total = await User.countDocuments(query);

        logger.success(`Fetched ${users.length} users (page ${page})`);
        res.json({
            users: usersWithLastLogin,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                totalItems: total,
                hasNext: skip + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        logger.error('Error fetching users:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching users' });
    }
};

/**
 * Update User
 * @route PUT /api/admin/users/:id
 * @access Admin only
 */
exports.updateUser = async (req, res) => {
    const { id } = req.params;
    logger.info(`Updating user: ${id}`);

    try {
        const { displayName, role } = req.body;

        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (role !== undefined && ['user', 'admin'].includes(role)) updateData.role = role;

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            logger.warn(`User not found: ${id}`);
            return res.status(404).json({ msg: 'User not found' });
        }

        logger.success(`User updated: ${user.email}`);
        res.json({ msg: 'User updated successfully', user });
    } catch (error) {
        logger.error('Error updating user:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error updating user' });
    }
};

/**
 * Delete User
 * @route DELETE /api/admin/users/:id
 * @access Admin only
 */
exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    logger.info(`Deleting user: ${id}`);

    try {
        // Prevent admin from deleting themselves
        if (req.user._id.toString() === id) {
            logger.warn('Admin attempted to delete own account');
            return res.status(400).json({ msg: 'Cannot delete your own admin account' });
        }

        const user = await User.findById(id);
        if (!user) {
            logger.warn(`User not found for deletion: ${id}`);
            return res.status(404).json({ msg: 'User not found' });
        }

        // Delete user's login history
        await LoginHistory.deleteMany({ userId: id });

        // Delete user's active sessions
        await ActiveSession.deleteMany({ userId: id });

        // Delete the user
        await User.findByIdAndDelete(id);

        logger.success(`User deleted: ${user.email}`);
        res.json({ msg: 'User deleted successfully' });
    } catch (error) {
        logger.error('Error deleting user:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error deleting user' });
    }
};

/**
 * Get Weekly Activity Data
 * @route GET /api/admin/activity
 * @access Admin only
 */
exports.getWeeklyActivity = async (req, res) => {
    logger.info('Fetching weekly activity data...');

    try {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date();
        const weekData = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            const nextDate = new Date(date);
            nextDate.setDate(nextDate.getDate() + 1);

            const loginCount = await LoginHistory.countDocuments({
                timestamp: { $gte: date, $lt: nextDate },
                action: 'login',
                success: true
            });

            weekData.push({
                day: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
                logins: loginCount
            });
        }

        logger.success('Weekly activity data fetched');
        res.json({ activity: weekData });
    } catch (error) {
        logger.error('Error fetching weekly activity:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching activity data' });
    }
};

// ==================== CLASSROOM MANAGEMENT ====================

/**
 * Get All Classrooms with Owner Info
 * @route GET /api/admin/classrooms
 * @access Admin only
 */
exports.getAllClassrooms = async (req, res) => {
    logger.info(`Fetching classrooms list - Page: ${req.query.page || 1}`);

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        // Build query
        let query = {};
        if (search) {
            query = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { classCode: { $regex: search, $options: 'i' } },
                    { subname: { $regex: search, $options: 'i' } }
                ]
            };
        }

        // Fetch classrooms with creator info
        const classrooms = await Class.find(query)
            .populate('creator', 'email displayName photoURL')
            .select('name subname classCode color isPublic allowSelfJoin creator participants createdAt')
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Transform data to include owner and participant count
        const classroomsWithInfo = classrooms.map(classroom => ({
            ...classroom,
            owner: classroom.creator && classroom.creator.length > 0 ? classroom.creator[0] : null,
            participantCount: classroom.participants ? classroom.participants.length : 0,
            creatorCount: classroom.creator ? classroom.creator.length : 0
        }));

        const total = await Class.countDocuments(query);

        logger.success(`Fetched ${classrooms.length} classrooms (page ${page})`);
        res.json({
            classrooms: classroomsWithInfo,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                totalItems: total,
                hasNext: skip + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        logger.error('Error fetching classrooms:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching classrooms' });
    }
};

/**
 * Update Classroom
 * @route PUT /api/admin/classrooms/:id
 * @access Admin only
 */
exports.updateClassroom = async (req, res) => {
    const { id } = req.params;
    logger.info(`Updating classroom: ${id}`);

    try {
        const { name, subname, color, isPublic, allowSelfJoin } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (subname !== undefined) updateData.subname = subname;
        if (color !== undefined) updateData.color = color;
        if (isPublic !== undefined) updateData.isPublic = isPublic;
        if (allowSelfJoin !== undefined) updateData.allowSelfJoin = allowSelfJoin;

        const classroom = await Class.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true, runValidators: true }
        ).populate('creator', 'email displayName');

        if (!classroom) {
            logger.warn(`Classroom not found: ${id}`);
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        logger.success(`Classroom updated: ${classroom.name}`);
        res.json({ msg: 'Classroom updated successfully', classroom });
    } catch (error) {
        logger.error('Error updating classroom:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error updating classroom' });
    }
};

/**
 * Delete Classroom
 * @route DELETE /api/admin/classrooms/:id
 * @access Admin only
 */
exports.deleteClassroom = async (req, res) => {
    const { id } = req.params;
    logger.info(`Deleting classroom: ${id}`);

    try {
        const classroom = await Class.findById(id);
        if (!classroom) {
            logger.warn(`Classroom not found for deletion: ${id}`);
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // Remove classroom reference from users' createdClasses and enrolledClasses
        await User.updateMany(
            { createdClasses: id },
            { $pull: { createdClasses: id } }
        );
        await User.updateMany(
            { enrolledClasses: id },
            { $pull: { enrolledClasses: id } }
        );
        await User.updateMany(
            { pinnedClasses: id },
            { $pull: { pinnedClasses: id } }
        );

        // Delete the classroom
        await Class.findByIdAndDelete(id);

        logger.success(`Classroom deleted: ${classroom.name}`);
        res.json({ msg: 'Classroom deleted successfully' });
    } catch (error) {
        logger.error('Error deleting classroom:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error deleting classroom' });
    }
};

// ==================== ACTIVITY LOGS ====================

/**
 * Get All Login History (Activity Logs)
 * @route GET /api/admin/logs
 * @access Admin only
 */
exports.getAllLogs = async (req, res) => {
    logger.info(`Fetching activity logs - Page: ${req.query.page || 1}`);

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const action = req.query.action || '';
        const success = req.query.success;

        // Build query
        let query = {};
        if (action) {
            query.action = action;
        }
        if (success !== undefined && success !== '') {
            query.success = success === 'true';
        }

        // Fetch logs with user info
        const logs = await LoginHistory.find(query)
            .populate('userId', 'email displayName photoURL')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Transform data
        const logsWithUser = logs.map(log => ({
            ...log,
            user: log.userId || { email: 'Unknown', displayName: 'Unknown User' }
        }));

        const total = await LoginHistory.countDocuments(query);

        logger.success(`Fetched ${logs.length} logs (page ${page})`);
        res.json({
            logs: logsWithUser,
            pagination: {
                current: page,
                total: Math.ceil(total / limit),
                totalItems: total,
                hasNext: skip + limit < total,
                hasPrev: page > 1
            }
        });
    } catch (error) {
        logger.error('Error fetching logs:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching logs' });
    }
};

// ==================== SYSTEM LOGS ====================

/**
 * Get System Logs
 * @route GET /api/admin/system-logs
 * @access Admin only
 */
exports.getSystemLogs = async (req, res) => {
    logger.info('Fetching system logs...');

    try {
        // Use local date for log filename (offset for timezone)
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localDate = new Date(now.getTime() - offset);
        const today = localDate.toISOString().slice(0, 10);

        const logFileName = `combined-${today}.log`;
        const logFilePath = path.join(__dirname, '../logs', logFileName);

        if (!fs.existsSync(logFilePath)) {
            logger.warn(`Log file not found: ${logFileName}`);
            return res.json({ logs: [] });
        }

        // Read file content
        const fileContent = fs.readFileSync(logFilePath, 'utf8');

        // Parse logs (assuming JSON format per line based on logger config)
        const logs = fileContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch (e) {
                    return null; // Skip invalid lines
                }
            })
            .filter(log => log !== null)
            .reverse() // Newest first
            .slice(0, 1000); // Limit to last 1000 lines

        logger.success(`Fetched ${logs.length} log entries`);
        res.json({ logs });
    } catch (error) {
        logger.error('Error fetching system logs:', { message: error.message, stack: error.stack });
        res.status(500).json({ msg: 'Server error fetching logs' });
    }
};

// ==================== SYSTEM SETTINGS ====================

/**
 * Get System Settings
 * @route GET /api/admin/system-settings
 * @access Admin only
 */
exports.getSystemSettings = async (req, res) => {
    logger.info('Fetching system settings...');
    try {
        const settings = await SystemSettings.getSettings();
        res.set('Cache-Control', 'no-store');
        res.json({ settings });
    } catch (error) {
        logger.error('Error fetching settings:', error);
        res.status(500).json({ msg: 'Server error fetching settings' });
    }
};

/**
 * Update System Settings
 * @route PUT /api/admin/system-settings
 * @access Admin only
 */
exports.updateSystemSettings = async (req, res) => {
    logger.info('Updating system settings via Atomic Update...');
    try {
        const { email, site, security } = req.body;
        console.log('[DEBUG] Atomic Update Payload:', JSON.stringify(req.body, null, 2));

        const updateOps = { $set: { updatedAt: Date.now() } };

        // Build atomic $set object
        if (email) {
            if (email.user !== undefined) updateOps.$set['email.user'] = email.user;
            if (email.pass !== undefined) updateOps.$set['email.pass'] = email.pass;
            if (email.service !== undefined) updateOps.$set['email.service'] = email.service;
            if (email.enabled !== undefined) updateOps.$set['email.enabled'] = email.enabled;
        }

        if (site) {
            if (site.name !== undefined) updateOps.$set['site.name'] = site.name;
            if (site.maintenanceMode !== undefined) updateOps.$set['site.maintenanceMode'] = site.maintenanceMode;
            if (site.maintenanceMessage !== undefined) updateOps.$set['site.maintenanceMessage'] = site.maintenanceMessage;
        }

        if (security) {
            if (security.allowRegistration !== undefined) updateOps.$set['security.allowRegistration'] = security.allowRegistration;
            if (security.sessionTimeout !== undefined) updateOps.$set['security.sessionTimeout'] = security.sessionTimeout;
        }

        const settings = await SystemSettings.findOneAndUpdate(
            { key: 'general' },
            updateOps,
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const { delCache } = require('../utils/cache');
        await delCache('system_settings:general');

        logger.success('System settings updated atomically');
        res.json({ msg: 'Settings updated successfully', settings });
    } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({ msg: 'Server error updating settings' });
    }
};

