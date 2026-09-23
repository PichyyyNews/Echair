const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['system', 'class_join', 'class_leave', 'score', 'event', 'login', 'class_update'],
        default: 'system'
    },
    isRead: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: String // e.g. classId or eventId 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for fast user notification lookups and unread queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
