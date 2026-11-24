const jwt = require('jsonwebtoken');
const User = require('../Models/User');

const COOKIE = 'sid';
const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 8 * 3600 * 1000,
  path: '/',
});

const setSession = (res, user) => {
  const token = jwt.sign({ sub: String(user._id), v: user.tokenVersion }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
  res.cookie(COOKIE, token, cookieOpts());
};
const clearSession = (res) => res.clearCookie(COOKIE, { path: '/' });

// Verifica la cookie y carga al usuario desde la base de datos en cada petición
async function auth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'No autenticado.' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const u = await User.findById(p.sub);
    if (!u || u.tokenVersion !== p.v) return res.status(401).json({ error: 'Sesión vencida.' });
    req.user = u;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida.' });
  }
}

module.exports = { auth, setSession, clearSession };