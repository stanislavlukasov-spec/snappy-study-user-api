const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { getPool } = require('../../shared/db');
const { childLimitForTier, CHILD_LIMITS } = require('../../shared/subscriptionTier');

const createChildSchema = z.object({
  displayName: z.string().min(1).max(64),
});

async function createChild(parentId, rawBody) {
  const parseResult = createChildSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { displayName } = parseResult.data;
  const pool = getPool();

  // Look up the parent's tier and current child count in one round-trip.
  // Tier governs the cap: Standard = 1 child, Family = up to 4. NULL tier on
  // an active subscription falls back to Standard (covers legacy rows from
  // before migration 014). The Family hard ceiling is also kept here as a
  // belt-and-braces guard.
  const [[tierRows], [countRows]] = await Promise.all([
    pool.query('SELECT subscription_tier FROM parents WHERE id = ?', [parentId]),
    pool.query('SELECT COUNT(*) AS cnt FROM children WHERE parent_id = ?', [parentId]),
  ]);

  const tier = tierRows[0]?.subscription_tier || null;
  const limit = childLimitForTier(tier);
  const currentCount = countRows[0].cnt;

  if (currentCount >= limit) {
    // Distinct error codes so the app can show a tier-aware upsell instead of
    // a generic message.
    const isFamilyCap = limit === CHILD_LIMITS.family;
    const error = new Error(
      isFamilyCap
        ? `Family plan supports up to ${CHILD_LIMITS.family} child profiles.`
        : `Standard plan supports 1 child profile. Upgrade to Family for up to ${CHILD_LIMITS.family}.`
    );
    error.statusCode = 403;
    error.code = isFamilyCap ? 'CHILD_LIMIT_FAMILY' : 'CHILD_LIMIT_STANDARD';
    error.details = { limit, currentCount, tier: tier || 'standard' };
    throw error;
  }

  const id = uuidv4();
  await pool.query(
    'INSERT INTO children (id, parent_id, display_name) VALUES (?, ?, ?)',
    [id, parentId, displayName]
  );

  return {
    child: { id, displayName, createdAt: new Date().toISOString() },
  };
}

module.exports = { createChild };
