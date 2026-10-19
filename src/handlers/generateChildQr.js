// Lambda handler: POST /children/{childId}/qr

const { requireParent } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { generateChildQr } = require('../domain/parent/generateChildQr');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const childId = event.pathParameters && event.pathParameters.childId;
    const result = await generateChildQr(auth.parent.id, childId);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
