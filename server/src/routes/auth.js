// Login, logout and "who am I".

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/auth');

const router = express.Router();

const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// At most 10 login tries per 15 minutes for the same username
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req.body && req.body.username) || 'unknown').toLowerCase(),
  message: { message: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring" },
});

function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the page cannot read this cookie
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production', // only over https in production
    maxAge: COOKIE_MAX_AGE_MS,
  };
}

async function loadUserForClient(userId) {
  return User.findById(userId).populate('branch', 'name code isWarehouse');
}

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const user = await User.findOne({ username });

    // Same message for "no such user" and "wrong password", so nobody can guess usernames
    const wrongMessage = "Login yoki parol noto'g'ri";

    if (!user || !user.isActive) {
      throw new AppError(401, wrongMessage);
    }

    const passwordIsCorrect = await user.checkPassword(password);

    if (!passwordIsCorrect) {
      throw new AppError(401, wrongMessage);
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '12h',
    });

    res.cookie('token', token, cookieOptions());

    const fullUser = await loadUserForClient(user._id);
    res.json({ user: fullUser });
  })
);

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions());
  res.json({ message: 'Chiqildi' });
});

router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const fullUser = await loadUserForClient(req.user._id);
    res.json({ user: fullUser });
  })
);

router.post(
  '/change-password',
  protect,
  asyncHandler(async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 8) {
      throw new AppError(400, "Yangi parol kamida 8 ta belgidan iborat bo'lsin");
    }

    const passwordIsCorrect = await req.user.checkPassword(currentPassword);

    if (!passwordIsCorrect) {
      throw new AppError(400, "Joriy parol noto'g'ri");
    }

    await req.user.setPassword(newPassword);
    await req.user.save();

    res.json({ message: "Parol o'zgartirildi" });
  })
);

module.exports = router;
