const { register } = require('../../../src/domain/auth/register');

jest.mock('../../../src/shared/db');
jest.mock('../../../src/shared/email');
jest.mock('bcryptjs');
jest.mock('uuid');
jest.mock('crypto');

const { getPool } = require('../../../src/shared/db');
const { sendVerificationEmail } = require('../../../src/shared/email');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const mockPool = { query: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  getPool.mockReturnValue(mockPool);
  bcrypt.hash.mockResolvedValue('$hashed');
  uuidv4.mockReturnValue('new-parent-uuid');
  // randomBytes returns a mock Buffer with a hex() method
  crypto.randomBytes.mockReturnValue({ toString: jest.fn().mockReturnValue('mocktoken123') });
  sendVerificationEmail.mockResolvedValue();
});

const VALID_BODY = { email: 'new@test.com', password: 'password123', displayName: 'Bob' };

describe('register – validation', () => {
  it('throws 400 for missing email', async () => {
    await expect(register({ password: 'pass12345', displayName: 'Bob' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for invalid email format', async () => {
    await expect(register({ email: 'bad', password: 'pass12345', displayName: 'Bob' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for a password shorter than 8 chars', async () => {
    await expect(register({ email: 'a@b.com', password: 'short', displayName: 'Bob' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for missing displayName', async () => {
    await expect(register({ email: 'a@b.com', password: 'password123' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('register – business logic', () => {
  it('throws 409 when email already exists', async () => {
    mockPool.query
      .mockResolvedValueOnce([[{ id: 'existing-id' }]]); // SELECT → email found

    await expect(register(VALID_BODY)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('inserts a new parent row on success', async () => {
    mockPool.query
      .mockResolvedValueOnce([[]])   // SELECT → no existing email
      .mockResolvedValueOnce([{}]);  // INSERT

    await register(VALID_BODY);

    const insertCall = mockPool.query.mock.calls[1];
    expect(insertCall[0]).toMatch(/INSERT INTO parents/i);
    expect(insertCall[1]).toContain('new-parent-uuid');
    expect(insertCall[1]).toContain('new@test.com');
  });

  it('returns emailVerificationRequired and autoLoginToken on success', async () => {
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}]);

    const result = await register(VALID_BODY);

    expect(result.emailVerificationRequired).toBe(true);
    expect(result.email).toBe('new@test.com');
    expect(result.autoLoginToken).toBeDefined();
  });

  it('sends a verification email with a link containing the token', async () => {
    mockPool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{}]);

    await register(VALID_BODY);

    expect(sendVerificationEmail).toHaveBeenCalledWith(
      'new@test.com',
      'Bob',
      expect.stringContaining('verify-email')
    );
  });
});
