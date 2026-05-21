const router = require('express').Router();
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

// Allowed period values → PostgreSQL interval literal (null = "all time", no filter).
// Keys are validated against this allowlist before being interpolated into SQL,
// so building filter fragments from these strings is safe.
const PERIODS = {
  '7d':  "INTERVAL '7 days'",
  '30d': "INTERVAL '30 days'",
  'all': null,
};

function resolvePeriod(raw) {
  const key = Object.prototype.hasOwnProperty.call(PERIODS, raw) ? raw : '7d';
  return { key, intervalSql: PERIODS[key] };
}

// GET /api/dashboard?period=7d|30d|all
// Returns dashboard metrics. Agents see team-wide aggregates + their own slice.
// Admins additionally get a per-agent productivity table.
router.get('/', authenticate, authorize('agent', 'admin'), async (req, res) => {
  const { key: period, intervalSql } = resolvePeriod(req.query.period);
  const resolvedFilter = intervalSql ? `AND resolved_at >= NOW() - ${intervalSql}` : '';
  const ticketCreatedFilter = intervalSql ? `AND t.created_at >= NOW() - ${intervalSql}` : '';

  try {
    const [personalResult, teamResult, byStatusResult, byPriorityResult, byCategoryResult] = await Promise.all([
      // Caller's personal slice
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::int        AS my_open,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS my_in_progress,
          COUNT(*) FILTER (WHERE status = 'pending')::int     AS my_pending,
          COUNT(*) FILTER (
            WHERE status IN ('open', 'in_progress', 'pending')
          )::int AS my_active,
          COUNT(*) FILTER (
            WHERE status = 'resolved' ${resolvedFilter}
          )::int AS my_resolved
        FROM tickets
        WHERE assigned_to = $1
      `, [req.user.id]),

      // Team-wide counts
      db.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'open')::int        AS team_open,
          COUNT(*) FILTER (WHERE status = 'in_progress')::int AS team_in_progress,
          COUNT(*) FILTER (WHERE status = 'pending')::int     AS team_pending,
          COUNT(*) FILTER (WHERE status = 'closed')::int      AS team_closed,
          COUNT(*) FILTER (
            WHERE status IN ('open', 'in_progress', 'pending')
          )::int AS team_active,
          COUNT(*) FILTER (
            WHERE status = 'resolved' ${resolvedFilter}
          )::int AS team_resolved_period,
          COUNT(*) FILTER (
            WHERE assigned_to IS NULL
              AND status NOT IN ('resolved', 'closed')
          )::int AS team_unassigned
        FROM tickets
      `),

      // Status breakdown across all tickets
      db.query(`
        SELECT status, COUNT(*)::int AS count
        FROM tickets
        GROUP BY status
        ORDER BY status
      `),

      // Priority breakdown across currently-active tickets
      db.query(`
        SELECT priority, COUNT(*)::int AS count
        FROM tickets
        WHERE status NOT IN ('resolved', 'closed')
        GROUP BY priority
      `),

      // Top categories on active tickets
      db.query(`
        SELECT COALESCE(category, 'Uncategorized') AS category, COUNT(*)::int AS count
        FROM tickets
        WHERE status NOT IN ('resolved', 'closed')
        GROUP BY COALESCE(category, 'Uncategorized')
        ORDER BY count DESC
        LIMIT 10
      `),
    ]);

    const response = {
      period,
      personal: personalResult.rows[0],
      team: teamResult.rows[0],
      by_status: byStatusResult.rows,
      by_priority: byPriorityResult.rows,
      by_category: byCategoryResult.rows,
    };

    if (req.user.role === 'admin') {
      // Per-agent productivity. Each CTE produces one row per agent that
      // has data in that dimension; the outer query LEFT JOINs them onto the
      // confirmed-agent roster so agents with zero activity still appear.
      const agentResult = await db.query(`
        WITH
        active AS (
          SELECT assigned_to AS agent_id, COUNT(*)::int AS active_count
          FROM tickets
          WHERE status IN ('open', 'in_progress', 'pending')
            AND assigned_to IS NOT NULL
          GROUP BY assigned_to
        ),
        resolved_in_period AS (
          SELECT
            assigned_to AS agent_id,
            COUNT(*)::int AS resolved_count,
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0)::float AS avg_resolution_hours
          FROM tickets
          WHERE resolved_at IS NOT NULL
            AND assigned_to IS NOT NULL
            ${intervalSql ? `AND resolved_at >= NOW() - ${intervalSql}` : ''}
          GROUP BY assigned_to
        ),
        first_response AS (
          SELECT
            t.assigned_to AS agent_id,
            AVG(EXTRACT(EPOCH FROM (fr.first_at - t.created_at)) / 3600.0)::float AS avg_first_response_hours
          FROM tickets t
          JOIN LATERAL (
            SELECT MIN(c.created_at) AS first_at
            FROM ticket_comments c
            WHERE c.ticket_id = t.id
              AND c.user_id = t.assigned_to
          ) fr ON fr.first_at IS NOT NULL
          WHERE t.assigned_to IS NOT NULL
            ${ticketCreatedFilter}
          GROUP BY t.assigned_to
        ),
        comment_gaps AS (
          SELECT
            ticket_id,
            EXTRACT(EPOCH FROM (
              created_at - LAG(created_at) OVER (PARTITION BY ticket_id ORDER BY created_at)
            )) / 3600.0 AS gap_hours
          FROM ticket_comments
        ),
        update_gaps AS (
          SELECT
            t.assigned_to AS agent_id,
            AVG(g.gap_hours)::float AS avg_update_gap_hours
          FROM tickets t
          JOIN comment_gaps g ON g.ticket_id = t.id
          WHERE t.assigned_to IS NOT NULL
            AND g.gap_hours IS NOT NULL
            ${ticketCreatedFilter}
          GROUP BY t.assigned_to
        )
        SELECT
          u.id, u.name, u.email,
          COALESCE(a.active_count, 0)        AS active_count,
          COALESCE(r.resolved_count, 0)      AS resolved_count,
          r.avg_resolution_hours,
          fr.avg_first_response_hours,
          ug.avg_update_gap_hours
        FROM users u
        LEFT JOIN active             a  ON a.agent_id  = u.id
        LEFT JOIN resolved_in_period r  ON r.agent_id  = u.id
        LEFT JOIN first_response     fr ON fr.agent_id = u.id
        LEFT JOIN update_gaps        ug ON ug.agent_id = u.id
        WHERE u.role = 'agent' AND u.email_confirmed = TRUE
        ORDER BY active_count DESC, u.name ASC
      `);

      response.agent_stats = agentResult.rows;
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
