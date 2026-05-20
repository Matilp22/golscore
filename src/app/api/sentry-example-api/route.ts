import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

export function GET(request: Request) {
  if (process.env.SENTRY_TEST_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("throw") !== "1") {
    return NextResponse.json({
      ok: true,
      message: "Sentry test route enabled. Add ?throw=1 to send a test error.",
    });
  }

  Sentry.logger.info("Sentry example API called");

  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
