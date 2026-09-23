const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    attachments: [{
        url: String,
        filename: String,
        fileType: String
    }],
    status: {
        type: String,
        enum: ['submitted', 'late', 'graded'],
        default: 'submitted'
    },
    pointsAwarded: {
        type: Number
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound indexes for submissions lookup and student submissions query
assignmentSubmissionSchema.index({ assignmentId: 1, studentId: 1 });
assignmentSubmissionSchema.index({ studentId: 1, submittedAt: -1 });

module.exports = mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);
