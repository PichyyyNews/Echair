const { S3Client, HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs');
const createLogger = require('../utils/logger');
const logger = createLogger('Storage');

const S3_ENDPOINT = process.env.S3_ENDPOINT; // e.g. 'http://127.0.0.1:9000' or 'http://minio:9000'
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || process.env.MINIO_ROOT_USER;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || process.env.MINIO_ROOT_PASSWORD;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'echair-uploads';
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE !== 'false'; // true for MinIO
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL; // Optional CDN or public MinIO URL

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

let s3Client = null;
let isS3Enabled = false;

if (S3_ENDPOINT && S3_ACCESS_KEY && S3_SECRET_KEY) {
    try {
        s3Client = new S3Client({
            endpoint: S3_ENDPOINT,
            region: S3_REGION,
            credentials: {
                accessKeyId: S3_ACCESS_KEY,
                secretAccessKey: S3_SECRET_KEY,
            },
            forcePathStyle: S3_FORCE_PATH_STYLE,
        });
        isS3Enabled = true;
        logger.info(`S3/MinIO client configured for endpoint: ${S3_ENDPOINT}, bucket: ${S3_BUCKET_NAME}`);

        // Ensure bucket exists asynchronously
        (async () => {
            try {
                await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET_NAME }));
                logger.success(`S3/MinIO bucket "${S3_BUCKET_NAME}" is ready.`);
            } catch (err) {
                if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
                    logger.info(`Bucket "${S3_BUCKET_NAME}" does not exist. Creating it...`);
                    try {
                        await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET_NAME }));
                        logger.success(`Bucket "${S3_BUCKET_NAME}" created successfully.`);
                        
                        // Set public read policy for MinIO bucket so client browsers can load uploaded images
                        const readOnlyPolicy = {
                            Version: "2012-10-17",
                            Statement: [
                                {
                                    Sid: "PublicReadGetObject",
                                    Effect: "Allow",
                                    Principal: "*",
                                    Action: ["s3:GetObject"],
                                    Resource: [`arn:aws:s3:::${S3_BUCKET_NAME}/*`]
                                }
                            ]
                        };
                        await s3Client.send(new PutBucketPolicyCommand({
                            Bucket: S3_BUCKET_NAME,
                            Policy: JSON.stringify(readOnlyPolicy)
                        }));
                        logger.success(`Public read policy applied to bucket "${S3_BUCKET_NAME}".`);
                    } catch (createErr) {
                        logger.warn(`Could not create bucket: ${createErr.message}`);
                    }
                } else {
                    logger.warn(`S3/MinIO connectivity check warning: ${err.message}`);
                }
            }
        })();
    } catch (err) {
        logger.error(`Failed to initialize S3/MinIO client: ${err.message}`);
        isS3Enabled = false;
    }
} else {
    logger.info('S3/MinIO not configured (S3_ENDPOINT/KEYS not provided). Using local disk storage.');
}

module.exports = {
    s3Client,
    isS3Enabled: () => isS3Enabled,
    S3_BUCKET_NAME,
    S3_ENDPOINT,
    S3_PUBLIC_URL,
    UPLOADS_DIR,
};
