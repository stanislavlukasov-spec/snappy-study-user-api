// Domain: GET /me – return parent profile + subscription status + children list

const { getPool } = require('../../shared/db');
const { emailHasUsedTrial } = require('../../shared/trialHistory');
const { childLimitForTier } = require('../../shared/subscriptionTier');

async function getMe(parentId, email, displayName) {
  const pool = getPool();

  const [[parentRows], [children]] = await Promise.all([
    pool.query(
      `SELECT subscription_status, subscription_tier, trial_ends_at,
              subscription_current_period_end
       FROM parents WHERE id = ?`,
      [parentId]
    ),
    pool.query(
      'SELECT id, display_name AS displayName, created_at AS createdAt, paired_at AS pairedAt FROM children WHERE parent_id = ? ORDER BY created_at ASC',
      [parentId]
    ),
  ]);
  const parentRow = parentRows[0];

  // Build subscription summary
  let subscription = { status: 'none' };
  if (parentRow && parentRow.subscription_status) {
    const status = parentRow.subscription_status;
    subscription = { status };
    if (status === 'trial' && parentRow.trial_ends_at) {
      subscription.trialEndsAt = new Date(parentRow.trial_ends_at).toISOString();
      // Treat expired trial as 'expired'
      if (new Date(parentRow.trial_ends_at) < new Date()) {
        subscription.status = 'expired';
      }
    }
    if (parentRow.subscription_current_period_end) {
      subscription.currentPeriodEnd = new Date(parentRow.subscription_current_period_end).toISOString();
    }
  }

  // Tier (standard | family) governs the child-profile limit. NULL maps to
  // 'standard' so legacy rows created before migration 014 (or rows where the
  // RevenueCat product_id is unrecognised) default to the Standard cap.
  const tier = parentRow?.subscription_tier || null;
  subscription.tier = tier;
  // The cap applies whenever any subscription state is held, including trial.
  if (subscription.status !== 'none') {
    subscription.childrenLimit = childLimitForTier(tier);
  }

  // Trial eligibility: only when the account has no plan AND the email has
  // never previously started a trial. trial_history persists across account
  // deletions so a re-registered user can't claim a second trial.
  subscription.trialEligible =
    subscription.status === 'none' && !(await emailHasUsedTrial(email));

  return {
    parent: {
      id: parentId,
      email: email || null,
      displayName: displayName || null,
    },
    subscription,
    children,
  };
}

module.exports = { getMe };
