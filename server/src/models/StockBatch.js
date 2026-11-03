// Stock is kept in BATCHES: one row per product + branch + batch number + expiry date.
// The stock of a product in a branch is the SUM of its batch quantities.
// All quantities are in the product BASE unit.

const mongoose = require('mongoose');

const stockBatchSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    batchNumber: { type: String, trim: true, default: '-' },
    expiryDate: { type: Date, default: null },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// The same product/branch/batch/expiry can exist only once
stockBatchSchema.index(
  { product: 1, branch: 1, batchNumber: 1, expiryDate: 1 },
  { unique: true }
);
stockBatchSchema.index({ branch: 1, expiryDate: 1 });

module.exports = mongoose.model('StockBatch', stockBatchSchema);
