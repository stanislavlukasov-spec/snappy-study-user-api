const {
  tierFromProductId,
  childLimitForTier,
  CHILD_LIMITS,
} = require('../../src/shared/subscriptionTier');

describe('tierFromProductId', () => {
  it('maps the Standard product id to "standard"', () => {
    expect(tierFromProductId('snappy_standard_monthly')).toBe('standard');
  });

  it('maps the Family product id to "family"', () => {
    expect(tierFromProductId('snappy_family_monthly')).toBe('family');
  });

  it('returns null for unrecognised product ids', () => {
    expect(tierFromProductId('something_else')).toBeNull();
    expect(tierFromProductId('')).toBeNull();
    expect(tierFromProductId(null)).toBeNull();
    expect(tierFromProductId(undefined)).toBeNull();
  });
});

describe('childLimitForTier', () => {
  it('returns the Family cap for "family"', () => {
    expect(childLimitForTier('family')).toBe(CHILD_LIMITS.family);
  });

  it('returns the Standard cap for "standard"', () => {
    expect(childLimitForTier('standard')).toBe(CHILD_LIMITS.standard);
  });

  it('defaults NULL / unknown tiers to Standard', () => {
    expect(childLimitForTier(null)).toBe(CHILD_LIMITS.standard);
    expect(childLimitForTier(undefined)).toBe(CHILD_LIMITS.standard);
    expect(childLimitForTier('mystery')).toBe(CHILD_LIMITS.standard);
  });

  it('caps are 1 and 4 respectively', () => {
    expect(CHILD_LIMITS.standard).toBe(1);
    expect(CHILD_LIMITS.family).toBe(4);
  });
});
