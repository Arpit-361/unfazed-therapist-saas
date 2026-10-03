const mongoose = require('mongoose');
const config = require('./env');

let memoryServer = null;

async function connectDB() {
  mongoose.set('strictQuery', true);

  if (config.mongoUri) {
    await mongoose.connect(config.mongoUri);
    console.log(`[db] Connected to MongoDB (${mongoose.connection.host})`);
    return { inMemory: false };
  }

  if (!config.demoMode) {
    throw new Error('MONGO_URI is required unless DEMO_MODE=true');
  }

  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('unfazed'));
  console.log('[db] DEMO_MODE: connected to in-memory MongoDB (data resets on restart)');
  return { inMemory: true };
}

async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}

module.exports = { connectDB, disconnectDB };
