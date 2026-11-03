// All stock changes go through this file. Nobody else touches StockBatch directly.
// Every function takes the transaction "session" so that stock and documents
// are saved together.

const mongoose = require('mongoose');
const StockBatch = require('../models/StockBatch');
const StockMovement = require('../models/StockMovement');
const AppError = require('../utils/AppError');
const { roundQty } = require('../utils/money');

// Writes one row of the stock ledger
async function writeMovement(data, session) {
  await StockMovement.create([data], { session });
}

// Adds stock to a batch (creates the batch if it does not exist yet).
async function addStock(options) {
  const {
    productId,
    branchId,
    baseQuantity,
    costPrice = 0,
    batchNumber = '-',
    expiryDate = null,
    type,
    refNumber = '',
    note = '',
    userId,
    session,
  } = options;

  const quantity = roundQty(baseQuantity);

  const filter = {
    product: productId,
    branch: branchId,
    batchNumber: batchNumber || '-',
    expiryDate: expiryDate || null,
  };

  const batch = await StockBatch.findOneAndUpdate(
    filter,
    { $inc: { quantity: quantity }, $set: { costPrice: costPrice } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session }
  );

  await writeMovement(
    {
      type,
      product: productId,
      branch: branchId,
      batch: batch._id,
      batchNumber: batch.batchNumber,
      quantity,
      costPrice,
      refNumber,
      note,
      user: userId,
    },
    session
  );

  return batch;
}

// Sort rule "first expired, first out" (FEFO):
// batches that expire sooner go first, batches without an expiry date go last.
function compareFefo(a, b) {
  if (a.expiryDate && b.expiryDate) {
    return a.expiryDate - b.expiryDate;
  }

  if (a.expiryDate) {
    return -1;
  }

  if (b.expiryDate) {
    return 1;
  }

  return a.createdAt - b.createdAt;
}

// Takes stock out using FEFO. Returns which batches were used ("allocations").
// Throws an error when there is not enough stock.
async function removeStock(options) {
  const {
    productId,
    productName = '',
    branchId,
    baseQuantity,
    type,
    refNumber = '',
    note = '',
    userId,
    session,
    skipExpired = true,
  } = options;

  let remaining = roundQty(baseQuantity);

  const query = {
    product: productId,
    branch: branchId,
    quantity: { $gt: 0 },
  };

  // Expired goods must not be sold or moved
  if (skipExpired) {
    query.$or = [{ expiryDate: null }, { expiryDate: { $gte: new Date() } }];
  }

  const batches = await StockBatch.find(query).session(session);
  batches.sort(compareFefo);

  let available = 0;

  for (const batch of batches) {
    available += batch.quantity;
  }

  if (roundQty(available) < remaining) {
    throw new AppError(
      400,
      "Omborda yetarli qoldiq yo'q: " + productName + ' (mavjud: ' + roundQty(available) + ')'
    );
  }

  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) {
      break;
    }

    const take = roundQty(Math.min(batch.quantity, remaining));

    // The "quantity >= take" condition protects us if another sale took the stock a moment ago
    const updated = await StockBatch.findOneAndUpdate(
      { _id: batch._id, quantity: { $gte: take } },
      { $inc: { quantity: -take } },
      { new: true, session }
    );

    if (!updated) {
      throw new AppError(409, 'Qoldiq o\'zgarib qoldi, qaytadan urinib ko\'ring');
    }

    await writeMovement(
      {
        type,
        product: productId,
        branch: branchId,
        batch: batch._id,
        batchNumber: batch.batchNumber,
        quantity: -take,
        costPrice: batch.costPrice,
        refNumber,
        note,
        user: userId,
      },
      session
    );

    allocations.push({
      batch: batch._id,
      quantity: take,
      returned: 0,
      costPrice: batch.costPrice,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
    });

    remaining = roundQty(remaining - take);
  }

  return allocations;
}

// Puts returned goods back into the SAME batch they were sold from
async function returnToBatch(options) {
  const { batchId, baseQuantity, refNumber = '', note = '', userId, session } = options;

  const quantity = roundQty(baseQuantity);

  const batch = await StockBatch.findOneAndUpdate(
    { _id: batchId },
    { $inc: { quantity: quantity } },
    { new: true, session }
  );

  if (!batch) {
    throw new AppError(404, 'Partiya topilmadi');
  }

  await writeMovement(
    {
      type: 'return',
      product: batch.product,
      branch: batch.branch,
      batch: batch._id,
      batchNumber: batch.batchNumber,
      quantity,
      costPrice: batch.costPrice,
      refNumber,
      note,
      user: userId,
    },
    session
  );

  return batch;
}

// Manual correction after counting the goods. "delta" can be negative.
async function adjustBatch(options) {
  const { batchId, delta, note, userId, session } = options;

  const change = roundQty(delta);

  if (change === 0) {
    throw new AppError(400, "O'zgarish nolga teng");
  }

  // When we remove stock, make sure the batch does not go below zero
  const filter = { _id: batchId };

  if (change < 0) {
    filter.quantity = { $gte: -change };
  }

  const batch = await StockBatch.findOneAndUpdate(
    filter,
    { $inc: { quantity: change } },
    { new: true, session }
  );

  if (!batch) {
    throw new AppError(400, 'Partiya topilmadi yoki qoldiq yetarli emas');
  }

  await writeMovement(
    {
      type: 'adjustment',
      product: batch.product,
      branch: batch.branch,
      batch: batch._id,
      batchNumber: batch.batchNumber,
      quantity: change,
      costPrice: batch.costPrice,
      note,
      user: userId,
    },
    session
  );

  return batch;
}

// Total stock of products. Returns a Map: "productId" -> quantity
// branchId = null means all branches together.
async function getStockMap(productIds, branchId) {
  // Aggregation pipelines do NOT convert text ids to ObjectId by themselves, so we do it here
  const match = { product: { $in: productIds.map((id) => new mongoose.Types.ObjectId(String(id))) } };

  if (branchId) {
    match.branch = new mongoose.Types.ObjectId(String(branchId));
  }

  const rows = await StockBatch.aggregate([
    { $match: match },
    { $group: { _id: '$product', quantity: { $sum: '$quantity' } } },
  ]);

  const map = new Map();

  for (const row of rows) {
    map.set(String(row._id), roundQty(row.quantity));
  }

  return map;
}

module.exports = {
  addStock,
  removeStock,
  returnToBatch,
  adjustBatch,
  getStockMap,
};
