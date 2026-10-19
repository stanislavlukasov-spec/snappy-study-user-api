// Domain: GET /activity
// Returns recent activity across ALL of a parent's children, joined with the
// children table so each item includes the child's display name.
// Uses the same cursor-based pagination as getChildActivity.

const { getPool } = require('../../shared/db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

async function getAllChildrenActivity(parentId, { limit: rawLimit, before } = {}) {
  const pool  = getPool();
  const limit = Math.min(parseInt(rawLimit, 10) || DEFAULT_LIMIT, MAX_LIMIT);

  let rows;
  if (before) {
    [rows] = await pool.query(
      `SELECT al.id, al.child_id, al.type, al.metadata, al.created_at,
              c.display_name AS child_display_name
       FROM   activity_logs al
       JOIN   children c ON c.id = al.child_id
       WHERE  al.parent_id = ? AND al.created_at < ?
       ORDER  BY al.created_at DESC
       LIMIT  ?`,
      [parentId, before, limit]
    );
  } else {
    [rows] = await pool.query(
      `SELECT al.id, al.child_id, al.type, al.metadata, al.created_at,
              c.display_name AS child_display_name
       FROM   activity_logs al
       JOIN   children c ON c.id = al.child_id
       WHERE  al.parent_id = ?
       ORDER  BY al.created_at DESC
       LIMIT  ?`,
      [parentId, limit]
    );
  }

  const items = rows.map((r) => ({
    id:               r.id,
    childId:          r.child_id,
    childDisplayName: r.child_display_name,
    type:             r.type,
    metadata:         typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    createdAt:        new Date(r.created_at).toISOString(),
  }));

  const nextBefore = items.length === limit
    ? items[items.length - 1].createdAt
    : null;

  return { items, nextBefore };
}

module.exports = { getAllChildrenActivity };
