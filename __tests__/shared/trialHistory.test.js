const { emailHasUsedTrial, recordTrialStart } = require('../../src/shared/trialHistory');

jest.mock('../../src/shared/db');
const { getPool } = require('../../src/shared/db');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  mockPool.query.mockReset();
  getPool.mockReset();
  getPool.mockReturnValue(mockPool);
});

describe('trialHistory – developer backdoor', () => {
  const BACKDOOR_EMAIL = 'stasikest89@gmail.com';

  it('emailHasUsedTrial returns false for the backdoor email even when DB has a hit', async () => {
    // Even if the DB would otherwise return a row, the backdoor short-circuits
    // before the query so the DB is never consulted.
    mockPool.query.mockResolvedValueOnce([[{ email_hash: 'whatever' }]]);
    await expect(emailHasUsedTrial(BACKDOOR_EMAIL)).resolves.toBe(false);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('emailHasUsedTrial is case-insensitive for the backdoor', async () => {
    await expect(emailHasUsedTrial('STASIKEST89@GMAIL.COM')).resolves.toBe(false);
    await expect(emailHasUsedTrial('  Stasikest89@Gmail.com  ')).resolves.toBe(false);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('recordTrialStart does NOT write the backdoor email to trial_history', async () => {
    await recordTrialStart(BACKDOOR_EMAIL);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('non-backdoor emails still consult the DB normally', async () => {
    mockPool.query.mockResolvedValueOnce([[]]);
    await emailHasUsedTrial('someone-else@example.com');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });

  it('non-backdoor emails still record to trial_history', async () => {
    mockPool.query.mockResolvedValueOnce([{}]);
    await recordTrialStart('someone-else@example.com');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
    const [sql] = mockPool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT IGNORE INTO trial_history/i);
  });
});

describe('trialHistory – demo-domain bypass (@nginetech.com)', () => {
  it('any @nginetech.com address bypasses emailHasUsedTrial', async () => {
    await expect(emailHasUsedTrial('demo1@nginetech.com')).resolves.toBe(false);
    await expect(emailHasUsedTrial('alice@nginetech.com')).resolves.toBe(false);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('the demo-domain check is case-insensitive and trim-tolerant', async () => {
    await expect(emailHasUsedTrial('Demo2@NGINETECH.COM')).resolves.toBe(false);
    await expect(emailHasUsedTrial('  demo3@Nginetech.com  ')).resolves.toBe(false);
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('recordTrialStart does NOT write @nginetech.com addresses', async () => {
    await recordTrialStart('demo4@nginetech.com');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('does not match emails that merely contain the substring nginetech.com', async () => {
    // Only the domain suffix matters — "nginetech.com" appearing in the
    // local-part should not trigger the bypass.
    mockPool.query.mockResolvedValueOnce([[]]);
    await emailHasUsedTrial('nginetech.com.fan@gmail.com');
    expect(mockPool.query).toHaveBeenCalledTimes(1);
  });
});
