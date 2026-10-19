// Lambda handler: POST /auth/apple

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { appleAuth } = require('../domain/auth/appleAuth');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const body = parseJsonBody(event);
    const result = await appleAuth(body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
