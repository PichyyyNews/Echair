const { redisClient, isRedisReady } = require('../config/redis');
const createLogger = require('./logger');
const logger = createLogger('Cache');

/**
 * Retrieve cached data by key
 * @param {string} key 
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
    if (!isRedisReady()) return null;
    try {
        const data = await redisClient.get(key);
        if (!data) return null;
        return JSON.parse(data);
    } catch (err) {
        logger.debug(`Cache get error for key "${key}": ${err.message}`);
        return null;
    }
};

/**
 * Store data into cache with TTL (Time To Live in seconds)
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds 
 * @returns {Promise<boolean>}
 */
const setCache = async (key, value, ttlSeconds = 60) => {
    if (!isRedisReady()) return false;
    try {
        const serialized = JSON.stringify(value);
        if (ttlSeconds > 0) {
            await redisClient.set(key, serialized, 'EX', ttlSeconds);
        } else {
            await redisClient.set(key, serialized);
        }
        return true;
    } catch (err) {
        logger.debug(`Cache set error for key "${key}": ${err.message}`);
        return false;
    }
};

/**
 * Delete a specific key from cache
 * @param {string} key 
 * @returns {Promise<boolean>}
 */
const delCache = async (key) => {
    if (!isRedisReady()) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (err) {
        logger.debug(`Cache del error for key "${key}": ${err.message}`);
        return false;
    }
};

/**
 * Delete all keys matching a glob pattern (e.g. "classroom:123:*")
 * @param {string} pattern 
 * @returns {Promise<number>} Number of deleted keys
 */
const delCachePattern = async (pattern) => {
    if (!isRedisReady()) return 0;
    try {
        let cursor = '0';
        let totalDeleted = 0;
        do {
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            if (keys && keys.length > 0) {
                await redisClient.del(...keys);
                totalDeleted += keys.length;
            }
        } while (cursor !== '0');
        if (totalDeleted > 0) {
            logger.debug(`Invalidated ${totalDeleted} cache keys matching pattern: ${pattern}`);
        }
        return totalDeleted;
    } catch (err) {
        logger.debug(`Cache del pattern error "${pattern}": ${err.message}`);
        return 0;
    }
};

/**
 * Express middleware for route level caching
 * @param {string} prefix Key prefix
 * @param {number} ttlSeconds TTL in seconds
 * @param {function} keyBuilder Optional custom key builder function
 */
const cacheMiddleware = (prefix, ttlSeconds = 60, keyBuilder = (req) => req.originalUrl) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        if (!isRedisReady()) {
            res.setHeader('X-Cache', 'BYPASS');
            return next();
        }

        const cacheKey = `${prefix}:${keyBuilder(req)}`;

        try {
            const cachedData = await getCache(cacheKey);
            if (cachedData !== null) {
                res.setHeader('X-Cache', 'HIT');
                return res.json(cachedData);
            }

            res.setHeader('X-Cache', 'MISS');

            // Intercept res.json to capture data and cache it
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    setCache(cacheKey, body, ttlSeconds).catch(() => {});
                }
                return originalJson(body);
            };

            next();
        } catch (err) {
            logger.debug(`Cache middleware error: ${err.message}`);
            next();
        }
    };
};

module.exports = {
    getCache,
    setCache,
    delCache,
    delCachePattern,
    cacheMiddleware
};
