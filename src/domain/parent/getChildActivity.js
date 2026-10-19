// Domain: GET /children/:childId/activity
// Returns a paginated list of activity logs for a specific child, scoped to the
// requesting parent.  Uses cursor-based pagination (before=<ISO timestamp>) so
// infinite scroll works efficiently at scale.

const { getPool } = require('../../shared/db');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

async function getChildActivity(parentId, childId, { limit: rawLimit, before } = {}) {
  const pool = getPool();

  // ── Verify the child belongs to this parent ──────────────────────────────
  const [childRows] = await pool.query(
    'SELECT id FROM children WHERE id = ? AND parent_id = ?',
    [childId, parentId]
  );
  if (childRows.length === 0) {
    const error = new Error('Child not found');
    error.statusCode = 404;
    throw error;
  }

  // ── Parse + clamp pagination params ─────────────────────────────────────
  const limit = Math.min(parseInt(rawLimit, 10) || DEFAULT_LIMIT, MAX_LIMIT);

  // ── Fetch activity rows ──────────────────────────────────────────────────
  let rows;
  if (before) {
    [rows] = await pool.query(
      `SELECT id, type, metadata, created_at
       FROM   activity_logs
       WHERE  child_id = ? AND created_at < ?
       ORDER  BY created_at DESC
       LIMIT  ?`,
      [childId, before, limit]
    );
  } else {
    [rows] = await pool.query(
      `SELECT id, type, metadata, created_at
       FROM   activity_logs
       WHERE  child_id = ?
       ORDER  BY created_at DESC
       LIMIT  ?`,
      [childId, limit]
    );
  }

  const items = rows.map((r) => ({
    id:        r.id,
    type:      r.type,
    metadata:  typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Cursor for the next page = created_at of the oldest item returned
  const nextBefore = items.length === limit
    ? items[items.length - 1].createdAt
    : null;

  return { items, nextBefore };
}

module.exports = { getChildActivity };
