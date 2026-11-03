// A small factory that builds list / create / update routes for simple resources
// (branches, units, suppliers). Use it like:
//
//   createCrudRouter({ Model: Unit, entity: 'Unit', fields: ['name'], ... })

const express = require('express');

const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { protect, requireRole } = require('../middleware/auth');
const { logAudit, diffObjects, plain } = require('../utils/audit');

function createCrudRouter(options) {
  const {
    Model,
    entity, // name used in the audit log
    fields, // fields the user is allowed to set
    readRoles, // roles allowed to list (empty = everybody who is logged in)
    writeRoles, // roles allowed to create and update
    sort = { name: 1 },
    labelField = 'name',
  } = options;

  const router = express.Router();

  router.use(protect);

  // LIST
  const listMiddleware = readRoles && readRoles.length > 0 ? [requireRole(...readRoles)] : [];

  router.get(
    '/',
    ...listMiddleware,
    asyncHandler(async (req, res) => {
      const filter = {};

      if (req.query.active === '1') {
        filter.isActive = true;
      }

      const items = await Model.find(filter).sort(sort);
      res.json({ items, total: items.length });
    })
  );

  // CREATE
  router.post(
    '/',
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const data = {};

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          data[field] = req.body[field];
        }
      }

      const item = await Model.create(data);

      await logAudit({
        user: req.user,
        action: 'create',
        entity,
        entityId: item._id,
        label: item[labelField],
        after: plain(item),
      });

      res.status(201).json({ item });
    })
  );

  // UPDATE (also used to deactivate: send isActive false). Nothing is ever deleted.
  router.put(
    '/:id',
    requireRole(...writeRoles),
    asyncHandler(async (req, res) => {
      const item = await Model.findById(req.params.id);

      if (!item) {
        throw new AppError(404, 'Topilmadi');
      }

      const before = plain(item);

      for (const field of fields) {
        if (req.body[field] !== undefined) {
          item[field] = req.body[field];
        }
      }

      if (req.body.isActive !== undefined && Model.schema.path('isActive')) {
        item.isActive = req.body.isActive;
      }

      await item.save();

      const changes = diffObjects(before, plain(item));

      await logAudit({
        user: req.user,
        action: 'update',
        entity,
        entityId: item._id,
        label: item[labelField],
        before: changes.before,
        after: changes.after,
      });

      res.json({ item });
    })
  );

  return router;
}

module.exports = createCrudRouter;
