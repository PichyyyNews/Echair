const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getCache, setCache } = require('../utils/cache');
const { isRedisReady } = require('../config/redis');
const { isS3Enabled } = require('../config/storage');

// Health check endpoint with Redis caching (10s TTL)
router.get('/health', async (req, res) => {
    try {
        const cached = await getCache('health:status');
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            const statusCode = cached.database?.connected ? 200 : 503;
            return res.status(statusCode).json(cached);
        }

        const dbState = mongoose.connection.readyState;
        const isDbConnected = dbState === 1;

        const memUsage = process.memoryUsage();
        const uptime = process.uptime();

        const healthData = {
            status: isDbConnected ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            uptime: {
                seconds: Math.floor(uptime),
                formatted: formatUptime(uptime),
            },
            database: {
                connected: isDbConnected,
                state: getDbStateName(dbState),
                name: mongoose.connection.name || 'N/A',
            },
            redis: {
                connected: isRedisReady(),
                mode: isRedisReady() ? 'cluster/standalone' : 'offline/fallback',
            },
            storage: {
                driver: isS3Enabled() ? 'minio-s3' : 'local-disk',
            },
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024),
            },
            process: {
                pid: process.pid,
                version: process.version,
                platform: process.platform,
            },
        };

        // Cache for 10 seconds
        await setCache('health:status', healthData, 10);

        res.setHeader('X-Cache', 'MISS');
        const statusCode = isDbConnected ? 200 : 503;
        res.status(statusCode).json(healthData);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
});

// Helper functions
function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

function getDbStateName(state) {
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting',
    };
    return states[state] || 'unknown';
}

module.exports = router;
