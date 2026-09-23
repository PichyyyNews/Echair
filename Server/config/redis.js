const Redis = require('ioredis');
const createLogger = require('../utils/logger');
const logger = createLogger('Redis');

const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = process.env.REDIS_URL;

let client = null;
let isConnected = false;

const redisOptions = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
        // Stop retrying aggressively if Redis is not running locally
        if (times > 3) {
            logger.warn('Redis connection retry limit reached. Operating in offline/fallback mode.');
            return null; // Stop retrying
        }
        return Math.min(times * 500, 2000);
    },
    enableOfflineQueue: false, // Fail fast rather than buffer when disconnected
    lazyConnect: true
};

if (REDIS_ENABLED) {
    client = REDIS_URL ? new Redis(REDIS_URL, { ...redisOptions, lazyConnect: true }) : new Redis(redisOptions);

    client.on('connect', () => {
        isConnected = true;
        logger.success(`Redis connected successfully to ${REDIS_URL || `${REDIS_HOST}:${REDIS_PORT}`}`);
    });

    client.on('ready', () => {
        isConnected = true;
    });

    client.on('error', (err) => {
        isConnected = false;
        // Suppress repeated spam logs if Redis server is not running
        if (err.code === 'ECONNREFUSED') {
            logger.warn(`Redis server not available at ${REDIS_HOST}:${REDIS_PORT}. Running in memory fallback mode.`);
        } else {
            logger.error('Redis error:', err.message);
        }
    });

    client.on('close', () => {
        isConnected = false;
    });

    // Attempt non-blocking initial connection
    client.connect().catch((err) => {
        isConnected = false;
        logger.warn(`Initial Redis connection could not be established (${err.message}). Graceful fallback is active.`);
    });
} else {
    logger.info('Redis is explicitly disabled via REDIS_ENABLED=false');
}

/**
 * Check if Redis is ready and accepting commands
 */
const isRedisReady = () => {
    return isConnected && client && client.status === 'ready';
};

/**
 * Create a new duplicate Redis connection (for pub/sub or queues)
 */
const createDuplicateClient = () => {
    if (!REDIS_ENABLED) return null;
    const dup = REDIS_URL 
        ? new Redis(REDIS_URL, { ...redisOptions, lazyConnect: true }) 
        : new Redis({ ...redisOptions, lazyConnect: true });
    
    dup.on('error', (err) => {
        // Suppress unhandled ECONNREFUSED in offline fallback mode
        logger.debug(`Duplicate Redis client error: ${err.message}`);
    });
    return dup;
};

const closeRedis = async () => {
    if (client) {
        try {
            await client.quit();
        } catch (_) {
            try { client.disconnect(); } catch (e) {}
        }
    }
};

module.exports = {
    redisClient: client,
    isRedisReady,
    createDuplicateClient,
    closeRedis,
    redisOptions
};
