// Numbers for the home screen.

const express = require('express');
const mongoose = require('mongoose');

const Sale = require('../models/Sale');
const StockBatch = require('../models/StockBatch');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getBranchScope } = require('../utils/permissions');
const { getStoreDayRange, todayStoreDate } = require('../utils/dates');
const { roundQty } = require('../utils/money');

const router = express.Router();

router.use(protect);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const branchId = getBranchScope(req, req.query.branch);
    const { start, end } = getStoreDayRange(todayStoreDate());

    // --- Today's sales ---
    const saleMatch = { createdAt: { $gte: start, $lt: end } };

    if (branchId) {
      saleMatch.branch = new mongoose.Types.ObjectId(String(branchId));
    }

    const salesRows = await Sale.aggregate([
      { $match: saleMatch },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$total' } } },
    ]);

    const today = salesRows[0] || { count: 0, total: 0 };

    const result = {
      todaySalesCount: today.count,
      todaySalesTotal: today.total,
      lowStock: [],
      expiringSoon: [],
      totalDebt: null,
    };

    // Cashiers only need today's numbers
    if (req.user.role === ROLES.CASHIER) {
      return res.json(result);
    }

    // --- Low stock: total of a product in the scope is below its minimum ---
    const stockMatch = {};

    if (branchId) {
      stockMatch.branch = new mongoose.Types.ObjectId(String(branchId));
    }

    const stockRows = await StockBatch.aggregate([
      { $match: stockMatch },
      { $group: { _id: '$product', quantity: { $sum: '$quantity' } } },
    ]);

    const stockMap = new Map(stockRows.map((row) => [String(row._id), roundQty(row.quantity)]));

    const watched = await Product.find({ isActive: true, minStock: { $gt: 0 } }).populate('baseUnit', 'name');

    for (const product of watched) {
      const quantity = stockMap.get(String(product._id)) || 0;

      if (quantity < product.minStock) {
        result.lowStock.push({
          name: product.name,
          sku: product.sku,
          quantity,
          minStock: product.minStock,
          unit: product.baseUnit ? product.baseUnit.name : '',
        });
      }
    }

    result.lowStock = result.lowStock.slice(0, 20);

    // --- Batches that expire within 30 days (or already expired) with stock left ---
    const limitDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const expiringFilter = {
      quantity: { $gt: 0 },
      expiryDate: { $ne: null, $lte: limitDate },
    };

    if (branchId) {
      expiringFilter.branch = branchId;
    }

    const batches = await StockBatch.find(expiringFilter)
      .populate('product', 'name sku')
      .populate('branch', 'name')
      .sort({ expiryDate: 1 })
      .limit(20);

    result.expiringSoon = batches.map((batch) => ({
      product: batch.product ? batch.product.name : '-',
      branch: batch.branch ? batch.branch.name : '-',
      batchNumber: batch.batchNumber,
      quantity: batch.quantity,
      expiryDate: batch.expiryDate,
    }));

    // --- Total customer debt ---
    const debtRows = await Customer.aggregate([
      { $group: { _id: null, total: { $sum: '$debt' } } },
    ]);

    result.totalDebt = debtRows[0] ? debtRows[0].total : 0;

    return res.json(result);
  })
);

module.exports = router;
