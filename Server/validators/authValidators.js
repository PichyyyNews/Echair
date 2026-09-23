const { z } = require('zod');

const loginSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    otpCode: z.string().optional(),
    rememberMe: z.boolean().optional(),
});

const registerSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    displayName: z.string().trim().min(1, 'Display name cannot be empty').optional(),
});

const forgotPasswordSchema = z.object({
    email: z.string().trim().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters long'),
});

module.exports = {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
};
