// Sales (checkout).

const express = require('express');

const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const Customer = require('../models/Customer');
const DebtEntry = require('../models/DebtEntry');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');
const { ROLES, PAYMENT_METHODS, MAX_CASHIER_DISCOUNT_PERCENT } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope, getBranchForWrite, assertBranchAccess } = require('../utils/permissions');
const { getStoreRange } = require('../utils/dates');
const { nextSequence, padNumber } = require('../utils/sequence');
const { runInTransaction } = require('../utils/transaction');
const { resolveUnit, assertQuantity } = require('../utils/units');
const { roundMoney, roundQty } = require('../utils/money');
const { removeStock } = require('../services/stockService');

const router = express.Router();

router.use(protect);

const POPULATE_SALE = [
  { path: 'branch', select: 'name code address phone' },
  { path: 'cashier', select: 'fullName' },
  { path: 'customer', select: 'name phone debt' },
];

// LIST  /api/sales?branch=&from=&to=&search=&customer=&page=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 20, 100);
    const branchId = getBranchScope(req, req.query.branch);

    const filter = {};

    if (branchId) {
      filter.branch = branchId;
    }

    if (req.query.customer) {
      filter.customer = req.query.customer;
    }

    if (req.query.search) {
      const safeText = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.number = new RegExp(safeText, 'i');
    }

    const range = getStoreRange(req.query.from, req.query.to);

    if (range) {
      filter.createdAt = range;
    }

    const total = await Sale.countDocuments(filter);
    const items = await Sale.find(filter)
      .select('-items.allocations')
      .populate(POPULATE_SALE)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

// ONE SALE (for the receipt and for returns)
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const sale = await Sale.findById(req.params.id).populate(POPULATE_SALE);

    if (!sale) {
      throw new AppError(404, 'Sotuv topilmadi');
    }

    assertBranchAccess(req, sale.branch._id);

    res.json({ sale });
  })
);

// Calculates the discount amount and checks the cashier limit
function calculateDiscount(body, subtotal, role) {
  const discountType = ['percent', 'amount'].includes(body.discountType) ? body.discountType : 'none';
  const discountValue = Number(body.discountValue) || 0;

  let discountAmount = 0;

  if (discountType === 'percent') {
    if (discountValue < 0 || discountValue > 100) {
      throw new AppError(400, "Chegirma foizi 0 dan 100 gacha bo'lsin");
    }

    discountAmount = roundMoney((subtotal * discountValue) / 100);
  }

  if (discountType === 'amount') {
    if (discountValue < 0 || discountValue > subtotal) {
      throw new AppError(400, "Chegirma summasi noto'g'ri");
    }

    discountAmount = roundMoney(discountValue);
  }

  if (role === ROLES.CASHIER && subtotal > 0) {
    const percent = (discountAmount / subtotal) * 100;

    if (percent > MAX_CASHIER_DISCOUNT_PERCENT) {
      throw new AppError(
        403,
        'Kassir ' + MAX_CASHIER_DISCOUNT_PERCENT + '% dan ortiq chegirma bera olmaydi. Menejerga murojaat qiling'
      );
    }
  }

  return { discountType, discountValue, discountAmount };
}

