// Reads ?page=1&limit=20 from the URL.

function getPaging(req, defaultLimit = 20, maxLimit = 200) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), maxLimit);

  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { getPaging };
