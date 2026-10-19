// Lambda handler: run pending DB migrations
//
// This Lambda is NOT exposed via API Gateway – it is invoked directly
// via the AWS CLI (see migrate.sh).  It has the same VPC config as all
// other user-api Lambdas so it can reach the private RDS instance.
//
// Response shape:
//   { success: bool, total: number, applied: string[], skipped: string[], errors: [] }

const { run } = require('../domain/migrations/runner');

exports.handler = async () => {
  try {
    const result = await run();
    return {
      statusCode: result.success ? 200 : 500,
      body: result,
    };
  } catch (err) {
    console.error('[migrate] Unhandled error:', err);
    return {
      statusCode: 500,
      body: { success: false, error: err.message },
    };
  }
};
