const createCrudRouter = require('./crud');
const Supplier = require('../models/Supplier');
const { ROLES } = require('../config/constants');

module.exports = createCrudRouter({
  Model: Supplier,
  entity: 'Supplier',
  fields: ['name', 'phone', 'address', 'note'],
  readRoles: [ROLES.ADMIN, ROLES.MANAGER],
  writeRoles: [ROLES.ADMIN, ROLES.MANAGER],
});
