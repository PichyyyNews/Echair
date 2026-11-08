const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    sender: {
        id: { type: String, required: true },
        displayName: { type: String },
        email: { type: String },
        photoURL: { type: String },
        role: { type: String, default: 'user' }
    },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const notificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    sender: {
        id: { type: String },
        displayName: { type: String },
        email: { type: String },
        photoURL: { type: String },
        role: { type: String, default: 'user' }
    },
    recipient: {
        id: { type: String },
        displayName: { type: String },
        email: { type: String },
        photoURL: { type: String }
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
        enum: ['system', 'class_join', 'class_leave', 'score', 'event', 'login', 'class_update', 'message', 'ticket'],
        default: 'system',
        index: true
    },
    category: {
        type: String,
        default: 'general'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'urgent'],
        default: 'normal'
    },
    ticketStatus: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open'
    },
    isTicket: {
        type: Boolean,
        default: false,
        index: true
    },
    replies: [replySchema],
    isRead: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: String // e.g. classId or eventId 
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

// Compound index for fast user notification lookups and unread queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
