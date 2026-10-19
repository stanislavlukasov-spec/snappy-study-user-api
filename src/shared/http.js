// HTTP helpers for Lambda handlers

const MAX_BODY_BYTES = 64 * 1024; // 64 KB — generous for any legitimate API call

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Checks the x-api-key header against the USER_API_KEY env var.
 * Returns a 401 response object if the key is missing or wrong, or null if OK.
 * Call at the top of every app-facing handler (skip for browser/webhook routes).
 */
function requireApiKey(event) {
  const apiKey = process.env.USER_API_KEY;
  if (!apiKey) {
    console.error('USER_API_KEY env var is not set');
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  const headers = event.headers || {};
  const provided = headers['x-api-key'] || headers['X-Api-Key'] || '';
  if (provided !== apiKey) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  return null;
}

function parseJsonBody(event) {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
  }
  try {
    return JSON.parse(event.body);
  } catch (e) {
    throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 });
  }
}

function htmlResponse(statusCode, html) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: html,
  };
}

/**
 * Parse application/x-www-form-urlencoded body (from HTML form POSTs).
 * API Gateway HTTP API passes the raw decoded string in event.body.
 */
function parseFormBody(event) {
  if (!event.body) return {};
  try {
    const params = new URLSearchParams(event.body);
    const obj = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  } catch (_) {
    return {};
  }
}

module.exports = {
  jsonResponse,
  requireApiKey,
  parseJsonBody,
  htmlResponse,
  parseFormBody,
};
