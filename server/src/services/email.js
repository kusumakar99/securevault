import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.EMAIL_FROM || 'SecureVault <noreply@securevault.local>';

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[EMAIL MOCK] To: ${to} | Subject: ${subject}`);
    console.log(`[EMAIL MOCK] Would send email but SMTP not configured.`);
    return { mock: true };
  }

  const transport = getTransporter();
  return transport.sendMail({ from, to, subject, html, text });
}
