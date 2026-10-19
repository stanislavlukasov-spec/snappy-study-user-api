// Lambda: POST /child-session/qr (exchange QR token for child session token)

const { z } = require('zod');
const { findParent } = require('../shared/store');

const childSessionFromQrSchema = z.object({
  qrToken: z.string().min(1),
});

exports.handler = async (event) => {
  let body;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return response(400, { error: 'Invalid JSON body' });
  }

  const parseResult = childSessionFromQrSchema.safeParse(body);
  if (!parseResult.success) {
    return response(400, { error: 'Invalid body', details: parseResult.error.issues });
  }

  const { qrToken } = parseResult.data;
  const parts = qrToken.split(':');
  if (parts.length < 4 || parts[0] !== 'qr') {
    return response(400, { error: 'Invalid QR token format (stub)' });
  }

  const [, parentId, childId] = parts;

  const parent = findParent(parentId);
  if (!parent) {
    return response(404, { error: 'Parent not found for QR token' });
  }

  const child = parent.children.find((c) => c.id === childId);
  if (!child) {
    return response(404, { error: 'Child not found for QR token' });
  }

  const childToken = `child-${child.id}:${parentId}`;

  return response(200, {
    childToken,
    child,
  });
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
