// User management. Only the admin can use these routes.

const express = require('express');

const User = require('../models/User');
const Branch = require('../models/Branch');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { logAudit, diffObjects, plain } = require('../utils/audit');

const router = express.Router();

router.use(protect, requireRole(ROLES.ADMIN));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await User.find().populate('branch', 'name code').sort({ createdAt: -1 });
    res.json({ items: users, total: users.length });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { fullName, username, password, role, branch } = req.body;

    if (!password || String(password).length < 8) {
      throw new AppError(400, "Parol kamida 8 ta belgidan iborat bo'lsin");
    }

    if (role !== ROLES.ADMIN) {
      const branchExists = await Branch.exists({ _id: branch });

      if (!branchExists) {
        throw new AppError(400, 'Menejer va kassir uchun filial tanlang');
      }
    }

    const user = new User({
      fullName,
      username,
      role,
      branch: role === ROLES.ADMIN ? undefined : branch,
    });

    await user.setPassword(String(password));
    await user.save();

    await logAudit({
      user: req.user,
      action: 'create',
      entity: 'User',
      entityId: user._id,
      label: user.fullName + ' (' + user.username + ')',
      after: plain(user),
    });

    res.status(201).json({ user });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError(404, 'Foydalanuvchi topilmadi');
    }

    const before = plain(user);

    const { fullName, role, branch, isActive, password } = req.body;

    // The admin must not lock himself out
    const isSelf = String(user._id) === String(req.user._id);

    if (isSelf && (isActive === false || (role && role !== ROLES.ADMIN))) {
      throw new AppError(400, "O'zingizni o'chirib yoki rolingizni o'zgartirib bo'lmaydi");
    }

    if (fullName !== undefined) {
      user.fullName = fullName;
    }

    if (role !== undefined) {
      user.role = role;
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    if (user.role === ROLES.ADMIN) {
      user.branch = undefined;
    } else if (branch) {
      user.branch = branch;
    }

    if (password) {
      if (String(password).length < 8) {
        throw new AppError(400, "Parol kamida 8 ta belgidan iborat bo'lsin");
      }

      await user.setPassword(String(password));
    }

    await user.save();

    const changes = diffObjects(before, plain(user));

    // A password change is not visible in the diff (we removed the hash), so we log it separately
    if (password) {
      changes.after.password = 'yangilandi';
    }

    await logAudit({
      user: req.user,
      action: 'update',
      entity: 'User',
      entityId: user._id,
      label: user.fullName + ' (' + user.username + ')',
      before: changes.before,
      after: changes.after,
    });

    res.json({ user });
  })
);

module.exports = router;
