// Login protection.
//  - protect: checks the login cookie and loads the user into req.user
//  - requireRole: allows only some roles

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const protect = asyncHandler(async (req, res, next) => {
  // The token normally comes from the httpOnly cookie. A Bearer header also works (for testing tools).
  let token = req.cookies ? req.cookies.token : null;
  const header = req.headers.authorization;

  if (!token && header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  }

  if (!token) {
    throw new AppError(401, 'Tizimga kiring');
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new AppError(401, 'Sessiya tugagan, qayta kiring');
  }

  // Load the user on EVERY request, so a deactivated user loses access at once
  const user = await User.findById(payload.id);

  if (!user || !user.isActive) {
    throw new AppError(401, 'Foydalanuvchi faol emas');
  }

  req.user = user;
  next();
});

function requireRole(...allowedRoles) {
  return function roleCheck(req, res, next) {
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, "Bu amal uchun ruxsat yo'q"));
    }

    return next();
  };
}

module.exports = { protect, requireRole };
