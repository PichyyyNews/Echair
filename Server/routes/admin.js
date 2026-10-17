const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const createLogger = require('../utils/logger');
const logger = createLogger('Admin Routes');

// All admin routes protected by strict adminMiddleware (handles JWT + role + email check → 404 on any failure)
const adminAuth = [adminMiddleware];

// Dashboard Stats
router.get('/stats', adminAuth, adminController.getDashboardStats);

// Weekly Activity
router.get('/activity', adminAuth, adminController.getWeeklyActivity);

// User Management
router.get('/users', adminAuth, adminController.getAllUsers);
router.put('/users/:id', adminAuth, adminController.updateUser);
router.delete('/users/:id', adminAuth, adminController.deleteUser);

// Classroom Management
router.get('/classrooms', adminAuth, adminController.getAllClassrooms);
router.put('/classrooms/:id', adminAuth, adminController.updateClassroom);
router.delete('/classrooms/:id', adminAuth, adminController.deleteClassroom);

// Activity Logs
router.get('/logs', adminAuth, adminController.getAllLogs);

// System Logs
router.get('/system-logs', adminAuth, adminController.getSystemLogs);

// System Settings (Dynamic Config)
router.get('/system-settings', adminAuth, adminController.getSystemSettings);
router.put('/system-settings', adminAuth, adminController.updateSystemSettings);

logger.info('Admin routes registered');

module.exports = router;

