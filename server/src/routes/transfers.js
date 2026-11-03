// Transfers between branches. The goods leave one branch and arrive in the other at once.

const express = require('express');

const Transfer = require('../models/Transfer');
const Product = require('../models/Product');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope, getBranchForWrite } = require('../utils/permissions');
const { getStoreRange } = require('../utils/dates');
const { nextSequence, padNumber } = require('../utils/sequence');
const { runInTransaction } = require('../utils/transaction');
const { resolveUnit, assertQuantity } = require('../utils/units');
const { roundQty } = require('../utils/money');
const { addStock, removeStock } = require('../services/stockService');

const router = express.Router();

router.use(protect, requireRole(ROLES.ADMIN, ROLES.MANAGER));

// LIST: transfers that leave from or arrive to my branch
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 20, 100);
    const branchId = getBranchScope(req, req.query.branch);

    const filter = {};

    if (branchId) {
      filter.$or = [{ fromBranch: branchId }, { toBranch: branchId }];
    }

    const range = getStoreRange(req.query.from, req.query.to);

    if (range) {
      filter.createdAt = range;
    }

    const total = await Transfer.countDocuments(filter);
    const items = await Transfer.find(filter)
      .populate('fromBranch', 'name')
      .populate('toBranch', 'name')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

// CREATE
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // A manager can only send goods OUT of his own branch
    const fromBranchId = getBranchForWrite(req, req.body.fromBranchId);
    const toBranchId = req.body.toBranchId;

    if (!toBranchId || String(toBranchId) === String(fromBranchId)) {
      throw new AppError(400, 'Qabul qiluvchi filialni tanlang (boshqa filial bo\'lishi kerak)');
    }

    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];

    if (itemsInput.length === 0) {
      throw new AppError(400, "Mahsulot qo'shing");
    }

    const fromBranch = await Branch.findById(fromBranchId);
    const toBranch = await Branch.findById(toBranchId);

    if (!fromBranch || !toBranch || !toBranch.isActive) {
      throw new AppError(400, 'Filial topilmadi');
    }

    const products = await Product.find({ _id: { $in: itemsInput.map((item) => item.productId) } })
      .populate('baseUnit', 'name allowDecimal')
      .populate('altUnits.unit', 'name allowDecimal');

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    // Check rows first
    const lines = [];

    for (const input of itemsInput) {
      const product = productMap.get(String(input.productId));

      if (!product) {
        throw new AppError(400, 'Mahsulot topilmadi');
      }

      const unitInfo = resolveUnit(product, input.unitId);
      const quantity = assertQuantity(input.quantity, unitInfo, product.name);

      lines.push({
        product,
        unitName: unitInfo.unitName,
        baseQuantity: roundQty(quantity * unitInfo.factor),
      });
    }

    const transfer = await runInTransaction(async (session) => {
      const sequence = await nextSequence('transfer', session);
      const number = 'T-' + padNumber(sequence);
      const note = fromBranch.name + ' -> ' + toBranch.name;

      for (const line of lines) {
        // 1) take the goods out of the sending branch (first-expired-first-out)
        const allocations = await removeStock({
          productId: line.product._id,
          productName: line.product.name,
          branchId: fromBranchId,
          baseQuantity: line.baseQuantity,
          type: 'transfer_out',
          refNumber: number,
          note,
          userId: req.user._id,
          session,
        });

        // 2) put the same batches into the receiving branch
        for (const allocation of allocations) {
          await addStock({
            productId: line.product._id,
            branchId: toBranchId,
            baseQuantity: allocation.quantity,
            costPrice: allocation.costPrice,
            batchNumber: allocation.batchNumber,
            expiryDate: allocation.expiryDate,
            type: 'transfer_in',
            refNumber: number,
            note,
            userId: req.user._id,
            session,
          });
        }
      }

      const created = await Transfer.create(
        [
          {
            number,
            fromBranch: fromBranchId,
            toBranch: toBranchId,
            items: lines.map((line) => ({
              product: line.product._id,
              name: line.product.name,
              unitName: line.product.baseUnit.name,
              baseQuantity: line.baseQuantity,
            })),
            note: String(req.body.note || ''),
            user: req.user._id,
          },
        ],
        { session }
      );

      return created[0];
    });

    res.status(201).json({ transfer });
  })
);

module.exports = router;
