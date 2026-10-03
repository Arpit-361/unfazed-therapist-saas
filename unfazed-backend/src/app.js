const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config/env');
const storageService = require('./services/storageService');
const { describeGateway } = require('./services/paymentGatewayService');
const { isSmtpConfigured } = require('./services/emailService');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const therapistController = require('./controllers/therapistController');

const allowedOrigins = [config.clientUrl, ...(process.env.CORS_EXTRA_ORIGINS || '').split(',').filter(Boolean)];

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(cors({ origin: allowedOrigins, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(
  express.json({
    limit: '1mb',
    // Raw body is needed to verify Razorpay webhook signatures.
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

// Only the "public/" storage prefix is web-served (avatars). Invoices stay private.
app.use('/uploads/public', express.static(path.join(storageService.localRoot, 'public'), { maxAge: '7d' }));

app.get('/api/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    success: true,
    status: 'ok',
    service: 'unfazed-api',
    database: dbStates[mongoose.connection.readyState] || 'unknown',
    demo_mode: config.demoMode,
    integrations: {
      payments: describeGateway().gateway,
      email: isSmtpConfigured ? 'smtp' : 'console-stub',
      whatsapp: 'stub',
      storage: storageService.driverName,
    },
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/therapists', require('./routes/therapistRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/scheduling', require('./routes/schedulingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/entitlements', require('./routes/entitlementRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/portal', require('./routes/portalRoutes'));

// Crawler-friendly Open Graph share link: <API_PUBLIC_URL>/share/:slug
app.get('/share/:slug', therapistController.sharePage);

app.use(notFound);
app.use(errorHandler);

module.exports = { app, allowedOrigins };
