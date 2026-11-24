const router = require('express').Router();
const User = require('../Models/User');
const Invitation = require('../Models/Invitation');
const AuditLog = require('../Models/AuditLog');
const requireRole = require('../Middleware/RequireRole');
const { applyRole } = require('../Utils/Access');
const { sha256, randomToken } = require('../Utils/Crypto');
const sendMail = require('../Utils/Mail');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const log = (req, action, target, extra) => AuditLog.create({ actor: req.user._id, action, target, ip: req.ip, details: extra }).catch(() => {});

router.use(requireRole('administrador'));

router.get('/users', wrap(async (req, res) => {
  const list = await User.find({ status: { $in: ['pendiente', 'revision'] } }).sort({ createdAt: -1 });
  res.json({ users: list.map((u) => ({ id: u._id, name: u.name, email: u.email, requestedRole: u.requestedRole, status: u.status, reason: u.reason, answers: u.answers || {} })) });
}));

router.post('/users/:id/approve', wrap(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (String(u._id) === String(req.user._id)) return res.status(403).json({ error: 'No puedes aprobarte a ti mismo.' });
  if (u.requestedRole === 'nutriologo') u.cedulaVerified = true;
  if (u.requestedRole === 'administrador') u.approval = { by: req.user._id, at: new Date(), grantsClinical: req.body?.grantsClinical === true };
  await u.save(); await applyRole(u); await log(req, 'approve', u._id);
  res.json({ ok: true });
}));

router.post('/users/:id/reject', wrap(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado.' });
  u.status = 'rechazado'; u.role = 'ninguno'; u.tokenVersion += 1;
  await u.save(); await log(req, 'reject', u._id);
  res.json({ ok: true });
}));

router.post('/invitations', wrap(async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Correo inválido.' });
  const token = randomToken();
  await Invitation.create({ tokenHash: sha256(token), email, createdBy: req.user._id, expiresAt: new Date(Date.now() + 48 * 3600 * 1000) });
  const link = `${process.env.CLIENT_URL}/?invite=${token}`;
  await sendMail(email, 'Invitación como administrador - La Nutria', link);
  await log(req, 'invite', undefined, { email });
  res.json({ link });
}));

module.exports = router;