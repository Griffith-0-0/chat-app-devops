const Sentry = require("@sentry/node");

Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.NODE_ENV || "development",
  sendDefaultPii: true,
});
