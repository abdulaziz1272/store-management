// Collects everything that happened in ONE store day (local time) for ONE branch,
// or the "global" report with general changes (products, users, units ...).

const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Purchase = require('../models/Purchase');
const Transfer = require('../models/Transfer');
const StockMovement = require('../models/StockMovement');
const DebtEntry = require('../models/DebtEntry');
const AuditLog = require('../models/AuditLog');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const { getStoreDayRange, formatStoreTime, toStoreDateString } = require('../utils/dates');

// Readable names for the report (Uzbek)
const PAYMENT_LABELS = {
  cash: 'Naqd',
  card: 'Karta',
  transfer: "O'tkazma",
  credit: 'Nasiya',
};

const MOVEMENT_LABELS = {
  receive: 'Kirim',
  sale: 'Sotuv',
  return: 'Qaytarish',
  transfer_out: "Ko'chirish (chiqim)",
  transfer_in: "Ko'chirish (kirim)",
  adjustment: 'Tuzatish',
};

const ENTITY_LABELS = {
  Product: 'Mahsulot',
  Unit: "O'lchov birligi",
  Branch: 'Filial',
  User: 'Foydalanuvchi',
  Supplier: 'Yetkazib beruvchi',
  Customer: 'Mijoz',
};

const ACTION_LABELS = {
  create: "Qo'shildi",
  update: "O'zgartirildi",
  import: 'Import',
};

// Turns a value into short readable text
function shortText(value) {
  if (value === undefined || value === null) {
    return '-';
  }

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 80 ? text.slice(0, 77) + '...' : text;
}

// {price: 10} -> {price: 12}  becomes  "price: 10 -> 12"
function describeChanges(before, after) {
  const keys = Object.keys(after || before || {});

  if (keys.length === 0) {
    return '';
  }

  return keys
    .map((key) => key + ': ' + shortText(before ? before[key] : undefined) + ' -> ' + shortText(after ? after[key] : undefined))
    .join('\n');
}

function emptyMethodTotals() {
  return { cash: 0, card: 0, transfer: 0, credit: 0 };
}

