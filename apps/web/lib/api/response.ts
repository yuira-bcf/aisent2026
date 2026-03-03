import { NextResponse } from "next/server";

type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
};

type ApiErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data } satisfies ApiSuccessResponse<T>, {
    status,
  });
}

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json(
    { ok: false, error: { code, message } } satisfies ApiErrorResponse,
    { status },
  );
}

export function UNAUTHORIZED(message = "認証が必要です") {
  return apiError("UNAUTHORIZED", message, 401);
}

export function FORBIDDEN(message = "権限がありません") {
  return apiError("FORBIDDEN", message, 403);
}

export function NOT_FOUND(message = "リソースが見つかりません") {
  return apiError("NOT_FOUND", message, 404);
}

export function VALIDATION_ERROR(message: string) {
  return apiError("VALIDATION_ERROR", message, 400);
}

export function INTERNAL_ERROR(message = "サーバーエラーが発生しました") {
  return apiError("INTERNAL_ERROR", message, 500);
}
