// Lambda: GET /child/me (child profile + parent id)

const { requireChild } = require('../shared/auth');
const { findParent } = require('../shared/store');

exports.handler = async (event) => {
  const auth = requireChild(event);
  if (auth.error) {
    return response(auth.error.statusCode, auth.error.body);
  }

  const { id: childId, parentId } = auth.child;
  const parent = findParent(parentId);
  if (!parent) {
    return response(404, { error: 'Parent not found for child token' });
  }

  const child = parent.children.find((c) => c.id === childId);
  if (!child) {
    return response(404, { error: 'Child not found for child token' });
  }

  return response(200, {
    child,
    parent: {
      id: parent.id,
    },
  });
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
