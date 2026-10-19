// Lambda handler: GET /activity  (parent token)
// Returns recent image analyses across all of the parent's children.

const { requireParent } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { getAllChildrenActivity } = require('../domain/parent/getAllChildrenActivity');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const qs     = event.queryStringParameters || {};
    const result = await getAllChildrenActivity(auth.parent.id, {
      limit:  qs.limit,
      before: qs.before,
    });

    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
