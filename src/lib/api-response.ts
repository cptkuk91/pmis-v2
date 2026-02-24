import { NextResponse } from "next/server";

interface SuccessResponse<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

export function success<T>(
  data: T,
  meta?: Record<string, unknown>,
): NextResponse<SuccessResponse<T>> {
  return NextResponse.json({ ok: true, data, ...(meta ? { meta } : {}) });
}

export function error(
  message: string,
  status: number = 400,
): NextResponse<ErrorResponse> {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function paginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): NextResponse<SuccessResponse<T[]>> {
  return success(data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
