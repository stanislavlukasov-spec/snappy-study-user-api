// Lambda handler: POST /webhooks/revenuecat
// NOTE: This endpoint is public (no JWT auth) — RevenueCat authenticates instead
// via the Authorization header value configured in the RevenueCat dashboard.

const { jsonResponse } = require('../shared/http');
const { handleRevenueCatWebhook } = require('../domain/subscription/revenuecatWebhook');

exports.handler = async (event) => {
  try {
    // API Gateway HTTP API v2 may base64-encode the body
    let rawBody = event.body || '';
    if (event.isBase64Encoded) {
      rawBody = Buffer.from(rawBody, 'base64').toString('utf8');
    }

    const headers = event.headers || {};
    // Header names are lowercase in HTTP API v2
    const authHeader = headers['authorization'] || headers['Authorization'] || '';

    const result = await handleRevenueCatWebhook(rawBody, authHeader);
    return jsonResponse(200, result);
  } catch (err) {
    console.error('[revenuecatWebhook] Error:', err);
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
