const db = require('../db');

/**
 * Auto-assign a ticket to the agent or admin with the fewest currently
 * open/in-progress/pending tickets. Excludes closed and resolved tickets
 * from the count so workload reflects active load only.
 *
 * @returns {Promise<number|null>} The user ID of the chosen assignee, or null if no agents exist.
 */
async function autoAssign() {
  const result = await db.query(`
    SELECT u.id
    FROM users u
    LEFT JOIN tickets t
      ON t.assigned_to = u.id
      AND t.status NOT IN ('resolved', 'closed')
    WHERE u.role IN ('agent')
      AND u.email_confirmed = TRUE
    GROUP BY u.id
    ORDER BY COUNT(t.id) ASC
    LIMIT 1
  `);

  return result.rows.length ? result.rows[0].id : null;
}

module.exports = { autoAssign };