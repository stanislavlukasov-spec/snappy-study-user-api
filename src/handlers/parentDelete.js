// Lambda handler: DELETE /me
//
// Deletes the authenticated parent account and cascades to all child records.
// Required by App Store guideline 5.1.1(v).

const { requireParent } = require('../shared/auth');
const { jsonResponse, requireApiKey } = require('../shared/http');
const { deleteAccount } = require('../domain/parent/deleteAccount');

exports.handler = async (event) => {
  const _keyError = requireApiKey(event);
  if (_keyError) return _keyError;

  try {
    const auth = requireParent(event);
    if (auth.error) {
      return jsonResponse(auth.error.statusCode, auth.error.body);
    }

    const result = await deleteAccount(auth.parent.id);
    return jsonResponse(200, result);
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return jsonResponse(statusCode, { error: err.message || 'Internal server error' });
  }
};
