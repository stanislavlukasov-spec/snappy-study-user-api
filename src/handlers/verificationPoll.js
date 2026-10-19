// Lambda handler: GET /auth/verification-poll?email=...

const { jsonResponse, requireApiKey } = require('../shared/http');
const { verificationPoll } = require('../domain/auth/verificationPoll');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const email = decodeURIComponent((event.queryStringParameters || {}).email || '');
    const result = await verificationPoll(email);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
