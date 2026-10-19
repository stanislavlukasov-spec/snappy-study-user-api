// Domain: delete a parent account and all of their data.
//
// Required by App Store guideline 5.1.1(v): apps that support account creation
// must offer in-app account deletion that removes the user's data.
//
// FK CASCADE handles the cleanup:
//   • children            (003_create_children.sql)            → ON DELETE CASCADE
//   • activity_logs.child  / activity_logs.parent (009)         → ON DELETE CASCADE
//   • everything else keyed on parent_id will follow the same pattern.
//
// A row deletion in `parents` therefore wipes every record we hold about the
// account in a single transaction. The caller is responsible for ensuring the
// authenticated parent matches the id being deleted (handled in the Lambda).

const { getPool } = require('../../shared/db');

async function deleteAccount(parentId) {
  if (!parentId) {
    const err = new Error('Missing parent id');
    err.statusCode = 400;
    throw err;
  }

  const pool = getPool();
  const [result] = await pool.query('DELETE FROM parents WHERE id = ?', [parentId]);

  if (result.affectedRows === 0) {
    const err = new Error('Account not found');
    err.statusCode = 404;
    throw err;
  }

  return { deleted: true };
}

module.exports = { deleteAccount };
