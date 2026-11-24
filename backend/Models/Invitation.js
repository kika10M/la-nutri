const { Schema, model } = require('mongoose');

const Invitation = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true }, // solo se guarda el hash del token
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['administrador'], default: 'administrador' },
    createdBy: Schema.Types.ObjectId,
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: Schema.Types.ObjectId,
  },
  { timestamps: true }
);

module.exports = model('Invitation', Invitation);
