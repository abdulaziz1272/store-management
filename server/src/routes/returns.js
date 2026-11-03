// Returns: a customer brings goods back.
// The goods go back to the SAME batches they were sold from.

const express = require('express');

const Sale = require('../models/Sale');
const SaleReturn = require('../models/SaleReturn');
const Customer = require('../models/Customer');
const DebtEntry = require('../models/DebtEntry');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');
const { MONEY_METHODS } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope, assertBranchAccess } = require('../utils/permissions');
const { getStoreRange } = require('../utils/dates');
const { nextSequence, padNumber } = require('../utils/sequence');
const { runInTransaction } = require('../utils/transaction');
const { roundMoney, roundQty } = require('../utils/money');
const { returnToBatch } = require('../services/stockService');

const router = express.Router();

router.use(protect);

// LIST
router.get(
  '/',
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

    const total = await SaleReturn.countDocuments(filter);
    const items = await SaleReturn.find(filter)
      .populate('branch', 'name')
      .populate('customer', 'name')
      .populate('user', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

// CREATE
// body: { saleId, items: [{ lineIndex, quantity }], refundMethod, reason }
// refundMethod: cash | card | transfer | debt   ("debt" = reduce the customer's debt)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const itemsInput = Array.isArray(req.body.items) ? req.body.items : [];
    const refundMethod = String(req.body.refundMethod || 'cash');

    if (itemsInput.length === 0) {
      throw new AppError(400, 'Qaytariladigan mahsulotni tanlang');
    }

    if (refundMethod !== 'debt' && !MONEY_METHODS.includes(refundMethod)) {
      throw new AppError(400, "Qaytarish usuli noto'g'ri");
    }

    const returnId = await runInTransaction(async (session) => {
      const sale = await Sale.findById(req.body.saleId).session(session);

      if (!sale) {
        throw new AppError(404, 'Sotuv topilmadi');
      }

      assertBranchAccess(req, sale.branch);

      const branch = await Branch.findById(sale.branch).session(session);
      const sequence = await nextSequence('return-' + sale.branch, session);
      const number = 'Q-' + branch.code + '-' + padNumber(sequence);

      // If the sale had a discount, the refund has the same discount share
      const ratio = sale.subtotal > 0 ? sale.total / sale.subtotal : 1;

      const returnItems = [];
      let refundAmount = 0;

      for (const input of itemsInput) {
        const line = sale.items[Number(input.lineIndex)];
        const quantity = Number(input.quantity);

        if (!line) {
          throw new AppError(400, 'Sotuv qatori topilmadi');
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError(400, "Miqdor noto'g'ri: " + line.name);
        }

        const canReturn = roundQty(line.quantity - line.returnedQuantity);

        if (quantity > canReturn) {
          throw new AppError(
            400,
            'Ko\'p qaytarib bo\'lmaydi: ' + line.name + ' (qaytarish mumkin: ' + canReturn + ')'
          );
        }

        const factor = line.baseQuantity / line.quantity;
        const baseQuantity = roundQty(quantity * factor);
        const refund = roundMoney(line.unitPrice * quantity * ratio);

        // Put the goods back into the batches they came from
        let need = baseQuantity;

        for (const allocation of line.allocations) {
          if (need <= 0) {
            break;
          }

          const free = roundQty(allocation.quantity - allocation.returned);

          if (free <= 0) {
            continue;
          }

          const give = roundQty(Math.min(free, need));

          await returnToBatch({
            batchId: allocation.batch,
            baseQuantity: give,
            refNumber: number,
            note: 'Qaytarish: ' + sale.number,
            userId: req.user._id,
            session,
          });

          allocation.returned = roundQty(allocation.returned + give);
          need = roundQty(need - give);
        }

        line.returnedQuantity = roundQty(line.returnedQuantity + quantity);

        refundAmount += refund;

        returnItems.push({
          product: line.product,
          name: line.name,
          unitName: line.unitName,
          quantity,
          baseQuantity,
          refund,
        });
      }

      // Update the status of the sale
      const everythingReturned = sale.items.every((line) => line.returnedQuantity >= line.quantity);
      sale.status = everythingReturned ? 'returned' : 'partially_returned';
      sale.markModified('items');
      await sale.save({ session });

      // Decide how the money goes back
      let debtReduced = 0;
      let paidOut = refundAmount;
      let paidOutMethod = refundMethod;

      if (refundMethod === 'debt') {
        if (!sale.customer) {
          throw new AppError(400, "Bu sotuvda mijoz yo'q, qarzni kamaytirib bo'lmaydi");
        }

        const customer = await Customer.findById(sale.customer).session(session);

        // We can only reduce the debt up to what the customer really owes.
        debtReduced = Math.min(refundAmount, customer.debt);
        paidOut = refundAmount - debtReduced;
        paidOutMethod = 'cash';

        if (debtReduced > 0) {
          const updated = await Customer.findOneAndUpdate(
            { _id: customer._id },
            { $inc: { debt: -debtReduced } },
            { new: true, session }
          );

          await DebtEntry.create(
            [
              {
                customer: customer._id,
                branch: sale.branch,
                type: 'return',
                amount: -debtReduced,
                balanceAfter: updated.debt,
                refNumber: number,
                note: 'Qaytarish: ' + sale.number,
                user: req.user._id,
              },
            ],
            { session }
          );
        }
      }

      const created = await SaleReturn.create(
        [
          {
            number,
            sale: sale._id,
            saleNumber: sale.number,
            branch: sale.branch,
            customer: sale.customer || undefined,
            items: returnItems,
            refundAmount,
            debtReduced,
            paidOut,
            paidOutMethod,
            reason: String(req.body.reason || ''),
            user: req.user._id,
          },
        ],
        { session }
      );

      return created[0]._id;
    });

    const saleReturn = await SaleReturn.findById(returnId)
      .populate('branch', 'name')
      .populate('customer', 'name');

    res.status(201).json({ saleReturn });
  })
);

module.exports = router;
