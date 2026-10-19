// Lambda handler: PATCH /me

const { requireParent } = require('../shared/auth');
const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { updateMe } = require('../domain/parent/updateMe');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) return jsonResponse(auth.error.statusCode, auth.error.body);

    const body = parseJsonBody(event);
    const result = await updateMe(auth.parent.id, body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
