import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import { createTerminalUI } from "../packages/terminal-ui/src/index.ts";

function capture() {
  let value = "";
  const output = new Writable({ write(chunk, _encoding, callback) { value += chunk.toString(); callback(); } });
  return { output, value: () => value };
}

test("spinner works without a TTY and supports success", () => {
  const stream = capture();
  createTerminalUI({ output: stream.output, interactive: false }).spinner("Deploy").start().succeed("Done");
  assert.equal(stream.value(), "✓ Done\n");
});

test("progress remains silent without a TTY and quiet mode suppresses output", () => {
  const stream = capture();
  const ui = createTerminalUI({ output: stream.output, interactive: false, quiet: true });
  ui.progress(10).increment(5).complete();
  ui.spinner("Work").start().info("Skipped");
  assert.equal(stream.value(), "");
});
