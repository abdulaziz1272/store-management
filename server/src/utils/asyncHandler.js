// Express 4 does not catch errors from async functions by itself.
// This wrapper sends any error to the error handler middleware.

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
