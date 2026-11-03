const createCrudRouter = require('./crud');
const Branch = require('../models/Branch');
const { ROLES } = require('../config/constants');

// Everyone who is logged in can read the branch list (needed for transfers).
// Only the admin can create or change branches.
module.exports = createCrudRouter({
  Model: Branch,
  entity: 'Branch',
  fields: ['name', 'code', 'address', 'phone', 'isWarehouse'],
  readRoles: [],
  writeRoles: [ROLES.ADMIN],
});
