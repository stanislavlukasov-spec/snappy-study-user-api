// Lambda handler: GET /auth/reset-password?token=...
//                 POST /auth/reset-password (form submission)

const { parseFormBody, jsonResponse } = require('../shared/http');
const { showResetForm, processReset } = require('../domain/auth/resetPassword');

exports.handler = async (event) => {
  try {
    const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

    if (method === 'GET') {
      const token = (event.queryStringParameters || {}).token;
      return await showResetForm(token);
    }

    if (method === 'POST') {
      // The form POSTs application/x-www-form-urlencoded
      const body = parseFormBody(event);
      return await processReset({
        token: body.token,
        password: body.password,
        confirm: body.confirm,
      });
    }

    return jsonResponse(405, { error: 'Method not allowed' });
  } catch (err) {
    console.error('[resetPassword] unexpected error:', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};
