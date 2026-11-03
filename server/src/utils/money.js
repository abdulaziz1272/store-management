// Money is stored as WHOLE numbers (so'm). Quantities may have up to 3 decimals.

function roundMoney(value) {
  return Math.round(Number(value) || 0);
}

function roundQty(value) {
  return Math.round((Number(value) || 0) * 1000) / 1000;
}

// Cost per unit can be fractional (for example 1250.5), keep 2 decimals
function roundCost(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

module.exports = { roundMoney, roundQty, roundCost };
