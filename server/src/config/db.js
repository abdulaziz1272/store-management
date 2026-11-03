// Database connection.

const mongoose = require('mongoose');

async function connectDatabase() {
  mongoose.set('strictQuery', true);

  await mongoose.connect(process.env.MONGODB_URI);

  // Load all models so that every collection and index exists
  // BEFORE the first transaction runs (transactions cannot create indexes).
  require('../models');

  const models = Object.values(mongoose.models);

  for (const model of models) {
    await model.init();
  }
}

module.exports = { connectDatabase };
