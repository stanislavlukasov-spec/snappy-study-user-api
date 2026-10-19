const { getMe } = require('../../../src/domain/parent/getMe');

jest.mock('../../../src/shared/db');
const { getPool } = require('../../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  // mockReset() (not clearAllMocks) so mockResolvedValueOnce queues are
  // emptied between tests — some code paths short-circuit on the trial_history
  // check and don't consume every queued mock, which used to leak into the
  // next test.
  mockPool.query.mockReset();
  getPool.mockReset();
  getPool.mockReturnValue(mockPool);
});

const CHILDREN        = [{ id: 'c1', displayName: 'Kid One', createdAt: '2025-01-01T00:00:00.000Z', pairedAt: null }];
const CHILDREN_PAIRED = [{ id: 'c1', displayName: 'Kid One', createdAt: '2025-01-01T00:00:00.000Z', pairedAt: '2025-06-01T10:00:00.000Z' }];

function mockQueries(parentRow, children = CHILDREN, trialHistoryRows = []) {
  // getMe uses Promise.all for parent + children, then emailHasUsedTrial
  // issues a third query against trial_history.
  mockPool.query
    .mockResolvedValueOnce([[parentRow]])      // parents SELECT
    .mockResolvedValueOnce([children])         // children SELECT
    .mockResolvedValueOnce([trialHistoryRows]); // trial_history SELECT
}

describe('getMe – subscription states', () => {
  it('returns status=none when subscription_status is null', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.status).toBe('none');
  });

  it('returns status=trial with trialEndsAt for an active trial', async () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    mockQueries({ subscription_status: 'trial', trial_ends_at: future, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.status).toBe('trial');
    expect(result.subscription.trialEndsAt).toBe(new Date(future).toISOString());
  });

  it('returns status=expired when trial_ends_at is in the past', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    mockQueries({ subscription_status: 'trial', trial_ends_at: past, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.status).toBe('expired');
  });

  it('returns status=active with currentPeriodEnd', async () => {
    const periodEnd = new Date('2099-12-31').toISOString();
    mockQueries({ subscription_status: 'active', trial_ends_at: null, subscription_current_period_end: periodEnd });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.status).toBe('active');
    expect(result.subscription.currentPeriodEnd).toBeDefined();
  });

  it('returns status=cancelled with currentPeriodEnd', async () => {
    const periodEnd = new Date('2099-12-31').toISOString();
    mockQueries({ subscription_status: 'cancelled', trial_ends_at: null, subscription_current_period_end: periodEnd });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.status).toBe('cancelled');
    expect(result.subscription.currentPeriodEnd).toBeDefined();
  });
});

describe('getMe – trial eligibility', () => {
  it('marks trialEligible=true when status is none and email has no history', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null });
    const result = await getMe('p1', 'fresh@t.com', 'Alice');
    expect(result.subscription.trialEligible).toBe(true);
  });

  it('marks trialEligible=false when the email is in trial_history', async () => {
    mockQueries(
      { subscription_status: null, trial_ends_at: null, subscription_current_period_end: null },
      CHILDREN,
      [{ email_hash: 'deadbeef' }] // history hit
    );
    const result = await getMe('p1', 'reused@t.com', 'Alice');
    expect(result.subscription.trialEligible).toBe(false);
  });

  it('marks trialEligible=false when the account already has a subscription', async () => {
    mockQueries({ subscription_status: 'active', trial_ends_at: null, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.subscription.trialEligible).toBe(false);
  });
});

describe('getMe – parent and children', () => {
  it('includes parent id, email, and displayName', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.parent).toEqual({ id: 'p1', email: 'u@t.com', displayName: 'Alice' });
  });

  it('includes the children list', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null });
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.children).toEqual(CHILDREN);
  });

  it('returns an empty children array when parent has no children', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null }, []);
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.children).toEqual([]);
  });

  it('exposes pairedAt as null when the child has never scanned their QR', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null }, CHILDREN);
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.children[0].pairedAt).toBeNull();
  });

  it('exposes pairedAt as a timestamp when the child has scanned their QR', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null }, CHILDREN_PAIRED);
    const result = await getMe('p1', 'u@t.com', 'Alice');
    expect(result.children[0].pairedAt).toBe('2025-06-01T10:00:00.000Z');
  });

  it('queries the DB with paired_at included in the children SELECT', async () => {
    mockQueries({ subscription_status: null, trial_ends_at: null, subscription_current_period_end: null });
    await getMe('p1', 'u@t.com', 'Alice');
    // The second query call is the children SELECT
    const childrenQuery = mockPool.query.mock.calls[1][0];
    expect(childrenQuery).toContain('paired_at');
  });
});
