// Lambda handler: GET /child/me

const { requireChild } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { getMe } = require('../domain/child/getMe');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireChild(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const { id: childId, parentId } = auth.child;
    const result = await getMe(childId, parentId);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
