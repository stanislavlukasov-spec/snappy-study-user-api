// Lambda: POST /children/{childId}/qr (generate QR token for child)

const { requireParent } = require('../shared/auth');
const { findParent } = require('../shared/store');

exports.handler = async (event) => {
  const auth = requireParent(event);
  if (auth.error) {
    return response(auth.error.statusCode, auth.error.body);
  }

  const parentId = auth.parent.id;
  const parent = findParent(parentId);
  if (!parent) {
    return response(404, { error: 'Parent not found' });
  }

  const childId = event.pathParameters && event.pathParameters.childId;
  const child = parent.children.find((c) => c.id === childId);
  if (!child) {
    return response(404, { error: 'Child not found' });
  }

  const qrToken = `qr:${parentId}:${child.id}:${Date.now()}`;

  return response(200, { qrToken });
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
