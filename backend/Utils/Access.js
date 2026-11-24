const Invitation = require('../models/Invitation');
const { resolveRole } = require('./roles');

// Evidencias verificadas por el servidor (nunca vienen del cliente)
async function evidenceFor(u) {
  const inv = u.inviteId ? await Invitation.findById(u.inviteId) : null;
  const invite = u.bootstrap
    ? { valid: true, role: 'administrador', emailMatches: true } // primer administrador creado por script
    : inv
      ? { valid: !!inv.usedBy && String(inv.usedBy) === String(u._id), role: inv.role, emailMatches: inv.email === u.email }
      : null;
  return {
    emailVerified: u.emailVerified,
    invite,
    cedula: { verified: u.cedulaVerified },
    mfaEnrolled: !!u.mfa?.enabled,
    adminApproval: u.approval?.by ? { grantsClinical: !!u.approval.grantsClinical } : u.bootstrap ? { grantsClinical: false } : null,
  };
}

// Recalcula el rol a partir de las respuestas guardadas y la evidencia actual.
// Si el rol cambia se invalidan las sesiones anteriores (tokenVersion).
async function applyRole(user) {
  if (user.status === 'rechazado') return { role: 'ninguno', status: 'rechazado', reason: 'rechazado' };
  const r = resolveRole({ ...user.answers, requested: user.requestedRole }, await evidenceFor(user));
  if (r.role !== user.role || r.status !== user.status) user.tokenVersion += 1;
  user.role = r.role;
  user.status = r.status;
  user.reason = r.reason;
  user.clinicalAccess = !!r.clinicalAccess;
  await user.save();
  return r;
}

// Lo que el usuario puede ver de su propio estado (no revela por qué está en revisión)
const NEXT = {
  correo_sin_verificar: 'verificar_correo',
  falta_mfa: 'configurar_mfa',
  incompleto: 'completar',
  cedula_invalida: 'completar',
  cedula_por_verificar: 'esperar',
  falta_segunda_aprobacion: 'esperar',
};
const publicUser = (u) => ({
  id: u._id,
  email: u.email,
  name: u.name,
  birth: u.birth,
  role: u.role,
  status: u.status,
  clinicalAccess: u.clinicalAccess,
  next: u.status === 'activo' ? null : u.status === 'revision' ? 'revision' : u.status === 'rechazado' ? 'rechazado' : NEXT[u.reason] || 'esperar',
});

module.exports = { applyRole, publicUser };