// Lambda handler: POST /child/activity

const { requireChild } = require('../shared/auth');
const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { logActivity } = require('../domain/child/logActivity');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireChild(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const body = parseJsonBody(event);
    const result = await logActivity(auth.child.id, auth.child.parentId, body);
    return jsonResponse(201, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
