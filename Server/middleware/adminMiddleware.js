const jwt = require('jsonwebtoken');
const User = require('../models/User');
const createLogger = require('../utils/logger');
const logger = createLogger('Admin Middleware');

/**
 * Strict Admin Middleware
 * - Verifies JWT token independently
 * - Checks role === 'admin'
 * - Checks email is in the authorized admin list
 * - Returns 404 (not 401/403) for ANY unauthorized access to mask endpoint existence
 */
const adminMiddleware = async (req, res, next) => {
    // ---- Authorized admin emails (hardcoded + env) ----
    const HARDCODED_ADMIN = 'newskung43@gmail.com';
    const envEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    const authorizedEmails = new Set([HARDCODED_ADMIN, ...envEmails]);

    // ---- Extract token ----
    const token = req.header('x-auth-token') ||
        (req.headers.authorization || '').replace(/^Bearer\s+/, '');

    if (!token) {
        logger.warn(`Admin access denied: No token for ${req.method} ${req.originalUrl}`);
        return res.status(404).json({ msg: 'Not found' });
    }

    try {
        // ---- Verify JWT ----
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id || decoded.userId).select('email role isSuspended displayName');

        if (!user) {
            logger.warn(`Admin access denied: User not found in DB for ${req.method} ${req.originalUrl}`);
            return res.status(404).json({ msg: 'Not found' });
        }

        if (user.isSuspended) {
            logger.warn(`Admin access denied: Suspended user ${user.email}`);
            return res.status(404).json({ msg: 'Not found' });
        }

        if (user.role !== 'admin') {
            logger.warn(`Admin access denied: User ${user.email} role=${user.role} attempted ${req.originalUrl}`);
            return res.status(404).json({ msg: 'Not found' });
        }

        const userEmail = (user.email || '').trim().toLowerCase();
        if (!authorizedEmails.has(userEmail)) {
            logger.warn(`Admin access denied: Email ${user.email} not in authorized list`);
            return res.status(404).json({ msg: 'Not found' });
        }

        // ---- Authorized ----
        req.user = user;
        logger.auth('Admin access granted', user.email, 'success');
        next();

    } catch (err) {
        logger.warn(`Admin access denied: Invalid token — ${err.message}`);
        return res.status(404).json({ msg: 'Not found' });
    }
};

module.exports = adminMiddleware;
