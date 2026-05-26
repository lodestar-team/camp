import { NextResponse } from "next/server";

type ErrorCode =
  | "bad_request"
  | "rate_limited"
  | "query_timeout"
  | "query_too_expensive"
  | "upstream_unavailable"
  | "internal";

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public hint?: string,
  ) {
    super(message);
  }
}

export function jsonError(err: ApiError) {
  return NextResponse.json(
    { error: { code: err.code, message: err.message, hint: err.hint } },
    { status: err.status },
  );
}

export function handle(err: unknown) {
  if (err instanceof ApiError) return jsonError(err);
  console.error("unhandled", err);
  return jsonError(
    new ApiError("internal", 500, "unexpected server error"),
  );
}
