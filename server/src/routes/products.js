// Products: list, search, scan by code, create, update and CSV import.

const express = require('express');

const Product = require('../models/Product');
const Unit = require('../models/Unit');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');
const { getPaging } = require('../utils/paging');
const { getBranchScope } = require('../utils/permissions');
const { nextSequence, padNumber } = require('../utils/sequence');
const { runInTransaction } = require('../utils/transaction');
const { logAudit, diffObjects, plain } = require('../utils/audit');
const { roundMoney, roundCost } = require('../utils/money');
const { addStock, getStockMap } = require('../services/stockService');

const router = express.Router();

router.use(protect);

const POPULATE_UNITS = [
  { path: 'baseUnit', select: 'name allowDecimal' },
  { path: 'altUnits.unit', select: 'name allowDecimal' },
];

// Creates the next free SKU like "P000012"
async function generateSku(session) {
  const number = await nextSequence('sku', session);
  return 'P' + padNumber(number, 6);
}

// Takes only the allowed fields from the request body
function pickProductFields(body) {
  const data = {};
  const allowed = [
    'name',
    'sku',
    'category',
    'baseUnit',
    'altUnits',
    'price',
    'costPrice',
    'minStock',
    'trackExpiry',
    'isActive',
  ];

  for (const field of allowed) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }

  if (data.price !== undefined) {
    data.price = roundMoney(data.price);
  }

  if (data.costPrice !== undefined) {
    data.costPrice = roundCost(data.costPrice);
  }

  return data;
}

// Adds a "stock" number to every product.
// Cashiers must not see the cost price, so we remove it for them.
async function attachStock(products, branchId, hideCost) {
  const ids = products.map((product) => product._id);
  const stockMap = await getStockMap(ids, branchId);

  return products.map((product) => {
    const object = product.toObject();
    object.stock = stockMap.get(String(product._id)) || 0;

    if (hideCost) {
      delete object.costPrice;
    }

    return object;
  });
}

// LIST  /api/products?search=&category=&page=&limit=&branch=
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPaging(req, 20, 500);
    const filter = {};

    if (req.query.active === '1') {
      filter.isActive = true;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const text = String(req.query.search).trim();
      // Escape special characters, so the user's text is searched as plain text
      const safeText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeText, 'i');
      filter.$or = [{ name: regex }, { sku: regex }, { category: regex }];
    }

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate(POPULATE_UNITS)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    const branchId = getBranchScope(req, req.query.branch);
    const items = await attachStock(products, branchId, req.user.role === ROLES.CASHIER);

    res.json({ items, total, page, limit });
  })
);

// Distinct categories (for the filter box)
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await Product.distinct('category', { category: { $ne: '' } });
    res.json({ items: categories.sort() });
  })
);

// FIND BY CODE: used by the scanner. The QR code contains the SKU.
router.get(
  '/by-code/:code',
  asyncHandler(async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();

    const product = await Product.findOne({ sku: code, isActive: true }).populate(POPULATE_UNITS);

    if (!product) {
      throw new AppError(404, 'Mahsulot topilmadi: ' + code);
    }

    const branchId = getBranchScope(req, req.query.branch);
    const items = await attachStock([product], branchId, req.user.role === ROLES.CASHIER);

    res.json({ product: items[0] });
  })
);

// CREATE
router.post(
  '/',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const data = pickProductFields(req.body);

    const product = await runInTransaction(async (session) => {
      if (!data.sku) {
        data.sku = await generateSku(session);
      }

      const created = await Product.create([data], { session });

      await logAudit({
        user: req.user,
        action: 'create',
        entity: 'Product',
        entityId: created[0]._id,
        label: created[0].name + ' (' + created[0].sku + ')',
        after: plain(created[0]),
        session,
      });

      return created[0];
    });

    res.status(201).json({ product });
  })
);

// UPDATE (also used to hide a product: isActive false)
router.put(
  '/:id',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);

    if (!product) {
      throw new AppError(404, 'Mahsulot topilmadi');
    }

    const before = plain(product);
    const data = pickProductFields(req.body);

    product.set(data);
    await product.save();

    const changes = diffObjects(before, plain(product));

    await logAudit({
      user: req.user,
      action: 'update',
      entity: 'Product',
      entityId: product._id,
      label: product.name + ' (' + product.sku + ')',
      before: changes.before,
      after: changes.after,
    });

    res.json({ product });
  })
);

// IMPORT from CSV.
// The browser reads the CSV file and sends rows like:
// { name, sku, category, unit, price, costPrice, minStock, quantity }
// If a row has "quantity" and a branch was chosen, opening stock is added too.
router.post(
  '/import',
  requireRole(ROLES.ADMIN, ROLES.MANAGER),
  asyncHandler(async (req, res) => {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

    if (rows.length === 0) {
      throw new AppError(400, 'Fayl bo\'sh');
    }

    if (rows.length > 5000) {
      throw new AppError(400, "Bir martada ko'pi bilan 5000 ta qator yuklash mumkin");
    }

    // A manager can only add opening stock to his own branch
    const branchId = getBranchScope(req, req.body.branchId);

    const units = await Unit.find();
    const unitByName = new Map();

    for (const unit of units) {
      unitByName.set(unit.name.toLowerCase(), unit);
    }

    const result = { created: 0, updated: 0, errors: [] };

    // When the browser sends the file in pieces, this tells us where the piece starts
    const rowOffset = Number(req.body.rowOffset) || 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = rowOffset + index + 2; // +2 because row 1 is the header in the file

      try {
        const name = String(row.name || '').trim();
        const unit = unitByName.get(String(row.unit || '').trim().toLowerCase());
        const price = Number(row.price);

        if (!name) {
          throw new Error('Nomi yo\'q');
        }

        if (!unit) {
          throw new Error("O'lchov birligi topilmadi: " + (row.unit || ''));
        }

        if (!Number.isFinite(price) || price < 0) {
          throw new Error("Narx noto'g'ri");
        }

        const quantity = Number(row.quantity || 0);

        const isNew = await runInTransaction(async (session) => {
          const sku = String(row.sku || '').trim().toUpperCase();
          let product = sku ? await Product.findOne({ sku }).session(session) : null;
          const isNewProduct = !product;

          if (isNewProduct) {
            product = new Product({ sku: sku || (await generateSku(session)) });
          }

          product.name = name;
          product.category = String(row.category || '').trim();
          product.baseUnit = unit._id;
          product.price = roundMoney(price);

          if (row.costPrice !== undefined && row.costPrice !== '') {
            product.costPrice = roundCost(row.costPrice);
          }

          if (row.minStock !== undefined && row.minStock !== '') {
            product.minStock = Number(row.minStock) || 0;
          }

          await product.save({ session });

          if (quantity > 0 && branchId) {
            await addStock({
              productId: product._id,
              branchId,
              baseQuantity: quantity,
              costPrice: product.costPrice,
              type: 'receive',
              refNumber: 'IMPORT',
              note: "Boshlang'ich qoldiq (import)",
              userId: req.user._id,
              session,
            });
          }

          return isNewProduct;
        });

        if (isNew) {
          result.created += 1;
        } else {
          result.updated += 1;
        }
      } catch (error) {
        result.errors.push({ row: rowNumber, message: error.message });
      }
    }

    // Only the first piece writes the audit row, so a big file does not create many rows
    if (rowOffset === 0) {
      await logAudit({
        user: req.user,
        action: 'import',
        entity: 'Product',
        label: 'CSV import (' + rows.length + ' qator va undan ko\'p)',
      });
    }

    res.json(result);
  })
);

module.exports = router;
