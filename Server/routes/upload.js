const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/authMiddleware');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { saveUploadedFile } = require('../utils/storage');
const createLogger = require('../utils/logger');
const logger = createLogger('UploadRoute');

// Use memory storage so we can process with Sharp and upload to MinIO/S3/Local
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

const uploadFields = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'image', maxCount: 1 }
]);

const getUploadedFile = (req) => {
    if (!req.files) return null;
    return req.files.file?.[0] || req.files.image?.[0] || null;
};

// @route   POST /api/upload
// @desc    Upload a file with auth check, rate limiting, and S3/MinIO/Local storage + Sharp image optimization
// @access  Private (Authenticated users only)
router.post('/', uploadLimiter, authMiddleware, (req, res) => {
    uploadFields(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            logger.warn(`Multer error: ${err.message}`);
            return res.status(400).json({ msg: err.message });
        }

        if (err) {
            logger.error(`Upload error: ${err.message || err}`);
            return res.status(400).json({ msg: typeof err === 'string' ? err : 'Upload failed' });
        }

        const uploadedFile = getUploadedFile(req);
        if (!uploadedFile) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        try {
            const folder = req.body.folder || 'stream';
            const uploadType = req.body.type || 'general';

            const result = await saveUploadedFile({
                buffer: uploadedFile.buffer,
                originalname: uploadedFile.originalname,
                mimetype: uploadedFile.mimetype,
                folder,
                optimize: true,
                type: uploadType
            });

            logger.success(`File successfully stored: ${result.filename} (${result.storage}) by ${req.user?.email}`);

            res.json({
                msg: 'File uploaded successfully',
                url: result.url,
                filename: result.filename,
                originalname: result.originalname,
                mimetype: result.mimetype,
                size: result.size
            });
        } catch (saveErr) {
            logger.error(`File save error: ${saveErr.message}`);
            res.status(500).json({ msg: 'Failed to process and store file' });
        }
    });
});

module.exports = router;
