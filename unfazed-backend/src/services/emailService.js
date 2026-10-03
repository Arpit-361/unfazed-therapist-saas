/**
 * Email channel. Uses SMTP via Nodemailer when SMTP_HOST is configured; otherwise uses
 * Nodemailer's JSON transport and logs the message (development stub).
 */
const nodemailer = require('nodemailer');
const config = require('../config/env');

const isSmtpConfigured = Boolean(config.smtp.host);

const transporter = isSmtpConfigured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

async function sendEmail({ to, subject, text, html }) {
  if (!to) return { status: 'skipped', detail: 'No recipient email' };
  try {
    const info = await transporter.sendMail({ from: config.smtp.from, to, subject, text, html: html || undefined });
    if (!isSmtpConfigured) {
      console.log(`[email:stub] to=${to} subject="${subject}"`);
      return { status: 'logged', detail: 'SMTP not configured - email logged' };
    }
    return { status: 'sent', detail: info.messageId };
  } catch (err) {
    console.error('[email] send failed:', err.message);
    return { status: 'failed', detail: err.message };
  }
}

module.exports = { sendEmail, isSmtpConfigured };
