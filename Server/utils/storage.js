const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { s3Client, isS3Enabled, S3_BUCKET_NAME, S3_ENDPOINT, S3_PUBLIC_URL, UPLOADS_DIR } = require('../config/storage');
const createLogger = require('./logger');
const logger = createLogger('StorageUtil');

const isImageMimetype = (mimetype) => {
    return /^image\/(jpeg|jpg|png|webp|gif|avif)$/i.test(mimetype);
};

/**
 * Optimize image using Sharp
 * @param {Buffer} buffer 
 * @param {Object} options 
 * @returns {Promise<{ buffer: Buffer, mimetype: string, extension: string }>}
 */
const optimizeImage = async (buffer, { type = 'general', quality = 85 } = {}) => {
    try {
        let pipeline = sharp(buffer);
        let extension = 'webp';
        let mimetype = 'image/webp';

        if (type === 'avatar') {
            pipeline = pipeline
                .resize(256, 256, { fit: 'cover', position: 'center' })
                .webp({ quality: 85 });
        } else if (type === 'banner') {
            pipeline = pipeline
                .resize({ width: 1920, withoutEnlargement: true })
                .webp({ quality: 80 });
        } else {
            pipeline = pipeline
                .resize({ width: 2048, withoutEnlargement: true })
                .webp({ quality });
        }

        const optimizedBuffer = await pipeline.toBuffer();
        return {
            buffer: optimizedBuffer,
            mimetype,
            extension
        };
    } catch (err) {
        logger.warn(`Sharp image optimization skipped: ${err.message}`);
        return null;
    }
};

/**
 * Save uploaded file to S3/MinIO or Local Storage
 * @param {Object} params
 * @param {Buffer} params.buffer
 * @param {string} params.originalname
 * @param {string} params.mimetype
 * @param {string} [params.folder] Subdirectory / prefix (e.g. 'profile_photos', 'banners')
 * @param {boolean} [params.optimize] Whether to auto-optimize images with Sharp
 * @param {string} [params.type] 'avatar' | 'banner' | 'general'
 * @returns {Promise<{ url: string, filename: string, originalname: string, mimetype: string, size: number }>}
 */
const saveUploadedFile = async ({
    buffer,
    originalname,
    mimetype,
    folder = '',
    optimize = true,
    type = 'general'
}) => {
    let finalBuffer = buffer;
    let finalMimetype = mimetype;
    let ext = path.extname(originalname);

    // Apply Sharp optimization if image and requested
    if (optimize && isImageMimetype(mimetype) && mimetype !== 'image/gif') {
        const optimized = await optimizeImage(buffer, { type });
        if (optimized) {
            finalBuffer = optimized.buffer;
            finalMimetype = optimized.mimetype;
            ext = `.${optimized.extension}`;
        }
    }

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const baseName = path.basename(originalname, path.extname(originalname)).replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${uniqueSuffix}_${baseName}${ext}`;
    const key = folder ? `${folder}/${filename}` : filename;

    // 1. Try S3/MinIO if enabled
    if (isS3Enabled() && s3Client) {
        try {
            await s3Client.send(new PutObjectCommand({
                Bucket: S3_BUCKET_NAME,
                Key: key,
                Body: finalBuffer,
                ContentType: finalMimetype,
            }));

            let url;
            if (S3_PUBLIC_URL) {
                url = `${S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
            } else {
                url = `${S3_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET_NAME}/${key}`;
            }

            logger.info(`File uploaded to MinIO/S3: ${key}`);
            return {
                url,
                filename,
                originalname,
                mimetype: finalMimetype,
                size: finalBuffer.length,
                storage: 's3'
            };
        } catch (err) {
            logger.error(`Failed to upload to S3/MinIO (${err.message}). Falling back to local disk.`);
        }
    }

    // 2. Fallback to Local Disk
    const targetDir = folder ? path.join(UPLOADS_DIR, folder) : UPLOADS_DIR;
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, filename);
    await fs.promises.writeFile(targetPath, finalBuffer);

    const relativeUrl = `/uploads/${folder ? `${folder}/` : ''}${filename}`;
    logger.info(`File saved to local disk: ${relativeUrl}`);

    return {
        url: relativeUrl,
        filename,
        originalname,
        mimetype: finalMimetype,
        size: finalBuffer.length,
        storage: 'local'
    };
};

/**
 * Delete a stored file from S3/MinIO or Local Storage
 * @param {string} fileUrl 
 */
const deleteStoredFile = async (fileUrl) => {
    if (!fileUrl) return false;

    // S3 URL (handles path-style MinIO, virtual-host S3, or custom CDN S3_PUBLIC_URL)
    if (isS3Enabled() && s3Client && (fileUrl.startsWith('http://') || fileUrl.startsWith('https://'))) {
        try {
            const urlObj = new URL(fileUrl);
            let key = urlObj.pathname.replace(/^\//, ''); // Strip leading slash
            // If pathname starts with bucket name (path-style MinIO), remove the bucket prefix
            if (key.startsWith(`${S3_BUCKET_NAME}/`)) {
                key = key.substring(S3_BUCKET_NAME.length + 1);
            }
            if (key) {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: S3_BUCKET_NAME,
                    Key: key,
                }));
                logger.info(`Deleted file from S3: ${key}`);
                return true;
            }
        } catch (err) {
            logger.warn(`Failed to delete file from S3: ${err.message}`);
        }
    }

    // Local file path (starts with /uploads/)
    if (fileUrl.startsWith('/uploads/')) {
        try {
            const relPath = fileUrl.replace(/^\/uploads\//, '');
            const absPath = path.join(UPLOADS_DIR, relPath);
            if (fs.existsSync(absPath)) {
                await fs.promises.unlink(absPath);
                logger.info(`Deleted local file: ${absPath}`);
                return true;
            }
        } catch (err) {
            logger.warn(`Failed to delete local file: ${err.message}`);
        }
    }

    return false;
};

module.exports = {
    saveUploadedFile,
    deleteStoredFile,
    optimizeImage,
    isImageMimetype,
};
