// The Express application: middleware and routes.

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// The server runs behind Render's proxy (and Netlify's). This lets Express
// see the real protocol, so "secure" cookies work.
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '5mb' })); // 5mb because product imports can be large
app.use(cookieParser());

// A simple check URL. A scheduler can call it every 10 minutes to keep the server awake.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/units', require('./routes/units'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/stock', require('./routes/stock'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/transfers', require('./routes/transfers'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/returns', require('./routes/returns'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
