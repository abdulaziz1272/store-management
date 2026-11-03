// Who changed what. Used for changes of "master data":
// products, units, branches, users, suppliers, customers.
// (Sales, returns, purchases and stock changes have their own history.)

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, default: '' },
    role: { type: String, default: '' },
    // The branch of the person who made the change (null for admin)
    branch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    // A readable name of the changed record, for example the product name
    label: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ branch: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
