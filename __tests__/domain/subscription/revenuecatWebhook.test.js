const { handleRevenueCatWebhook } = require('../../../src/domain/subscription/revenuecatWebhook');

jest.mock('../../../src/shared/db');
jest.mock('../../../src/shared/email');

const { getPool } = require('../../../src/shared/db');
const {
  sendSubscriptionConfirmedEmail,
  sendSubscriptionCancelledEmail,
  sendPlanChangedEmail,
} = require('../../../src/shared/email');

const mockPool = { query: jest.fn() };
const AUTH = 'test-revenuecat-auth';

beforeEach(() => {
  // mockReset (not clearAllMocks) so queued mockResolvedValueOnce returns
  // don't leak between tests — some branches consume fewer mocks than others.
  mockPool.query.mockReset();
  getPool.mockReset();
  getPool.mockReturnValue(mockPool);
  sendSubscriptionConfirmedEmail.mockReset();
  sendSubscriptionConfirmedEmail.mockResolvedValue();
  sendSubscriptionCancelledEmail.mockReset();
  sendSubscriptionCancelledEmail.mockResolvedValue();
  sendPlanChangedEmail.mockReset();
  sendPlanChangedEmail.mockResolvedValue();
  process.env.REVENUECAT_WEBHOOK_AUTH = AUTH;
});

const body = (event) => JSON.stringify({ event });

// Helper: queue the parent-id resolution query (returns the matched row).
function mockResolveParent(id = 'p1') {
  mockPool.query.mockResolvedValueOnce([[{ id }]]);
}

describe('handleRevenueCatWebhook', () => {
  it('rejects requests with a missing/invalid Authorization header', async () => {
    await expect(handleRevenueCatWebhook(body({ type: 'RENEWAL' }), 'wrong'))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it('fails closed (500) when no webhook auth is configured', async () => {
    delete process.env.REVENUECAT_WEBHOOK_AUTH;
    await expect(handleRevenueCatWebhook(body({ type: 'RENEWAL' }), 'anything'))
      .rejects.toMatchObject({ statusCode: 500 });
  });

  it('acknowledges pings without an event', async () => {
    const result = await handleRevenueCatWebhook(JSON.stringify({}), AUTH);
    expect(result).toEqual({ received: true, ignored: 'no event' });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('ignores anonymous-only events with no resolvable id', async () => {
    const result = await handleRevenueCatWebhook(
      body({ type: 'RENEWAL', app_user_id: '$RCAnonymousID:abc' }),
      AUTH
    );
    expect(result).toEqual({ received: true, ignored: 'no resolvable app_user_id' });
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  // Helper for ACTIVE-event mock queueing:
  //   1. resolveParentId SELECT
  //   2. SELECT prev email + display_name + subscription_tier (for email routing)
  //   3. UPDATE parents
  function mockActiveEventPath({
    parentId = 'p1',
    email = 'u@t.com',
    displayName = 'Alice',
    previousTier = null,
  } = {}) {
    mockResolveParent(parentId);
    mockPool.query
      .mockResolvedValueOnce([[{ email, display_name: displayName, subscription_tier: previousTier }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
  }

  it('activates the subscription on INITIAL_PURCHASE and emails the parent (Standard)', async () => {
    const expMs = Date.now() + 30 * 86400 * 1000;
    mockActiveEventPath({ previousTier: null });

    const result = await handleRevenueCatWebhook(
      body({ type: 'INITIAL_PURCHASE', app_user_id: 'p1', expiration_at_ms: expMs, store: 'APP_STORE', product_id: 'snappy_standard_monthly' }),
      AUTH
    );

    expect(result).toEqual({ received: true });
    const updateCall = mockPool.query.mock.calls[2];           // 0=resolve, 1=prev SELECT, 2=UPDATE
    expect(updateCall[0]).toMatch(/subscription_status = 'active'/);
    expect(updateCall[1]).toContain('p1');
    expect(sendSubscriptionConfirmedEmail).toHaveBeenCalledWith('u@t.com', 'Alice', expect.any(Date), 'standard');
    expect(sendPlanChangedEmail).not.toHaveBeenCalled();
  });

  it('sends a plan-changed email when tier flips Standard → Family on PRODUCT_CHANGE', async () => {
    mockActiveEventPath({ previousTier: 'standard' });

    await handleRevenueCatWebhook(
      body({
        type: 'PRODUCT_CHANGE',
        app_user_id: 'p1',
        product_id: 'snappy_family_monthly',
        expiration_at_ms: Date.now() + 30 * 86400 * 1000,
      }),
      AUTH
    );

    expect(sendPlanChangedEmail).toHaveBeenCalledWith(
      'u@t.com', 'Alice', expect.any(Date), 'standard', 'family'
    );
    expect(sendSubscriptionConfirmedEmail).not.toHaveBeenCalled();
  });

  it('does not email on RENEWAL when tier is unchanged', async () => {
    mockActiveEventPath({ previousTier: 'standard' });
    await handleRevenueCatWebhook(
      body({ type: 'RENEWAL', app_user_id: 'p1', product_id: 'snappy_standard_monthly', expiration_at_ms: Date.now() + 30 * 86400 * 1000 }),
      AUTH
    );
    expect(sendSubscriptionConfirmedEmail).not.toHaveBeenCalled();
    expect(sendPlanChangedEmail).not.toHaveBeenCalled();
  });

  it('sends a confirmed email on UNCANCELLATION (resume)', async () => {
    mockActiveEventPath({ previousTier: 'family' });
    await handleRevenueCatWebhook(
      body({
        type: 'UNCANCELLATION',
        app_user_id: 'p1',
        product_id: 'snappy_family_monthly',
        expiration_at_ms: Date.now() + 30 * 86400 * 1000,
      }),
      AUTH
    );
    expect(sendSubscriptionConfirmedEmail).toHaveBeenCalledWith('u@t.com', 'Alice', expect.any(Date), 'family');
  });

  it('falls back to original_app_user_id when current id is anonymous', async () => {
    mockActiveEventPath({ parentId: 'parent-from-original', previousTier: null });

    await handleRevenueCatWebhook(
      body({
        type: 'RENEWAL',
        app_user_id: '$RCAnonymousID:anon-xyz',
        original_app_user_id: 'parent-from-original',
        product_id: 'snappy_family_monthly',
        expiration_at_ms: Date.now() + 86400000,
      }),
      AUTH
    );

    const updateCall = mockPool.query.mock.calls[2];
    expect(updateCall[1]).toContain('parent-from-original');
    expect(updateCall[1]).toContain('family');
  });

  it('marks subscription cancelled on CANCELLATION', async () => {
    mockResolveParent('p1');
    mockPool.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])                           // UPDATE
      .mockResolvedValueOnce([[{ email: 'u@t.com', display_name: 'Alice' }]]); // SELECT email

    const result = await handleRevenueCatWebhook(
      body({ type: 'CANCELLATION', app_user_id: 'p1', expiration_at_ms: Date.now() + 86400000 }),
      AUTH
    );

    expect(result).toEqual({ received: true });
    expect(mockPool.query.mock.calls[1][0]).toMatch(/subscription_status = 'cancelled'/);
    expect(sendSubscriptionCancelledEmail).toHaveBeenCalled();
  });

  it('marks subscription cancelled on EXPIRATION', async () => {
    mockResolveParent('p1');
    mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await handleRevenueCatWebhook(
      body({ type: 'EXPIRATION', app_user_id: 'p1', expiration_at_ms: Date.now() - 1000 }),
      AUTH
    );
    expect(mockPool.query.mock.calls[1][0]).toMatch(/subscription_status = 'cancelled'/);
  });
});
