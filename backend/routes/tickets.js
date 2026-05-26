const router = require('express').Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { autoAssign } = require('../services/assignments');
const {
  notifyTicketSubmitted,
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyTicketClosed,
  notifyCommentAdded,
} = require('../services/notifications');

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

// GET /api/tickets — list tickets (user sees own, agent/admin sees all).
// Optional ?q= does full-text search across title, description, and category.
// Soft-deleted tickets are always excluded — see GET /trash for the admin recycle bin.
router.get('/', authenticate, async (req, res) => {
  const q = req.query.q?.trim() || '';
  const isAgent = ['agent', 'admin'].includes(req.user.role);
  try {
    let result;
    if (q) {
      if (isAgent) {
        result = await db.query(
          `SELECT t.*, u.name AS creator_name, a.name AS assignee_name,
                  ts_rank(t.search_vector, websearch_to_tsquery('english', $1)) AS rank
           FROM tickets t
           LEFT JOIN users u ON t.created_by = u.id
           LEFT JOIN users a ON t.assigned_to = a.id
           WHERE t.deleted_at IS NULL
             AND t.search_vector @@ websearch_to_tsquery('english', $1)
           ORDER BY rank DESC`,
          [q]
        );
      } else {
        result = await db.query(
          `SELECT t.*, u.name AS creator_name, a.name AS assignee_name,
                  ts_rank(t.search_vector, websearch_to_tsquery('english', $2)) AS rank
           FROM tickets t
           LEFT JOIN users u ON t.created_by = u.id
           LEFT JOIN users a ON t.assigned_to = a.id
           WHERE t.created_by = $1
             AND t.deleted_at IS NULL
             AND t.search_vector @@ websearch_to_tsquery('english', $2)
           ORDER BY rank DESC`,
          [req.user.id, q]
        );
      }
    } else {
      result = await db.query(
        isAgent
          ? `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
             FROM tickets t
             LEFT JOIN users u ON t.created_by = u.id
             LEFT JOIN users a ON t.assigned_to = a.id
             WHERE t.deleted_at IS NULL
             ORDER BY t.created_at DESC`
          : `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
             FROM tickets t
             LEFT JOIN users u ON t.created_by = u.id
             LEFT JOIN users a ON t.assigned_to = a.id
             WHERE t.created_by = $1
               AND t.deleted_at IS NULL
             ORDER BY t.created_at DESC`,
        isAgent ? [] : [req.user.id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tickets/trash — admin-only listing of soft-deleted tickets.
// Defined before /:id so the literal path wins over the param route.
router.get('/trash', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.name AS creator_name, a.name AS assignee_name
       FROM tickets t
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users a ON t.assigned_to = a.id
       WHERE t.deleted_at IS NOT NULL
       ORDER BY t.deleted_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tickets/:id — get single ticket with comments, attachments, KB links.
// Soft-deleted tickets are visible to admins only (for preview before restore/purge);
// users and agents get a 404.
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
    if (t.deleted_at && req.user.role !== 'admin')
      return res.status(404).json({ error: 'Ticket not found' });
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
    // Auto-assign to the agent/admin with the lightest active workload
    const assigneeId = await autoAssign();

    const result = await db.query(
      `INSERT INTO tickets (title, description, priority, category, created_by, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description, priority || 'medium', category || null, req.user.id, assigneeId]
    );
    const ticket = result.rows[0];

    // Fetch admins (broadcast recipients) and the assignee (targeted email) in parallel.
    // Other agents are deliberately excluded — only the assignee should hear about it.
    const [adminsResult, assigneeResult] = await Promise.all([
      db.query(
        `SELECT id, name, email FROM users
         WHERE role = 'admin' AND email_confirmed = TRUE`
      ),
      assigneeId
        ? db.query(`SELECT id, name, email FROM users WHERE id = $1`, [assigneeId])
        : Promise.resolve({ rows: [] }),
    ]);
    const admins   = adminsResult.rows;
    const assignee = assigneeResult.rows[0] || null;

    notifyTicketSubmitted(ticket, { email: req.user.email, name: req.user.name }).catch(console.error);

    if (admins.length) {
      notifyTicketCreated(ticket, req.user.name, admins).catch(console.error);
    }

    if (assignee) {
      notifyTicketAssigned(ticket, assignee, req.user.name).catch(console.error);
    }

    res.status(201).json(ticket);
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
    // Fetch current ticket state before update (needed for change detection)
    const before = await db.query(`SELECT * FROM tickets WHERE id = $1`, [id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Ticket not found' });
    const oldTicket = before.rows[0];

    const result = await db.query(
      `UPDATE tickets SET
        status      = COALESCE($1, status),
        priority    = COALESCE($2, priority),
        category    = COALESCE($3, category),
        assigned_to = COALESCE($4, assigned_to),
        resolved_at = CASE WHEN $5 THEN NOW() ELSE resolved_at END
       WHERE id = $6 RETURNING *`,
      [status, priority, category, assigned_to, status === 'resolved', id]
    );
    const ticket = result.rows[0];

    // ── Fetch people we may need to notify ──────────────────────────────────
    const [creatorResult, assigneeResult] = await Promise.all([
      db.query(`SELECT id, name, email FROM users WHERE id = $1`, [ticket.created_by]),
      ticket.assigned_to
        ? db.query(`SELECT id, name, email FROM users WHERE id = $1`, [ticket.assigned_to])
        : Promise.resolve({ rows: [] }),
    ]);
    const creator  = creatorResult.rows[0]  || null;
    const assignee = assigneeResult.rows[0] || null;

    // ── Fire notifications (all fire-and-forget) ─────────────────────────────

    // Status changed
    if (status && status !== oldTicket.status) {
      if (status === 'closed') {
        // Closed: notify creator + assignee via dedicated function
        notifyTicketClosed(ticket, creator, assignee).catch(console.error);
      } else {
        // Any other status transition: notify creator
        notifyStatusChanged(ticket, creator, oldTicket.status).catch(console.error);
      }
    }

    // Assignment changed (manual re-assign by admin)
    if (assigned_to && assigned_to !== oldTicket.assigned_to) {
      // Fetch the creator's name for the assignment email context
      const creatorName = creator?.name || 'a user';
      notifyTicketAssigned(ticket, assignee, creatorName).catch(console.error);
    }

    res.json(ticket);
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

  const internal = is_internal && ['agent', 'admin'].includes(req.user.role);

  try {
    const result = await db.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, body, is_internal)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, body, internal]
    );
    const comment = result.rows[0];

    // Only send notifications for public comments
    if (!internal) {
      // Fetch ticket + involved users in parallel
      const [ticketResult, creatorResult] = await Promise.all([
        db.query(`SELECT * FROM tickets WHERE id = $1`, [id]),
        db.query(
          `SELECT u.id, u.name, u.email FROM tickets t
           JOIN users u ON u.id = t.created_by
           WHERE t.id = $1`, [id]
        ),
      ]);

      const ticket  = ticketResult.rows[0];
      const creator = creatorResult.rows[0] || null;

      let assignee = null;
      if (ticket?.assigned_to) {
        const ar = await db.query(
          `SELECT id, name, email FROM users WHERE id = $1`, [ticket.assigned_to]
        );
        assignee = ar.rows[0] || null;
      }

      if (ticket) {
        notifyCommentAdded(
          ticket,
          comment,
          { id: req.user.id, name: req.user.name, role: req.user.role, email: req.user.email },
          creator,
          assignee
        ).catch(console.error);
      }
    }

    res.status(201).json(comment);
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

// DELETE /api/tickets/:id — soft delete (admin only).
// The ticket disappears from all list/detail views but is recoverable from /trash.
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE tickets SET deleted_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found or already deleted' });
    res.json({ message: 'Ticket moved to trash', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tickets/:id/restore — restore a soft-deleted ticket (admin only).
router.post('/:id/restore', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE tickets SET deleted_at = NULL
       WHERE id = $1 AND deleted_at IS NOT NULL
       RETURNING id`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Ticket not found in trash' });
    res.json({ message: 'Ticket restored', id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/tickets/:id/purge — permanently delete a soft-deleted ticket (admin only).
// Cascades to comments, attachments rows, and KB links via FK ON DELETE CASCADE.
// Best-effort unlinks attachment files from disk; orphaned files are logged but not fatal.
router.delete('/:id/purge', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    // Only purge if already soft-deleted, so a misclick can't nuke an active ticket.
    const guard = await db.query(
      `SELECT id FROM tickets WHERE id = $1 AND deleted_at IS NOT NULL`,
      [id]
    );
    if (!guard.rows.length) {
      return res.status(404).json({ error: 'Ticket must be in trash before it can be purged' });
    }

    // Collect attachment filenames before the cascade removes the rows.
    const attachments = await db.query(
      `SELECT filename FROM ticket_attachments WHERE ticket_id = $1`,
      [id]
    );

    await db.query(`DELETE FROM tickets WHERE id = $1`, [id]);

    const uploadDir = path.join(__dirname, '../uploads');
    for (const row of attachments.rows) {
      const filePath = path.join(uploadDir, row.filename);
      try {
        fs.unlinkSync(filePath);
      } catch (fileErr) {
        if (fileErr.code !== 'ENOENT') {
          console.error(`[purge] could not unlink ${filePath}:`, fileErr.message);
        }
      }
    }

    res.json({ message: 'Ticket permanently deleted', id: Number(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
