const crypto = require('crypto');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('hex');

// Cifrado AES-256-GCM para el secreto de MFA (MFA_KEY = 64 caracteres hexadecimales)
const key = () => Buffer.from(process.env.MFA_KEY, 'hex');
const encrypt = (text) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('hex')).join('.');
};
const decrypt = (payload) => {
  const [iv, tag, enc] = payload.split('.').map((h) => Buffer.from(h, 'hex'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
};

module.exports = { sha256, randomToken, encrypt, decrypt };