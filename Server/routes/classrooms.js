const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const userController = require('../controllers/userController'); // For toggle-pin
const authMiddleware = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { createClassSchema, joinClassSchema, updateSeatingSchema } = require('../validators/classroomValidators');

router.get('/', authMiddleware, classController.getClassrooms);
router.post('/create', authMiddleware, validate(createClassSchema), classController.createClassroom);
router.post('/join', authMiddleware, validate(joinClassSchema), classController.joinClassroom);
router.get('/:id', authMiddleware, classController.getClassroom);
router.put('/:classId/seating', authMiddleware, validate(updateSeatingSchema), classController.updateSeating);
router.post('/:classId/leave', authMiddleware, classController.leaveClassroom);
router.put('/:classId/kick', authMiddleware, classController.kickUser);
router.put('/:classId/promote', authMiddleware, classController.promoteUser);
router.put('/:classId/demote', authMiddleware, classController.demoteUser);
router.put('/:classId/theme', authMiddleware, classController.updateTheme);
router.put('/:classId/settings', authMiddleware, classController.updateSettings);
router.put('/:classId/attendance', authMiddleware, classController.updateAttendance);
router.get('/:classId/chat', authMiddleware, classController.getChatHistory);

// Toggle pin route is technically under /api/classrooms/:classId/toggle-pin
router.post('/:classId/toggle-pin', authMiddleware, userController.togglePinClass);

// Teaching Session routes
router.post('/:classId/session/start', authMiddleware, classController.startSession);
router.post('/:classId/session/end', authMiddleware, classController.endSession);
router.get('/:classId/sessions', authMiddleware, classController.getSessions);

module.exports = router;
