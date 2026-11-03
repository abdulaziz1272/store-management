// Branch rules:
//  - admin can see every branch (or choose one)
//  - manager and cashier can only work with THEIR OWN branch

const AppError = require('./AppError');
const { ROLES } = require('../config/constants');

// For READING data.
// Returns a branch id, or null which means "all branches" (admin only).
function getBranchScope(req, requestedBranchId) {
  if (req.user.role !== ROLES.ADMIN) {
    return req.user.branch;
  }

  return requestedBranchId || null;
}

// For WRITING data. A write always belongs to exactly one branch.
function getBranchForWrite(req, bodyBranchId) {
  if (req.user.role !== ROLES.ADMIN) {
    return req.user.branch;
  }

  if (!bodyBranchId) {
    throw new AppError(400, 'Filialni tanlang');
  }

  return bodyBranchId;
}

// Throws an error when a non-admin touches data of another branch
function assertBranchAccess(req, branchId) {
  if (req.user.role === ROLES.ADMIN) {
    return;
  }

  if (String(req.user.branch) !== String(branchId)) {
    throw new AppError(403, "Bu filial ma'lumotlariga ruxsat yo'q");
  }
}

module.exports = { getBranchScope, getBranchForWrite, assertBranchAccess };
