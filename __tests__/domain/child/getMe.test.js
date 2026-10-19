const { getMe, isSubscriptionActive } = require('../../../src/domain/child/getMe');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockQuery = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue({ query: mockQuery });
});

// Helpers
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();
const PAST   = new Date(Date.now() - 86_400_000).toISOString();

function makeRow(overrides = {}) {
  return {
    id: 'c1',
    display_name: 'Lily',
    paired_at: null,
    subscription_status: 'active',
    trial_ends_at: null,
    subscription_current_period_end: null,
    ...overrides,
  };
}

// ── isSubscriptionActive (pure unit tests) ────────────────────────────────────

describe('isSubscriptionActive', () => {
  it('returns false when subscription_status is null', () => {
    expect(isSubscriptionActive({ subscription_status: null })).toBe(false);
  });

  it('returns true for status=active', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'active' }))).toBe(true);
  });

  it('returns true for status=trial with a future trial_ends_at', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'trial', trial_ends_at: FUTURE }))).toBe(true);
  });

  it('returns false for status=trial with a past trial_ends_at', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'trial', trial_ends_at: PAST }))).toBe(false);
  });

  it('returns false for status=trial with no trial_ends_at', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'trial', trial_ends_at: null }))).toBe(false);
  });

  it('returns true for status=cancelled with a future current_period_end', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'cancelled', subscription_current_period_end: FUTURE }))).toBe(true);
  });

  it('returns false for status=cancelled with a past current_period_end', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'cancelled', subscription_current_period_end: PAST }))).toBe(false);
  });

  it('returns false for status=cancelled with no current_period_end', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'cancelled', subscription_current_period_end: null }))).toBe(false);
  });

  it('returns false for an unknown status', () => {
    expect(isSubscriptionActive(makeRow({ subscription_status: 'expired' }))).toBe(false);
  });
});

// ── getMe – child not found ───────────────────────────────────────────────────

describe('child/getMe – not found', () => {
  it('throws 401 when no DB row is returned (child deleted or token mismatch)', async () => {
    mockQuery.mockResolvedValue([[]]); // empty result set
    await expect(getMe('c1', 'p1')).rejects.toMatchObject({ statusCode: 401 });
  });
});

// ── getMe – subscription gate ─────────────────────────────────────────────────

describe('child/getMe – subscription gate', () => {
  it('throws 403 when parent has no subscription', async () => {
    mockQuery.mockResolvedValue([[makeRow({ subscription_status: null })]]);
    await expect(getMe('c1', 'p1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when trial has expired', async () => {
    mockQuery.mockResolvedValue([[makeRow({ subscription_status: 'trial', trial_ends_at: PAST })]]);
    await expect(getMe('c1', 'p1')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('throws 403 when cancelled and period has ended', async () => {
    mockQuery.mockResolvedValue([[makeRow({ subscription_status: 'cancelled', subscription_current_period_end: PAST })]]);
    await expect(getMe('c1', 'p1')).rejects.toMatchObject({ statusCode: 403 });
  });
});

// ── getMe – success ───────────────────────────────────────────────────────────

describe('child/getMe – success', () => {
  it('returns child profile with camelCase fields for an active subscription', async () => {
    mockQuery.mockResolvedValue([[makeRow({ paired_at: FUTURE })]]);
    const result = await getMe('c1', 'p1');
    expect(result.child).toEqual({ id: 'c1', displayName: 'Lily', parentId: 'p1', pairedAt: FUTURE });
    expect(result.parent).toEqual({ id: 'p1' });
  });

  it('returns pairedAt as null when child has never scanned a QR', async () => {
    mockQuery.mockResolvedValue([[makeRow({ paired_at: null })]]);
    const result = await getMe('c1', 'p1');
    expect(result.child.pairedAt).toBeNull();
  });

  it('succeeds for an active trial', async () => {
    mockQuery.mockResolvedValue([[makeRow({ subscription_status: 'trial', trial_ends_at: FUTURE })]]);
    await expect(getMe('c1', 'p1')).resolves.toBeDefined();
  });

  it('succeeds for a cancelled subscription still within the paid period', async () => {
    mockQuery.mockResolvedValue([[makeRow({ subscription_status: 'cancelled', subscription_current_period_end: FUTURE })]]);
    await expect(getMe('c1', 'p1')).resolves.toBeDefined();
  });

  it('queries with a JOIN and passes the correct childId and parentId', async () => {
    mockQuery.mockResolvedValue([[makeRow()]]);
    await getMe('c2', 'p2');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('JOIN parents'),
      ['c2', 'p2']
    );
  });
});
