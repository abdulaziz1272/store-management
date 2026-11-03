// The nightly job: builds a PDF for every branch (plus one "global" report)
// and sends them to Telegram.
//
// It is safe to run many times: a report that was already sent is skipped
// (see the DailyReport collection), and one failing branch never stops the others.

const Branch = require('../models/Branch');
const DailyReport = require('../models/DailyReport');
const { buildDailyReport } = require('./reportService');
const { createReportPdf, reportFileName, money } = require('./pdfService');
const { sendTelegramDocument, sendTelegramMessage } = require('./telegramService');
const { yesterdayStoreDate } = require('../utils/dates');

// Telegram limits how fast a bot can send. A short pause keeps us safe.
const PAUSE_BETWEEN_SENDS_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Short text that goes under the PDF in Telegram
function buildCaption(report) {
  if (report.scope === 'global') {
    return "Umumiy o'zgarishlar\nSana: " + report.date + "\nO'zgarishlar soni: " + report.summary.auditCount;
  }

  const s = report.summary;

  return [
    'Filial: ' + report.branch.name,
    'Sana: ' + report.date,
    'Sotuvlar: ' + s.salesCount + ' ta, ' + money(s.salesTotal) + " so'm",
    'Qaytarishlar: ' + s.returnsCount + ' ta, ' + money(s.refundTotal) + " so'm",
    'Kirim: ' + s.purchaseCount + ' ta, ' + money(s.purchaseTotal) + " so'm",
    "Qarz to'lovlari: " + money(s.debtPaymentsTotal) + " so'm",
  ].join('\n');
}

// Sends ONE report. Throws an error if something fails.
async function sendOneReport(scope, date) {
  const report = await buildDailyReport(scope, date);
  const pdf = await createReportPdf(report);

  await sendTelegramDocument(pdf, reportFileName(report), buildCaption(report));
}

async function markResult(scope, date, status, errorMessage) {
  const update = {
    $set: { status, error: errorMessage || '' },
    $inc: { attempts: 1 },
  };

  if (status === 'sent') {
    update.$set.sentAt = new Date();
  }

  await DailyReport.findOneAndUpdate({ scope, date }, update, { upsert: true });
}

// Runs the job for one date (default: yesterday)
async function sendDailyReports(date = yesterdayStoreDate()) {
  const branches = await Branch.find({ isActive: true }).sort({ name: 1 });

  // One report for each branch, and one for general changes
  const scopes = branches.map((branch) => ({ scope: String(branch._id), name: branch.name }));
  scopes.push({ scope: 'global', name: "Umumiy o'zgarishlar" });

  const sent = [];
  const skipped = [];
  const failed = [];

  for (const item of scopes) {
    const already = await DailyReport.findOne({ scope: item.scope, date, status: 'sent' });

    if (already) {
      skipped.push(item.name);
      continue;
    }

    try {
      await sendOneReport(item.scope, date);
      await markResult(item.scope, date, 'sent');
      sent.push(item.name);
    } catch (error) {
      // One branch failed: remember it and go on with the next branch
      console.error('Report failed for ' + item.name + ':', error.message);
      await markResult(item.scope, date, 'failed', error.message);
      failed.push(item.name + ' (' + error.message + ')');
    }

    await sleep(PAUSE_BETWEEN_SENDS_MS);
  }

  // A final status message, so a missing report is never overlooked
  try {
    let text = 'Hisobotlar (' + date + '): yuborildi ' + sent.length + ' / ' + scopes.length + '.';

    if (skipped.length > 0) {
      text += '\nOldin yuborilgan: ' + skipped.length;
    }

    if (failed.length > 0) {
      text += '\nXatolik: ' + failed.join('; ');
    }

    await sendTelegramMessage(text);
  } catch (error) {
    console.error('Status message failed:', error.message);
  }

  return { date, sent, skipped, failed };
}

module.exports = { sendDailyReports, sendOneReport, buildCaption };
