// Lambda handler: POST /auth/login

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { login } = require('../domain/auth/login');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const body = parseJsonBody(event);
    const result = await login(body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    if (err.code) payload.code = err.code;
    return jsonResponse(statusCode, payload);
  }
};
