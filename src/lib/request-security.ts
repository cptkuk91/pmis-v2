import type { NextRequest } from "next/server";
import { ApiError, VALIDATION_ERROR } from "@/lib/api-error";
import { isAuthBypassEnabled } from "@/lib/runtime-flags";

const UNSAFE_HTML_PATTERN =
  /<\s*script\b|javascript:|data:text\/html|on\w+\s*=|<\s*iframe\b|<\s*object\b|<\s*embed\b/i;

export function assertSafeMutationRequest(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    return;
  }

  if (isAuthBypassEnabled) {
    return;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) {
    throw new ApiError("요청 Origin 검증에 실패했습니다.", 403, "CSRF_BLOCKED");
  }

  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiError("요청 Origin 형식이 올바르지 않습니다.", 403, "CSRF_BLOCKED");
  }

  if (originHost !== host) {
    throw new ApiError("허용되지 않은 Origin 요청입니다.", 403, "CSRF_BLOCKED");
  }
}

export function assertNoUnsafeHtml(value: string, fieldName: string) {
  if (!value) {
    return;
  }
  if (UNSAFE_HTML_PATTERN.test(value)) {
    throw VALIDATION_ERROR(`${fieldName}에 허용되지 않는 스크립트/HTML 패턴이 포함되어 있습니다.`);
  }
}
