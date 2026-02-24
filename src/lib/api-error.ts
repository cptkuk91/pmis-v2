import { error } from "./api-response";

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 공통 에러 팩토리
export const UNAUTHORIZED = () =>
  new ApiError("인증이 필요합니다.", 401, "UNAUTHORIZED");

export const FORBIDDEN = () =>
  new ApiError("권한이 없습니다.", 403, "FORBIDDEN");

export const NOT_FOUND = (resource = "리소스") =>
  new ApiError(`${resource}을(를) 찾을 수 없습니다.`, 404, "NOT_FOUND");

export const VALIDATION_ERROR = (message: string) =>
  new ApiError(message, 422, "VALIDATION_ERROR");

/**
 * API 라우트에서 에러를 처리하는 핸들러
 */
export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return error(err.message, err.statusCode);
  }

  console.error("Unhandled API Error:", err);
  return error("서버 내부 오류가 발생했습니다.", 500);
}
