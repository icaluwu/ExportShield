import type { ApiFailure, ApiSuccess } from "@exportshield/shared";
import type { Env } from "./types";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify({ data } satisfies ApiSuccess<T>), { ...init, headers });
}

export function errorResponse(error: HttpError): Response {
  const body: ApiFailure = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    },
  };
  return new Response(JSON.stringify(body), {
    status: error.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function assertSameOrigin(request: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new HttpError(403, "INVALID_ORIGIN", "Request origin is not allowed");
  }
}

export function withApi(handler: PagesFunction<Env>): PagesFunction<Env> {
  return async (context) => {
    try {
      assertSameOrigin(context.request);
      const response = await handler(context);
      const headers = new Headers(response.headers);
      headers.set("x-content-type-options", "nosniff");
      headers.set("referrer-policy", "no-referrer");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      if (error instanceof HttpError) return errorResponse(error);
      console.error("ExportShield API error", error instanceof Error ? error.name : "UnknownError");
      return errorResponse(new HttpError(500, "INTERNAL_ERROR", "The request could not be completed"));
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Expected application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
}

export function getClientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}
