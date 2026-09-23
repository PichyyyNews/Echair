const multer = require('multer');
const path = require('path');
const createLogger = require('../utils/logger');
const logger = createLogger('Upload');

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for avatar
    fileFilter: function (req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            logger.success(`File validation passed: ${file.originalname} (${file.mimetype})`);
            return cb(null, true);
        }
        logger.error(`File validation failed: ${file.originalname} (${file.mimetype})`);
        cb(new Error("File upload only supports images: jpeg, jpg, png, gif, webp"));
    }
}).single('profileImage');

module.exports = upload;
