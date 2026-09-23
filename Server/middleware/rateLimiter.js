const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient, isRedisReady } = require('../config/redis');
const createLogger = require('../utils/logger');
const logger = createLogger('RateLimit');

/**
 * Resilient rate-limit store that dynamically delegates to RedisStore
 * when Redis is connected and ready, and seamlessly falls back to MemoryStore
 * when Redis is offline or not yet connected.
 */
class ResilientStore {
    constructor(prefix = 'rl:') {
        this.prefix = prefix;
        this.memoryStore = new rateLimit.MemoryStore();
        this.redisStore = null;
        this.options = null;
    }

    init(options) {
        this.options = options;
        if (this.memoryStore && typeof this.memoryStore.init === 'function') {
            this.memoryStore.init(options);
        }
    }

    _getActiveStore() {
        if (isRedisReady() && redisClient) {
            if (!this.redisStore) {
                try {
                    this.redisStore = new RedisStore({
                        prefix: `echair:${this.prefix}`,
                        sendCommand: (...args) => redisClient.call(...args),
                    });
                    if (this.options && typeof this.redisStore.init === 'function') {
                        this.redisStore.init(this.options);
                    }
                } catch (err) {
                    logger.warn(`Failed to initialize RedisStore for ${this.prefix}: ${err.message}`);
                    this.redisStore = null;
                }
            }
            if (this.redisStore) return this.redisStore;
        }
        return this.memoryStore;
    }

    async increment(key) {
        const store = this._getActiveStore();
        try {
            return await store.increment(key);
        } catch (err) {
            return await this.memoryStore.increment(key);
        }
    }

    async decrement(key) {
        const store = this._getActiveStore();
        try {
            if (store.decrement) return await store.decrement(key);
        } catch (err) {
            if (this.memoryStore.decrement) return await this.memoryStore.decrement(key);
        }
    }

    async resetKey(key) {
        const store = this._getActiveStore();
        try {
            return await store.resetKey(key);
        } catch (err) {
            return await this.memoryStore.resetKey(key);
        }
    }

    async resetAll() {
        const store = this._getActiveStore();
        try {
            if (store.resetAll) return await store.resetAll();
        } catch (err) {
            if (this.memoryStore.resetAll) return await this.memoryStore.resetAll();
        }
    }

    async get(key) {
        const store = this._getActiveStore();
        try {
            if (store.get) return await store.get(key);
        } catch (err) {
            if (this.memoryStore.get) return await this.memoryStore.get(key);
        }
    }
}

const createStore = (prefix) => new ResilientStore(prefix);

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Limit each IP to 200 requests per windowMs
    store: createStore('api:'),
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: '15 minutes'
        });
    },
});

// Strict limiter for login/register endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 25,
    store: createStore('auth:'),
    skipSuccessfulRequests: true,
    message: {
        error: 'Too many login attempts, please try again later.',
        retryAfter: '15 minutes'
    },
    handler: (req, res) => {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many login attempts, please try again later.',
            retryAfter: '15 minutes'
        });
    },
});

// Login history endpoint limiter
const loginHistoryLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createStore('login_hist:'),
    message: {
        error: 'Too many requests, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Login history rate limit exceeded for IP: ${req.ip}, User: ${req.user?.email || 'Unknown'}`);
        res.status(429).json({
            error: 'Too many requests, please slow down.',
            retryAfter: '1 minute'
        });
    },
});

// Active sessions endpoint limiter
const activeSessionsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    store: createStore('sessions:'),
    message: {
        error: 'Too many requests, please slow down.',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Upload rate limiter (protect storage endpoints from abuse)
const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 uploads per 15 min
    store: createStore('upload:'),
    message: {
        error: 'Upload limit reached. Please wait before uploading more files.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Upload rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Upload limit reached. Please wait before uploading more files.',
            retryAfter: '15 minutes'
        });
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    loginHistoryLimiter,
    activeSessionsLimiter,
    uploadLimiter,
    ResilientStore,
};
