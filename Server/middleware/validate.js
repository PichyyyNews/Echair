const { ZodError } = require('zod');
const createLogger = require('../utils/logger');
const logger = createLogger('Validator');

/**
 * Express middleware to validate request payload with Zod
 * @param {import('zod').ZodSchema} schema 
 * @param {'body' | 'query' | 'params'} [source='body']
 */
const validate = (schema, source = 'body') => {
    return async (req, res, next) => {
        try {
            const parsed = await schema.parseAsync(req[source]);
            req[source] = parsed;
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                const issueList = err.issues || err.errors || [];
                const issues = issueList.map(e => ({
                    field: (Array.isArray(e.path) && e.path.length > 0) ? e.path.join('.') : (source || 'body'),
                    message: e.message
                }));
                logger.warn(`Validation failed on ${req.method} ${req.originalUrl}: ${JSON.stringify(issues)}`);
                return res.status(400).json({
                    error: 'Validation failed',
                    message: issues[0]?.message || 'Invalid input data',
                    details: issues
                });
            }
            logger.error(`Unexpected validation error: ${err.message}`);
            return res.status(500).json({ error: 'Internal validation error' });
        }
    };
};

module.exports = validate;
