function getObjectMessage(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof (value as { message?: unknown }).message === "string"
  ) {
    return (value as { message: string }).message;
  }

  return null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "Unexpected error"
): string {
  if (error && typeof error === "object") {
    const causeMessage = getObjectMessage((error as { cause?: unknown }).cause);
    if (causeMessage) {
      return causeMessage;
    }

    const contextMessage = getObjectMessage(
      (error as { context?: unknown }).context
    );
    if (contextMessage) {
      return contextMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  const directMessage = getObjectMessage(error);
  if (directMessage) {
    return directMessage;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}
