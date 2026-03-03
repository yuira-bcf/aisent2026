export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type ApiSuccessResponse<T> = { ok: true; data: T };
type ApiErrorResponse = { ok: false; error: { code: string; message: string } };

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const baseUrl =
    typeof window === "undefined"
      ? process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      : "";

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = (await res.json()) as ApiSuccessResponse<T> | ApiErrorResponse;

  if (!json.ok) {
    throw new ApiClientError(json.error.code, json.error.message, res.status);
  }

  return json.data;
}
