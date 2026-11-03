// The stock LEDGER. Every change of stock is a row here and rows are never edited or deleted.
// quantity > 0 means stock came in, quantity < 0 means stock went out (base unit).

const mongoose = require('mongoose');
const { MOVEMENT_TYPES } = require('../config/constants');

const stockMovementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'StockBatch' },
    batchNumber: { type: String, default: '-' },
    quantity: { type: Number, required: true },
    costPrice: { type: Number, default: 0 },
    // The document that caused this movement (sale, purchase ...)
    refNumber: { type: String, default: '' },
    note: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockMovementSchema.index({ branch: 1, createdAt: -1 });
stockMovementSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);
