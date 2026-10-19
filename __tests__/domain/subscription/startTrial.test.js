const { startTrial } = require('../../../src/domain/subscription/startTrial');

jest.mock('../../../src/shared/db');
jest.mock('../../../src/shared/email');

const { getPool } = require('../../../src/shared/db');
const { sendTrialStartedEmail } = require('../../../src/shared/email');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
  sendTrialStartedEmail.mockResolvedValue();
});

// Helper: queue the happy-path query sequence (no trial history, no cross-
// account email collision). UPDATE + INSERT IGNORE return empty result objects.
function mockHappyPathFor(email = 'u@t.com', displayName = 'Alice') {
  mockPool.query
    .mockResolvedValueOnce([[{ subscription_status: null, email, display_name: displayName }]])
    .mockResolvedValueOnce([[]])  // trial_history lookup → empty
    .mockResolvedValueOnce([[]])  // cross-account email check → empty
    .mockResolvedValueOnce([{}])  // UPDATE parents
    .mockResolvedValueOnce([{}]); // INSERT IGNORE trial_history
}

describe('startTrial', () => {
  it('throws 404 when parent is not found', async () => {
    mockPool.query.mockResolvedValueOnce([[]]); // no rows
    await expect(startTrial('missing')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 409 when the account already has a subscription status', async () => {
    mockPool.query.mockResolvedValueOnce([[{
      subscription_status: 'trial', email: 'u@t.com', display_name: 'Alice',
    }]]);
    await expect(startTrial('p1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 when the email is already recorded in trial_history (deleted-account abuse)', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ subscription_status: null, email: 'u@t.com', display_name: 'Alice' }]])
      .mockResolvedValueOnce([[{ email_hash: 'deadbeef' }]]); // trial_history hit
    await expect(startTrial('p1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 409 when another account with the same email already used a trial', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ subscription_status: null, email: 'u@t.com', display_name: 'Alice' }]])
      .mockResolvedValueOnce([[]])                          // trial_history empty
      .mockResolvedValueOnce([[{ id: 'other-account' }]]);  // cross-account email check
    await expect(startTrial('p1')).rejects.toMatchObject({ statusCode: 409 });
  });

  it('sets subscription_status=trial and returns trial subscription', async () => {
    mockHappyPathFor();

    const result = await startTrial('p1');

    expect(result.subscription.status).toBe('trial');
    expect(result.subscription.trialEndsAt).toBeDefined();

    const updateCall = mockPool.query.mock.calls[3];
    expect(updateCall[0]).toMatch(/UPDATE parents\s+SET\s+subscription_status/i);
    // Tier is also locked to 'standard' on trial start.
    expect(updateCall[0]).toMatch(/subscription_tier\s*=\s*'standard'/i);
    expect(updateCall[1]).toContain('trial');
  });

  it('records the trial in trial_history with an HMAC-SHA256 hex email hash', async () => {
    mockHappyPathFor();
    await startTrial('p1');

    const insertCall = mockPool.query.mock.calls[4];
    expect(insertCall[0]).toMatch(/INSERT IGNORE INTO trial_history/i);
    expect(insertCall[1]).toHaveLength(1);
    // 64 hex characters = SHA-256 digest length
    expect(insertCall[1][0]).toMatch(/^[a-f0-9]{64}$/);
  });

  it('sends a trial-started email', async () => {
    mockHappyPathFor();
    await startTrial('p1');

    expect(sendTrialStartedEmail).toHaveBeenCalledWith(
      'u@t.com',
      'Alice',
      expect.any(Date)
    );
  });

  it('trial expires approximately 7 days from now', async () => {
    mockHappyPathFor();

    const before = Date.now();
    const result = await startTrial('p1');
    const after = Date.now();

    const trialEnd = new Date(result.subscription.trialEndsAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(trialEnd).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
    expect(trialEnd).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
  });
});
