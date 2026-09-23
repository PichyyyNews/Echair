const jwt = require('jsonwebtoken');
const User = require('../models/User');
const createLogger = require('../utils/logger');
const logger = createLogger('Auth Middleware');

const authMiddleware = async (req, res, next) => {
    const token = req.header('x-auth-token');
    if (!token) {
        logger.warn(`Authentication failed: No token provided for ${req.method} ${req.originalUrl}`);
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        if (!user) {
            logger.warn(`Authentication failed: User not found (${decoded.user.id})`);
            return res.status(404).json({ msg: 'User not found' });
        }
        if (user.isSuspended) {
            logger.warn(`Authentication blocked: User account is suspended (${user.email})`);
            return res.status(403).json({ msg: 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ' });
        }
        req.user = user;
        logger.auth('Authenticated', user.email, 'success');
        next();
    } catch (err) {
        logger.error(`Token validation failed: ${err.message}`);
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
