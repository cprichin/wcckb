const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  logger: true,
  debug: true,
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT) || 25,
  secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for 25/587

  auth:
  process.env.SMTP_USER && process.env.SMTP_PASS
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,

 tls: {
  rejectUnauthorized:
    process.env.SMTP_REJECT_UNAUTHORIZED === 'true',
},
});
transporter.verify((err, success) => {
  if (err) {
    console.error('SMTP VERIFY FAILED');
    console.error(err);
  } else {
    console.log('SMTP SERVER READY');
  }
});
/**
 * Send an email confirmation link to a newly registered user.
 * @param {string} toEmail - Recipient email address
 * @param {string} toName  - Recipient display name
 * @param {string} token   - Confirmation token (raw, not hashed)
 */
async function sendConfirmationEmail(toEmail, toName, token) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const confirmUrl = `${baseUrl}/confirm-email?token=${token}`;
  const expiryHours = 6;

  // Build sender from separate env vars
  const smtpName = process.env.SMTP_NAME || 'HelpDesk';
  const smtpEmail = process.env.SMTP_EMAIL || 'helpdesk@fastmanacollective.com';

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
      <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">🎫 HelpDesk</h1>
      </div>

      <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin-top: 0;">Confirm your email address</h2>

        <p>Hi ${toName},</p>

        <p>
          Your HelpDesk account has been created.
          Click the button below to confirm your email address and activate your account.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a
            href="${confirmUrl}"
            style="
              background: #3b82f6;
              color: #fff;
              padding: 14px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 15px;
              display: inline-block;
            "
          >
            Confirm Email Address
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          This link expires in <strong>${expiryHours} hours</strong>.
          If you don't confirm within that time, your account will be automatically deleted
          and you'll need to register again.
        </p>

        <p style="color: #64748b; font-size: 13px;">
          If you didn't create this account, you can safely ignore this email.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          If the button doesn't work, copy and paste this link into your browser:
          <br />
          <a
            href="${confirmUrl}"
            style="color: #3b82f6; word-break: break-all;"
          >
            ${confirmUrl}
          </a>
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"${smtpName}" <${smtpEmail}>`,
    to: `"${toName}" <${toEmail}>`,
    subject: 'Confirm your HelpDesk account',

    html,

    text: `Hi ${toName},

Confirm your HelpDesk account by visiting:
${confirmUrl}

This link expires in ${expiryHours} hours.

If you didn't create this account, ignore this email.`,
  });
}

/**
 * Send a password-reset link to a user who hit "forgot password".
 * @param {string} toEmail - Recipient email address
 * @param {string} toName  - Recipient display name
 * @param {string} token   - Reset token (raw, not hashed)
 */
async function sendPasswordResetEmail(toEmail, toName, token) {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const expiryMinutes = 60;

  const smtpName = process.env.SMTP_NAME || 'HelpDesk';
  const smtpEmail = process.env.SMTP_EMAIL || 'helpdesk@fastmanacollective.com';

  const html = `
    <div style="font-family: 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; color: #1e293b;">
      <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 22px;">🎫 HelpDesk</h1>
      </div>

      <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
        <h2 style="margin-top: 0;">Reset your password</h2>

        <p>Hi ${toName},</p>

        <p>
          We received a request to reset the password for your HelpDesk account.
          Click the button below to choose a new password.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a
            href="${resetUrl}"
            style="
              background: #3b82f6;
              color: #fff;
              padding: 14px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 600;
              font-size: 15px;
              display: inline-block;
            "
          >
            Reset Password
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          This link expires in <strong>${expiryMinutes} minutes</strong>.
          If you didn't request a password reset, you can safely ignore this email —
          your password will remain unchanged.
        </p>

        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />

        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          If the button doesn't work, copy and paste this link into your browser:
          <br />
          <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">
            ${resetUrl}
          </a>
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"${smtpName}" <${smtpEmail}>`,
    to: `"${toName}" <${toEmail}>`,
    subject: 'Reset your HelpDesk password',
    html,
    text: `Hi ${toName},

Reset your HelpDesk password by visiting:
${resetUrl}

This link expires in ${expiryMinutes} minutes.

If you didn't request a password reset, ignore this email — your password will remain unchanged.`,
  });
}

module.exports = { transporter, sendConfirmationEmail, sendPasswordResetEmail };
