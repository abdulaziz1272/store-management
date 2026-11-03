// Optional: runs the daily report inside this server at 00:00 store time.
// Turn it on with ENABLE_INTERNAL_CRON=true in .env.
//
// On a free hosting plan the server sleeps when nobody uses it, and a sleeping
// server cannot run a schedule. In that case use an external scheduler that calls
// POST /api/reports/cron/daily (see README).

const cron = require('node-cron');
const { sendDailyReports } = require('./dailyReportJob');
const { STORE_TIMEZONE } = require('../config/constants');

function startInternalCron() {
  if (process.env.ENABLE_INTERNAL_CRON !== 'true') {
    return;
  }

  // "0 0 * * *" = every day at 00:00
  cron.schedule(
    '0 0 * * *',
    () => {
      sendDailyReports().catch((error) => console.error('Daily report job failed:', error));
    },
    { timezone: STORE_TIMEZONE }
  );

  console.log('Internal daily report cron is ON (' + STORE_TIMEZONE + ')');
}

module.exports = { startInternalCron };
