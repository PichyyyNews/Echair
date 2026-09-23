const { createAdapter } = require('@socket.io/redis-adapter');
const { createDuplicateClient } = require('../config/redis');
const createLogger = require('../utils/logger');
const logger = createLogger('SocketAdapter');

/**
 * Setup Redis adapter for Socket.IO scaling across multiple server processes
 * Gracefully falls back to default in-memory adapter if Redis is unavailable
 * @param {import('socket.io').Server} io 
 */
const setupSocketAdapter = async (io) => {
    const pubClient = createDuplicateClient();
    const subClient = createDuplicateClient();

    if (!pubClient || !subClient) {
        logger.info('Running Socket.IO with default in-memory adapter.');
        return;
    }

    try {
        await Promise.all([pubClient.connect(), subClient.connect()]);
        io.adapter(createAdapter(pubClient, subClient));
        logger.success('Socket.IO Redis adapter attached successfully for horizontal scaling.');
    } catch (err) {
        logger.warn(`Socket.IO Redis adapter could not connect: ${err.message}. Using default in-memory adapter.`);
        try {
            pubClient.disconnect();
            subClient.disconnect();
        } catch (_) {}
    }
};

module.exports = setupSocketAdapter;
