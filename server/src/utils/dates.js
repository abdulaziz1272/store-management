// Date helpers for the "store day".
//
// Dates are saved in the database in UTC. But a "day" for the store starts at
// 00:00 LOCAL time (UTC+5 for Uzbekistan). So we shift the time by the offset.

const { STORE_UTC_OFFSET_HOURS } = require('../config/constants');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Date -> "YYYY-MM-DD" in store local time
function toStoreDateString(date) {
  const shifted = new Date(new Date(date).getTime() + STORE_UTC_OFFSET_HOURS * HOUR_MS);
  return shifted.toISOString().slice(0, 10);
}

function todayStoreDate() {
  return toStoreDateString(new Date());
}

function yesterdayStoreDate() {
  return toStoreDateString(new Date(Date.now() - DAY_MS));
}

function isValidDateString(text) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(text || ''));
}

// "2026-11-01" -> { start, end } where start is local 00:00 and end is next local 00:00.
// Use it like:  createdAt: { $gte: start, $lt: end }
function getStoreDayRange(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const startUtc = Date.UTC(year, month - 1, day) - STORE_UTC_OFFSET_HOURS * HOUR_MS;

  return {
    start: new Date(startUtc),
    end: new Date(startUtc + DAY_MS),
  };
}

// Range between two date strings (inclusive). Either side can be empty.
function getStoreRange(fromString, toString) {
  const range = {};

  if (isValidDateString(fromString)) {
    range.$gte = getStoreDayRange(fromString).start;
  }

  if (isValidDateString(toString)) {
    range.$lt = getStoreDayRange(toString).end;
  }

  return Object.keys(range).length > 0 ? range : null;
}

// Date -> "HH:mm" or "HH:mm:ss" in store local time
function formatStoreTime(date, withSeconds = false) {
  const shifted = new Date(new Date(date).getTime() + STORE_UTC_OFFSET_HOURS * HOUR_MS);
  const text = shifted.toISOString().slice(11, 19);
  return withSeconds ? text : text.slice(0, 5);
}

module.exports = {
  toStoreDateString,
  todayStoreDate,
  yesterdayStoreDate,
  isValidDateString,
  getStoreDayRange,
  getStoreRange,
  formatStoreTime,
};