// CREATE A SALE
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const branchId = getBranchForWrite(req, req.body.branchId);
    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];

    if (itemsInput.length === 0) {
      throw new AppError(400, "Savat bo'sh");
    }

    const branch = await Branch.findById(branchId);

    if (!branch || !branch.isActive) {
      throw new AppError(400, 'Filial topilmadi');
    }

    if (branch.isWarehouse) {
      throw new AppError(400, "Omborxonadan sotib bo'lmaydi");
    }

    const products = await Product.find({
      _id: { $in: itemsInput.map((item) => item.productId) },
      isActive: true,
    })
      .populate('baseUnit', 'name allowDecimal')
      .populate('altUnits.unit', 'name allowDecimal');

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    // STEP 1: build the sale lines and the numbers (nothing is saved yet)
    const lines = [];
    let subtotal = 0;

    for (const input of itemsInput) {
      const product = productMap.get(String(input.productId));

      if (!product) {
        throw new AppError(400, 'Mahsulot topilmadi yoki faol emas');
      }

      const unitInfo = resolveUnit(product, input.unitId);
      const quantity = assertQuantity(input.quantity, unitInfo, product.name);

      // The price always comes from the database, never from the browser
      const unitPrice = roundMoney(product.price * unitInfo.factor);
      const lineTotal = roundMoney(unitPrice * quantity);

      subtotal += lineTotal;

      lines.push({
        product: product._id,
        productName: product.name,
        sku: product.sku,
        unitName: unitInfo.unitName,
        quantity,
        baseQuantity: roundQty(quantity * unitInfo.factor),
        unitPrice,
        lineTotal,
      });
    }

    const discount = calculateDiscount(req.body, subtotal, req.user.role);
    const total = subtotal - discount.discountAmount;

    if (total <= 0) {
      throw new AppError(400, "Jami summa 0 dan katta bo'lishi kerak");
    }

    // STEP 2: check the payments
    const paymentsInput = Array.isArray(req.body.payments) ? req.body.payments : [];
    const payments = [];
    let paidTotal = 0;
    let debtAmount = 0;

    for (const input of paymentsInput) {
      const amount = roundMoney(input.amount);

      if (amount <= 0) {
        continue;
      }

      if (!PAYMENT_METHODS.includes(input.method)) {
        throw new AppError(400, "To'lov turi noto'g'ri");
      }

      payments.push({ method: input.method, amount });
      paidTotal += amount;

      if (input.method === 'credit') {
        debtAmount += amount;
      }
    }

    if (paidTotal !== total) {
      throw new AppError(400, "To'lovlar yig'indisi jami summaga teng bo'lishi kerak");
    }

    if (debtAmount > 0 && !req.body.customerId) {
      throw new AppError(400, 'Nasiyaga sotish uchun mijozni tanlang');
    }

    // STEP 3: save everything in ONE transaction
    const saleId = await runInTransaction(async (session) => {
      const sequence = await nextSequence('sale-' + branchId, session);
      const number = branch.code + '-' + padNumber(sequence);

      const saleItems = [];

      for (const line of lines) {
        const allocations = await removeStock({
          productId: line.product,
          productName: line.productName,
          branchId,
          baseQuantity: line.baseQuantity,
          type: 'sale',
          refNumber: number,
          userId: req.user._id,
          session,
        });

        saleItems.push({
          product: line.product,
          name: line.productName,
          sku: line.sku,
          unitName: line.unitName,
          quantity: line.quantity,
          baseQuantity: line.baseQuantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          allocations,
        });
      }

      const created = await Sale.create(
        [
          {
            number,
            branch: branchId,
            cashier: req.user._id,
            customer: req.body.customerId || undefined,
            items: saleItems,
            subtotal,
            discountType: discount.discountType,
            discountValue: discount.discountValue,
            discountAmount: discount.discountAmount,
            total,
            payments,
            debtAmount,
            note: String(req.body.note || ''),
          },
        ],
        { session }
      );

      if (debtAmount > 0) {
        const customer = await Customer.findOneAndUpdate(
          { _id: req.body.customerId, isActive: true },
          { $inc: { debt: debtAmount } },
          { new: true, session }
        );

        if (!customer) {
          throw new AppError(400, 'Mijoz topilmadi');
        }

        await DebtEntry.create(
          [
            {
              customer: customer._id,
              branch: branchId,
              type: 'sale',
              amount: debtAmount,
              balanceAfter: customer.debt,
              refNumber: number,
              user: req.user._id,
            },
          ],
          { session }
        );
      }

      return created[0]._id;
    });

    const sale = await Sale.findById(saleId).populate(POPULATE_SALE);

    res.status(201).json({ sale });
  })
);

module.exports = router;
