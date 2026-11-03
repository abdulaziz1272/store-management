// An error that we throw ON PURPOSE (for example "not enough stock").
// The error handler turns it into a JSON answer with the given HTTP status code.

class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = AppError;
