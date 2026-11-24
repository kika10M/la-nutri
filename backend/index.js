require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./Config/Db');

for (const k of ['MONGO_URI', 'JWT_SECRET', 'MFA_KEY']) {
  if (!process.env[k]) { console.error(`Falta ${k} en backend/.env`); process.exit(1); }
}
if (!/^[0-9a-f]{64}$/i.test(process.env.MFA_KEY)) {
  console.error('MFA_KEY debe tener 64 caracteres hexadecimales (genera uno con el comando de env.example).');
  process.exit(1);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', require('./Routers/auth'));
app.use('/api/admin', require('./Routers/admin'));

// Cualquier ruta /api inexistente responde JSON (el frontend siempre lee { error })
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`)))
  .catch((e) => { console.error('No se pudo conectar a MongoDB:', e.message); process.exit(1); });