import { getDb } from '../models/database.js';
import { sendEmail } from './email.js';

// Dead Man's Switch Scheduler
// Checks for expired pending access requests and processes them

export function startDMSScheduler() {
  const intervalHours = parseInt(process.env.DMS_CHECK_INTERVAL_HOURS || '24');
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`[DMS] Scheduler started. Checking every ${intervalHours} hours.`);

  // Run immediately on start, then on interval
  checkPendingRequests();
  setInterval(checkPendingRequests, intervalMs);
}

async function checkPendingRequests() {
  try {
    const db = getDb();
    const now = new Date().toISOString();

    // Find requests that have expired (past their total wait period)
    const expiredRequests = db.prepare(`
      SELECT ar.*, n.name as nominee_name, n.email as nominee_email,
             u.name as owner_name, u.email as owner_email
      FROM access_requests ar
      JOIN nominees n ON ar.nominee_id = n.id
      JOIN users u ON ar.user_id = u.id
      WHERE ar.status = 'pending' AND ar.expires_at <= ?
    `).all(now);

    for (const request of expiredRequests) {
      console.log(`[DMS] Auto-approving expired request ${request.id} for nominee ${request.nominee_name}`);

      db.prepare(`
        UPDATE access_requests
        SET status = 'auto_approved', response = 'auto_approved_timeout', unlocked_at = datetime('now')
        WHERE id = ?
      `).run(request.id);

      // Insert audit log
      db.prepare(`
        INSERT INTO audit_log (user_id, actor, action, details)
        VALUES (?, 'system', 'access_auto_approved', ?)
      `).run(request.user_id, JSON.stringify({
        requestId: request.id,
        nomineeId: request.nominee_id,
        reason: 'Owner did not respond within deadline',
      }));

      // Notify nominee
      try {
        await sendEmail({
          to: request.nominee_email,
          subject: '🔓 SecureVault: Access Granted',
          html: `
            <h2>Vault Access Granted</h2>
            <p>Dear ${request.nominee_name},</p>
            <p>The vault owner did not respond to your access request within the waiting period.</p>
            <p>You now have access to the vault. Please use your access code to log in:</p>
            <p><a href="${process.env.APP_URL}/nominee-access">Access SecureVault</a></p>
            <p><em>— SecureVault System</em></p>
          `,
        });
      } catch (emailErr) {
        console.error('[DMS] Failed to notify nominee:', emailErr);
      }
    }

    // Send reminders for requests approaching deadline
    const reminderLeadDays = parseInt(process.env.DMS_INITIAL_WAIT_DAYS || '7');
    const reminderThreshold = new Date(Date.now() + reminderLeadDays * 24 * 60 * 60 * 1000).toISOString();

    const pendingRequests = db.prepare(`
      SELECT ar.*, n.name as nominee_name, u.email as owner_email, u.name as owner_name
      FROM access_requests ar
      JOIN nominees n ON ar.nominee_id = n.id
      JOIN users u ON ar.user_id = u.id
      WHERE ar.status = 'pending'
      AND ar.expires_at <= ?
      AND (ar.last_reminder_at IS NULL OR ar.last_reminder_at < datetime('now', '-1 day'))
    `).all(reminderThreshold);

    for (const request of pendingRequests) {
      console.log(`[DMS] Sending reminder for request ${request.id}`);

      db.prepare(`
        UPDATE access_requests SET last_reminder_at = datetime('now'), reminder_count = reminder_count + 1 WHERE id = ?
      `).run(request.id);

      try {
        await sendEmail({
          to: request.owner_email,
          subject: '⚠️ REMINDER: SecureVault Access Request Pending',
          html: `
            <h2>Reminder: Pending Access Request</h2>
            <p>Dear ${request.owner_name},</p>
            <p><strong>${request.nominee_name}</strong> is still waiting for your response.</p>
            <p>If you don't respond by ${new Date(request.expires_at).toLocaleDateString()}, access will be automatically granted.</p>
            <p><a href="${process.env.APP_URL}/access-requests">Respond Now</a></p>
          `,
        });
      } catch (emailErr) {
        console.error('[DMS] Failed to send reminder:', emailErr);
      }
    }

    if (expiredRequests.length > 0 || pendingRequests.length > 0) {
      console.log(`[DMS] Processed ${expiredRequests.length} expired, ${pendingRequests.length} reminders`);
    }
  } catch (err) {
    console.error('[DMS] Scheduler error:', err);
  }
}
