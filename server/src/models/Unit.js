// Unit of measure: dona, kg, qop, metr ...

const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    // false for units that are counted (dona, qop). true for kg, metr, litr.
    allowDecimal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Unit', unitSchema);
