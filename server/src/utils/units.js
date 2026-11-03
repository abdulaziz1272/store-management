// Unit conversion helpers.
//
// A product has a base unit (for example "kg") and optional alternative units
// (for example "qop" with factor 50, meaning 1 qop = 50 kg).
// Prices and stock are always kept per BASE unit.

const AppError = require('./AppError');

// Returns { factor, unitName, allowDecimal } for the unit chosen by the user.
// "unitId" empty means the base unit.
// "product" must have baseUnit and altUnits.unit populated.
function resolveUnit(product, unitId) {
  const baseUnit = product.baseUnit;

  if (!unitId || String(unitId) === String(baseUnit._id)) {
    return {
      factor: 1,
      unitName: baseUnit.name,
      allowDecimal: baseUnit.allowDecimal,
      unitId: baseUnit._id,
    };
  }

  const alt = product.altUnits.find((item) => String(item.unit._id) === String(unitId));

  if (!alt) {
    throw new AppError(400, "Bu o'lchov birligi mahsulotga biriktirilmagan: " + product.name);
  }

  return {
    factor: alt.factor,
    unitName: alt.unit.name,
    allowDecimal: alt.unit.allowDecimal,
    unitId: alt.unit._id,
  };
}

// Checks that a quantity is a positive number and has no decimals when the unit does not allow them
function assertQuantity(quantity, unitInfo, productName) {
  const number = Number(quantity);

  if (!Number.isFinite(number) || number <= 0) {
    throw new AppError(400, "Miqdor noto'g'ri: " + productName);
  }

  if (!unitInfo.allowDecimal && !Number.isInteger(number)) {
    throw new AppError(400, "Bu birlikda kasr son mumkin emas: " + productName);
  }

  return number;
}

module.exports = { resolveUnit, assertQuantity };
