const router = require('express').Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const VALID_TYPES = ['info', 'warning', 'critical'];

// GET /api/announcements — active, non-expired banners for all authenticated users
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, message, type, expires_at, created_at
       FROM announcements
       WHERE is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/announcements/all — full list for admin management (defined before /:id)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.*, u.name AS created_by_name
       FROM announcements a
       LEFT JOIN users u ON a.created_by = u.id
       ORDER BY a.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/announcements — create (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { message, type, expires_at } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
  const announcementType = VALID_TYPES.includes(type) ? type : 'info';

  try {
    const result = await db.query(
      `INSERT INTO announcements (message, type, is_active, created_by, expires_at)
       VALUES ($1, $2, TRUE, $3, $4)
       RETURNING *`,
      [message.trim(), announcementType, req.user.id, expires_at || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/announcements/:id — update (admin only)
// expires_at: omit to leave unchanged, send '' or null to clear, send ISO string to set
router.patch('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { message, type, is_active } = req.body;

  if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  const hasExpiry = 'expires_at' in req.body;
  const expiresAt = hasExpiry ? (req.body.expires_at || null) : undefined;

  try {
    const result = await db.query(
      `UPDATE announcements SET
        message    = COALESCE($1, message),
        type       = COALESCE($2, type),
        is_active  = COALESCE($3::boolean, is_active),
        expires_at = CASE WHEN $4 THEN $5::timestamptz ELSE expires_at END
       WHERE id = $6
       RETURNING *`,
      [
        message?.trim() || null,
        type || null,
        is_active != null ? is_active : null,
        hasExpiry,
        expiresAt,
        id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Announcement not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/announcements/:id — permanent delete (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM announcements WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ message: 'Deleted', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
