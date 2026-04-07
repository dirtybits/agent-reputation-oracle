import { CliError, getErrorMessage } from "./errors.js";

function printLines(value: string | string[]) {
  for (const line of Array.isArray(value) ? value : [value]) {
    console.log(line);
  }
}

export async function runCommand<T>(
  options: { json?: boolean },
  action: () => Promise<T>,
  renderText: (result: T) => string | string[]
): Promise<void> {
  try {
    const result = await action();
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    printLines(renderText(result));
  } catch (error: unknown) {
    const exitCode = error instanceof CliError ? error.exitCode : 1;
    const message = getErrorMessage(error);
    if (options.json) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            error: message,
            ...(error instanceof CliError && error.data !== undefined
              ? { data: error.data }
              : {}),
          },
          null,
          2
        )
      );
    } else {
      console.error(`Error: ${message}`);
    }
    process.exitCode = exitCode;
  }
}
