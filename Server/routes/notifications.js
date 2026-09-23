const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const { getCache, setCache, delCache } = require('../utils/cache');
const createLogger = require('../utils/logger');
const logger = createLogger('Notifications');

// @route   GET /api/notifications
// @desc    Get user's notifications (limit 50, sorted by date DESC) with Redis caching
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const cacheKey = `notifications:${req.user.id}`;
        const cached = await getCache(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        // Cache for 30 seconds
        await setCache(cacheKey, notifications, 30);
        res.json(notifications);
    } catch (err) {
        logger.error('Error fetching notifications:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found or unauthorized' });
        }

        await delCache(`notifications:${req.user.id}`);
        res.json(notification);
    } catch (err) {
        logger.error('Error updating notification read status:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/notifications/read-all
// @desc    Mark all user notifications as read
// @access  Private
router.put('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, isRead: false },
            { $set: { isRead: true } }
        );

        await delCache(`notifications:${req.user.id}`);
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        logger.error('Error marking all notifications as read:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
