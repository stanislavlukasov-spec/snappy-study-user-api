// Domain: POST /child/activity
// Records a child's activity (image analysis, quiz result, etc.) in the DB.
// Called fire-and-forget from the app after a successful analysis.

const { z } = require('zod');
const { getPool } = require('../../shared/db');

const ALLOWED_TYPES = ['image_analysis'];

const schema = z.object({
  type:     z.enum(ALLOWED_TYPES),
  metadata: z.record(z.string(), z.unknown()),   // flexible JSON object; validated per-type if needed
});

async function logActivity(childId, parentId, rawBody) {
  const parsed = schema.safeParse(rawBody);
  if (!parsed.success) {
    const error = new Error('Invalid activity body');
    error.statusCode = 400;
    error.details = parsed.error.issues;
    throw error;
  }

  const { type, metadata } = parsed.data;
  const pool = getPool();

  const [result] = await pool.query(
    `INSERT INTO activity_logs (child_id, parent_id, type, metadata)
     VALUES (?, ?, ?, ?)`,
    [childId, parentId, type, JSON.stringify(metadata)]
  );

  return { id: result.insertId, type, createdAt: new Date().toISOString() };
}

module.exports = { logActivity };
