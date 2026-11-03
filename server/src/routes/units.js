const createCrudRouter = require('./crud');
const Unit = require('../models/Unit');
const { ROLES } = require('../config/constants');

module.exports = createCrudRouter({
  Model: Unit,
  entity: 'Unit',
  fields: ['name', 'allowDecimal'],
  readRoles: [],
  writeRoles: [ROLES.ADMIN],
});
