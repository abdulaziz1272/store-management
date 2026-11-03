// The audit log: who changed products, users, prices and so on.

const express = require('express');

const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope } = require('../utils/permissions');
const { getStoreRange } = require('../utils/dates');

const router = express.Router();

router.use(protect, requireRole(ROLES.ADMIN, ROLES.MANAGER));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 30, 200);
    const filter = {};

    // A manager sees only changes made in his branch. The admin sees everything.
    const branchId = getBranchScope(req, req.query.branch);

    if (branchId) {
      filter.branch = branchId;
    }

    if (req.query.entity) {
      filter.entity = req.query.entity;
    }

    const range = getStoreRange(req.query.from, req.query.to);

    if (range) {
      filter.createdAt = range;
    }

    const total = await AuditLog.countDocuments(filter);
    const items = await AuditLog.find(filter)
      .populate('branch', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ items, total, page, limit });
  })
);

module.exports = router;
