// Lambda handler: GET /auth/verify-email?token=xxx
// Returns HTML — not JSON — so the user sees a nice page in their browser.

const { verifyEmail } = require('../domain/auth/verifyEmail');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  return verifyEmail(params.token);
};
