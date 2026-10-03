/**
 * Seeds a persistent MongoDB (MONGO_URI) with demo data. Usage: npm run seed
 * With DEMO_MODE and no MONGO_URI, the in-memory database is seeded automatically on server start.
 */
const mongoose = require('mongoose');
const config = require('../src/config/env');
const { seedDatabase } = require('../src/utils/seed');

async function run() {
  if (!config.mongoUri) {
    console.log('MONGO_URI is not set. In DEMO_MODE the in-memory database is seeded automatically when the server starts.');
    process.exit(0);
  }
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.syncIndexes();
  await seedDatabase({ reset: true });
  await mongoose.disconnect();
  console.log('Seed complete.');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
