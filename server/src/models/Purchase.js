// A purchase = goods received from a supplier into a branch ("Kirim").

const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    unitName: { type: String, default: '' },
    quantity: { type: Number, required: true },
    baseQuantity: { type: Number, required: true },
    // Cost per ONE ENTERED unit
    unitCost: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
    batchNumber: { type: String, default: '-' },
    expiryDate: { type: Date, default: null },
  },
  { _id: false }
);

const purchaseSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    items: { type: [purchaseItemSchema], required: true },
    totalCost: { type: Number, required: true },
    note: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

purchaseSchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
