const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true, // e.g., 'email_config', 'site_config'
        default: 'general'
    },
    email: {
        user: { type: String, default: '' },
        pass: { type: String, default: '' },
        service: { type: String, default: 'gmail' },
        enabled: { type: Boolean, default: true }
    },
    site: {
        name: { type: String, default: 'Echair Admin' },
        maintenanceMode: { type: Boolean, default: false },
        maintenanceMessage: { type: String, default: 'The system is currently undergoing maintenance. Please try again later.' }
    },
    security: {
        allowRegistration: { type: Boolean, default: true },
        sessionTimeout: { type: Number, default: 60 } // in minutes
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create a default settings document if one doesn't exist
systemSettingsSchema.statics.getSettings = async function () {
    const { getCache, setCache } = require('../utils/cache');
    const cached = await getCache('system_settings:general');
    if (cached) {
        return cached;
    }

    let settings = await this.findOne({ key: 'general' });
    if (!settings) {
        settings = await this.create({
            key: 'general',
            email: {
                user: process.env.EMAIL_USER || '',
                pass: process.env.EMAIL_PASS || '',
                service: 'gmail'
            }
        });
    } else {
        // Ensure new schema fields exist if document was created previously
        let needsUpdate = false;
        if (!settings.security) {
            settings.security = { allowRegistration: true, sessionTimeout: 60 };
            needsUpdate = true;
        }
        if (!settings.site.maintenanceMessage) {
            settings.site.maintenanceMessage = 'The system is currently undergoing maintenance. Please try again later.';
            needsUpdate = true;
        }
        if (typeof settings.email.enabled === 'undefined') {
            settings.email.enabled = true;
            needsUpdate = true;
        }

        if (needsUpdate) {
            await settings.save();
        }
    }

    const plainSettings = settings.toObject ? settings.toObject() : settings;
    // Cache settings for 10 minutes (600 seconds)
    await setCache('system_settings:general', plainSettings, 600);
    return plainSettings;
};

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
