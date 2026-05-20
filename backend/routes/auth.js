const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { sendConfirmationEmail } = require('../services/email');

// Helper — generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/register — self-registration (always role: user)
router.post('/register', async (req, res) => {
  const { name, email, password, department } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email, and password are required' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const token = generateToken();
    const expires = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours from now

    const result = await db.query(
      `INSERT INTO users
         (name, email, password_hash, role, department,
          email_confirmed, confirmation_token, confirmation_expires_at)
       VALUES ($1, $2, $3, 'user', $4, FALSE, $5, $6)
       RETURNING id, name, email, role`,
      [name, email, hash, department || null, token, expires]
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
      'SELECT id, name, email, role, department, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
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
