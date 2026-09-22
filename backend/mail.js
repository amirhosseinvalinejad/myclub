const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const MAIL_FILE = path.join(__dirname, "mail.json");

function loadMailConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(MAIL_FILE, "utf8"));
    if (cfg.user && cfg.pass) {
      return cfg;
    }
  } catch {
    // optional local SMTP file
  }
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
    };
  }
  return null;
}

let testTransport = null;

async function getTransport() {
  const cfg = loadMailConfig();
  if (cfg) {
    return {
      transporter: nodemailer.createTransport({
        host: cfg.host || "smtp.gmail.com",
        port: cfg.port || 587,
        secure: Boolean(cfg.secure),
        auth: { user: cfg.user, pass: cfg.pass },
      }),
      from: cfg.from || cfg.user,
      test: false,
    };
  }
  if (!testTransport) {
    const account = await nodemailer.createTestAccount();
    testTransport = {
      transporter: nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
      from: `Club <${account.user}>`,
      test: true,
    };
  }
  return testTransport;
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const { transporter, from, test } = await getTransport();
  const info = await transporter.sendMail({
    from,
    to,
    subject: "Set a new password for your club account",
    text: [
      "You asked to reset your club password.",
      "",
      "Open this link to set a new password (valid for 1 hour):",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `<p>You asked to reset your club password.</p>
<p><a href="${resetUrl}">Set a new password</a></p>
<p>This link expires in 1 hour. If you did not request this, ignore this email.</p>`,
  });
  return { previewUrl: test ? nodemailer.getTestMessageUrl(info) : null };
}

module.exports = { sendPasswordResetEmail };
