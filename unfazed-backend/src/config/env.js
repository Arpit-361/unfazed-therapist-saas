const crypto = require('crypto');
require('dotenv').config({ quiet: true });

const toBool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIntList = (value, fallback) => {
  if (!value) return fallback;
  const list = value
    .split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter(Number.isFinite);
  return list.length ? list : fallback;
};

const demoMode = toBool(process.env.DEMO_MODE, false);
const nodeEnv = process.env.NODE_ENV || 'development';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === 'replace_with_a_long_random_string') {
  if (!demoMode) {
    throw new Error('JWT_SECRET must be set (or run with DEMO_MODE=true)');
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[config] JWT_SECRET not set - generated an ephemeral secret for DEMO_MODE');
}

const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: toInt(process.env.PORT, 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  apiPublicUrl: process.env.API_PUBLIC_URL || `http://localhost:${toInt(process.env.PORT, 5000)}`,
  mongoUri: process.env.MONGO_URI || '',
  demoMode,
  seedOnStart: toBool(process.env.SEED_ON_START, demoMode),
  demoPassword: process.env.DEMO_PASSWORD || 'Demo@1234',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  pricing: {
    currency: process.env.CURRENCY || 'INR',
    gstRatePercent: toInt(process.env.GST_RATE_PERCENT, 18),
    defaultSessionPriceInr: toInt(process.env.DEFAULT_SESSION_PRICE_INR, 1500),
    packageSizes: toIntList(process.env.PACKAGE_SIZES, [3, 6, 12]),
    paymentHoldMinutes: toInt(process.env.PAYMENT_HOLD_MINUTES, 15),
  },
  scheduling: {
    sessionDurations: toIntList(process.env.SESSION_DURATIONS, [30, 45, 60, 90]),
    slotStepMinutes: toInt(process.env.SLOT_STEP_MINUTES, 30),
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Unfazed <no-reply@unfazed.in>',
  },
  whatsapp: {
    provider: process.env.WHATSAPP_PROVIDER || 'stub',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: process.env.STORAGE_LOCAL_DIR || 'uploads',
    s3: {
      region: process.env.AWS_REGION || '',
      bucket: process.env.AWS_S3_BUCKET || '',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  },
  schedulerIntervalSeconds: toInt(process.env.SCHEDULER_INTERVAL_SECONDS, 60),
};

module.exports = config;
