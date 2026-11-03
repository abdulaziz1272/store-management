// Daily reports: view, download as PDF, send to Telegram, and the trigger for the scheduler.

const express = require('express');
const crypto = require('crypto');

const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { isValidDateString, yesterdayStoreDate } = require('../utils/dates');
const { buildDailyReport } = require('../services/reportService');
const { createReportPdf, reportFileName } = require('../services/pdfService');
const { sendDailyReports, sendOneReport } = require('../services/dailyReportJob');

const router = express.Router();

// ---------- Trigger for the external scheduler (no login, uses a secret) ----------

function secretsMatch(a, b) {
  const first = Buffer.from(String(a || ''));
  const second = Buffer.from(String(b || ''));

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

// POST /api/reports/cron/daily      header:  x-cron-secret: <CRON_SECRET>
// It answers at once and works in the background, because external schedulers
// wait only a few seconds for an answer.
router.post('/cron/daily', (req, res, next) => {
  const secret = process.env.CRON_SECRET;

  if (!secret || !secretsMatch(req.headers['x-cron-secret'], secret)) {
    return next(new AppError(401, 'Ruxsat yo\'q'));
  }

  const date = isValidDateString(req.query.date) ? req.query.date : yesterdayStoreDate();

  sendDailyReports(date).catch((error) => console.error('Daily report job failed:', error));

  return res.status(202).json({ message: 'Hisobotlar yuborilmoqda', date });
});

// ---------- Everything below needs a login ----------

router.use(protect);

// Works out which report the user asks for and checks the permission
function readReportRequest(req) {
  const date = req.query.date;

  if (!isValidDateString(date)) {
    throw new AppError(400, "Sanani kiriting (YYYY-MM-DD)");
  }

  let scope = req.query.branch;

  if (req.user.role !== ROLES.ADMIN) {
    // Managers and cashiers can only see their own branch
    scope = String(req.user.branch);
  }

  if (!scope) {
    throw new AppError(400, 'Filialni tanlang');
  }

  return { date, scope };
}

// Cashiers do not see reports
router.use(requireRole(ROLES.ADMIN, ROLES.MANAGER));

// JSON report for the screen
router.get(
  '/daily',
  asyncHandler(async (req, res) => {
    const { date, scope } = readReportRequest(req);
    const report = await buildDailyReport(scope, date);
    res.json({ report });
  })
);

// PDF download
router.get(
  '/daily/pdf',
  asyncHandler(async (req, res) => {
    const { date, scope } = readReportRequest(req);
    const report = await buildDailyReport(scope, date);
    const pdf = await createReportPdf(report);

    const fileName = reportFileName(report);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(fileName) + '"');
    res.send(pdf);
  })
);

// Send one report to Telegram right now (admin only)
router.post(
  '/send',
  requireRole(ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const { date, scope } = readReportRequest(req);
    await sendOneReport(scope, date);
    res.json({ message: 'Telegramga yuborildi' });
  })
);

module.exports = router;
