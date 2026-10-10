import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runCLI } from "@devnovaa-id/novaforge-testing";
import { createCLI } from "../packages/core/src/index.ts";

function makeCLI() {
  const output: string[] = [];
  const errors: string[] = [];
  const cli = createCLI({
    name: "nova",
    version: "0.1.0",
    ui: {
      log: (...values) => output.push(values.join(" ")),
      error: (...values) => errors.push(values.join(" ")),
    },
  });
  return { cli, output, errors };
}

test("plugins can register commands and lifecycle hooks", async () => {
  const { cli, output } = makeCLI();
  const events: string[] = [];
  cli.use({
    name: "greetings",
    async setup({ command, hooks }) {
      command("hello <name>").action(({ args, ui }) => ui.log(`Hi ${args.name}`));
      hooks.beforeCommand(() => events.push("before"));
      hooks.afterCommand(() => events.push("after"));
    },
  });

  assert.equal(await cli.run(["hello", "Key"]), 0);
  assert.deepEqual(output, ["Hi Key"]);
  assert.deepEqual(events, ["before", "after"]);
});

test("rejects duplicate plugin names", () => {
  const { cli } = makeCLI();
  const plugin = { name: "same", setup: () => undefined };
  cli.use(plugin);
  assert.throws(() => cli.use(plugin), /already registered/);
});

test("testing toolkit captures stdout and exit codes", async () => {
  const cli = createCLI({ name: "nova" });
  cli.command("hello <name>").action(({ args, ui }) => ui.log(`Hello, ${args.name}!`));

  const result = await runCLI(cli, ["hello", "Key"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stdout, "Hello, Key!");
  assert.equal(result.stderr, "");
});

test("runs a command with positional arguments and boolean options", async () => {
  const { cli, output } = makeCLI();
  cli.command("hello <name>")
    .option("--uppercase", "Uppercase output")
    .action(({ args, options, ui }) => {
      const message = `Hello, ${args.name}!`;
      ui.log(options.uppercase ? message.toUpperCase() : message);
    });

  assert.equal(await cli.run(["hello", "Key", "--uppercase"]), 0);
  assert.deepEqual(output, ["HELLO, KEY!"]);
});

test("supports nested commands and value options", async () => {
  const { cli, output } = makeCLI();
  cli.command("project create <name>")
    .option("--template <template>", "Template name")
    .action(({ args, options, ui }) => ui.log(`${args.name}:${options.template}`));

  assert.equal(await cli.run(["project", "create", "demo", "--template", "node"]), 0);
  assert.deepEqual(output, ["demo:node"]);
});

test("generates help and reports missing required arguments", async () => {
  const { cli, output, errors } = makeCLI();
  cli.command("hello <name>").description("Say hello").action(() => undefined);

  assert.equal(await cli.run(["hello", "--help"]), 0);
  assert.match(output[0], /Usage: nova hello <name>/);
  assert.equal(await cli.run(["hello"]), 1);
  assert.deepEqual(errors, ["Missing argument: name"]);
});

test("runs lifecycle hooks in order", async () => {
  const events: string[] = [];
  const cli = createCLI({
    name: "nova",
    hooks: {
      beforeCommand: ({ args }) => events.push(`before:${args.name}`),
      afterCommand: ({ args }) => events.push(`after:${args.name}`),
      onError: (error) => events.push(`error:${(error as Error).message}`),
    },
  });
  cli.command("hello <name>").action(({ args }) => events.push(`action:${args.name}`));

  assert.equal(await cli.run(["hello", "Key"]), 0);
  assert.deepEqual(events, ["before:Key", "action:Key", "after:Key"]);
});

test("calls onError when a hook or action fails", async () => {
  const errors: string[] = [];
  const cli = createCLI({
    name: "nova",
    hooks: { onError: (error) => errors.push((error as Error).message) },
  });
  cli.command("fail").action(() => { throw new Error("boom"); });

  assert.equal(await cli.run(["fail"]), 1);
  assert.deepEqual(errors, ["boom"]);
});

test("loads config with CLI > environment > file precedence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "novaforge-"));
  const file = join(directory, "nova.json");
  writeFileSync(file, JSON.stringify({ template: "file" }));
  const previous = process.env.NOVA_TEMPLATE;
  process.env.NOVA_TEMPLATE = "environment";
  try {
    const output: string[] = [];
    const cli = createCLI({
      name: "nova",
      config: { files: [file], envPrefix: "NOVA_" },
      ui: { log: (...values) => output.push(values.join(" ")) },
    });
    cli.command("project")
      .option("--template <name>")
      .action(({ options, ui }) => ui.log(String(options.template)));

    assert.equal(await cli.run(["project", "--template", "cli"]), 0);
    assert.equal(await cli.run(["project"]), 0);
    assert.deepEqual(output, ["cli", "environment"]);

    const fileCLI = createCLI({
      name: "nova",
      config: { files: [file] },
      ui: { log: (...values) => output.push(values.join(" ")) },
    });
    fileCLI.command("project").option("--template <name>").action(({ options, ui }) => ui.log(String(options.template)));
    assert.equal(await fileCLI.run(["project"]), 0);
    assert.equal(output.at(-1), "file");
  } finally {
    if (previous === undefined) delete process.env.NOVA_TEMPLATE;
    else process.env.NOVA_TEMPLATE = previous;
  }
});

test("supports JSON and table output with quiet mode", async () => {
  const output: string[] = [];
  const cli = createCLI({
    name: "nova",
    ui: {
      log: (...values) => output.push(values.join(" ")),
      json: (value) => output.push(JSON.stringify(value)),
      table: (rows) => output.push(rows.map((row) => JSON.stringify(row)).join("\n")),
    },
  });
  cli.command("report").action(({ ui }) => {
    ui.json({ ok: true });
    ui.table([{ name: "nova", status: "ok" }]);
  });

  assert.equal(await cli.run(["report"]), 0);
  assert.equal(output[0], '{"ok":true}');
  assert.match(output[1], /name/);
  output.length = 0;
  assert.equal(await cli.run(["report", "--quiet"]), 0);
  assert.deepEqual(output, []);
});

test("supports version output and option aliases", async () => {
  const { cli, output } = makeCLI();
  cli.command("hello").option("-u, --uppercase").action(({ options, ui }) => ui.log(String(options.uppercase)));

  assert.equal(await cli.run(["--version"]), 0);
  assert.equal(await cli.run(["hello", "-u"]), 0);
  assert.deepEqual(output, ["0.1.0", "true"]);
});
