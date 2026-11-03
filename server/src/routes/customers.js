// Customers, their debts and debt payments.

const express = require('express');

const Customer = require('../models/Customer');
const DebtEntry = require('../models/DebtEntry');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES, MONEY_METHODS } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchForWrite } = require('../utils/permissions');
const { runInTransaction } = require('../utils/transaction');
const { logAudit, diffObjects, plain } = require('../utils/audit');
const { roundMoney } = require('../utils/money');

const router = express.Router();

router.use(protect);

// LIST  /api/customers?search=&withDebt=1
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 20, 500);
    const filter = {};

    if (req.query.withDebt === '1') {
      filter.debt = { $gt: 0 };
    }

    if (req.query.search) {
      const safeText = String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeText, 'i');
      filter.$or = [{ name: regex }, { phone: regex }];
    }

    const total = await Customer.countDocuments(filter);
    const items = await Customer.find(filter).sort({ name: 1 }).skip(skip).limit(limit);

    res.json({ items, total, page, limit });
  })
);

// CREATE: cashiers can add customers while selling
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, phone, address, note } = req.body;

    const customer = await Customer.create({ name, phone, address, note });

    await logAudit({
      user: req.user,
      action: 'create',
      entity: 'Customer',
      entityId: customer._id,
      label: customer.name,
      after: plain(customer),
    });

    res.status(201).json({ customer });
  })
);

// UPDATE
router.put(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      throw new AppError(404, 'Mijoz topilmadi');
    }

    const before = plain(customer);

    // The debt can NOT be edited here. It only changes through sales and payments.
    const { name, phone, address, note, isActive } = req.body;

    if (name !== undefined) {
      customer.name = name;
    }

    if (phone !== undefined) {
      customer.phone = phone;
    }

    if (address !== undefined) {
      customer.address = address;
    }

    if (note !== undefined) {
      customer.note = note;
    }

    if (isActive !== undefined) {
      customer.isActive = isActive;
    }

    await customer.save();

    const changes = diffObjects(before, plain(customer));

    await logAudit({
      user: req.user,
      action: 'update',
      entity: 'Customer',
      entityId: customer._id,
      label: customer.name,
      before: changes.before,
      after: changes.after,
    });

    res.json({ customer });
  })
);

// DEBT HISTORY of one customer
router.get(
  '/:id/ledger',
  asyncHandler(async (req, res) => {
    const entries = await DebtEntry.find({ customer: req.params.id })
      .populate('branch', 'name')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ items: entries });
  })
);

// A customer pays (part of) his debt
router.post(
  '/:id/payments',
  asyncHandler(async (req, res) => {
    const amount = roundMoney(req.body.amount);
    const method = String(req.body.method || 'cash');

    if (amount <= 0) {
      throw new AppError(400, "Summa noto'g'ri");
    }

    if (!MONEY_METHODS.includes(method)) {
      throw new AppError(400, "To'lov turi noto'g'ri");
    }

    const branchId = getBranchForWrite(req, req.body.branchId);

    const result = await runInTransaction(async (session) => {
      // The condition "debt >= amount" makes it impossible to pay more than the debt
      const customer = await Customer.findOneAndUpdate(
        { _id: req.params.id, debt: { $gte: amount } },
        { $inc: { debt: -amount } },
        { new: true, session }
      );

      if (!customer) {
        throw new AppError(400, "Mijozning qarzi to'lov summasidan kam yoki mijoz topilmadi");
      }

      const entries = await DebtEntry.create(
        [
          {
            customer: customer._id,
            branch: branchId,
            type: 'payment',
            amount: -amount,
            balanceAfter: customer.debt,
            method,
            note: String(req.body.note || ''),
            user: req.user._id,
          },
        ],
        { session }
      );

      return { customer, entry: entries[0] };
    });

    res.status(201).json(result);
  })
);

module.exports = router;
