// A sale (checkout). Names and prices are COPIED into the sale,
// so old receipts do not change when a product is edited later.

const mongoose = require('mongoose');
const { PAYMENT_METHODS } = require('../config/constants');

const allocationSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    // Base-unit quantity taken from this batch
    quantity: { type: Number, required: true },
    // Base-unit quantity already returned to this batch
    returned: { type: Number, default: 0 },
    costPrice: { type: Number, default: 0 },
  },
  { _id: false }
);

const saleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    sku: { type: String, default: '' },
    unitName: { type: String, default: '' },
    // Quantity as entered by the cashier (in "unitName")
    quantity: { type: Number, required: true },
    // Same quantity in the product base unit
    baseQuantity: { type: Number, required: true },
    // Price for ONE entered unit
    unitPrice: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    // How much of "quantity" was returned (entered units)
    returnedQuantity: { type: Number, default: 0 },
    allocations: { type: [allocationSchema], default: [] },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    amount: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    items: { type: [saleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    discountType: { type: String, enum: ['none', 'percent', 'amount'], default: 'none' },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    payments: { type: [paymentSchema], required: true },
    // Part of the total that the customer will pay later
    debtAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['completed', 'partially_returned', 'returned'],
      default: 'completed',
    },
    note: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

saleSchema.index({ branch: 1, createdAt: -1 });
saleSchema.index({ customer: 1, createdAt: -1 });

module.exports = mongoose.model('Sale', saleSchema);
