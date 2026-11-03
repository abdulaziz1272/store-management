// A product. Stock is NOT stored here, it lives in StockBatch (per branch).
//
// Price and quantity rules:
//  - "price" is the selling price for ONE base unit (so'm, whole number)
//  - an alternative unit has a factor: 1 qop = 50 kg means factor 50

const mongoose = require('mongoose');

const altUnitSchema = new mongoose.Schema(
  {
    unit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    factor: { type: Number, required: true, min: 0.000001 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // The SKU is also the text inside the QR code
    sku: { type: String, required: true, trim: true, uppercase: true, unique: true },
    category: { type: String, trim: true, default: '' },
    baseUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'Unit', required: true },
    altUnits: { type: [altUnitSchema], default: [] },
    price: { type: Number, required: true, min: 0 },
    // Last purchase cost per base unit
    costPrice: { type: Number, default: 0, min: 0 },
    // Warn when stock in a branch is lower than this
    minStock: { type: Number, default: 0, min: 0 },
    // If true, an expiry date is required when receiving this product
    trackExpiry: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 1 });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
