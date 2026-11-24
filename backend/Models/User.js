const { Schema, model } = require('mongoose');

const User = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    birth: String,
    passwordHash: { type: String, select: false },
    securityQuestion: String,
    securityAnswerHash: { type: String, select: false },

    requestedRole: { type: String, enum: ['paciente', 'nutriologo', 'administrador'], required: true },
    role: { type: String, enum: ['ninguno', 'paciente', 'nutriologo', 'administrador'], default: 'ninguno' },
    status: { type: String, enum: ['activo', 'pendiente', 'revision', 'rechazado'], default: 'pendiente' },
    reason: String,
    clinicalAccess: { type: Boolean, default: false },
    answers: Schema.Types.Mixed,

    inviteId: Schema.Types.ObjectId,
    bootstrap: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailTokenHash: String,
    emailTokenExp: Date,
    cedulaVerified: { type: Boolean, default: false },
    approval: { by: Schema.Types.ObjectId, at: Date, grantsClinical: Boolean },
    mfa: {
      enabled: { type: Boolean, default: false },
      secretEnc: { type: String, select: false },
      pendingEnc: { type: String, select: false },
    },

    failedLogins: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    qfails: { type: Number, default: 0 },
    qlock: Date,
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = model('User', User);
