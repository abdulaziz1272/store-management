// Writes one row to the audit log (who changed what).

const AuditLog = require('../models/AuditLog');

// Only keeps the fields that really changed.
// Example: before {price: 10, name: "A"}, after {price: 12, name: "A"}
// result: { before: {price: 10}, after: {price: 12} }
function diffObjects(before, after) {
  const changedBefore = {};
  const changedAfter = {};
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    const oldValue = before ? before[key] : undefined;
    const newValue = after ? after[key] : undefined;

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changedBefore[key] = oldValue;
      changedAfter[key] = newValue;
    }
  }

  return { before: changedBefore, after: changedAfter };
}

async function logAudit({ user, action, entity, entityId, label, before, after, session }) {
  const entry = {
    user: user._id,
    username: user.username,
    role: user.role,
    branch: user.branch || null,
    action,
    entity,
    entityId,
    label: label || '',
    before,
    after,
  };

  await AuditLog.create([entry], { session });
}

// Turns a mongoose document into a simple object that is safe to store in the log
function plain(document) {
  if (!document) {
    return undefined;
  }

  const object = typeof document.toObject === 'function' ? document.toObject() : document;
  const copy = JSON.parse(JSON.stringify(object));

  delete copy.passwordHash;
  delete copy.__v;
  delete copy.createdAt;
  delete copy.updatedAt;

  return copy;
}

module.exports = { logAudit, diffObjects, plain };
