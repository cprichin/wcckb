const router = require('express').Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// File upload config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(file.mimetype));
  },
});

// GET /api/tickets — list tickets (user sees own, agent/admin sees all)
router.get('/', authenticate, async (req, res) => {
  try {
    const isAgent = ['agent', 'admin'].includes(req.user.role);
    const query = isAgent
      ? `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
         FROM tickets t
         LEFT JOIN users u ON t.created_by = u.id
         LEFT JOIN users a ON t.assigned_to = a.id
         ORDER BY t.created_at DESC`
      : `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
         FROM tickets t
         LEFT JOIN users u ON t.created_by = u.id
         LEFT JOIN users a ON t.assigned_to = a.id
         WHERE t.created_by = $1
         ORDER BY t.created_at DESC`;

    const result = isAgent
      ? await db.query(query)
      : await db.query(query, [req.user.id]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tickets/:id — get single ticket with comments, attachments, KB links
router.get('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  try {
    const ticket = await db.query(
      `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
       FROM tickets t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users a ON t.assigned_to = a.id
       WHERE t.id = $1`,
      [id]
    );
    if (!ticket.rows.length) return res.status(404).json({ error: 'Ticket not found' });

    const t = ticket.rows[0];
    // Check ownership for regular users
    if (req.user.role === 'user' && t.created_by !== req.user.id)
      return res.status(403).json({ error: 'Forbidden' });

    const comments = await db.query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role
       FROM ticket_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.ticket_id = $1
       ${req.user.role === 'user' ? 'AND c.is_internal = FALSE' : ''}
       ORDER BY c.created_at ASC`,
      [id]
    );

    const attachments = await db.query(
      `SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY uploaded_at ASC`,
      [id]
    );

    const kbLinks = await db.query(
      `SELECT a.id, a.title, a.category FROM kb_articles a
       JOIN ticket_kb_links l ON l.article_id = a.id
       WHERE l.ticket_id = $1`,
      [id]
    );

    res.json({ ...t, comments: comments.rows, attachments: attachments.rows, kb_links: kbLinks.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tickets — create ticket
router.post('/', authenticate, async (req, res) => {
  const { title, description, priority, category } = req.body;
  if (!title || !description)
    return res.status(400).json({ error: 'title and description are required' });

  try {
    const result = await db.query(
      `INSERT INTO tickets (title, description, priority, category, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, description, priority || 'medium', category || null, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/tickets/:id — update ticket (agents/admins)
router.patch('/:id', authenticate, authorize('agent', 'admin'), async (req, res) => {
  const { id } = req.params;
  const { status, priority, category, assigned_to } = req.body;
  try {
    const resolved_at = status === 'resolved' ? 'NOW()' : null;
    const result = await db.query(
      `UPDATE tickets SET
        status = COALESCE($1, status),
        priority = COALESCE($2, priority),
        category = COALESCE($3, category),
        assigned_to = COALESCE($4, assigned_to),
        resolved_at = CASE WHEN $5 THEN NOW() ELSE resolved_at END
       WHERE id = $6 RETURNING *`,
      [status, priority, category, assigned_to, status === 'resolved', id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tickets/:id/comments — add comment
router.post('/:id/comments', authenticate, async (req, res) => {
  const { id } = req.params;
  const { body, is_internal } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });

  // Only agents/admins can post internal notes
  const internal = is_internal && ['agent', 'admin'].includes(req.user.role);
  try {
    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, body, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, body, internal]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tickets/:id/attachments — upload image
router.post('/:id/attachments', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const result = await db.query(
      `INSERT INTO ticket_attachments (ticket_id, filename, original_name, uploaded_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, req.file.filename, req.file.originalname, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tickets/:id/kb-links — link KB article to ticket
router.post('/:id/kb-links', authenticate, authorize('agent', 'admin'), async (req, res) => {
  const { article_id } = req.body;
  try {
    await db.query(
      `INSERT INTO ticket_kb_links (ticket_id, article_id, linked_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.params.id, article_id, req.user.id]
    );
    res.status(201).json({ message: 'Linked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
