const { Queue, Worker } = require('bullmq');
const { redisOptions, isRedisReady, redisClient } = require('../config/redis');
const createLogger = require('../utils/logger');
const logger = createLogger('BullMQ');

let emailQueue = null;
let cleanupQueue = null;
let emailWorker = null;
let cleanupWorker = null;

// BullMQ connection options
const bullConnection = {
    host: redisOptions.host,
    port: redisOptions.port,
    password: redisOptions.password,
    maxRetriesPerRequest: null // Required by BullMQ
};

/**
 * Initialize Queues and Workers if Redis is available
 */
const initQueues = () => {
    if (emailQueue) return; // Already initialized

    if (!isRedisReady()) {
        logger.info('Redis is offline/not ready. Background jobs will execute with direct inline fallback.');
        return;
    }

    try {
        emailQueue = new Queue('echair-email', { connection: bullConnection });
        cleanupQueue = new Queue('echair-cleanup', { connection: bullConnection });

        // Worker for Email
        emailWorker = new Worker('echair-email', async (job) => {
            const dynamicTransporter = require('../config/email');
            logger.info(`[Worker] Processing email job ${job.id} for: ${job.data.mailOptions?.to}`);
            return await dynamicTransporter.sendMail(job.data.mailOptions);
        }, { connection: bullConnection });

        emailWorker.on('completed', (job) => {
            logger.success(`[Worker] Email job ${job.id} sent successfully`);
        });

        emailWorker.on('failed', (job, err) => {
            logger.error(`[Worker] Email job ${job?.id} failed: ${err.message}`);
        });

        // Worker for Stale Sessions Cleanup
        cleanupWorker = new Worker('echair-cleanup', async (job) => {
            const { autoEndStaleSessions } = require('../utils/sessionCleaner');
            logger.info(`[Worker] Processing session cleanup job ${job.id}`);
            if (typeof autoEndStaleSessions === 'function') {
                await autoEndStaleSessions();
            }
        }, { connection: bullConnection });

        logger.success('BullMQ queues and workers initialized successfully.');
    } catch (err) {
        logger.warn(`Failed to initialize BullMQ (${err.message}). Using inline fallbacks.`);
    }
};

/**
 * Enqueue an email to be sent asynchronously in the background.
 * Falls back to direct inline execution if BullMQ / Redis is not active.
 * @param {Object} mailOptions 
 */
const enqueueEmail = async (mailOptions) => {
    if (emailQueue && isRedisReady()) {
        try {
            const job = await emailQueue.add('send-email', { mailOptions }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false
            });
            logger.info(`Email job enqueued (ID: ${job.id}) for ${mailOptions.to}`);
            return { enqueued: true, jobId: job.id };
        } catch (err) {
            logger.warn(`Failed to enqueue email via BullMQ: ${err.message}. Sending inline.`);
        }
    }

    // Inline fallback
    const dynamicTransporter = require('../config/email');
    logger.info(`Sending email directly (inline fallback) to ${mailOptions.to}`);
    return await dynamicTransporter.sendMail(mailOptions);
};

/**
 * Enqueue a session cleanup job.
 * Falls back to direct inline execution if BullMQ / Redis is not active.
 */
const enqueueCleanup = async () => {
    if (cleanupQueue && isRedisReady()) {
        try {
            await cleanupQueue.add('clean-stale-sessions', {}, {
                removeOnComplete: true,
                removeOnFail: true
            });
            logger.info('Session cleanup job enqueued in BullMQ');
            return;
        } catch (err) {
            logger.warn(`Failed to enqueue cleanup job: ${err.message}. Running inline.`);
        }
    }

    // Inline fallback
    const { autoEndStaleSessions } = require('../utils/sessionCleaner');
    if (typeof autoEndStaleSessions === 'function') {
        await autoEndStaleSessions();
    }
};

/**
 * Gracefully close BullMQ queues and workers
 */
const closeQueues = async () => {
    try {
        if (emailWorker) await emailWorker.close();
        if (cleanupWorker) await cleanupWorker.close();
        if (emailQueue) await emailQueue.close();
        if (cleanupQueue) await cleanupQueue.close();
    } catch (_) {}
    emailQueue = null;
    cleanupQueue = null;
    emailWorker = null;
    cleanupWorker = null;
};

// Auto-initialize when Redis becomes ready
if (redisClient) {
    redisClient.on('ready', () => {
        if (!emailQueue) {
            initQueues();
        }
    });
}

module.exports = {
    initQueues,
    closeQueues,
    enqueueEmail,
    enqueueCleanup,
    getEmailQueue: () => emailQueue,
    getCleanupQueue: () => cleanupQueue
};
