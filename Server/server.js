require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

// Logger
const createLogger = require('./utils/logger');
const logger = createLogger('Server');
const httpLogger = require('./middleware/httpLogger');
const chalk = require('chalk'); // For status monitoring colors
const figlet = require('figlet'); // ASCII art banner
const { startHealthCheck } = require('./utils/healthCheck');
const { startSessionCleaner } = require('./utils/sessionCleaner');
const { initSentry, captureException } = require('./config/sentry');
const setupSocketAdapter = require('./socket/adapter');
const { initQueues } = require('./jobs/queue');

// Display ASCII Art Banner
console.log(chalk.green(figlet.textSync('Echair Server', {
    font: 'Standard',
    horizontalLayout: 'default'
})));
console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

// Config
const connectDB = require('./config/db');
require('./config/firebase'); // Init Firebase Admin
require('./config/email'); // Init Email
require('./config/storage'); // Init Storage (S3/MinIO/Local)
require('./config/redis'); // Init Redis Cache

// Connect Database
logger.info('>> Starting server initialization...');
connectDB();

const app = express();
app.set('trust proxy', 1);

// Initialize Sentry error tracking
initSentry(app);

const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Initialize Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins (for Admin Panel local file access)
        methods: ["GET", "POST"]
    }
});

// Setup Redis adapter for Socket.IO scaling
setupSocketAdapter(io);

// Enable Real-time Logger Streaming
createLogger.setSocketInstance(io);
logger.info('Socket.IO server initialized with CORS settings');

// Middleware
app.use(cors());
logger.debug('CORS middleware enabled');

app.use(express.json());
logger.debug('JSON body parser enabled');

// HTTP Logging Middleware
app.use(httpLogger);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
logger.debug('Static files serving enabled for /uploads');

// Inject Socket.IO into req for use in API routes
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Routes
app.use((req, res, next) => {
    logger.info(`[DEBUG ROOT] ${req.method} ${req.url}`);
    next();
});

app.get('/api/test-upload', (req, res) => res.send('Upload Route Works!'));

logger.info('Registering API routes...');
app.use('/api', require('./routes/health')); // Health check endpoints
app.use('/api/auth', require('./routes/auth'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/users', require('./routes/users'));
app.use('/api/presets', require('./routes/presets'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/stream', require('./routes/stream'));
app.use('/api/classwork', require('./routes/classwork'));
app.use('/api/public', require('./routes/public'));
logger.success('All API routes registered successfully');

// Support both Vite build output (dist/) and CRA (build/)
const clientDistPath = path.resolve(__dirname, '../Client/dist');
const clientBuildPath = fs.existsSync(clientDistPath) ? clientDistPath : path.resolve(__dirname, '../Client/build');
const clientIndexPath = path.join(clientBuildPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
    logger.info(`Serving client build from ${clientBuildPath}`);
    app.use(express.static(clientBuildPath));

    app.get('*', (req, res, next) => {
        if (
            req.path.startsWith('/api') ||
            req.path.startsWith('/uploads') ||
            req.path.startsWith('/socket.io')
        ) {
            return next();
        }

        return res.sendFile(clientIndexPath);
    });
}

// Global Error Handler
app.use((err, req, res, next) => {
    logger.error(`Unhandled error on ${req.method} ${req.url}: ${err.message}`);
    captureException(err, { url: req.originalUrl, method: req.method });
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// Socket Handler
logger.info('Setting up Socket.IO event handlers...');
require('./socket/socketHandler')(io);
logger.success('Socket.IO event handlers registered');

// Error handling for uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught Exception:', error);
    captureException(error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    captureException(reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.warn('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

// Server Status Monitoring (every 5 seconds)
let statusInterval;
const startStatusMonitoring = () => {
    statusInterval = setInterval(() => {
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

        // Get Socket.IO online users count
        const onlineUsers = io.engine.clientsCount || 0;

        // Get MongoDB connection status
        const mongoose = require('mongoose');
        const dbStatus = mongoose.connection.readyState === 1 ? chalk.green('Connected') : chalk.red('Disconnected');

        // Format uptime
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

        logger.info(chalk.cyan(`[STATUS]`) + ` Uptime: ${chalk.yellow(uptimeStr)} | Users Online: ${chalk.green(onlineUsers)} | Memory: ${chalk.yellow(`${memUsedMB}/${memTotalMB}MB`)} | DB: ${dbStatus}`);
    }, 5000);
};

// Start Server
server.listen(port, () => {
    logger.success(`Server is running on port ${port}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Socket.IO ready for connections`);
    logger.info(`API available at http://localhost:${port}/api`);
    logger.info('========================================================');

    // Initialize BullMQ queues
    initQueues();

    // Start status monitoring
    logger.info(chalk.cyan('[STATUS]') + ' Starting server status monitoring (every 5 seconds)...');
    startStatusMonitoring();

    // Start health check monitoring (every 10 seconds)
    logger.info(chalk.cyan('[HEALTH]') + ' Starting health check monitoring (every 10 seconds)...');
    startHealthCheck();

    // Start session cleaner to auto-end stale sessions (every 15 minutes)
    logger.info(chalk.cyan('[SESSION]') + ' Starting session cleaner (stale sessions will auto-end)...');
    startSessionCleaner();
});
