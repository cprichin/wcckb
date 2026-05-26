const { sendMail } = require('./email');

// ─── Shared helpers ────────────────────────────────────────────────────────────

const FROM = `"${process.env.SMTP_NAME || 'HelpDesk'}" <${process.env.SMTP_EMAIL || 'helpdesk@example.com'}>`;
const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Wrap content in the standard branded email shell.
 * @param {string} bodyHtml - Inner HTML to render inside the card.
 * @returns {string} Full HTML email string.
 */
function wrapEmail(bodyHtml) {
  return `
    <div style="font-family:'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#1e293b;">
      <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
        <h1 style="color:#fff;margin:0;font-size:22px;">🎫 HelpDesk</h1>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;">
        ${bodyHtml}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">
          You're receiving this because you have an account on HelpDesk.
        </p>
      </div>
    </div>
  `;
}

/**
 * Render a standard CTA button.
 * @param {string} href
 * @param {string} label
 * @returns {string}
 */
function ctaButton(href, label) {
  return `
    <div style="text-align:center;margin:28px 0;">
      <a href="${href}"
         style="background:#3b82f6;color:#fff;padding:13px 30px;border-radius:8px;
                text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">
        ${label}
      </a>
    </div>
  `;
}

/**
 * Render a small metadata table (status, priority, category, etc.)
 * @param {Object} fields - Key/value pairs to display.
 * @returns {string}
 */
function metaTable(fields) {
  const rows = Object.entries(fields)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `
      <tr>
        <td style="padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;">
          ${k}
        </td>
        <td style="padding:6px 0;font-size:13px;font-weight:600;">
          ${v}
        </td>
      </tr>
    `)
    .join('');
  return `<table style="border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

// ─── Notification functions ────────────────────────────────────────────────────

/**
 * Send a "new ticket submitted" email to each recipient in the supplied list.
 * The caller decides who hears about new tickets — typically admins only,
 * since the auto-assigned agent gets a dedicated "assigned to you" email
 * via notifyTicketAssigned.
 *
 * @param {Object} ticket      - Full ticket row from DB (including title, priority, category, id).
 * @param {string} creatorName - Display name of the user who submitted the ticket.
 * @param {Array}  recipients  - Array of { email, name } to notify.
 */
async function notifyTicketCreated(ticket, creatorName, recipients) {
  if (!recipients.length) return;

  const ticketUrl = `${BASE_URL}/tickets/${ticket.id}`;

  const html = wrapEmail(`
    <h2 style="margin-top:0;">New ticket submitted</h2>
    <p>A new support ticket has been opened and is awaiting review.</p>
    <p><strong>${ticket.title}</strong></p>
    ${metaTable({
      'Submitted by': creatorName,
      'Priority':     ticket.priority,
      'Category':     ticket.category || '—',
      'Ticket #':     `#${ticket.id}`,
    })}
    ${ctaButton(ticketUrl, 'View Ticket')}
  `);

  const text =
    `New ticket #${ticket.id}: ${ticket.title}\n` +
    `Submitted by: ${creatorName}\n` +
    `Priority: ${ticket.priority}\n\n` +
    `View: ${ticketUrl}`;

  await Promise.allSettled(
    recipients.map(recipient =>
      sendMail({
        from: FROM,
        to: `"${recipient.name}" <${recipient.email}>`,
        subject: `[HelpDesk] New ticket #${ticket.id}: ${ticket.title}`,
        html,
        text,
      })
    )
  );
}

/**
 * Notify a specific agent that a ticket has been assigned to them.
 *
 * @param {Object} ticket       - Full ticket row.
 * @param {Object} assignee     - { email, name } of the agent being assigned.
 * @param {string} creatorName  - Display name of the ticket submitter.
 */
async function notifyTicketAssigned(ticket, assignee, creatorName) {
  if (!assignee?.email) return;

  const ticketUrl = `${BASE_URL}/tickets/${ticket.id}`;

  const html = wrapEmail(`
    <h2 style="margin-top:0;">Ticket assigned to you</h2>
    <p>Hi ${assignee.name}, ticket <strong>#${ticket.id}</strong> has been assigned to you.</p>
    <p><strong>${ticket.title}</strong></p>
    ${metaTable({
      'Submitted by': creatorName,
      'Priority':     ticket.priority,
      'Category':     ticket.category || '—',
      'Status':       ticket.status,
    })}
    ${ctaButton(ticketUrl, 'View Ticket')}
  `);

  const text =
    `Hi ${assignee.name},\n\n` +
    `Ticket #${ticket.id} has been assigned to you: ${ticket.title}\n` +
    `Submitted by: ${creatorName}\n\n` +
    `View: ${ticketUrl}`;

  await sendMail({
    from: FROM,
    to: `"${assignee.name}" <${assignee.email}>`,
    subject: `[HelpDesk] Ticket #${ticket.id} assigned to you`,
    html,
    text,
  });
}

/**
 * Notify the ticket creator when the ticket status changes.
 * Also used for the resolved state — closed gets its own function below.
 *
 * @param {Object} ticket    - Updated ticket row.
 * @param {Object} creator   - { email, name } of the ticket submitter.
 * @param {string} oldStatus - The previous status value.
 */
