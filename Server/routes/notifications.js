const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Class = require('../models/Class');
const { getCache, setCache, delCache } = require('../utils/cache');
const createLogger = require('../utils/logger');
const logger = createLogger('Notifications');

// Helper to safely invalidate caches
const invalidateUserCache = async (userId) => {
    if (!userId) return;
    try {
        await delCache(`notifications:${userId}`);
    } catch (e) {
        // Cache miss or Redis down is safe to ignore
    }
};

// @route   GET /api/notifications
// @desc    Get user's notifications and messages with tab filters, search, and unread counts
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { tab = 'all', unreadOnly, search, limit = 100 } = req.query;
        const currentUserId = req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        let query = {};

        if (tab === 'tickets') {
            // If admin, show all support tickets across the platform so admin can handle support!
            // If normal user, show tickets they created or where they are recipient
            if (isAdmin) {
                query = { type: 'ticket' };
            } else {
                query = {
                    type: 'ticket',
                    $or: [
                        { userId: currentUserId },
                        { 'sender.id': currentUserId }
                    ]
                };
            }
        } else if (tab === 'messages') {
            // Direct letters/messages sent to user or from user
            query = {
                type: 'message',
                $or: [
                    { userId: currentUserId },
                    { 'sender.id': currentUserId }
                ]
            };
        } else if (tab === 'sent') {
            query = {
                'sender.id': currentUserId,
                type: { $in: ['message', 'ticket'] }
            };
        } else if (tab === 'system') {
            query = {
                userId: currentUserId,
                type: { $in: ['system', 'class_join', 'class_leave', 'score', 'event', 'login', 'class_update'] }
            };
        } else {
            // Tab 'all'
            if (isAdmin) {
                // Admin sees their own notifications + all support tickets
                query = {
                    $or: [
                        { userId: currentUserId },
                        { 'sender.id': currentUserId },
                        { type: 'ticket' }
                    ]
                };
            } else {
                query = {
                    $or: [
                        { userId: { $in: [currentUserId, req.user._id, req.user.id] } },
                        { 'sender.id': currentUserId, type: { $in: ['message', 'ticket'] } }
                    ]
                };
            }
        }

        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            query.$and = (query.$and || []).concat([{
                $or: [
                    { title: regex },
                    { message: regex },
                    { 'sender.displayName': regex },
                    { 'recipient.displayName': regex }
                ]
            }]);
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit, 10) || 100);

        // Calculate unread & ticket counts for sidebar badges
        const unreadCount = await Notification.countDocuments({
            userId: currentUserId,
            isRead: false
        });

        let ticketCount = 0;
        if (isAdmin) {
            ticketCount = await Notification.countDocuments({
                type: 'ticket',
                ticketStatus: { $in: ['open', 'in_progress'] }
            });
        } else {
            ticketCount = await Notification.countDocuments({
                type: 'ticket',
                $or: [{ userId: currentUserId }, { 'sender.id': currentUserId }],
                ticketStatus: { $in: ['open', 'in_progress'] }
            });
        }

        if (req.query.summary === 'true') {
            return res.json({
                notifications,
                unreadCount,
                ticketCount
            });
        }

        // Return raw array by default for 100% backward compatibility with Navbar and legacy callers
        res.json(notifications);
    } catch (err) {
        logger.error('Error fetching notifications:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   GET /api/notifications/recipients
// @desc    Find recipients for composing messages (students, teachers, classmates)
// @access  Private
router.get('/recipients', auth, async (req, res) => {
    try {
        const { q = '' } = req.query;
        const currentUserId = req.user._id;

        let query = {
            _id: { $ne: currentUserId },
            isSuspended: { $ne: true }
        };

        if (q && q.trim()) {
            const regex = new RegExp(q.trim(), 'i');
            query.$or = [
                { displayName: regex },
                { email: regex }
            ];
        }

        const users = await User.find(query)
            .select('_id displayName email photoURL role')
            .limit(30)
            .lean();

        const formatted = users.map(u => ({
            id: u._id.toString(),
            displayName: u.displayName || u.email.split('@')[0],
            email: u.email,
            photoURL: u.photoURL || '',
            role: u.role || 'user'
        }));

        res.json(formatted);
    } catch (err) {
        logger.error('Error searching recipients:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

// @route   POST /api/notifications/send-message
// @desc    Send a direct message/letter to another user
// @access  Private
router.post('/send-message', auth, async (req, res) => {
    try {
        const { recipientId, title, message, priority = 'normal' } = req.body;

        if (!recipientId || !title?.trim() || !message?.trim()) {
            return res.status(400).json({ msg: 'Recipient, title, and message are required' });
        }

        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ msg: 'Recipient user not found' });
        }

        const notification = new Notification({
            userId: recipient._id.toString(),
            sender: {
                id: req.user._id.toString(),
                displayName: req.user.displayName || req.user.email.split('@')[0],
                email: req.user.email,
                photoURL: req.user.photoURL || '',
                role: req.user.role || 'user'
            },
            recipient: {
                id: recipient._id.toString(),
                displayName: recipient.displayName || recipient.email.split('@')[0],
                email: recipient.email,
                photoURL: recipient.photoURL || ''
            },
            title: title.trim(),
            message: message.trim(),
            type: 'message',
            priority: ['low', 'normal', 'urgent'].includes(priority) ? priority : 'normal',
            isRead: false
        });

        await notification.save();
        await invalidateUserCache(recipient._id.toString());
        await invalidateUserCache(req.user._id.toString());

        // Emit via Socket.io
        if (req.io) {
            req.io.to(recipient._id.toString()).emit('new-notification', notification);
            logger.info(`Emitted direct message to user ${recipient._id}`);
        }

        res.status(201).json({ success: true, notification });
    } catch (err) {
        logger.error('Error sending direct message:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   POST /api/notifications/create-ticket
// @desc    Open a support ticket to platform administrators
// @access  Private
router.post('/create-ticket', auth, async (req, res) => {
    try {
        const { title, message, category = 'general', priority = 'normal' } = req.body;

        if (!title?.trim() || !message?.trim()) {
            return res.status(400).json({ msg: 'Title and message are required for support ticket' });
        }

        const ticket = new Notification({
            userId: req.user._id.toString(),
            sender: {
                id: req.user._id.toString(),
                displayName: req.user.displayName || req.user.email.split('@')[0],
                email: req.user.email,
                photoURL: req.user.photoURL || '',
                role: req.user.role || 'user'
            },
            title: title.trim(),
            message: message.trim(),
            type: 'ticket',
            isTicket: true,
            category: category || 'general',
            priority: ['low', 'normal', 'urgent'].includes(priority) ? priority : 'normal',
            ticketStatus: 'open',
            isRead: true // Author already read their own created ticket
        });

        await ticket.save();
        await invalidateUserCache(req.user._id.toString());

        // Notify Admins
        if (req.io) {
            req.io.to('admins').emit('new-notification', ticket);
            req.io.to('admins').emit('new-ticket', ticket);
            logger.info(`Emitted support ticket #${ticket._id} to admin room`);
        }

        // Also notify individual admins in DB
        const admins = await User.find({ role: 'admin' }).select('_id');
        for (const admin of admins) {
            if (req.io) {
                req.io.to(admin._id.toString()).emit('new-notification', ticket);
            }
            await invalidateUserCache(admin._id.toString());
        }

        res.status(201).json({ success: true, ticket });
    } catch (err) {
        logger.error('Error creating support ticket:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   POST /api/notifications/:id/reply
// @desc    Add a reply message to a letter or support ticket thread
// @access  Private
router.post('/:id/reply', auth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ msg: 'Reply message cannot be empty' });
        }

        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ msg: 'Notification or thread not found' });
        }

        const currentUserId = req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        const isRecipient = notification.userId === currentUserId || notification.recipient?.id === currentUserId;
        const isSender = notification.sender?.id === currentUserId;

        if (!isAdmin && !isRecipient && !isSender) {
            return res.status(403).json({ msg: 'Unauthorized to reply to this thread' });
        }

        const newReply = {
            sender: {
                id: currentUserId,
                displayName: req.user.displayName || req.user.email.split('@')[0],
                email: req.user.email,
                photoURL: req.user.photoURL || '',
                role: req.user.role || 'user'
            },
            message: message.trim(),
            createdAt: new Date()
        };

        notification.replies.push(newReply);

        // If it's a ticket and admin replies, auto update status to 'in_progress' if currently 'open'
        if (notification.type === 'ticket' && isAdmin && notification.ticketStatus === 'open') {
            notification.ticketStatus = 'in_progress';
        }

        // Mark as unread for the counterpart
        notification.isRead = false;
        await notification.save();

        // Emit real-time notification
        if (req.io) {
            // Determine who to notify
            const counterpartId = isSender ? (notification.recipient?.id || notification.userId) : notification.sender?.id;
            if (counterpartId) {
                req.io.to(counterpartId.toString()).emit('new-notification', notification);
                req.io.to(counterpartId.toString()).emit('notification-reply', {
                    notificationId: notification._id,
                    reply: newReply
                });
                await invalidateUserCache(counterpartId.toString());
            }

            if (notification.type === 'ticket') {
                req.io.to('admins').emit('new-notification', notification);
            }
        }

        res.json({ success: true, notification });
    } catch (err) {
        logger.error('Error replying to notification:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   PUT /api/notifications/:id/ticket-status
// @desc    Update support ticket status (open, in_progress, resolved, closed)
// @access  Private
router.put('/:id/ticket-status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({ msg: 'Invalid ticket status' });
        }

        const notification = await Notification.findById(req.params.id);
        if (!notification || notification.type !== 'ticket') {
            return res.status(404).json({ msg: 'Ticket not found' });
        }

        const currentUserId = req.user._id.toString();
        const isAdmin = req.user.role === 'admin';
        const isOwner = notification.userId === currentUserId || notification.sender?.id === currentUserId;

        if (!isAdmin && !isOwner) {
            return res.status(403).json({ msg: 'Unauthorized to change ticket status' });
        }

        notification.ticketStatus = status;
        await notification.save();

        if (req.io) {
            req.io.to(notification.userId.toString()).emit('new-notification', notification);
            if (notification.sender?.id) {
                req.io.to(notification.sender.id.toString()).emit('new-notification', notification);
            }
            req.io.to('admins').emit('ticket-updated', notification);
        }

        res.json({ success: true, notification });
    } catch (err) {
        logger.error('Error updating ticket status:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                $or: [
                    { userId: currentUserId },
                    { 'sender.id': currentUserId }
                ]
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found or unauthorized' });
        }

        await invalidateUserCache(currentUserId);
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
        const currentUserId = req.user._id.toString();
        await Notification.updateMany(
            { userId: currentUserId, isRead: false },
            { $set: { isRead: true } }
        );

        await invalidateUserCache(currentUserId);
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        logger.error('Error marking all notifications as read:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification or message
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const currentUserId = req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        const filter = isAdmin
            ? { _id: req.params.id }
            : {
                _id: req.params.id,
                $or: [
                    { userId: currentUserId },
                    { 'sender.id': currentUserId }
                ]
            };

        const deleted = await Notification.findOneAndDelete(filter);
        if (!deleted) {
            return res.status(404).json({ msg: 'Notification not found or unauthorized' });
        }

        await invalidateUserCache(currentUserId);
        res.json({ success: true, msg: 'Notification deleted successfully' });
    } catch (err) {
        logger.error('Error deleting notification:', err.message);
        res.status(500).json({ msg: 'Server Error' });
    }
});

module.exports = router;
