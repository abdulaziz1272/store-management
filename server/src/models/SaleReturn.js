// Goods that a customer brings back.

const mongoose = require('mongoose');
const { MONEY_METHODS } = require('../config/constants');

const returnItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitName: { type: String, default: '' },
    quantity: { type: Number, required: true },
    baseQuantity: { type: Number, required: true },
    refund: { type: Number, required: true },
  },
  { _id: false }
);

const saleReturnSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
    saleNumber: { type: String, required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [returnItemSchema], required: true },
    // Total value of the returned goods
    refundAmount: { type: Number, required: true },
    // Part that reduced the customer's debt
    debtReduced: { type: Number, default: 0 },
    // Part that was paid back as money, and how
    paidOut: { type: Number, default: 0 },
    paidOutMethod: { type: String, enum: MONEY_METHODS, default: 'cash' },
    reason: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

saleReturnSchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model('SaleReturn', saleReturnSchema);
