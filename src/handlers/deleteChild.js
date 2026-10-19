// Lambda handler: DELETE /children/:childId

const { requireParent } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { deleteChild } = require('../domain/parent/deleteChild');

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

    const result = await deleteChild(auth.parent.id, childId);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    return jsonResponse(statusCode, payload);
  }
};
