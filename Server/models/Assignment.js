const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    dueDate: {
        type: Date,
        required: false
    },
    points: {
        type: Number,
        default: 100
    },
    allowLateSubmission: {
        type: Boolean,
        default: false
    },
    showScoreToStudents: {
        type: Boolean,
        default: true
    },
    attachments: [{
        type: { type: String, enum: ['file', 'link', 'image'], default: 'file' },
        url: { type: String },
        filename: { type: String },
        mimetype: { type: String }
    }],
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound indexes for classwork lookups
assignmentSchema.index({ classId: 1, createdAt: -1 });
assignmentSchema.index({ creator: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
