const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendConfirmationEmail, sendPasswordResetEmail } = require('../services/email');

// Helper — generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register — self-registration (always role: user)
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, and password are required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const token = generateToken();
    const expires = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now

    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, role,
          email_confirmed, confirmation_token, confirmation_expires_at)
       VALUES ($1, $2, $3, 'user', FALSE, $4, $5)
       RETURNING id, name, email, role`,
      [name, email, hash, token, expires]
    );

    // Send confirmation email — if it fails, delete the account and surface the error
    try {
      await sendConfirmationEmail(email, name, token);
    } catch (mailErr) {
      await db.query('DELETE FROM users WHERE id = $1', [result.rows[0].id]);
      console.error('Email send failed:', mailErr.message);
      return res.status(500).json({
        error: 'Account created but confirmation email could not be sent. Please try again or contact an administrator.',
      });
    }

    res.status(201).json({
      message: 'Account created. Please check your email to confirm your account within 6 hours.',
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/confirm/:token — confirm email address
router.get('/confirm/:token', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.query(
      `UPDATE users
       SET email_confirmed = TRUE,
           confirmation_token = NULL,
           confirmation_expires_at = NULL
       WHERE confirmation_token = $1
         AND email_confirmed = FALSE
         AND confirmation_expires_at > NOW()
       RETURNING id, name, email, role`,
      [token]
    );

    if (!result.rows.length) {
      // Check if the token exists but is expired
      const expired = await db.query(
        `SELECT id FROM users WHERE confirmation_token = $1 AND email_confirmed = FALSE`,
        [token]
      );
      if (expired.rows.length) {
        return res.status(410).json({ error: 'This confirmation link has expired. Your account has been removed — please register again.' });
      }
      return res.status(404).json({ error: 'Invalid or already used confirmation link.' });
    }

    res.json({ message: 'Email confirmed successfully. You can now log in.', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // Block unconfirmed accounts
    if (!user.email_confirmed) {
      return res.status(403).json({
        error: 'Please confirm your email address before logging in. Check your inbox for the confirmation link.',
        unconfirmed: true,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'changeme_secret',
      { expiresIn: '12h' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot — request a password-reset link
// Always returns the same generic 200 so this endpoint can't be used to enumerate accounts.
router.post('/forgot', async (req, res) => {
  const { email } = req.body;
  const generic = { message: 'If an account exists for that email, a password-reset link has been sent.' };

  if (!email) return res.status(400).json({ error: 'email is required' });

  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    // No user? Respond as if we sent the email anyway.
    if (!user) return res.json(generic);

    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.query(
      `UPDATE users SET reset_token = $1, reset_expires_at = $2 WHERE id = $3`,
      [token, expires, user.id]
    );

    // Fire the email. If it fails, surface a 500 — the user needs to know to retry,
    // and the token row stays valid until expiry / next request overwrites it.
    try {
      await sendPasswordResetEmail(user.email, user.name, token);
    } catch (mailErr) {
      console.error('Password reset email failed:', mailErr.message);
      return res.status(500).json({ error: 'Could not send reset email. Please try again or contact an administrator.' });
    }

    res.json(generic);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset/:token — complete a password reset
router.post('/reset/:token', async (req, res) => {
  const { token } = req.params;
  const { new_password } = req.body;

  if (!new_password) return res.status(400).json({ error: 'new_password is required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const lookup = await db.query(
      `SELECT id, email_confirmed FROM users
       WHERE reset_token = $1 AND reset_expires_at > NOW()`,
      [token]
    );

    if (!lookup.rows.length) {
      // Distinguish expired vs. truly invalid so the UI can phrase it appropriately.
      const expired = await db.query(
        `SELECT id FROM users WHERE reset_token = $1`,
        [token]
      );
      if (expired.rows.length) {
        return res.status(410).json({ error: 'This password-reset link has expired. Please request a new one.' });
      }
      return res.status(404).json({ error: 'Invalid or already used reset link.' });
    }

    const { id, email_confirmed } = lookup.rows[0];
    const hash = await bcrypt.hash(new_password, 10);

    // Clear the reset token, set the new password, and auto-confirm the email
    // since clicking the link proved ownership of the inbox.
    await db.query(
      `UPDATE users SET
         password_hash = $1,
         reset_token = NULL,
         reset_expires_at = NULL,
         email_confirmed = TRUE,
         confirmation_token = CASE WHEN email_confirmed = FALSE THEN NULL ELSE confirmation_token END,
         confirmation_expires_at = CASE WHEN email_confirmed = FALSE THEN NULL ELSE confirmation_expires_at END
       WHERE id = $2`,
      [hash, id]
    );

    res.json({
      message: 'Password updated successfully. You can now log in.',
      auto_confirmed: !email_confirmed,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/auth/password — change own password
router.patch('/password', authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: 'current_password and new_password are required' });
  if (new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });

  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
