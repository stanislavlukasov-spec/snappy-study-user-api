// Lambda handler: POST /auth/register

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { register } = require('../domain/auth/register');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const body = parseJsonBody(event);
    const result = await register(body);
    return jsonResponse(201, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
