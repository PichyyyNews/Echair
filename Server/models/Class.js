const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    name: { type: String, required: true },
    subname: { type: String, default: 'General' },
    imageUrl: { type: String },
    bannerUrl: { type: String },
    color: { type: String, default: '#4CAF50' },
    classCode: { type: String, required: true, unique: true },
    creator: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isPublic: { type: Boolean, default: false },
    allowSelfJoin: { type: Boolean, default: true },
    seatingPositions: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    assignedUsers: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    studentScores: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    rows: { type: Number, default: 0 },
    cols: { type: Number, default: 0 },
    chairGroups: { type: mongoose.Schema.Types.Mixed, default: [] },
    attendance: { type: mongoose.Schema.Types.Mixed, default: {} },
    attendanceDays: { type: Number, default: 20 },
    showStudentStatus: { type: Boolean, default: false },
    showScoreBar: { type: Boolean, default: false },
    chatMessages: {
        type: [{
            senderId: { type: String, required: true },
            senderName: { type: String, required: true },
            senderPhoto: { type: String },
            message: { type: String, required: true },
            timestamp: { type: Number, required: true }
        }],
        default: [] // ✨ CRITICAL: Default empty array so existing classrooms work
    },
    classroomEvents: {
        type: [{
            id: { type: String }, // Client generated ID or UUID
            title: { type: String },
            description: { type: String },
            type: { type: String, default: 'default' },
            config: { type: mongoose.Schema.Types.Mixed }, // Store event config
            results: { type: mongoose.Schema.Types.Mixed }, // Store results
            status: { type: String, default: 'idle' },
            startTime: { type: Number },
            createdAt: { type: Number },
            updatedAt: { type: Number }
        }],
        default: []
    },
    eventHistory: {
        type: [{
            id: { type: String },
            title: { type: String },
            description: { type: String },
            type: { type: String },
            config: { type: mongoose.Schema.Types.Mixed },
            results: { type: mongoose.Schema.Types.Mixed },
            status: { type: String },
            startTime: { type: Number },
            createdAt: { type: Number },
            updatedAt: { type: Number },
            deletedAt: { type: Number }
        }],
        default: []
    }
});

// Compound and single indexes for fast lookups
classSchema.index({ creator: 1 });
classSchema.index({ participants: 1 });
classSchema.index({ isPublic: 1 });
classSchema.index({ creator: 1, isPublic: 1 });

module.exports = mongoose.model('Class', classSchema);
