const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const User = require('../Models/User');
const Invitation = require('../Models/Invitation');
const { QUESTIONS } = require('../Utils/Roles');
const { applyRole, publicUser } = require('../Utils/Access');
const { sha256, randomToken, encrypt, decrypt } = require('../Utils/Crypto');
const sendMail = require('../Utils/Mail');
const { auth, setSession, clearSession } = require('../middleware/Auth');

const MAX_BIRTH = '2008-12-31';
const MAX_FAILS = 3;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Registro
router.post('/register', wrap(async (req, res) => {
  const b = req.body || {};
  const email = str(b.email).toLowerCase();
  const name = str(b.name);
  const answer = str(b.answer).toLowerCase();
  const requested = b.requested;
  const a = b.answers && typeof b.answers === 'object' ? b.answers : {};

  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Nombre o correo inválidos.' });
  if (!str(b.birth) || b.birth > MAX_BIRTH) return res.status(400).json({ error: 'La fecha de nacimiento debe ser de 2008 o anterior.' });
  if (typeof b.password !== 'string' || b.password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  if (!QUESTIONS.includes(b.question) || !answer) return res.status(400).json({ error: 'Elige una pregunta de seguridad y respóndela.' });
  if (!['paciente', 'nutriologo', 'administrador'].includes(requested)) return res.status(400).json({ error: 'Solicitud inválida.' });

  // Respuesta genérica: no revela si el correo ya existe
  const done = { message: 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.' };
  if (await User.exists({ email })) return res.json(done);

  let invitation = null;
  if (requested === 'administrador') {
    invitation = await Invitation.findOne({ tokenHash: sha256(str(b.inviteToken)), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!invitation || invitation.email !== email) return res.status(400).json({ error: 'La invitación no es válida o expiró.' });
  }

  const token = randomToken();
  const user = await User.create({
    email, name, birth: b.birth,
    passwordHash: await bcrypt.hash(b.password, 12),
    securityQuestion: b.question,
    securityAnswerHash: await bcrypt.hash(answer, 12),
    requestedRole: requested,
    // El servidor completa lo que resolveRole necesita; nunca confía en un rol enviado por el cliente
    answers: { ...a, email, ...(invitation ? { inviteToken: 'presente' } : {}) },
    inviteId: invitation?._id,
    emailTokenHash: sha256(token),
    emailTokenExp: new Date(Date.now() + 24 * 3600 * 1000),
  });
  if (invitation) { invitation.usedAt = new Date(); invitation.usedBy = user._id; await invitation.save(); }
  await applyRole(user);

  await sendMail(email, 'Verifica tu correo - La Nutria', `Abre este enlace para verificar tu cuenta:\n${process.env.API_URL}/api/auth/verify-email?token=${token}`);
  res.json(done);
}));

router.get('/verify-email', wrap(async (req, res) => {
  const u = await User.findOne({ emailTokenHash: sha256(str(req.query.token)), emailTokenExp: { $gt: new Date() } });
  if (u) {
    u.emailVerified = true; u.emailTokenHash = undefined; u.emailTokenExp = undefined;
    await u.save(); await applyRole(u);
  }
  res.redirect(`${process.env.CLIENT_URL}/?verificado=${u ? 1 : 0}`);
}));

// ── Inicio de sesión (bloqueo a los 3 intentos fallidos, MFA si está activo)
router.post('/login', wrap(async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const u = await User.findOne({ email }).select('+passwordHash +mfa.secretEnc');
  const bad = () => res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  if (!u) { await bcrypt.compare(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali'); return bad(); }
  if (u.locked) return res.status(423).json({ error: 'Cuenta bloqueada.', locked: true, email: u.email, question: u.securityQuestion });

  if (!(await bcrypt.compare(password, u.passwordHash))) {
    u.failedLogins += 1;
    const justLocked = u.failedLogins >= MAX_FAILS;
    if (justLocked) u.locked = true;
    await u.save();
    if (justLocked) return res.status(423).json({ error: 'Cuenta bloqueada.', locked: true, justLocked: true, email: u.email, question: u.securityQuestion });
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.', left: MAX_FAILS - u.failedLogins });
  }

  if (u.mfa?.enabled) {
    const code = str(req.body?.code);
    if (!code) return res.status(401).json({ mfaRequired: true });
    if (!authenticator.check(code, decrypt(u.mfa.secretEnc))) return res.status(401).json({ error: 'Código incorrecto.', mfaRequired: true });
  }
  u.failedLogins = 0; await u.save();
  setSession(res, u);
  res.json({ user: publicUser(u) });
}));

router.post('/logout', auth, wrap(async (req, res) => {
  req.user.tokenVersion += 1; await req.user.save();
  clearSession(res); res.json({ ok: true });
}));

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// ── Desbloqueo con pregunta de seguridad
router.post('/unlock', wrap(async (req, res) => {
  const email = str(req.body?.email).toLowerCase();
  const answer = str(req.body?.answer).toLowerCase();
  const pwd = req.body?.newPassword;
  if (typeof pwd !== 'string' || pwd.length < 8) return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres.' });
  const u = await User.findOne({ email }).select('+securityAnswerHash');
  const bad = () => res.status(400).json({ error: 'No se pudo desbloquear la cuenta.' });
  if (!u || !u.locked) return bad();
  if (u.qlock && u.qlock > new Date()) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  if (!(await bcrypt.compare(answer, u.securityAnswerHash))) {
    u.qfails += 1;
    if (u.qfails >= 5) { u.qfails = 0; u.qlock = new Date(Date.now() + 15 * 60 * 1000); }
    await u.save();
    return res.status(400).json({ error: 'Respuesta incorrecta.' });
  }
  u.passwordHash = await bcrypt.hash(pwd, 12);
  Object.assign(u, { locked: false, failedLogins: 0, qfails: 0, qlock: undefined });
  u.tokenVersion += 1; await u.save();
  res.json({ ok: true });
}));

// ── MFA (app de autenticación)
router.post('/mfa/setup', auth, wrap(async (req, res) => {
  const u = await User.findById(req.user._id).select('+mfa.pendingEnc');
  const secret = authenticator.generateSecret();
  u.mfa.pendingEnc = encrypt(secret); await u.save();
  res.json({ secret, otpauth: authenticator.keyuri(u.email, 'La Nutria', secret) });
}));

router.post('/mfa/verify', auth, wrap(async (req, res) => {
  const u = await User.findById(req.user._id).select('+mfa.pendingEnc +mfa.secretEnc');
  if (!u.mfa?.pendingEnc) return res.status(400).json({ error: 'Primero genera el código.' });
  if (!authenticator.check(str(req.body?.code), decrypt(u.mfa.pendingEnc))) return res.status(400).json({ error: 'Código incorrecto.' });
  u.mfa.secretEnc = u.mfa.pendingEnc; u.mfa.pendingEnc = undefined; u.mfa.enabled = true;
  await u.save(); await applyRole(u);
  res.json({ ok: true });
}));

module.exports = router;