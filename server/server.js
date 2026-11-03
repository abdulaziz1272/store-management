// Entry point of the backend.
// It loads the environment variables, connects to the database and starts the web server.

require('dotenv').config();

const app = require('./src/app');
const { connectDatabase } = require('./src/config/db');
const { startInternalCron } = require('./src/services/scheduler');

const PORT = process.env.PORT || 5000;

function checkRequiredEnv() {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error('Missing environment variables: ' + missing.join(', '));
    console.error('Copy .env.example to .env and fill it in.');
    process.exit(1);
  }
}

async function start() {
  checkRequiredEnv();

  await connectDatabase();
  console.log('Database connected');

  app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
  });

  startInternalCron();
}

start().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});
