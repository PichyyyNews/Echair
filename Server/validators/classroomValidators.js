const { z } = require('zod');

const createClassSchema = z.object({
    name: z.string().trim().min(1, 'Classroom name is required'),
    subname: z.string().optional(),
    imageUrl: z.string().optional(),
    color: z.string().optional(),
    rows: z.number().int().min(0).optional(),
    cols: z.number().int().min(0).optional(),
    seatingPositions: z.any().optional(),
});

const joinClassSchema = z.object({
    classCode: z.string().trim().min(4, 'Classroom code must be at least 4 characters long'),
});

const updateSeatingSchema = z.object({
    seatingPositions: z.any().optional(),
    assignedUsers: z.any().optional(),
    studentScores: z.any().optional(),
    chairGroups: z.any().optional(),
});

module.exports = {
    createClassSchema,
    joinClassSchema,
    updateSeatingSchema,
};
