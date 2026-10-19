// Lambda handler: POST /auth/google

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { googleAuth } = require('../domain/auth/googleAuth');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const body = parseJsonBody(event);
    const result = await googleAuth(body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
