// A counter that gives us the next number for receipts, SKU codes and so on.
// _id is the name of the counter, for example "sale-<branchId>" or "sku".

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
