// Domain: GET /child/me – verify the child still exists in the DB AND that the
// parent has an active subscription.  Called on every app launch (startup gate)
// and polled every minute while the child is using the app.
//
// Possible error responses:
//   401 – child not found (deleted by parent, or token claims are wrong)
//   403 – parent subscription is inactive (trial expired / never subscribed)

const { getPool } = require('../../shared/db');

/**
 * Returns true when the parent's subscription permits child access:
 *   - active trial (trial_ends_at in the future)
 *   - paid subscription (status = 'active')
 *   - cancelled but still within the paid period (current_period_end in future)
 */
function isSubscriptionActive(row) {
  const status = row.subscription_status;
  if (!status) return false;

  if (status === 'trial') {
    return !!row.trial_ends_at && new Date(row.trial_ends_at) > new Date();
  }
  if (status === 'active') {
    return true;
  }
  if (status === 'cancelled') {
    return (
      !!row.subscription_current_period_end &&
      new Date(row.subscription_current_period_end) > new Date()
    );
  }
  return false;
}

async function getMe(childId, parentId) {
  const pool = getPool();

  // Single query: join children to parents so we can check both existence and
  // subscription status without a round-trip.
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.display_name,
       c.paired_at,
       p.subscription_status,
       p.trial_ends_at,
       p.subscription_current_period_end
     FROM children c
     JOIN parents p ON p.id = c.parent_id
     WHERE c.id = ? AND c.parent_id = ?`,
    [childId, parentId]
  );

  if (rows.length === 0) {
    // Child was deleted (or token claims don't match any DB row)
    const error = new Error('Child not found');
    error.statusCode = 401;
    throw error;
  }

  const row = rows[0];

  if (!isSubscriptionActive(row)) {
    const error = new Error('Parent subscription is not active');
    error.statusCode = 403;
    throw error;
  }

  return {
    child: {
      id: row.id,
      displayName: row.display_name,
      parentId,
      pairedAt: row.paired_at || null,
    },
    parent: { id: parentId },
  };
}

module.exports = { getMe, isSubscriptionActive };
