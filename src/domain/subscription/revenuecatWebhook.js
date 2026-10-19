// Domain: POST /webhooks/revenuecat
// Processes RevenueCat webhook events to keep the DB subscription status in sync
// with Apple App Store / Google Play in-app purchases.
//
// RevenueCat is the single source of truth for store purchases. The mobile app
// performs the purchase natively (StoreKit / Play Billing) via the RevenueCat
// SDK; RevenueCat then notifies this endpoint of any subscription lifecycle
// change so we can mirror it into our own `parents` table.
//
// Auth: RevenueCat signs each request with the Authorization header value
// configured in the RevenueCat dashboard (REVENUECAT_WEBHOOK_AUTH).
//
// The webhook's `app_user_id` is the parent's id — we set it in the app via
// Purchases.logIn(parentId), so we can link the event straight back to a parent.
//
// Event reference: https://www.revenuecat.com/docs/webhooks/event-types-and-fields

const { getPool } = require('../../shared/db');
const {
  sendSubscriptionConfirmedEmail,
  sendSubscriptionCancelledEmail,
  sendPlanChangedEmail,
} = require('../../shared/email');
const { tierFromProductId } = require('../../shared/subscriptionTier');

// Events that mean the subscription is (still) paid and entitled.
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);

function verifyAuth(authHeader) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  // If no secret is configured, fail closed — never accept unauthenticated events.
  if (!expected) {
    throw Object.assign(
      new Error('RevenueCat webhook auth is not configured'),
      { statusCode: 500 }
    );
  }
  if (!authHeader || authHeader !== expected) {
    throw Object.assign(
      new Error('RevenueCat webhook authorization failed'),
      { statusCode: 401 }
    );
  }
}

async function handleRevenueCatWebhook(rawBody, authHeader) {
  verifyAuth(authHeader);

  let payload;
  try {
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody || '{}') : (rawBody || {});
  } catch (err) {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }

  const event = payload.event;
  if (!event || !event.type) {
    // Test pings / unknown shapes — acknowledge so RevenueCat stops retrying.
    return { received: true, ignored: 'no event' };
  }

  // Collect every candidate id RevenueCat sent. The "current" app_user_id can
  // be an anonymous $RCAnonymousID:... if the device dropped its identity
  // (e.g. after a reinstall before our Purchases.logIn ran), so we also try
  // original_app_user_id and any aliases until we find a real parent row.
  const candidateIds = Array.from(new Set(
    [event.app_user_id, event.original_app_user_id, ...(event.aliases || [])]
      .filter(Boolean)
      .filter((id) => !String(id).startsWith('$RCAnonymousID'))
  ));

  if (candidateIds.length === 0) {
    return { received: true, ignored: 'no resolvable app_user_id' };
  }

  const pool = getPool();
  const periodEnd = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  // Returns the first parent id that matches one of our candidates, or null.
  async function resolveParentId() {
    for (const candidate of candidateIds) {
      const [rows] = await pool.query(
        'SELECT id FROM parents WHERE id = ? LIMIT 1',
        [candidate]
      );
      if (rows.length) return rows[0].id;
    }
    return null;
  }

  if (ACTIVE_EVENTS.has(event.type)) {
    // Derive the tier (standard | family | null) from the product id so the
    // child-limit guard knows how many profiles this parent is entitled to.
    const tier = tierFromProductId(event.product_id);

    const appUserId = await resolveParentId();
    if (!appUserId) {
      console.warn(`[revenuecat] ${event.type} – no parent row for any of:`, candidateIds);
      return { received: true, ignored: 'no matching parent' };
    }

    // Read the previous tier BEFORE the update so we can detect a plan change
    // (Standard ↔ Family) and send the right email.
    const [prevRows] = await pool.query(
      'SELECT email, display_name, subscription_tier FROM parents WHERE id = ?',
      [appUserId]
    );
    const previousTier = prevRows[0]?.subscription_tier || null;

    const [updated] = await pool.query(
      `UPDATE parents
       SET subscription_status = 'active',
           subscription_current_period_end = ?,
           subscription_store = ?,
           store_product_id = ?,
           subscription_tier = ?,
           trial_ends_at = NULL
       WHERE id = ?`,
      [periodEnd, event.store || null, event.product_id || null, tier, appUserId]
    );

    if (updated.affectedRows > 0 && prevRows[0]?.email) {
      const email = prevRows[0].email;
      const displayName = prevRows[0].display_name || 'there';

      // Plan-changed email when the user actually switched tiers (e.g.
      // Standard → Family). Covers PRODUCT_CHANGE explicitly, but we also
      // tolerate any active event that brings a new tier value.
      const tierChanged =
        tier && previousTier && tier !== previousTier;

      if (tierChanged) {
        await sendPlanChangedEmail(email, displayName, periodEnd, previousTier, tier);
      } else if (event.type === 'INITIAL_PURCHASE') {
        // First-time confirmation when there was no prior paid tier.
        await sendSubscriptionConfirmedEmail(email, displayName, periodEnd, tier);
      } else if (event.type === 'UNCANCELLATION') {
        // User resumed a subscription they'd previously cancelled — treat
        // this as a fresh confirmation so they know it's active again.
        await sendSubscriptionConfirmedEmail(email, displayName, periodEnd, tier);
      }
      // RENEWAL / NON_RENEWING_PURCHASE remain silent — emailing on every
      // renewal would be noise.
    }

    console.log(`[revenuecat] ${event.type} – activated subscription for ${appUserId} (tier=${tier})`);
    return { received: true };
  }

  // Both non-active branches need the same parent resolution.
  const appUserId = await resolveParentId();

  switch (event.type) {
    case 'CANCELLATION': {
      if (!appUserId) break;
      // Auto-renew turned off (or refund). Access continues until period end.
      const [updated] = await pool.query(
        `UPDATE parents
         SET subscription_status = 'cancelled',
             subscription_current_period_end = ?
         WHERE id = ?`,
        [periodEnd, appUserId]
      );
      if (updated.affectedRows > 0) {
        const [rows] = await pool.query(
          'SELECT email, display_name FROM parents WHERE id = ?',
          [appUserId]
        );
        if (rows.length && rows[0].email && periodEnd) {
          await sendSubscriptionCancelledEmail(rows[0].email, rows[0].display_name || 'there', periodEnd);
        }
      }
      console.log(`[revenuecat] CANCELLATION – ${appUserId}`);
      break;
    }

    case 'EXPIRATION': {
      if (!appUserId) break;
      // Subscription has fully lapsed — entitlement removed.
      await pool.query(
        `UPDATE parents
         SET subscription_status = 'cancelled',
             subscription_current_period_end = ?
         WHERE id = ?`,
        [periodEnd || new Date(), appUserId]
      );
      console.log(`[revenuecat] EXPIRATION – ${appUserId}`);
      break;
    }

    case 'BILLING_ISSUE': {
      console.warn(`[revenuecat] BILLING_ISSUE for ${appUserId || candidateIds.join(',')}`);
      break;
    }

    default:
      // SUBSCRIBER_ALIAS, TRANSFER, TEST, etc. — acknowledge and ignore.
      break;
  }

  return { received: true };
}

module.exports = { handleRevenueCatWebhook };
