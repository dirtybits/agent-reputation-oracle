export class CliError extends Error {
  readonly exitCode: number;
  readonly data?: unknown;

  constructor(message: string, opts?: { exitCode?: number; data?: unknown }) {
    super(message);
    this.name = "CliError";
    this.exitCode = opts?.exitCode ?? 1;
    this.data = opts?.data;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return "Unknown error";
}
