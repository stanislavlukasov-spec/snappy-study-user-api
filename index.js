// Local development server – wraps Lambda handlers in an Express app.
// Run: node index.js   (or: npm start)
// This file is NOT deployed to Lambda; only src/ and node_modules/ are.

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { handler: authRegisterHandler } = require('./src/handlers/authRegister');
const { handler: authLoginHandler } = require('./src/handlers/authLogin');
const { handler: authGoogleHandler } = require('./src/handlers/authGoogle');
const { handler: authAppleHandler } = require('./src/handlers/authApple');
const { handler: parentMeHandler } = require('./src/handlers/parentMe');
const { handler: parentDeleteHandler } = require('./src/handlers/parentDelete');
const { handler: createChildHandler } = require('./src/handlers/createChild');
const { handler: updateChildHandler } = require('./src/handlers/updateChild');
const { handler: deleteChildHandler } = require('./src/handlers/deleteChild');
const { handler: generateChildQrHandler } = require('./src/handlers/generateChildQr');
const { handler: revenuecatWebhookHandler } = require('./src/handlers/revenuecatWebhook');
const { handler: childSessionFromQrHandler } = require('./src/handlers/childSessionFromQr');
const { handler: childMeHandler } = require('./src/handlers/childMe');

// Convert a Lambda-style handler into an Express middleware
function lambda(handler) {
  return async (req, res) => {
    const event = {
      httpMethod: req.method,
      path: req.path,
      headers: req.headers,
      queryStringParameters: req.query || {},
      body: req.body ? JSON.stringify(req.body) : null,
      pathParameters: req.params || {},
    };
    try {
      const result = await handler(event);
      res
        .status(result.statusCode)
        .set(result.headers || {})
        .send(result.body);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

const app = express();
app.use(cors());
app.use(express.json());

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/auth/register', lambda(authRegisterHandler));
app.post('/auth/login', lambda(authLoginHandler));
app.post('/auth/google', lambda(authGoogleHandler));
app.post('/auth/apple', lambda(authAppleHandler));

// ── Parent ────────────────────────────────────────────────────────────────────
app.get('/me', lambda(parentMeHandler));
app.delete('/me', lambda(parentDeleteHandler));
app.post('/children', lambda(createChildHandler));
app.patch('/children/:childId', lambda(updateChildHandler));
app.delete('/children/:childId', lambda(deleteChildHandler));
app.post('/children/:childId/qr', lambda(generateChildQrHandler));

// ── Subscriptions (RevenueCat webhook) ──────────────────────────────────────────
app.post('/webhooks/revenuecat', lambda(revenuecatWebhookHandler));

// ── Child ─────────────────────────────────────────────────────────────────────
app.post('/child-session/qr', lambda(childSessionFromQrHandler));
app.get('/child/me', lambda(childMeHandler));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User API (local) listening on http://localhost:${PORT}`);
});
