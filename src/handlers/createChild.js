// Lambda handler: POST /children

const { requireParent } = require('../shared/auth');
const { jsonResponse, parseJsonBody, requireApiKey } = require('../shared/http');
const { createChild } = require('../domain/parent/createChild');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const body = parseJsonBody(event);
    const result = await createChild(auth.parent.id, body);
    return jsonResponse(201, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    const payload = { error: err.message || 'Internal server error' };
    if (err.details) payload.details = err.details;
    return jsonResponse(statusCode, payload);
  }
};
