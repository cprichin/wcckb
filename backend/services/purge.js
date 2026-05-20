const db = require('../db');

const EXPIRY_HOURS = 6;
const INTERVAL_MS = 30 * 60 * 1000; // run every 30 minutes

async function purgeExpiredUnconfirmed() {
  try {
    const result = await db.query(
      `DELETE FROM users
       WHERE email_confirmed = FALSE
         AND confirmation_expires_at < NOW()
       RETURNING id, email`
    );
    if (result.rowCount > 0) {
      console.log(`[purge] Deleted ${result.rowCount} unconfirmed account(s):`,
        result.rows.map(r => r.email).join(', '));
    }
  } catch (err) {
    console.error('[purge] Error purging unconfirmed accounts:', err.message);
  }
}

function startPurgeJob() {
  console.log(`[purge] Unconfirmed account cleanup running every 30 minutes (${EXPIRY_HOURS}h expiry)`);
  // Run once immediately on startup to clean up anything leftover
  purgeExpiredUnconfirmed();
  // Then on a schedule
  setInterval(purgeExpiredUnconfirmed, INTERVAL_MS);
}

module.exports = { startPurgeJob };
