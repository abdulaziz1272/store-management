// Moving goods from one branch to another.

const mongoose = require('mongoose');

const transferItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitName: { type: String, default: '' },
    // Always in the base unit
    baseQuantity: { type: Number, required: true },
  },
  { _id: false }
);

const transferSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    fromBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    items: { type: [transferItemSchema], required: true },
    note: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transferSchema.index({ fromBranch: 1, createdAt: -1 });
transferSchema.index({ toBranch: 1, createdAt: -1 });

module.exports = mongoose.model('Transfer', transferSchema);
