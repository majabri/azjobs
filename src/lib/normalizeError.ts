/**
 * Converts an unknown thrown value into a human-readable string.
 *
 * - `Error` instances → `error.message`
 * - objects with a `message` string field → that field
 * - other objects → JSON.stringify (falling back to String())
 * - primitives → String()
 */
export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  ) {
    return (error as Record<string, unknown>).message as string;
  }
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
