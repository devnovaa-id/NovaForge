import type { CLI } from "@devnovaa-id/novaforge-core";

export interface CLIResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  lines: string[];
}

function stringify(values: unknown[]): string {
  return values.map((value) => typeof value === "string" ? value : JSON.stringify(value)).join(" ");
}

/** Runs a CLI in-process and captures terminal output without spawning a subprocess. */
export async function runCLI(cli: CLI, argv: string[] = []): Promise<CLIResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = (...values) => stdout.push(stringify(values));
  console.info = (...values) => stdout.push(stringify(values));
  console.warn = (...values) => stderr.push(stringify(values));
  console.error = (...values) => stderr.push(stringify(values));
  try {
    const exitCode = await cli.run(argv);
    return { exitCode, stdout: stdout.join("\n"), stderr: stderr.join("\n"), lines: stdout };
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
}
