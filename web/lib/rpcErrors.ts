export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isRpcRateLimitError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("too many requests") ||
    message.includes("rate limit")
  );
}

export function wrapRpcLookupError(error: unknown, context: string): Error {
  const message = getErrorMessage(error);
  return new Error(`${context}: ${message}`);
}
