const Notification = require('../models/Notification');
const { delCache } = require('./cache');
const logger = require('./logger')('NotificationHelper');

/**
 * Creates a notification in the database and emits it via socket.io
 * 
 * @param {Object} io - Socket.io instance
 * @param {String} userId - Recipient user ID
 * @param {String} title - Notification title
 * @param {String} message - Notification message
 * @param {String} type - Notification type (e.g., 'system', 'class_join', 'score')
 * @param {String} relatedId - Optional related ID (classId, eventId)
 */
const createAndSendNotification = async (io, userId, title, message, type = 'system', relatedId = null) => {
    try {
        if (!userId) {
            logger.warn('Missing userId for notification:', title);
            return null;
        }

        const notification = new Notification({
            userId,
            title,
            message,
            type,
            relatedId
        });

        await notification.save();
        await delCache(`notifications:${userId}`);

        // Emit to specific user if online
        if (io) {
            // We assume clients join a room with their userId when they connect or login
            io.to(userId.toString()).emit('new-notification', notification);
            logger.debug(`Emitted new-notification to user ${userId}`);
        } else {
            logger.warn('Socket.io instance not provided to emit notification');
        }

        return notification;
    } catch (err) {
        logger.error('Error creating notification:', err.message);
        return null;
    }
};

module.exports = {
    createAndSendNotification
};
