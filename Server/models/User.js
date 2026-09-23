const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, select: false },
    displayName: { type: String },
    photoURL: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    isSuspended: { type: Boolean, default: false, index: true },
    uid: { type: String, unique: true, sparse: true, default: null },
    createdClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    enrolledClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    pinnedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Class' }],
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorCode: { type: String, select: false },
    twoFactorExpires: { type: Date, select: false },
    loginOtpCode: { type: String, select: false },
    loginOtpExpires: { type: Date, select: false }
});

module.exports = mongoose.model('User', userSchema);
