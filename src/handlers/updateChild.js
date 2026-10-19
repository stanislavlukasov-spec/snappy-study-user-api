// Lambda handler: PATCH /children/:childId

const { requireParent } = require('../shared/auth');
const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { updateChild } = require('../domain/parent/updateChild');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const childId = event.pathParameters?.childId;
    if (!childId) {
      return jsonResponse(400, { error: 'Missing childId' });
    }

    const body = parseJsonBody(event);
    const result = await updateChild(auth.parent.id, childId, body);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
