// Lambda: GET /me (parent profile + children)

const { requireParent } = require('../shared/auth');
const { getOrCreateParent } = require('../shared/store');

exports.handler = async (event) => {
  const auth = requireParent(event);
  if (auth.error) {
    return response(auth.error.statusCode, auth.error.body);
  }

  const parent = getOrCreateParent(auth.parent.id);

  return response(200, {
    parent: {
      id: parent.id,
      email: null, // TODO: derive from Cognito claims
    },
    children: parent.children,
  });
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
