// The debt LEDGER of customers. amount > 0 increases the debt, amount < 0 decreases it.

const mongoose = require('mongoose');

const debtEntrySchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    type: { type: String, enum: ['sale', 'payment', 'return'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    method: { type: String, default: '' },
    refNumber: { type: String, default: '' },
    note: { type: String, default: '' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

debtEntrySchema.index({ customer: 1, createdAt: -1 });
debtEntrySchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model('DebtEntry', debtEntrySchema);