// MAIN FUNCTION
// scope: a branch id, or the word "global"
async function buildDailyReport(scope, date) {
  const { start, end } = getStoreDayRange(date);
  const timeFilter = { $gte: start, $lt: end };

  const report = {
    scope: scope === 'global' ? 'global' : 'branch',
    date,
    branch: null,
    generatedAt: new Date(),
    summary: null,
    sales: [],
    returns: [],
    purchases: [],
    transfers: [],
    movements: [],
    debtPayments: [],
    audit: [],
  };

  // GLOBAL REPORT: only general changes made by admin (no branch)
  if (scope === 'global') {
    const logs = await AuditLog.find({ branch: null, createdAt: timeFilter }).sort({ createdAt: 1 });
    report.audit = logs.map(mapAuditRow);

    report.summary = { auditCount: report.audit.length };
    return report;
  }

  // BRANCH REPORT
  const branch = await Branch.findById(scope);

  if (!branch) {
    throw new AppError(404, 'Filial topilmadi');
  }

  report.branch = { id: branch._id, name: branch.name, code: branch.code };

  const sales = await Sale.find({ branch: branch._id, createdAt: timeFilter })
    .populate('cashier', 'fullName')
    .populate('customer', 'name')
    .sort({ createdAt: 1 });

  const returns = await SaleReturn.find({ branch: branch._id, createdAt: timeFilter })
    .populate('user', 'fullName')
    .populate('customer', 'name')
    .sort({ createdAt: 1 });

  const purchases = await Purchase.find({ branch: branch._id, createdAt: timeFilter })
    .populate('supplier', 'name')
    .populate('user', 'fullName')
    .sort({ createdAt: 1 });

  const transfers = await Transfer.find({
    $or: [{ fromBranch: branch._id }, { toBranch: branch._id }],
    createdAt: timeFilter,
  })
    .populate('fromBranch', 'name')
    .populate('toBranch', 'name')
    .populate('user', 'fullName')
    .sort({ createdAt: 1 });

  const movements = await StockMovement.find({ branch: branch._id, createdAt: timeFilter })
    .populate('product', 'name')
    .populate('user', 'fullName')
    .sort({ createdAt: 1 });

  const debtPayments = await DebtEntry.find({ branch: branch._id, type: 'payment', createdAt: timeFilter })
    .populate('customer', 'name')
    .populate('user', 'fullName')
    .sort({ createdAt: 1 });

  const logs = await AuditLog.find({ branch: branch._id, createdAt: timeFilter }).sort({ createdAt: 1 });

  // --- Rows for the tables ---

  report.sales = sales.map((sale) => ({
    time: formatStoreTime(sale.createdAt, true),
    number: sale.number,
    cashier: sale.cashier ? sale.cashier.fullName : '-',
    customer: sale.customer ? sale.customer.name : '-',
    items: sale.items.map((item) => item.name + ' x ' + item.quantity + ' ' + item.unitName).join('\n'),
    discount: sale.discountAmount,
    total: sale.total,
    payments: sale.payments.map((p) => PAYMENT_LABELS[p.method] + ': ' + p.amount).join('\n'),
    status: sale.status,
  }));

  report.returns = returns.map((item) => ({
    time: formatStoreTime(item.createdAt, true),
    number: item.number,
    saleNumber: item.saleNumber,
    user: item.user ? item.user.fullName : '-',
    customer: item.customer ? item.customer.name : '-',
    items: item.items.map((line) => line.name + ' x ' + line.quantity + ' ' + line.unitName).join('\n'),
    refundAmount: item.refundAmount,
    debtReduced: item.debtReduced,
    paidOut: item.paidOut,
    paidOutMethod: PAYMENT_LABELS[item.paidOutMethod] || '',
    reason: item.reason,
  }));

  report.purchases = purchases.map((item) => ({
    time: formatStoreTime(item.createdAt, true),
    number: item.number,
    supplier: item.supplier ? item.supplier.name : '-',
    user: item.user ? item.user.fullName : '-',
    items: item.items.map((line) => line.name + ' x ' + line.quantity + ' ' + line.unitName).join('\n'),
    totalCost: item.totalCost,
  }));

  report.transfers = transfers.map((item) => ({
    time: formatStoreTime(item.createdAt, true),
    number: item.number,
    direction: String(item.fromBranch._id) === String(branch._id) ? 'Chiqim' : 'Kirim',
    from: item.fromBranch.name,
    to: item.toBranch.name,
    user: item.user ? item.user.fullName : '-',
    items: item.items.map((line) => line.name + ' x ' + line.baseQuantity + ' ' + line.unitName).join('\n'),
  }));

  report.movements = movements.map((item) => ({
    time: formatStoreTime(item.createdAt, true),
    type: MOVEMENT_LABELS[item.type] || item.type,
    product: item.product ? item.product.name : '-',
    batchNumber: item.batchNumber,
    quantity: item.quantity,
    refNumber: item.refNumber,
    user: item.user ? item.user.fullName : '-',
    note: item.note,
  }));

  report.debtPayments = debtPayments.map((item) => ({
    time: formatStoreTime(item.createdAt, true),
    customer: item.customer ? item.customer.name : '-',
    amount: -item.amount,
    method: PAYMENT_LABELS[item.method] || item.method,
    user: item.user ? item.user.fullName : '-',
    note: item.note,
  }));

  report.audit = logs.map(mapAuditRow);

  // --- Summary numbers ---

  const paymentsByMethod = emptyMethodTotals();
  let salesTotal = 0;
  let discountTotal = 0;
  let newDebt = 0;

  for (const sale of sales) {
    salesTotal += sale.total;
    discountTotal += sale.discountAmount;
    newDebt += sale.debtAmount;

    for (const payment of sale.payments) {
      paymentsByMethod[payment.method] += payment.amount;
    }
  }

  const refundsByMethod = emptyMethodTotals();
  let refundTotal = 0;
  let debtReducedByReturns = 0;

  for (const item of returns) {
    refundTotal += item.refundAmount;
    debtReducedByReturns += item.debtReduced;
    refundsByMethod[item.paidOutMethod] += item.paidOut;
  }

  const debtPaymentsByMethod = emptyMethodTotals();
  let debtPaymentsTotal = 0;

  for (const entry of debtPayments) {
    debtPaymentsTotal += -entry.amount;
    debtPaymentsByMethod[entry.method] = (debtPaymentsByMethod[entry.method] || 0) - entry.amount;
  }

  let purchaseTotal = 0;

  for (const purchase of purchases) {
    purchaseTotal += purchase.totalCost;
  }

  report.summary = {
    salesCount: sales.length,
    salesTotal,
    discountTotal,
    newDebt,
    returnsCount: returns.length,
    refundTotal,
    debtReducedByReturns,
    purchaseCount: purchases.length,
    purchaseTotal,
    debtPaymentsTotal,
    paymentsByMethod,
    refundsByMethod,
    debtPaymentsByMethod,
    // Money that really entered the cashbox during the day, by method (credit is not money)
    netByMethod: {
      cash: paymentsByMethod.cash - refundsByMethod.cash + debtPaymentsByMethod.cash,
      card: paymentsByMethod.card - refundsByMethod.card + debtPaymentsByMethod.card,
      transfer: paymentsByMethod.transfer - refundsByMethod.transfer + debtPaymentsByMethod.transfer,
    },
    movementCount: movements.length,
    auditCount: report.audit.length,
  };

  return report;
}

function mapAuditRow(log) {
  return {
    time: formatStoreTime(log.createdAt, true),
    user: log.username + ' (' + log.role + ')',
    action: ACTION_LABELS[log.action] || log.action,
    entity: ENTITY_LABELS[log.entity] || log.entity,
    label: log.label,
    changes: describeChanges(log.before, log.after),
  };
}

// The date of "yesterday" or any date string is accepted by buildDailyReport.
// This tiny helper is used by the job to print the date in messages.
function reportTitleDate(date) {
  return toStoreDateString(getStoreDayRange(date).start);
}

module.exports = { buildDailyReport, reportTitleDate, PAYMENT_LABELS };
