// Values that are used in many places. Change them here, not in the code.

const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CASHIER: 'cashier',
};

// "credit" means the customer will pay later (it creates a debt)
const PAYMENT_METHODS = ['cash', 'card', 'transfer', 'credit'];

// Methods that can be used to give money back or to pay a debt
const MONEY_METHODS = ['cash', 'card', 'transfer'];

const MOVEMENT_TYPES = [
  'receive',
  'sale',
  'return',
  'transfer_out',
  'transfer_in',
  'adjustment',
];

// Uzbekistan is UTC+5 all year. If the store moves to another timezone, change .env
const STORE_UTC_OFFSET_HOURS = Number(process.env.STORE_UTC_OFFSET_HOURS || 5);
const STORE_TIMEZONE = process.env.STORE_TIMEZONE || 'Asia/Tashkent';

const MAX_CASHIER_DISCOUNT_PERCENT = Number(
  process.env.MAX_CASHIER_DISCOUNT_PERCENT || 10
);

module.exports = {
  ROLES,
  PAYMENT_METHODS,
  MONEY_METHODS,
  MOVEMENT_TYPES,
  STORE_UTC_OFFSET_HOURS,
  STORE_TIMEZONE,
  MAX_CASHIER_DISCOUNT_PERCENT,
};
