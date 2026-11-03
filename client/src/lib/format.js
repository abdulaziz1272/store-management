// Helpers that show numbers and dates in a readable way.

export const STORE_TIMEZONE = 'Asia/Tashkent';

// 1234567 -> "1 234 567"
export function formatNumber(value) {
  const number = Math.round(Number(value) || 0);
  return String(number).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// 1234567 -> "1 234 567 so'm"
export function formatMoney(value) {
  return formatNumber(value) + " so'm";
}

// 2.5 -> "2.5", 3 -> "3", 0.1+0.2 -> "0.3"
export function formatQty(value) {
  const number = Math.round((Number(value) || 0) * 1000) / 1000;
  return String(number);
}

export function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('ru-RU', { timeZone: STORE_TIMEZONE });
}

export function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  const day = date.toLocaleDateString('ru-RU', { timeZone: STORE_TIMEZONE });
  const time = date.toLocaleTimeString('ru-RU', {
    timeZone: STORE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });

  return day + ' ' + time;
}

// Today as "YYYY-MM-DD" in store time (used by date inputs)
export function todayString() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: STORE_TIMEZONE });
}

// N days ago as "YYYY-MM-DD" in store time
export function daysAgoString(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toLocaleDateString('sv-SE', { timeZone: STORE_TIMEZONE });
}

// Expiry date from the server -> "YYYY-MM-DD" for a date input
export function toInputDate(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('sv-SE', { timeZone: STORE_TIMEZONE });
}
