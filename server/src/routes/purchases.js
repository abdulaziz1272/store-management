// Purchases ("Kirim"): goods received from a supplier into a branch.

const express = require('express');

const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope, getBranchForWrite } = require('../utils/permissions');
const { getStoreRange, getStoreDayRange, isValidDateString } = require('../utils/dates');
const { nextSequence, padNumber } = require('../utils/sequence');
const { runInTransaction } = require('../utils/transaction');
const { resolveUnit, assertQuantity } = require('../utils/units');
const { roundMoney, roundQty, roundCost } = require('../utils/money');
const { addStock } = require('../services/stockService');

const router = express.Router();

router.use(protect);

// LIST
router.get(
  '/',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 20, 100);
    const branchId = getBranchScope(req, req.query.branch);

    const filter = {};

    if (branchId) {
      filter.branch = branchId;
    }

    const range = getStoreRange(req.query.from, req.query.to);

    if (range) {
      filter.createdAt = range;
    }

    const total = await Purchase.countDocuments(filter);
    const items = await Purchase.find(filter)
      .populate('branch', 'name')
      .populate('supplier', 'name')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

// Expiry date "2026-12-31" -> the LAST moment of that day in store time
function parseExpiry(text, product) {
  if (!text) {
    if (product.trackExpiry) {
      throw new AppError(400, 'Yaroqlilik muddatini kiriting: ' + product.name);
    }

    return null;
  }

  if (!isValidDateString(text)) {
    throw new AppError(400, "Yaroqlilik muddati noto'g'ri: " + product.name);
  }

  return new Date(getStoreDayRange(text).end.getTime() - 1);
}

// CREATE
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const branchId = getBranchForWrite(req, req.body.branchId);
    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];

    if (itemsInput.length === 0) {
      throw new AppError(400, "Mahsulot qo'shing");
    }

    const branch = await Branch.findById(branchId);

    if (!branch || !branch.isActive) {
      throw new AppError(400, 'Filial topilmadi');
    }

    const productIds = itemsInput.map((item) => item.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .populate('baseUnit', 'name allowDecimal')
      .populate('altUnits.unit', 'name allowDecimal');

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    // Step 1: check every row and calculate numbers (nothing is saved yet)
    const lines = [];
    let totalCost = 0;

    for (const input of itemsInput) {
      const product = productMap.get(String(input.productId));

      if (!product) {
        throw new AppError(400, 'Mahsulot topilmadi');
      }

      const unitInfo = resolveUnit(product, input.unitId);
      const quantity = assertQuantity(input.quantity, unitInfo, product.name);
      const unitCost = roundCost(input.unitCost);

      if (unitCost < 0) {
        throw new AppError(400, "Narx noto'g'ri: " + product.name);
      }

      const line = {
        product: product._id,
        name: product.name,
        unitName: unitInfo.unitName,
        quantity,
        baseQuantity: roundQty(quantity * unitInfo.factor),
        unitCost,
        lineTotal: roundMoney(unitCost * quantity),
        batchNumber: String(input.batchNumber || '-').trim() || '-',
        expiryDate: parseExpiry(input.expiryDate, product),
        costPerBase: roundCost(unitCost / unitInfo.factor),
      };

      totalCost += line.lineTotal;
      lines.push(line);
    }

    // Step 2: save everything in ONE transaction
    const purchase = await runInTransaction(async (session) => {
      const sequence = await nextSequence('purchase-' + branchId, session);
      const number = 'K-' + branch.code + '-' + padNumber(sequence);

      for (const line of lines) {
        await addStock({
          productId: line.product,
          branchId,
          baseQuantity: line.baseQuantity,
          costPrice: line.costPerBase,
          batchNumber: line.batchNumber,
          expiryDate: line.expiryDate,
          type: 'receive',
          refNumber: number,
          userId: req.user._id,
          session,
        });

        // Remember the latest cost on the product
        await Product.updateOne({ _id: line.product }, { costPrice: line.costPerBase }, { session });
      }

      const created = await Purchase.create(
        [
          {
            number,
            branch: branchId,
            supplier: req.body.supplierId || undefined,
            items: lines,
            totalCost,
            note: String(req.body.note || ''),
            user: req.user._id,
          },
        ],
        { session }
      );

      return created[0];
    });

    res.status(201).json({ purchase });
  })
);

module.exports = router;
