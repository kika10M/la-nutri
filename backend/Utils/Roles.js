// Lógica de asignación de roles. Corre SOLO en el servidor.
// Principio: las respuestas del usuario son declaraciones, no pruebas. El rol efectivo
// es el que el servidor logra verificar con evidencia; si algo falta o es dudoso => 'ninguno'.
const RANK = { ninguno: 0, paciente: 1, nutriologo: 2, administrador: 3 };

const QUESTIONS = ['¿Cómo se llama tu mascota?', '¿Cuál es tu color favorito?', '¿En qué ciudad naciste?', '¿Cuál es tu comida favorita?'];

const REQUIRED = {
  paciente: ['email'],
  nutriologo: ['email', 'cedula', 'nombreCedula', 'institucion', 'atiendePacientes'],
  administrador: ['email', 'inviteToken', 'area', 'necesitaDatosClinicos', 'atiendePacientes'],
};
// Casillas que deben venir marcadas (true); "false" no cuenta como aceptado
const MUST_BE_TRUE = {
  paciente: ['consentPrivacidad'],
  nutriologo: ['consentPrivacidad', 'aceptaConfidencialidad'],
  administrador: ['consentPrivacidad', 'aceptaPoliticaAdmin'],
};

const filled = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const out = (role, status, reason, extra = {}) => ({ role, status, reason, ...extra });

// a  = respuestas del usuario (NO confiables)
// ev = evidencias verificadas por el servidor:
//      { emailVerified, invite:{valid,role,emailMatches}, cedula:{verified}, mfaEnrolled, adminApproval:{grantsClinical} }
function resolveRole(a, ev) {
  const req = a.requested;
  if (!REQUIRED[req]) return out('ninguno', 'pendiente', 'solicitud_invalida');

  const missing = [
    ...REQUIRED[req].filter((k) => !filled(a[k])),
    ...MUST_BE_TRUE[req].filter((k) => a[k] !== true),
  ];
  if (missing.length) return out('ninguno', 'pendiente', 'incompleto', { missing });
  if (!ev.emailVerified) return out('ninguno', 'pendiente', 'correo_sin_verificar');

  if (req === 'paciente') return out('paciente', 'activo', 'ok');

  if (req === 'nutriologo') {
    if (a.atiendePacientes !== true) return out('ninguno', 'revision', 'contradiccion');
    if (!/^\d{7,8}$/.test(String(a.cedula))) return out('ninguno', 'pendiente', 'cedula_invalida'); // ajusta al formato de tu registro
    return ev.cedula?.verified
      ? out('nutriologo', 'activo', 'ok')
      : out('ninguno', 'pendiente', 'cedula_por_verificar'); // sin rol hasta que un administrador verifique la cédula
  }

  // administrador
  const inv = ev.invite;
  if (!inv?.valid || inv.role !== 'administrador' || !inv.emailMatches)
    return out('ninguno', 'revision', 'sin_invitacion_valida', { alertAdmins: true });
  if (a.atiendePacientes === true) return out('ninguno', 'revision', 'conflicto_de_funciones');
  if (!ev.mfaEnrolled) return out('ninguno', 'pendiente', 'falta_mfa');
  if (!ev.adminApproval) return out('ninguno', 'pendiente', 'falta_segunda_aprobacion');
  return out('administrador', 'activo', 'ok', {
    clinicalAccess: a.necesitaDatosClinicos === true && ev.adminApproval.grantsClinical === true,
  });
}

module.exports = { RANK, QUESTIONS, resolveRole };