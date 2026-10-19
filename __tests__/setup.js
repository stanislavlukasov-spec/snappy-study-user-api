// Global test environment configuration

process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.USER_API_BASE_URL = 'https://api.test';
process.env.REVENUECAT_WEBHOOK_AUTH = 'test-revenuecat-auth';
process.env.APPLE_BUNDLE_ID = 'com.snappystudy.app';

// Silence console.log/warn in tests (keep console.error visible for debugging)
global.console.log = jest.fn();
global.console.warn = jest.fn();
