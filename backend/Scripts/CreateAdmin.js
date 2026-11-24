// Crea el PRIMER administrador (único camino sin invitación). Uso:
//   node scripts/createAdmin.js correo@dominio.com "Contraseña-larga" "Nombre Apellido" "respuesta secreta"
// Al iniciar sesión por primera vez deberá activar MFA para obtener el rol.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { QUESTIONS } = require('../Utils/roles');
const { applyRole } = require('../Utils/access');

(async () => {
  const [email, password, name, answer] = process.argv.slice(2);
  if (!email || !password || !name || !answer) { console.error('Uso: node scripts/createAdmin.js correo contraseña "Nombre" "respuesta"'); process.exit(1); }
  if (password.length < 8) { console.error('La contraseña debe tener al menos 8 caracteres.'); process.exit(1); }
  await mongoose.connect(process.env.MONGO_URI);
  if (await User.exists({ email: email.toLowerCase() })) { console.error('Ese correo ya existe.'); process.exit(1); }
  const u = await User.create({
    email, name, birth: '1990-01-01', bootstrap: true, emailVerified: true,
    requestedRole: 'administrador',
    answers: { email: email.toLowerCase(), inviteToken: 'bootstrap', area: 'Operación', necesitaDatosClinicos: false, atiendePacientes: false, consentPrivacidad: true, aceptaPoliticaAdmin: true },
    passwordHash: await bcrypt.hash(password, 12),
    securityQuestion: QUESTIONS[0],
    securityAnswerHash: await bcrypt.hash(answer.trim().toLowerCase(), 12),
  });
  const r = await applyRole(u);
  console.log(`Administrador creado (${r.reason}). Inicia sesión y activa MFA para completar el acceso.`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });