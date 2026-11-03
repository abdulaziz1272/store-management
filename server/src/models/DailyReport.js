// Remembers which daily reports were already sent, so nothing is sent twice.
// scope is a branch id, or the word "global" for the report of general changes.

const mongoose = require('mongoose');

const dailyReportSchema = new mongoose.Schema(
  {
    scope: { type: String, required: true },
    date: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    attempts: { type: Number, default: 0 },
    error: { type: String, default: '' },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

// One row for each scope and date. The database itself refuses duplicates.
dailyReportSchema.index({ scope: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyReport', dailyReportSchema);
