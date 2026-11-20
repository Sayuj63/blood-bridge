import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";

/** A domain error that maps to a clean JSON error response. */
export class AppError extends HTTPException {
  constructor(
    status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(status, { message });
  }
}

export const notFound = (what: string) => new AppError(404, "not_found", `${what} not found`);
export const conflict = (message: string, details?: unknown) => new AppError(409, "conflict", message, details);
export const badRequest = (message: string, details?: unknown) => new AppError(400, "bad_request", message, details);

/** Parse and validate a JSON body against a Zod schema, throwing a 400 with field errors. */
export async function body<S extends z.ZodType>(c: Context, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    throw badRequest("Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(422, "validation_failed", "Some fields are invalid", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
