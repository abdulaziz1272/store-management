// Stock overview, batches, manual adjustments and the movement history.

const express = require('express');
const mongoose = require('mongoose');

const StockBatch = require('../models/StockBatch');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES, MOVEMENT_TYPES } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope, assertBranchAccess } = require('../utils/permissions');
const { getStoreRange } = require('../utils/dates');
const { runInTransaction } = require('../utils/transaction');
const { adjustBatch } = require('../services/stockService');
const { roundQty } = require('../utils/money');

const router = express.Router();

router.use(protect);

function toObjectId(value) {
  return value ? new mongoose.Types.ObjectId(String(value)) : null;
}

// STOCK TABLE: one row for each product in each branch
// /api/stock?branch=&search=&lowOnly=1
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const branchId = getBranchScope(req, req.query.branch);

    const match = {};

    if (branchId) {
      match.branch = toObjectId(branchId);
    }

    const rows = await StockBatch.aggregate([
      { $match: match },
      {
        $group: {
          _id: { product: '$product', branch: '$branch' },
          quantity: { $sum: '$quantity' },
          value: { $sum: { $multiply: ['$quantity', '$costPrice'] } },
        },
      },
    ]);

    const productIds = rows.map((row) => row._id.product);
    const products = await Product.find({ _id: { $in: productIds } }).populate('baseUnit', 'name');
    const branches = await Branch.find();

    const productMap = new Map(products.map((product) => [String(product._id), product]));
    const branchMap = new Map(branches.map((branch) => [String(branch._id), branch]));

    const search = String(req.query.search || '').trim().toLowerCase();
    const items = [];

    for (const row of rows) {
      const product = productMap.get(String(row._id.product));
      const branch = branchMap.get(String(row._id.branch));

      if (!product || !branch) {
        continue;
      }

      if (search) {
        const text = (product.name + ' ' + product.sku).toLowerCase();

        if (!text.includes(search)) {
          continue;
        }
      }

      const quantity = roundQty(row.quantity);
      const isLow = quantity < product.minStock;

      if (req.query.lowOnly === '1' && !isLow) {
        continue;
      }

      items.push({
        productId: product._id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        unit: product.baseUnit ? product.baseUnit.name : '',
        branchId: branch._id,
        branchName: branch.name,
        quantity,
        minStock: product.minStock,
        isLow,
        // Cashiers do not see cost values
        value: req.user.role === ROLES.CASHIER ? 0 : Math.round(row.value),
      });
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ items, total: items.length });
  })
);

// BATCHES of one product in one branch
router.get(
  '/batches',
  asyncHandler(async (req, res) => {
    const branchId = getBranchScope(req, req.query.branch);

    const filter = { quantity: { $gt: 0 } };

    if (req.query.product) {
      filter.product = req.query.product;
    }

    if (branchId) {
      filter.branch = branchId;
    }

    const batches = await StockBatch.find(filter)
      .populate('product', 'name sku')
      .populate('branch', 'name')
      .sort({ expiryDate: 1, createdAt: 1 })
      .limit(500);

    const items = batches.map((batch) => {
      const object = batch.toObject();

      if (req.user.role === ROLES.CASHIER) {
        delete object.costPrice;
      }

      return object;
    });

    res.json({ items });
  })
);

// ADJUST: fix the stock after counting. A reason is required.
router.post(
  '/adjust',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const reason = String(req.body.reason || '').trim();
    const batchId = req.body.batchId;
    const newQuantity = Number(req.body.newQuantity);

    if (!reason) {
      throw new AppError(400, 'Sababni yozing');
    }

    if (!Number.isFinite(newQuantity) || newQuantity < 0) {
      throw new AppError(400, "Yangi miqdor noto'g'ri");
    }

    const batch = await runInTransaction(async (session) => {
      const current = await StockBatch.findById(batchId).session(session);

      if (!current) {
        throw new AppError(404, 'Partiya topilmadi');
      }

      assertBranchAccess(req, current.branch);

      const delta = roundQty(newQuantity - current.quantity);

      return adjustBatch({
        batchId,
        delta,
        note: reason,
        userId: req.user._id,
        session,
      });
    });

    res.json({ batch });
  })
);

// MOVEMENT HISTORY /api/stock/movements?branch=&product=&type=&from=&to=&page=
router.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 30, 200);
    const branchId = getBranchScope(req, req.query.branch);

    const filter = {};

    if (branchId) {
      filter.branch = branchId;
    }

    if (req.query.product) {
      filter.product = req.query.product;
    }

    if (MOVEMENT_TYPES.includes(req.query.type)) {
      filter.type = req.query.type;
    }

    const range = getStoreRange(req.query.from, req.query.to);

    if (range) {
      filter.createdAt = range;
    }

    const total = await StockMovement.countDocuments(filter);
    const items = await StockMovement.find(filter)
      .populate('product', 'name sku')
      .populate('branch', 'name')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

module.exports = router;
