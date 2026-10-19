// User API Lambda (parents, kids, QR pairing, child sessions)
// This is the main Lambda implementation; lambda-index.js at the project root
// simply re-exports this handler so CloudFormation can keep using
// handler: lambda-index.handler.

require('dotenv').config();
const serverless = require('serverless-http');
const app = require('../../app');

exports.handler = serverless(app);
