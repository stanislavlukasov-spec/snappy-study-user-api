// Lambda handler: POST /child-session/qr

const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { sessionFromQr } = require('../domain/child/sessionFromQr');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const body = parseJsonBody(event);
    const result = await sessionFromQr(body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
