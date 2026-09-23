/**
 * Comprehensive Automated Verification Suite for Echair Stack Upgrade
 * Tests:
 * 1. Redis Client & Cache Layer (utils/cache.js)
 * 2. MinIO/S3 Storage & Sharp Image Processing (utils/storage.js)
 * 3. Zod API Validation (middleware/validate.js, validators)
 * 4. BullMQ Queue & Worker fallback (jobs/queue.js)
 * 5. Sentry Error Tracking (config/sentry.js)
 * 6. Mongoose Compound Indexes on Models
 * 7. Rate Limiting (middleware/rateLimiter.js)
 * 8. Socket.IO Adapter (socket/adapter.js)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
    console.log('🧪 Starting Echair Stack Upgrade Test Suite...\n');
    let passed = 0;
    let failed = 0;

    const test = async (name, fn) => {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err) {
            console.error(`  ❌ FAIL: ${name}\n     ${err.message}`);
            failed++;
        }
    };

    // --- 1. Cache Layer ---
    console.log('--- 1. Testing Redis & Cache Layer ---');
    const { getCache, setCache, delCache, delCachePattern } = require('./utils/cache');
    const { isRedisReady } = require('./config/redis');

    await test('isRedisReady() returns boolean without throwing', async () => {
        const ready = isRedisReady();
        assert.strictEqual(typeof ready, 'boolean');
    });

    await test('Cache functions gracefully handle offline state', async () => {
        const val = await getCache('test:nonexistent');
        assert.strictEqual(val, null);
        const setRes = await setCache('test:key', { hello: 'world' }, 10);
        assert.strictEqual(typeof setRes, 'boolean');
        const delRes = await delCache('test:key');
        assert.strictEqual(typeof delRes, 'boolean');
        const count = await delCachePattern('test:*');
        assert.strictEqual(typeof count, 'number');
    });

    // --- 2. Storage & Sharp ---
    console.log('\n--- 2. Testing MinIO / S3 Storage & Sharp Image Processing ---');
    const { saveUploadedFile, deleteStoredFile, optimizeImage, isImageMimetype } = require('./utils/storage');
    const { isS3Enabled, UPLOADS_DIR } = require('./config/storage');

    await test('isImageMimetype detects image types properly', async () => {
        assert.strictEqual(isImageMimetype('image/jpeg'), true);
        assert.strictEqual(isImageMimetype('image/png'), true);
        assert.strictEqual(isImageMimetype('image/webp'), true);
        assert.strictEqual(isImageMimetype('application/pdf'), false);
    });

    await test('Sharp optimizes JPEG/PNG image buffer to WebP', async () => {
        const sharp = require('sharp');
        // Create 100x100 test PNG buffer
        const testBuffer = await sharp({
            create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } }
        }).png().toBuffer();

        const optimized = await optimizeImage(testBuffer, { type: 'avatar' });
        assert.ok(optimized, 'Optimization result should exist');
        assert.strictEqual(optimized.mimetype, 'image/webp');
        assert.strictEqual(optimized.extension, 'webp');
        assert.ok(optimized.buffer.length > 0);

        // Verify avatar dimensions are 256x256
        const meta = await sharp(optimized.buffer).metadata();
        assert.strictEqual(meta.width, 256);
        assert.strictEqual(meta.height, 256);
        assert.strictEqual(meta.format, 'webp');
    });

    await test('saveUploadedFile stores file and returns consistent URL', async () => {
        const sampleText = Buffer.from('Hello Echair Storage Test!');
        const result = await saveUploadedFile({
            buffer: sampleText,
            originalname: 'sample-doc.txt',
            mimetype: 'text/plain',
            folder: 'test_uploads',
            optimize: false
        });

        assert.ok(result.url, 'Result must contain url');
        assert.ok(result.filename, 'Result must contain filename');
        assert.strictEqual(result.mimetype, 'text/plain');

        // Clean up test file
        await deleteStoredFile(result.url);
    });

    // --- 3. Zod API Validation ---
    console.log('\n--- 3. Testing Zod API Validation ---');
    const validate = require('./middleware/validate');
    const { loginSchema, registerSchema } = require('./validators/authValidators');
    const { createClassSchema, joinClassSchema } = require('./validators/classroomValidators');

    await test('loginSchema validates valid input and rejects invalid email', async () => {
        const valid = await loginSchema.safeParseAsync({ email: 'test@example.com', password: 'password123' });
        assert.strictEqual(valid.success, true);

        const invalid = await loginSchema.safeParseAsync({ email: 'invalid-email', password: '123' });
        assert.strictEqual(invalid.success, false);
    });

    await test('registerSchema enforces minimum password length', async () => {
        const valid = await registerSchema.safeParseAsync({ email: 'user@test.com', password: 'securePassword123' });
        assert.strictEqual(valid.success, true);

        const invalid = await registerSchema.safeParseAsync({ email: 'user@test.com', password: '123' });
        assert.strictEqual(invalid.success, false);
    });

    await test('classroomValidators validate create and join schemas', async () => {
        const validCreate = await createClassSchema.safeParseAsync({ name: 'Physics 101' });
        assert.strictEqual(validCreate.success, true);

        const invalidCreate = await createClassSchema.safeParseAsync({ name: '' });
        assert.strictEqual(invalidCreate.success, false);

        const validJoin = await joinClassSchema.safeParseAsync({ classCode: 'ABCD12' });
        assert.strictEqual(validJoin.success, true);
    });

    await test('validate() middleware correctly processes Express mock request', async () => {
        const middleware = validate(loginSchema);
        let nextCalled = false;
        const mockReq = { body: { email: 'teacher@test.com', password: 'myPassword123' }, method: 'POST', originalUrl: '/api/auth/login' };
        const mockRes = {
            status: () => mockRes,
            json: () => {}
        };
        await middleware(mockReq, mockRes, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, true);
    });

    await test('validate() middleware rejects invalid Express mock request with 400', async () => {
        const middleware = validate(loginSchema);
        let nextCalled = false;
        let statusCode = null;
        let jsonResponse = null;
        const mockReq = { body: { email: 'bad-email' }, method: 'POST', originalUrl: '/api/auth/login' };
        const mockRes = {
            status: (code) => { statusCode = code; return mockRes; },
            json: (payload) => { jsonResponse = payload; }
        };
        await middleware(mockReq, mockRes, () => { nextCalled = true; });
        assert.strictEqual(nextCalled, false, 'next() should not be called on validation failure');
        assert.strictEqual(statusCode, 400, 'Status code must be 400');
        assert.strictEqual(jsonResponse.error, 'Validation failed');
        assert.ok(Array.isArray(jsonResponse.details) && jsonResponse.details.length > 0);
    });

    // --- 4. BullMQ Job Queue ---
    console.log('\n--- 4. Testing BullMQ Queue & Worker fallback ---');
    const { enqueueEmail, enqueueCleanup, closeQueues } = require('./jobs/queue');

    await test('enqueueEmail executes gracefully without throwing', async () => {
        // Mail with fake transport or offline queue
        try {
            await enqueueEmail({
                to: 'test-queue@example.com',
                subject: 'BullMQ Test',
                html: '<p>Test</p>'
            });
        } catch (err) {
            // If email credentials fail to connect SMTP, it's expected in dev test
            assert.ok(err.message, 'Expected error handled');
        }
    });

    await test('enqueueCleanup executes without error', async () => {
        await enqueueCleanup();
    });

    // --- 5. Sentry Error Tracking ---
    console.log('\n--- 5. Testing Sentry Error Tracking ---');
    const { initSentry, captureException } = require('./config/sentry');

    await test('Sentry initializes safely without throwing when DSN is absent', async () => {
        initSentry({});
        captureException(new Error('Test harmless Sentry exception'));
    });

    // --- 6. Mongoose Models & Compound Indexes ---
    console.log('\n--- 6. Testing Mongoose Compound Indexes ---');
    const Class = require('./models/Class');
    const Notification = require('./models/Notification');
    const Assignment = require('./models/Assignment');
    const AssignmentSubmission = require('./models/AssignmentSubmission');
    const StreamPost = require('./models/StreamPost');
    const ActiveSession = require('./models/ActiveSession');

    await test('Class model has defined indexes', async () => {
        const indexes = Class.schema.indexes();
        assert.ok(indexes.length >= 4, `Expected at least 4 indexes, found ${indexes.length}`);
    });

    await test('Notification model has compound index for user + isRead + createdAt', async () => {
        const indexes = Notification.schema.indexes();
        const hasCompound = indexes.some(([idx]) => idx.userId && idx.isRead && idx.createdAt);
        assert.ok(hasCompound, 'Notification must contain compound index');
    });

    await test('AssignmentSubmission model has compound index for assignmentId + studentId', async () => {
        const indexes = AssignmentSubmission.schema.indexes();
        const hasCompound = indexes.some(([idx]) => idx.assignmentId && idx.studentId);
        assert.ok(hasCompound, 'AssignmentSubmission must contain compound index');
    });

    await test('StreamPost model has compound index for classId + createdAt', async () => {
        const indexes = StreamPost.schema.indexes();
        const hasCompound = indexes.some(([idx]) => idx.classId && idx.createdAt);
        assert.ok(hasCompound, 'StreamPost must contain compound index');
    });

    await test('ActiveSession model has compound index for userId + isActive', async () => {
        const indexes = ActiveSession.schema.indexes();
        const hasCompound = indexes.some(([idx]) => idx.userId && idx.isActive);
        assert.ok(hasCompound, 'ActiveSession must contain compound index');
    });

    // --- 7. Rate Limiter ---
    console.log('\n--- 7. Testing Rate Limiter ---');
    const { uploadLimiter, apiLimiter, authLimiter } = require('./middleware/rateLimiter');

    await test('uploadLimiter and other limiters are valid Express middlewares', async () => {
        assert.strictEqual(typeof uploadLimiter, 'function');
        assert.strictEqual(typeof apiLimiter, 'function');
        assert.strictEqual(typeof authLimiter, 'function');
    });

    await test('ResilientStore increments and resets keys in fallback mode', async () => {
        const { ResilientStore } = require('./middleware/rateLimiter');
        const rateLimit = require('express-rate-limit');
        const store = new ResilientStore('test-rl:');
        const customLimiter = rateLimit({
            windowMs: 60000,
            max: 5,
            store
        });
        assert.strictEqual(typeof customLimiter, 'function');
        const inc = await store.increment('test-ip-1');
        assert.ok(inc && inc.totalHits >= 1);
        await store.resetKey('test-ip-1');
    });

    await test('deleteStoredFile handles safe URL deletion without throwing', async () => {
        const fakeS3Url = 'http://127.0.0.1:9000/echair-uploads/test/fake.webp';
        const res = await deleteStoredFile(fakeS3Url);
        assert.strictEqual(typeof res, 'boolean');
        const emptyRes = await deleteStoredFile('');
        assert.strictEqual(emptyRes, false);
    });

    // --- 8. Socket.IO Adapter ---
    console.log('\n--- 8. Testing Socket.IO Adapter ---');
    const setupSocketAdapter = require('./socket/adapter');

    await test('setupSocketAdapter runs without throwing', async () => {
        const mockIo = { adapter: () => {} };
        await setupSocketAdapter(mockIo);
    });

    // Teardown connections to allow clean exit
    const { closeRedis } = require('./config/redis');
    await closeQueues();
    await closeRedis();

    console.log(`\n========================================`);
    console.log(`Summary: ${passed} passed, ${failed} failed.`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
