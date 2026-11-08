const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const createLogger = require('../utils/logger');
const logger = createLogger('Firebase');

let serviceAccount = null;
const serverDir = path.resolve(__dirname, '..');

// 1. Check custom path from .env
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const envPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        : path.resolve(serverDir, process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (fs.existsSync(envPath)) {
        serviceAccount = require(envPath);
        logger.info(`Loaded Firebase Service Account from env path: ${envPath}`);
    }
}

// 2. Check serviceAccountKey.json
if (!serviceAccount) {
    const standardPath = path.resolve(serverDir, 'serviceAccountKey.json');
    if (fs.existsSync(standardPath)) {
        serviceAccount = require(standardPath);
        logger.info('Loaded Firebase Service Account from serviceAccountKey.json');
    }
}

// 3. Auto-detect any firebase-adminsdk json file in Server root
if (!serviceAccount) {
    try {
        const files = fs.readdirSync(serverDir);
        const newProjKey = files.find(f => f.includes('echair-7bf50') && f.endsWith('.json'));
        const fallbackKey = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
        const selected = newProjKey || fallbackKey;
        if (selected) {
            serviceAccount = require(path.join(serverDir, selected));
            logger.info(`Auto-detected Firebase Service Account: ${selected}`);
        }
    } catch (err) {
        logger.error('Error auto-detecting service account key:', err.message);
    }
}

if (serviceAccount) {
    try {
        if (!admin.apps.length) {
            logger.info('Initializing Firebase Admin SDK...');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            logger.success('Firebase Admin SDK initialized successfully!');
            logger.debug(`Project ID: ${serviceAccount.project_id}`);
        }
    } catch (err) {
        logger.error('Failed to initialize Firebase Admin SDK:', err.message);
    }
} else {
    logger.warn('No Firebase Service Account JSON found. Google Auth verification will not work.');
}

module.exports = admin;
