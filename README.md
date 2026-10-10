# NovaForge

**Build Powerful CLIs. Ship Better Tools.**

NovaForge is the DevNova-ID toolkit for building professional Node.js CLIs. The first release focuses on a small, dependency-free command engine: nested commands, positional arguments, flags, validation, and generated help.

## Quick start

```ts
import { createCLI } from "@devnovaa-id/novaforge-core";

const cli = createCLI({ name: "nova", version: "0.1.0", description: "DevNova-ID developer toolkit" });

cli.command("hello <name>")
  .description("Say hello to a developer")
  .option("--uppercase", "Print uppercase output")
  .action(({ args, options, ui }) => {
    const message = `Hello, ${args.name}!`;
    ui.log(options.uppercase ? message.toUpperCase() : message);
  });

await cli.run();
```

```bash
nova hello Key
nova hello Key --uppercase
nova --help
```

## Terminal UI

`@devnovaa-id/novaforge-terminal-ui` provides TTY-aware spinners and progress bars:

```ts
import { createTerminalUI } from "@devnovaa-id/novaforge-terminal-ui";

const ui = createTerminalUI();
const spinner = ui.spinner("Deploying...").start();
await deploy();
spinner.succeed("Deployment complete");

const progress = ui.progress(3, "Uploading");
progress.increment();
progress.increment(2).complete();
```

The UI automatically avoids animated output in CI/non-TTY environments and supports `quiet` mode.

## Interactive prompts

The `@devnovaa-id/novaforge-prompt` package provides TTY-aware prompts:

```ts
import { createPrompt } from "@devnovaa-id/novaforge-prompt";

const prompt = createPrompt({ yes: process.argv.includes("--yes") });
const name = await prompt.inputText("Project name", "my-app");
const confirmed = await prompt.confirm("Continue?", true);
const template = await prompt.select("Template", [
  { label: "Node", value: "node" },
  { label: "React", value: "react" },
]);
prompt.close();
```

When stdin/stdout is not a TTY, prompts return defaults instead of blocking CI.

## Plugins

Plugins can register commands and lifecycle hooks without changing the core CLI:

```ts
cli.use({
  name: "doctor",
  setup({ command, hooks }) {
    command("doctor").action(({ ui }) => ui.success("Environment ready"));
    hooks.beforeCommand(() => console.log("starting"));
  },
});
```

Plugin setup may be asynchronous. Duplicate plugin names are rejected.

## Testing CLIs

Use `@devnovaa-id/novaforge-testing` to run commands in-process:

```ts
import { runCLI } from "@devnovaa-id/novaforge-testing";

const result = await runCLI(cli, ["hello", "Key"]);
console.log(result.exitCode, result.stdout, result.stderr);
```

## v0.2 typed options

Options can now validate and convert values:

```ts
cli.command("check")
  .option("--port <port>", "Port", {
    type: "number",
    validate: (value) => Number(value) > 0,
  })
  .option("--mode <mode>", "Mode", { choices: ["fast", "safe"] });
```

## Status

Output helpers are available for terminal and automation use:

```ts
ui.success("Deployment complete");
ui.table([{ name: "api", status: "ready" }]);
ui.json({ ok: true });
```

Use `--json` for machine-readable output or `--quiet` to suppress normal output. Configuration is available with predictable precedence: CLI flags > environment variables > config files > defaults.

```ts
const cli = createCLI({
  name: "nova",
  config: {
    files: ["nova.json"],
    envPrefix: "NOVA_",
  },
});
```

Config files currently use JSON. Missing files are ignored, while malformed files produce a clear error.

Lifecycle hooks are available in the core package:

```ts
const cli = createCLI({
  name: "nova",
  hooks: {
    beforeCommand: ({ command }) => console.log(`Starting ${command.name}`),
    afterCommand: ({ command }) => console.log(`Finished ${command.name}`),
    onError: (error) => console.error(error),
  },
});
```

Hooks run around the command action and `onError` receives failures from parsing, hooks, or actions. Middleware, plugins, prompts, formatters, and configuration are deliberately planned for later milestones; the public API may change before 1.0.

```bash
npm install
npm run build
```

## License

MIT © DevNova-ID
