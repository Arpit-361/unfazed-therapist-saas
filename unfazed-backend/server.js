const http = require('http');
const mongoose = require('mongoose');
const config = require('./src/config/env');
const { connectDB, disconnectDB } = require('./src/config/db');
const { app, allowedOrigins } = require('./src/app');
const { initSocket } = require('./src/sockets/chatSocket');
const entitlementService = require('./src/services/entitlementService');
const schedulerService = require('./src/services/schedulerService');
const { seedDatabase } = require('./src/utils/seed');
const Therapist = require('./src/models/Therapist');

async function start() {
  const { inMemory } = await connectDB();
  await mongoose.connection.syncIndexes();
  await entitlementService.ensureTierConfigs();

  if (inMemory || (config.seedOnStart && (await Therapist.estimatedDocumentCount()) === 0)) {
    await seedDatabase();
  }

  const server = http.createServer(app);
  initSocket(server, allowedOrigins);
  schedulerService.start();

  server.listen(config.port, () => {
    console.log(`[server] Unfazed API listening on http://localhost:${config.port} (demo mode: ${config.demoMode})`);
  });

  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received, shutting down`);
    schedulerService.stop();
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
