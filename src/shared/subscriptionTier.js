// Subscription tier helpers — single source of truth for product IDs, tier
// derivation, and per-tier child limits. Used by the RevenueCat webhook (to
// persist the tier when an active event arrives), the trial flow (to default
// new trials to Standard), and the add-child guard (to enforce the cap).

const STANDARD_PRODUCT_IDS = new Set([
  'snappy_standard_monthly',
]);

const FAMILY_PRODUCT_IDS = new Set([
  'snappy_family_monthly',
]);

const CHILD_LIMITS = {
  standard: 1,
  family:   4,
};

// Map a store product id to a tier ('standard' | 'family' | null).
function tierFromProductId(productId) {
  if (!productId) return null;
  if (STANDARD_PRODUCT_IDS.has(productId)) return 'standard';
  if (FAMILY_PRODUCT_IDS.has(productId))   return 'family';
  return null;
}

// How many child profiles the given tier is allowed.
// A NULL tier with an active subscription is treated as 'standard' so legacy
// rows (created before migration 014) still get the Standard cap.
function childLimitForTier(tier) {
  if (tier === 'family') return CHILD_LIMITS.family;
  return CHILD_LIMITS.standard;
}

module.exports = {
  STANDARD_PRODUCT_IDS,
  FAMILY_PRODUCT_IDS,
  CHILD_LIMITS,
  tierFromProductId,
  childLimitForTier,
};
