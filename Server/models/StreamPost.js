const mongoose = require('mongoose');

const streamPostSchema = new mongoose.Schema({
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    type: {
        type: String,
        enum: ['announcement', 'assignment'],
        default: 'announcement'
    },
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        default: null
    },
    assignmentMeta: {
        points: Number,
        dueDate: Date
    },
    attachments: [{
        type: { type: String, enum: ['link', 'file', 'image'], required: true },
        url: { type: String, required: true },
        name: { type: String }
    }],
    comments: [{
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound indexes for stream posts per class ordered by date
streamPostSchema.index({ classId: 1, createdAt: -1 });
streamPostSchema.index({ author: 1 });

module.exports = mongoose.model('StreamPost', streamPostSchema);
