const { auth } = require('./Auth');
const { RANK } = require('../Utils/roles');

// Uso: router.get('/ruta', requireRole('administrador'), handler)
// El rol se lee de la base de datos (req.user), nunca del cuerpo de la petición ni del token.
const requireRole = (min) => [
  auth,
  (req, res, next) => {
    const u = req.user;
    if (u.status !== 'activo' || RANK[u.role] < RANK[min]) return res.status(403).json({ error: 'Sin permiso.' });
    if (u.role === 'administrador' && !u.mfa?.enabled) return res.status(403).json({ error: 'Sin permiso.' });
    next();
  },
];

module.exports = requireRole;