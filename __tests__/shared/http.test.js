const { jsonResponse, parseJsonBody, htmlResponse, parseFormBody, requireApiKey } = require('../../src/shared/http');

const TEST_API_KEY = 'test-user-api-key-abc123';

describe('jsonResponse', () => {
  it('returns the correct status code', () => {
    expect(jsonResponse(200, {}).statusCode).toBe(200);
    expect(jsonResponse(404, {}).statusCode).toBe(404);
  });

  it('sets Content-Type to application/json', () => {
    expect(jsonResponse(200, {}).headers['Content-Type']).toBe('application/json');
  });

  it('JSON-serialises the body', () => {
    const res = jsonResponse(200, { hello: 'world' });
    expect(JSON.parse(res.body)).toEqual({ hello: 'world' });
  });
});

describe('htmlResponse', () => {
  it('returns the correct status code', () => {
    expect(htmlResponse(200, '<html/>').statusCode).toBe(200);
  });

  it('sets Content-Type to text/html', () => {
    expect(htmlResponse(200, '<html/>').headers['Content-Type']).toMatch(/text\/html/);
  });

  it('passes through the body string unchanged', () => {
    const html = '<html><body>Test</body></html>';
    expect(htmlResponse(200, html).body).toBe(html);
  });
});

describe('parseJsonBody', () => {
  it('returns an empty object when event.body is missing', () => {
    expect(parseJsonBody({})).toEqual({});
    expect(parseJsonBody({ body: null })).toEqual({});
  });

  it('parses a valid JSON string', () => {
    const event = { body: JSON.stringify({ email: 'a@b.com' }) };
    expect(parseJsonBody(event)).toEqual({ email: 'a@b.com' });
  });

  it('throws a 400 error for invalid JSON', () => {
    expect(() => parseJsonBody({ body: '{bad-json' })).toThrow();
    try {
      parseJsonBody({ body: '{bad-json' });
    } catch (err) {
      expect(err.statusCode).toBe(400);
    }
  });

  it('throws a 413 error when body exceeds 64 KB', () => {
    const big = { body: 'x'.repeat(64 * 1024 + 1) };
    try {
      parseJsonBody(big);
    } catch (err) {
      expect(err.statusCode).toBe(413);
    }
  });
});

describe('parseFormBody', () => {
  it('returns an empty object when event.body is missing', () => {
    expect(parseFormBody({})).toEqual({});
  });

  it('parses a URL-encoded form body', () => {
    const event = { body: 'token=abc123&password=secret' };
    const result = parseFormBody(event);
    expect(result.token).toBe('abc123');
    expect(result.password).toBe('secret');
  });

  it('returns an empty object on parse error', () => {
    expect(parseFormBody({ body: '' })).toEqual({});
  });
});

describe('requireApiKey', () => {
  const OLD_ENV = process.env.USER_API_KEY;

  beforeAll(() => { process.env.USER_API_KEY = TEST_API_KEY; });
  afterAll(() => { process.env.USER_API_KEY = OLD_ENV; });

  it('returns null when the correct key is provided', () => {
    const event = { headers: { 'x-api-key': TEST_API_KEY } };
    expect(requireApiKey(event)).toBeNull();
  });

  it('accepts the key case-insensitively (X-Api-Key)', () => {
    const event = { headers: { 'X-Api-Key': TEST_API_KEY } };
    expect(requireApiKey(event)).toBeNull();
  });

  it('returns 401 when the key is missing', () => {
    const result = requireApiKey({ headers: {} });
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when the key is wrong', () => {
    const result = requireApiKey({ headers: { 'x-api-key': 'wrong-key' } });
    expect(result.statusCode).toBe(401);
  });

  it('returns 401 when headers are absent', () => {
    const result = requireApiKey({});
    expect(result.statusCode).toBe(401);
  });
});
