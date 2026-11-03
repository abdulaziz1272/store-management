// Last middleware: turns every error into a JSON answer { message }.

function notFound(req, res) {
  res.status(404).json({ message: 'Manzil topilmadi' });
}

function errorHandler(error, req, res, next) {
  // Our own errors, thrown with "new AppError(status, message)"
  if (error.isAppError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  // Mongoose: a required field is empty or a value is invalid
  if (error.name === 'ValidationError') {
    const fields = Object.keys(error.errors).join(', ');
    return res.status(400).json({ message: "Ma'lumot noto'g'ri yoki to'liq emas: " + fields });
  }

  // Mongoose: a wrong id format
  if (error.name === 'CastError') {
    return res.status(400).json({ message: "Noto'g'ri qiymat: " + error.path });
  }

  // MongoDB: duplicate value in a unique field
  if (error.code === 11000) {
    const fields = Object.keys(error.keyPattern || {}).join(', ');
    return res.status(409).json({ message: 'Bu qiymat allaqachon mavjud: ' + fields });
  }

  console.error(error);
  return res.status(500).json({ message: 'Server xatosi. Keyinroq urinib ko\'ring' });
}

module.exports = { notFound, errorHandler };
