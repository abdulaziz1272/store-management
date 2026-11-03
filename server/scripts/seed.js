// Creates the first data: default units, the first branch and the first admin.
// Run it once:   npm run seed
// It is safe to run again, it only adds what is missing.

require('dotenv').config();

const { connectDatabase } = require('../src/config/db');
const Unit = require('../src/models/Unit');
const Branch = require('../src/models/Branch');
const User = require('../src/models/User');

const DEFAULT_UNITS = [
  { name: 'dona', allowDecimal: false },
  { name: 'kg', allowDecimal: true },
  { name: 'tonna', allowDecimal: true },
  { name: 'qop', allowDecimal: false },
  { name: 'metr', allowDecimal: true },
  { name: 'kv.m', allowDecimal: true },
  { name: 'kub.m', allowDecimal: true },
  { name: 'litr', allowDecimal: true },
  { name: 'quti', allowDecimal: false },
  { name: 'rulon', allowDecimal: false },
  { name: 'list', allowDecimal: false },
  { name: 'paddon', allowDecimal: false },
];

async function seed() {
  await connectDatabase();

  for (const unit of DEFAULT_UNITS) {
    const exists = await Unit.findOne({ name: unit.name });

    if (!exists) {
      await Unit.create(unit);
      console.log('Unit created: ' + unit.name);
    }
  }

  let branch = await Branch.findOne({ code: 'MAIN' });

  if (!branch) {
    branch = await Branch.create({ name: 'Asosiy filial', code: 'MAIN' });
    console.log('Branch created: Asosiy filial');
  }

  const username = String(process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 8) {
    console.error('Set ADMIN_PASSWORD (at least 8 characters) in .env');
    process.exit(1);
  }

  const existing = await User.findOne({ username });

  if (!existing) {
    const admin = new User({ fullName: 'Administrator', username, role: 'admin' });
    await admin.setPassword(password);
    await admin.save();
    console.log('Admin created: ' + username);
  } else {
    console.log('Admin already exists: ' + username);
  }

  console.log('Seed finished. Now change the admin password after the first login.');
  process.exit(0);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
