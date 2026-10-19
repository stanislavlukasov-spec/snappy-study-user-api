// Lambda handler: GET /children/{childId}/activity

const { requireParent } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { getChildActivity } = require('../domain/parent/getChildActivity');

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

    const qs = event.queryStringParameters || {};
    const result = await getChildActivity(auth.parent.id, childId, {
      limit:  qs.limit,
      before: qs.before,
    });

    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