async function notifyStatusChanged(ticket, creator, oldStatus) {
  if (!creator?.email) return;

  const ticketUrl = `${BASE_URL}/tickets/${ticket.id}`;

  const statusLabel = {
    open:        'Open',
    in_progress: 'In Progress',
    pending:     'Pending',
    resolved:    'Resolved',
    closed:      'Closed',
  }[ticket.status] || ticket.status;

  const html = wrapEmail(`
    <h2 style="margin-top:0;">Your ticket status has changed</h2>
    <p>Hi ${creator.name}, the status of your ticket has been updated.</p>
    <p><strong>${ticket.title}</strong></p>
    ${metaTable({
      'Ticket #':     `#${ticket.id}`,
      'Old status':   oldStatus,
      'New status':   statusLabel,
    })}
    ${ctaButton(ticketUrl, 'View Ticket')}
  `);

  const text =
    `Hi ${creator.name},\n\n` +
    `Your ticket #${ticket.id} status changed from "${oldStatus}" to "${ticket.status}".\n\n` +
    `View: ${ticketUrl}`;

  await sendMail({
    from: FROM,
    to: `"${creator.name}" <${creator.email}>`,
    subject: `[HelpDesk] Ticket #${ticket.id} status updated: ${statusLabel}`,
    html,
    text,
  });
}

/**
 * Notify the ticket creator (and optionally the assigned agent) when a ticket is closed.
 *
 * @param {Object} ticket    - Updated ticket row.
 * @param {Object} creator   - { email, name } of the ticket submitter.
 * @param {Object|null} assignee - { email, name } of the assigned agent, if any.
 */
async function notifyTicketClosed(ticket, creator, assignee) {
  const ticketUrl = `${BASE_URL}/tickets/${ticket.id}`;

  const recipients = [creator];
  // Notify the assignee too unless they are the one who closed it
  // (caller is responsible for passing null if assignee === actor)
  if (assignee?.email && assignee.email !== creator.email) {
    recipients.push(assignee);
  }

  await Promise.allSettled(
    recipients.map(recipient => {
      const html = wrapEmail(`
        <h2 style="margin-top:0;">Ticket closed</h2>
        <p>Hi ${recipient.name}, ticket <strong>#${ticket.id}</strong> has been closed.</p>
        <p><strong>${ticket.title}</strong></p>
        ${metaTable({
          'Ticket #':  `#${ticket.id}`,
          'Category':  ticket.category || '—',
          'Priority':  ticket.priority,
        })}
        <p style="color:#64748b;font-size:13px;">
          If this was closed in error or your issue is not resolved,
          please open a new ticket and reference #${ticket.id}.
        </p>
        ${ctaButton(ticketUrl, 'View Ticket')}
      `);

      const text =
        `Hi ${recipient.name},\n\n` +
        `Ticket #${ticket.id} ("${ticket.title}") has been closed.\n\n` +
        `If your issue is unresolved, please open a new ticket referencing #${ticket.id}.\n\n` +
        `View: ${ticketUrl}`;

      return sendMail({
        from: FROM,
        to: `"${recipient.name}" <${recipient.email}>`,
        subject: `[HelpDesk] Ticket #${ticket.id} closed`,
        html,
        text,
      });
    })
  );
}

/**
 * Notify relevant parties when a new public comment is added.
 *
 * - If the commenter is the ticket creator (user), notify the assigned agent (if any).
 * - If the commenter is an agent/admin, notify the ticket creator.
 * Internal notes are never emailed — caller must check is_internal before calling this.
 *
 * @param {Object} ticket    - Full ticket row.
 * @param {Object} comment   - The new comment row ({ body, is_internal }).
 * @param {Object} commenter - { id, name, role } of the person posting.
 * @param {Object} creator   - { id, email, name } of the ticket submitter.
 * @param {Object|null} assignee - { email, name } of the assigned agent, if any.
 */
async function notifyCommentAdded(ticket, comment, commenter, creator, assignee) {
  if (comment.is_internal) return; // never email internal notes

  const ticketUrl = `${BASE_URL}/tickets/${ticket.id}`;

  // Determine recipient
  let recipient = null;
  if (['agent', 'admin'].includes(commenter.role)) {
    // Agent replied — notify the user/creator
    recipient = creator;
  } else {
    // User replied — notify the assigned agent
    recipient = assignee || null;
  }

  if (!recipient?.email) return;

  // Don't email someone their own comment
  if (recipient.email === commenter.email) return;

  const preview = comment.body.length > 200
    ? comment.body.slice(0, 200) + '…'
    : comment.body;

  const html = wrapEmail(`
    <h2 style="margin-top:0;">New reply on ticket #${ticket.id}</h2>
    <p>Hi ${recipient.name}, a new reply has been posted on a ticket you're involved with.</p>
    <p><strong>${ticket.title}</strong></p>
    <div style="background:#f8fafc;border-left:4px solid #3b82f6;
                padding:14px 16px;border-radius:0 8px 8px 0;
                margin:16px 0;color:#334155;font-size:14px;line-height:1.6;">
      ${preview.replace(/\n/g, '<br/>')}
    </div>
    ${ctaButton(ticketUrl, 'View Reply')}
  `);

  const text =
    `Hi ${recipient.name},\n\n` +
    `New reply on ticket #${ticket.id}: ${ticket.title}\n\n` +
    `"${preview}"\n\n` +
    `View: ${ticketUrl}`;

  await sendMail({
    from: FROM,
    to: `"${recipient.name}" <${recipient.email}>`,
    subject: `[HelpDesk] New reply on ticket #${ticket.id}: ${ticket.title}`,
    html,
    text,
  });
}

module.exports = {
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyTicketClosed,
  notifyCommentAdded,
};