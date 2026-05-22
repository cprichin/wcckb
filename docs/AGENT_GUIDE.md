# Agent Guide

This guide is written for HelpDesk agents — TAs and staff who work tickets, assist users, and maintain the knowledge base.

> Your account was created by the system administrator. If you can't log in or don't have an account yet, contact them directly. If you've forgotten your password, use the **Forgot password?** link on the login page — it sends a reset link to your inbox.

---

## Table of Contents

- [Logging In](#logging-in)
- [Your Dashboard](#your-dashboard)
- [Working Tickets](#working-tickets)
  - [Viewing All Tickets](#viewing-all-tickets)
  - [Ticket Status Workflow](#ticket-status-workflow)
  - [Triaging a New Ticket](#triaging-a-new-ticket)
  - [Assigning Tickets](#assigning-tickets)
  - [Updating Priority](#updating-priority)
  - [Commenting on Tickets](#commenting-on-tickets)
  - [Internal Notes](#internal-notes)
  - [Closing a Ticket](#closing-a-ticket)
- [Knowledge Base](#knowledge-base)
  - [Browsing and Searching Articles](#browsing-and-searching-articles)
  - [Linking Articles to Tickets](#linking-articles-to-tickets)
  - [Writing a New Article](#writing-a-new-article)
  - [Editing an Existing Article](#editing-an-existing-article)
  - [Markdown Reference](#markdown-reference)
- [Best Practices](#best-practices)
- [What You Cannot Do](#what-you-cannot-do)

---

## Logging In

Navigate to the helpdesk URL provided by your administrator and log in with the credentials they gave you. On first login, change your password under **My Account → Change Password**.

If you forget your password later, use the **Forgot password?** link on the login page — you'll get a one-time reset link in your email that expires after 60 minutes.

---

## Your Dashboard

After logging in you'll land on the **Dashboard** at `/dashboard`. It summarises:

- **Your active workload** — open / in-progress / pending tickets assigned to you
- **Your resolved-this-period count** — how many you closed in the selected window (7d / 30d / all-time, toggle at the top)
- **Team-wide totals** — open queue and unassigned-awaiting-pickup
- **Charts** — tickets by status, active tickets by priority, top active categories

Use the **Tickets** page for the actual queue. The sidebar gives you access to:

- **Dashboard** — what you see when you log in
- **Tickets** — the full ticket queue
- **Knowledge Base** — all articles, including drafts not visible to regular users

On the ticket list, use the status filter buttons at the top to focus on what needs attention:

| Filter | What to look at |
|---|---|
| `open` | New tickets, not yet assigned — start here |
| `in_progress` | Tickets actively being worked |
| `pending` | Waiting on a response from the user |
| `resolved` | Recently closed — check these if a user follows up |

---

## Working Tickets

### Viewing All Tickets

Click **Tickets** in the sidebar. You'll see every ticket in the system with its status, priority, category, who submitted it, and who it's assigned to.

Click any ticket to open the full detail view, which shows:
- The original description
- Any attachments the user uploaded
- The full comment thread
- The sidebar with status, priority, assignment, and linked KB articles

---

### Ticket Status Workflow

Move tickets through these statuses as you work them:

```
open → in_progress → pending → resolved → closed
```

| Status | Meaning |
|---|---|
| `open` | Just submitted, not yet picked up |
| `in_progress` | You're actively working on it |
| `pending` | Waiting for the user to respond or provide more information |
| `resolved` | Issue is fixed — user can confirm and close, or it auto-closes |
| `closed` | Done, no further action needed |

Change the status using the dropdown in the ticket's right sidebar. The change saves immediately.

---

### Triaging a New Ticket

When you pick up a new `open` ticket:

1. **Read the full description** — and check any attachments
2. **Set the category** if it's missing or wrong (Hardware, Software, Network, etc.)
3. **Adjust the priority** if needed:
   - `low` — inconvenient but not blocking
   - `medium` — default, affects normal workflow
   - `high` — significantly blocking the user
   - `urgent` — system down, data loss risk, or time-critical
4. **Assign it** — to yourself if you're taking it, or to another agent if it's their area
5. **Change status to `in_progress`**
6. **Post a comment** to let the user know you're looking into it — even a brief acknowledgment helps

---

### Assigning Tickets

Use the **Assigned To** dropdown in the right sidebar to assign a ticket to yourself or another agent. Unassigned tickets are visible to all agents — pick them up when you have capacity.

If you're assigning to another agent, add a comment explaining what you know so far to save them from starting from scratch.

---

### Updating Priority

Use the **Priority** dropdown in the right sidebar. When in doubt, leave it at `medium`. Escalate to `high` or `urgent` when:

- The issue is blocking the user from doing their job
- Multiple users are affected by the same issue
- There's a deadline involved (exam, event, class)
- Data loss or security is a concern

---

### Commenting on Tickets

Use the comment box at the bottom of the ticket to communicate with the user. They see all regular (non-internal) comments and receive an email notification each time one is posted on a ticket they submitted. Likewise, when a user replies, you get an email if the ticket is assigned to you.

Good commenting habits:
- **Acknowledge quickly** — even "I'm looking into this" is better than silence
- **Be specific** — tell the user exactly what you tried and what you found
- **Ask one question at a time** — if you need more info, ask the most important question first
- **Close the loop** — when you resolve it, explain what the fix was so the user understands

---

### Internal Notes

Check the **Internal note** checkbox before posting a comment to make it visible only to agents and admins — the user will never see it.

Use internal notes for:
- Flagging something to another agent ("heads up — this user has reported this twice before")
- Documenting steps you tried that didn't work
- Escalation notes
- Anything you wouldn't want the user to read

Internal notes are displayed with a yellow background in the comment thread so they're easy to identify.

---

### Closing a Ticket

When the issue is resolved:

1. Post a comment explaining what the fix was
2. Change status to `resolved`
3. If the user confirms it's working, change to `closed`

If you don't hear back after a reasonable time (a few days), change to `closed` at your discretion.

**Before closing, ask yourself:**
- Is there a knowledge base article that covers this issue?
- If not — should there be one? (See [Writing a New Article](#writing-a-new-article))
- Did you link any relevant KB articles to this ticket?

---

## Knowledge Base

The knowledge base is a library of articles that help users self-serve and give agents a reference for common issues. Keeping it up to date is one of the most valuable things you can do as an agent.

---

### Browsing and Searching Articles

Click **Knowledge Base** in the sidebar. Use the search bar to find articles by title or content keyword. Filter by category using the dropdown.

---

### Linking Articles to Tickets

When an existing KB article is relevant to a ticket, link it:

1. Open the ticket
2. In the right sidebar under **Knowledge Base**, open the article dropdown
3. Select the relevant article
4. Click **Link**

The article will appear as a clickable link in the ticket, visible to both the user and agents. This helps users find the full solution documentation and helps future agents see what resources were used.

---

### Writing a New Article

The best time to write a KB article is right after you resolve a ticket — the fix is fresh in your mind and you know exactly what the user needed.

1. Click **Knowledge Base** in the sidebar
2. Click **+ New Article**
3. Fill in:
   - **Title** — clear and searchable, e.g. "How to connect to campus VPN on Windows"
   - **Category** — pick the closest match
   - **Tags** — comma-separated keywords that help with search, e.g. `vpn, network, windows`
   - **Public** — checked means all users can see it; uncheck for internal agent-only references
   - **Content** — write in Markdown (see reference below)
4. Use **Preview** to check how it looks before publishing
5. Click **Publish Article**

#### Tips for Good Articles

- **Write for the person who's frustrated.** Assume they've already tried the obvious thing and it didn't work.
- **Use numbered steps** for procedures — not bullets.
- **Include screenshots descriptions** if the visual is important, even if you can't embed the image yet.
- **State what the article covers at the top** — one sentence summary.
- **Keep it focused** — one issue per article. If it's getting long, split it.
- **Update it when things change** — an outdated article is worse than no article.

---

### Editing an Existing Article

1. Open the article from the Knowledge Base list
2. Click **Edit** in the top right
3. Make your changes
4. Preview, then click **Update Article**

If an article is significantly wrong or outdated and you're not sure how to fix it, add a note at the top: `> ⚠️ This article may be outdated. Contact an admin.` — this signals to users that it needs review without breaking the content entirely.

---

### Markdown Reference

Article content supports Markdown formatting. Here's a quick reference:

```markdown
# Heading 1
## Heading 2
### Heading 3

Regular paragraph text. Keep lines short and readable.

**Bold text**
*Italic text*

Numbered list (use for steps):
1. First step
2. Second step
3. Third step

Bullet list (use for options or notes):
- Item one
- Item two

Inline code: `command or filename`

Code block (use for commands users need to run):
```bash
ipconfig /release
ipconfig /renew
```

> Blockquote — use for tips, warnings, or notes

---   (horizontal rule — use to separate sections)

[Link text](https://example.com)
```

---

## Best Practices

**Respond quickly, even if you don't have an answer yet.**
A message that says "I've seen this and I'm looking into it" takes 10 seconds to write and makes a big difference to someone waiting.

**One agent per ticket.**
Assign tickets to avoid two people working the same issue. If you're taking a ticket, assign it to yourself.

**Use internal notes instead of side conversations.**
If you need to coordinate with another agent about a ticket, use an internal note on the ticket itself — not a separate chat. This keeps all context in one place.

**Build the knowledge base as you go.**
Every ticket you resolve is a potential KB article. Even a short one ("Reset password via X panel — takes 5 minutes, requires Y") is valuable.

**Link KB articles before closing.**
If you used an article to solve a ticket, link it. If you wrote one because of the ticket, link it. Future agents will thank you.

**Don't leave tickets in `pending` indefinitely.**
If you're waiting on a user and haven't heard back in a few days, follow up with a comment and set a mental deadline. Close the ticket if there's no response after a reasonable time.

---

## What You Cannot Do

As an agent, you cannot:

- **Create user accounts** — only the admin can do this
- **Change user roles** — only the admin can promote or demote users
- **Delete KB articles** — you can edit them; deletion requires admin
- **See or edit other agents' internal notes** — actually you can see them, but use discretion
- **Access the Users admin panel** — that sidebar link only appears for admins

If you need any of the above done, contact the administrator.
