const Sentry = require('@sentry/node');
const createLogger = require('../utils/logger');
const logger = createLogger('Sentry');

const SENTRY_DSN = process.env.SENTRY_DSN;

const initSentry = (app) => {
    if (SENTRY_DSN) {
        try {
            Sentry.init({
                dsn: SENTRY_DSN,
                environment: process.env.NODE_ENV || 'development',
                tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
            });
            logger.success('Sentry initialized successfully for error tracking.');
        } catch (err) {
            logger.warn(`Failed to initialize Sentry: ${err.message}`);
        }
    } else {
        logger.info('SENTRY_DSN not configured. Running with standard Winston/Pino error logging.');
    }
};

const captureException = (err, context = {}) => {
    if (SENTRY_DSN) {
        Sentry.captureException(err, { extra: context });
    }
};

module.exports = {
    initSentry,
    captureException,
    Sentry
};
