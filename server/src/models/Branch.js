// A branch (filial) = one physical place: a shop or a warehouse.

const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // Short code, used in receipt numbers, for example "MAIN"
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    // A warehouse stores goods but does not sell to customers
    isWarehouse: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Branch', branchSchema);
