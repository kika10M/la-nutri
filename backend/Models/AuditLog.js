const { Schema, model } = require('mongoose');

// Bitácora de auditoría: solo se agregan registros; ninguna ruta los edita ni los borra.
const AuditLog = new Schema({
  actor: Schema.Types.ObjectId,
  action: { type: String, required: true },
  target: Schema.Types.ObjectId,
  ip: String,
  at: { type: Date, default: Date.now },
  details: Schema.Types.Mixed,
});

module.exports = model('AuditLog', AuditLog);
