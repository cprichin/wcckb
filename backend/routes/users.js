const router = require('express').Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/users — list all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, department, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/agents — list agents (for ticket assignment dropdown)
router.get('/agents', authenticate, authorize('agent', 'admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email FROM users WHERE role IN ('agent', 'admin') ORDER BY name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users — admin creates a user with any role directly
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, email, password, role, department } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  if (!['user', 'agent', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, department, created_at`,
      [name, email, hash, role, department || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/users/:id — admin deletes a user
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    await db.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/users/:id/role — change user role (admin only)
router.patch('/:id/role', authenticate, authorize('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['user', 'agent', 'admin'].includes(role))
    return res.status(400).json({ error: 'Invalid role' });
  try {
    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
      [role, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
