// En desarrollo solo imprime el correo en la consola del servidor.
// En producción reemplaza el cuerpo por Nodemailer, SendGrid, Resend, etc.
module.exports = async function sendMail(to, subject, text) {
  console.log(`\n[CORREO SIMULADO]\nPara: ${to}\nAsunto: ${subject}\n${text}\n`);
};