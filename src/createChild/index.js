// Lambda: POST /children (create child under parent)

const { z } = require('zod');
const { requireParent } = require('../shared/auth');
const { getOrCreateParent } = require('../shared/store');

const createChildSchema = z.object({
  displayName: z.string().min(1).max(64),
});

exports.handler = async (event) => {
  const auth = requireParent(event);
  if (auth.error) {
    return response(auth.error.statusCode, auth.error.body);
  }

  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const parseResult = createChildSchema.safeParse(body);
  if (!parseResult.success) {
    return response(400, { error: 'Invalid body', details: parseResult.error.issues });
  }

  const { displayName } = parseResult.data;
  const parent = getOrCreateParent(auth.parent.id);

  if (parent.children.length >= 4) {
    return response(400, { error: 'Maximum of 4 child accounts per parent reached' });
  }

  const childId = `child-${parent.children.length + 1}-${Date.now()}`;
  const child = {
    id: childId,
    displayName,
    createdAt: new Date().toISOString(),
  };

  parent.children.push(child);

  return response(201, { child });
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
