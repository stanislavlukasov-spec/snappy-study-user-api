// Lambda handler: POST /auth/forgot-password

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { forgotPassword } = require('../domain/auth/forgotPassword');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const { email } = parseJsonBody(event);
    const result = await forgotPassword(email);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
