import type { NextRequest } from "next/server";
import { ZodError } from "zod";
import { INTERNAL_ERROR, VALIDATION_ERROR } from "./response";

type RouteHandler = (
  req: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export function safeHandler(fn: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (error) {
      if (error instanceof ZodError) {
        return VALIDATION_ERROR(error.errors[0].message);
      }
      console.error("[API Error]", error);
      return INTERNAL_ERROR();
    }
  };
}
