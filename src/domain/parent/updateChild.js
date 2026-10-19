const { z } = require('zod');
const { getPool } = require('../../shared/db');

const updateChildSchema = z.object({
  displayName: z.string().min(1).max(64),
});

async function updateChild(parentId, childId, rawBody) {
  const parseResult = updateChildSchema.safeParse(rawBody);
  if (!parseResult.success) {
    const error = new Error('Invalid body');
    error.statusCode = 400;
    error.details = parseResult.error.issues;
    throw error;
  }

  const { displayName } = parseResult.data;
  const pool = getPool();

  const [rows] = await pool.query(
    'UPDATE children SET display_name = ? WHERE id = ? AND parent_id = ?',
    [displayName, childId, parentId]
  );

  if (rows.affectedRows === 0) {
    const error = new Error('Child not found');
    error.statusCode = 404;
    throw error;
  }

  return { child: { id: childId, displayName } };
}

module.exports = { updateChild };
