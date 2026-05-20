const router = require('express').Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/kb — list all public articles (or all for agents/admins)
router.get('/', authenticate, async (req, res) => {
  const { search, category } = req.query;
  const isAgent = ['agent', 'admin'].includes(req.user.role);

  try {
    let query = `SELECT id, title, category, tags, is_public, view_count, created_at, updated_at
                 FROM kb_articles WHERE 1=1`;
    const params = [];

    if (!isAgent) {
      query += ` AND is_public = TRUE`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (title ILIKE $${params.length} OR content ILIKE $${params.length})`;
    }

    query += ` ORDER BY updated_at DESC`;
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/kb/:id — get single article (increments view count)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE kb_articles SET view_count = view_count + 1
       WHERE id = $1 RETURNING *, (SELECT name FROM users WHERE id = kb_articles.author_id) AS author_name`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Article not found' });
    const article = result.rows[0];
    if (!article.is_public && req.user.role === 'user')
      return res.status(403).json({ error: 'Forbidden' });
    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/kb — create article (agents/admins)
router.post('/', authenticate, authorize('agent', 'admin'), async (req, res) => {
  const { title, content, category, tags, is_public } = req.body;
  if (!title || !content)
    return res.status(400).json({ error: 'title and content are required' });

  try {
    const result = await db.query(
      `INSERT INTO kb_articles (title, content, category, tags, author_id, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, content, category || null, tags || [], req.user.id, is_public !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/kb/:id — update article (agents/admins)
router.patch('/:id', authenticate, authorize('agent', 'admin'), async (req, res) => {
  const { title, content, category, tags, is_public } = req.body;
  try {
    const result = await db.query(
      `UPDATE kb_articles SET
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        category = COALESCE($3, category),
        tags = COALESCE($4, tags),
        is_public = COALESCE($5, is_public)
       WHERE id = $6 RETURNING *`,
      [title, content, category, tags, is_public, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Article not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/kb/:id — delete article (admins only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM kb_articles WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
