// Ejecutar con:  npm test
const assert = require('assert');
const { resolveRole } = require('./roles');

const ok = { emailVerified: true, invite: { valid: true, role: 'administrador', emailMatches: true }, cedula: { verified: true }, mfaEnrolled: true, adminApproval: { grantsClinical: false } };
const nut = { requested: 'nutriologo', email: 'a@b.mx', cedula: '1234567', nombreCedula: 'Ana', institucion: 'Consultorio', atiendePacientes: true, consentPrivacidad: true, aceptaConfidencialidad: true };
const adm = { requested: 'administrador', email: 'a@b.mx', inviteToken: 'x', area: 'Operación', necesitaDatosClinicos: false, atiendePacientes: false, consentPrivacidad: true, aceptaPoliticaAdmin: true };
const t = (name, got, role, reason) => { assert.strictEqual(got.role, role, `${name}: rol ${got.role}`); if (reason) assert.strictEqual(got.reason, reason, `${name}: motivo ${got.reason}`); console.log('ok -', name); };

t('nutriólogo verificado', resolveRole(nut, ok), 'nutriologo', 'ok');
t('nutriólogo sin verificar cédula', resolveRole(nut, { ...ok, cedula: { verified: false } }), 'ninguno', 'cedula_por_verificar');
t('nutriólogo con cédula inválida', resolveRole({ ...nut, cedula: '12' }, ok), 'ninguno', 'cedula_invalida');
t('nutriólogo que no atiende pacientes', resolveRole({ ...nut, atiendePacientes: false }, ok), 'ninguno', 'contradiccion');
t('casilla de confidencialidad sin marcar', resolveRole({ ...nut, aceptaConfidencialidad: false }, ok), 'ninguno', 'incompleto');
t('correo sin verificar', resolveRole(nut, { ...ok, emailVerified: false }), 'ninguno', 'correo_sin_verificar');
t('administrador completo', resolveRole(adm, ok), 'administrador', 'ok');
t('administrador sin invitación', resolveRole(adm, { ...ok, invite: null }), 'ninguno', 'sin_invitacion_valida');
t('invitación de otro correo', resolveRole(adm, { ...ok, invite: { valid: true, role: 'administrador', emailMatches: false } }), 'ninguno', 'sin_invitacion_valida');
t('invitación sin rol administrador', resolveRole(adm, { ...ok, invite: { valid: true, role: 'nutriologo', emailMatches: true } }), 'ninguno', 'sin_invitacion_valida');
t('administrador que atiende pacientes', resolveRole({ ...adm, atiendePacientes: true }, ok), 'ninguno', 'conflicto_de_funciones');
t('administrador sin MFA', resolveRole(adm, { ...ok, mfaEnrolled: false }), 'ninguno', 'falta_mfa');
t('administrador sin segunda aprobación', resolveRole(adm, { ...ok, adminApproval: null }), 'ninguno', 'falta_segunda_aprobacion');
t('rol inventado', resolveRole({ ...adm, requested: 'superadmin' }, ok), 'ninguno', 'solicitud_invalida');
t('sin rol elegido', resolveRole({ email: 'a@b.mx' }, ok), 'ninguno', 'solicitud_invalida');
console.log('\nTodas las pruebas pasaron.');