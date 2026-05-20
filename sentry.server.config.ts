// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  enabled: Boolean(dsn),

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: getSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1),

  // Enable logs to be sent to Sentry
  enableLogs: process.env.SENTRY_ENABLE_LOGS === "true",

  // Do not send user PII (Personally Identifiable Information) by default.
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,
});

function getSampleRate(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const sampleRate = Number(value);
  return Number.isFinite(sampleRate) && sampleRate >= 0 && sampleRate <= 1
    ? sampleRate
    : fallback;
}
