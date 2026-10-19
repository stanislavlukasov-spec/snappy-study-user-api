// Lambda handler: POST /auth/resend-verification

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { resendVerification } = require('../domain/auth/resendVerification');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const { email } = parseJsonBody(event);
    const result = await resendVerification(email);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
