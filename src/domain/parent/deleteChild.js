const { getPool } = require('../../shared/db');

async function deleteChild(parentId, childId) {
  const pool = getPool();

  const [rows] = await pool.query(
    'DELETE FROM children WHERE id = ? AND parent_id = ?',
    [childId, parentId]
  );

  if (rows.affectedRows === 0) {
    const error = new Error('Child not found');
    error.statusCode = 404;
    throw error;
  }

  return { deleted: true };
}

module.exports = { deleteChild };
