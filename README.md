<div align="center">

# NovaForge

### Build Powerful CLIs. Ship Better Tools.

A modular TypeScript toolkit for building professional Node.js command-line applications.

[![CI](https://github.com/devnovaa-id/NovaForge/actions/workflows/ci.yml/badge.svg)](https://github.com/devnovaa-id/NovaForge/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@devnovaa-id/novaforge-core?logo=npm&logoColor=white&label=core)](https://www.npmjs.com/package/@devnovaa-id/novaforge-core)
[![npm downloads](https://img.shields.io/npm/dm/@devnovaa-id/novaforge-core?logo=npm&logoColor=white)](https://www.npmjs.com/package/@devnovaa-id/novaforge-core)
[![Node.js](https://img.shields.io/node/v/@devnovaa-id/novaforge-core?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/github/license/devnovaa-id/NovaForge)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/devnovaa-id/NovaForge?style=flat&logo=github)](https://github.com/devnovaa-id/NovaForge/stargazers)

[Core](https://www.npmjs.com/package/@devnovaa-id/novaforge-core) · [Testing](https://www.npmjs.com/package/@devnovaa-id/novaforge-testing) · [Prompt](https://www.npmjs.com/package/@devnovaa-id/novaforge-prompt) · [Terminal UI](https://www.npmjs.com/package/@devnovaa-id/novaforge-terminal-ui)

</div>

> **DevNova-ID open-source project** — build, extend, and automate developer tools.

NovaForge is an open-source project by **DevNova-ID**. It provides a reusable foundation for developer tools: command registration, nested commands, typed options, configuration, lifecycle hooks, plugins, machine-readable output, testing utilities, prompts, and terminal UI.

NovaForge is not an application-specific CLI and it is not only an argument parser. It is a small CLI platform that lets every DevNova-ID tool share the same conventions and developer experience.

## At a glance

| | |
| --- | --- |
| **Runtime** | Node.js 20+ |
| **Language** | TypeScript |
| **Package manager** | npm |
| **Release** | `0.2.0` |
| **License** | MIT |
| **Repository** | [devnovaa-id/NovaForge](https://github.com/devnovaa-id/NovaForge) |

## Why NovaForge?

- Build commands once and compose them into larger tools.
- Keep human-friendly terminal output and CI-friendly automation in the same CLI.
- Extend a CLI with plugins instead of modifying its core.
- Test commands in-process without spawning subprocesses.
- Keep interactive features optional and safe in non-TTY environments.
- Use focused packages instead of shipping one large runtime dependency.

## Packages

| Package | Purpose |
| --- | --- |
| [`@devnovaa-id/novaforge-core`](./packages/core) | Command engine, parser, help, config, hooks, plugins, and output helpers |
| [`@devnovaa-id/novaforge-testing`](./packages/testing) | In-process CLI runner with captured output and exit codes |
| [`@devnovaa-id/novaforge-prompt`](./packages/prompt) | TTY-aware input, confirmation, and selection prompts |
| [`@devnovaa-id/novaforge-terminal-ui`](./packages/terminal-ui) | TTY-aware spinners and progress bars |

All packages are currently published as `0.2.0`.

## Installation

Install the core package:

```bash
npm install @devnovaa-id/novaforge-core
```

Install optional capabilities as needed:

```bash
npm install @devnovaa-id/novaforge-testing
npm install @devnovaa-id/novaforge-prompt
npm install @devnovaa-id/novaforge-terminal-ui
```

Requires Node.js 20 or newer.

## Quick start

Create a CLI with a command, positional argument, and typed option:

```ts
import { createCLI } from "@devnovaa-id/novaforge-core";

const cli = createCLI({
  name: "nova",
  version: "0.2.0",
  description: "DevNova-ID developer toolkit",
});

cli.command("hello <name>")
  .description("Say hello to a developer")
  .option("--uppercase", "Print uppercase output")
  .action(({ args, options, ui }) => {
    const message = `Hello, ${args.name}!`;
    ui.log(options.uppercase ? message.toUpperCase() : message);
  });

await cli.run();
```

Example usage:

```bash
nova hello Key
# Hello, Key!

nova hello Key --uppercase
# HELLO, KEY!

nova --help
nova --version
```

## Core capabilities

### Nested commands

Register a command tree with a single declaration:

```ts
cli.command("project create <name>")
  .description("Create a new project")
  .option("--template <template>", "Project template")
  .action(({ args, options, ui }) => {
    ui.log(`Creating ${args.name} from ${options.template ?? "default"}`);
  });
```

This produces a command such as:

```bash
nova project create my-app --template node
```

### Typed options and validation

Convert values and reject invalid input before the action runs:

```ts
cli.command("check")
  .option("--port <port>", "Port number", {
    type: "number",
    validate: (value) => Number(value) > 0 || "Port must be positive",
  })
  .option("--mode <mode>", "Execution mode", {
    choices: ["fast", "safe"],
  })
  .action(({ options, ui }) => {
    ui.log(`Mode: ${options.mode}, port: ${options.port}`);
  });
```

Supported option features:

- Boolean flags
- Value options
- Short aliases such as `-u, --uppercase`
- `string`, `number`, and `boolean` conversion
- Default values
- Allowed choices
- Custom validation functions
- Custom parsers

### Configuration

Configuration follows a predictable precedence order:

```text
CLI flags > environment variables > config files > defaults
```

```ts
const cli = createCLI({
  name: "nova",
  config: {
    files: ["nova.json"],
    envPrefix: "NOVA_",
    values: { mode: "safe" },
  },
});
```

Config files currently use JSON. Missing files are ignored; malformed files produce an error. With `envPrefix: "NOVA_"`, for example, `NOVA_MODE` maps to the `mode` option.

### Output for humans and machines

```ts
ui.success("Deployment complete");
ui.table([{ name: "api", status: "ready" }]);
ui.json({ ok: true });
```

Use global output flags in scripts and CI:

```bash
nova deploy --json
nova deploy --quiet
```

- Default output is human-readable.
- `--json` emits machine-readable JSON for normal output helpers.
- `--quiet` suppresses normal output.
- Commands return a consistent numeric exit code (`0` for success, `1` for failure).

### Lifecycle hooks

Hooks are useful for logging, authentication, telemetry, cleanup, and policy checks:

```ts
const cli = createCLI({
  name: "nova",
  hooks: {
    beforeCommand: ({ command }) => {
      console.log(`Starting ${command.name}`);
    },
    afterCommand: ({ command }) => {
      console.log(`Finished ${command.name}`);
    },
    onError: (error) => {
      console.error("Command failed:", error);
    },
  },
});
```

## Plugins

Plugins can register commands and lifecycle hooks without changing the core CLI:

```ts
cli.use({
  name: "doctor",
  setup({ command, hooks }) {
    command("doctor")
      .description("Check the development environment")
      .action(({ ui }) => ui.success("Environment ready"));

    hooks.beforeCommand(({ command }) => {
      console.log(`Plugin preparing ${command.name}`);
    });
  },
});
```

Plugin setup may be asynchronous. Duplicate plugin names are rejected.

## Interactive prompts

Install the optional prompt package:

```bash
npm install @devnovaa-id/novaforge-prompt
```

```ts
import { createPrompt } from "@devnovaa-id/novaforge-prompt";

const prompt = createPrompt({
  yes: process.argv.includes("--yes"),
});

const name = await prompt.inputText("Project name", "my-app");
const confirmed = await prompt.confirm("Continue?", true);
const template = await prompt.select("Template", [
  { label: "Node", value: "node" },
  { label: "React", value: "react" },
]);

prompt.close();
```

Prompts automatically return defaults when stdin/stdout is not a TTY, so commands do not block in CI. The `yes` option can be used for approval-oriented automation.

## Terminal UI

Install the optional terminal UI package:

```bash
npm install @devnovaa-id/novaforge-terminal-ui
```

```ts
import { createTerminalUI } from "@devnovaa-id/novaforge-terminal-ui";

const ui = createTerminalUI();
const spinner = ui.spinner("Deploying...").start();

try {
  await deploy();
  spinner.succeed("Deployment complete");
} catch (error) {
  spinner.fail("Deployment failed");
  throw error;
}

const progress = ui.progress(3, "Uploading");
progress.increment();
progress.increment(2).complete();
```

Animated output is disabled automatically in non-TTY environments and can be suppressed with `quiet` mode.

## Testing a CLI

Install the testing package:

```bash
npm install --save-dev @devnovaa-id/novaforge-testing
```

Run a CLI in-process and inspect its result:

```ts
import { runCLI } from "@devnovaa-id/novaforge-testing";

const result = await runCLI(cli, ["hello", "Key"]);

console.log(result.exitCode); // 0
console.log(result.stdout);   // Hello, Key!
console.log(result.stderr);   // ""
```

`runCLI()` captures stdout, stderr, output lines, and the exit code without spawning a child process.

## Development

Clone the repository and install dependencies with npm:

```bash
git clone https://github.com/devnovaa-id/NovaForge.git
cd NovaForge
npm install
```

Available checks:

```bash
npm test
npm run typecheck
npm run build
npm run pack:check
```

The test suite covers command execution, nested commands, options, validation, configuration, hooks, plugins, output modes, testing utilities, and terminal UI behavior.

## Project status

NovaForge `0.2.0` is an actively developed foundation. The public API may continue to evolve before `1.0.0`. Breaking changes will be documented in the changelog and reflected in versioning.

See [`CHANGELOG.md`](./CHANGELOG.md) for release history and the package-level READMEs for focused API references.

## Contributing

Contributions, bug reports, and ideas are welcome. Please open an issue or pull request in the [GitHub repository](https://github.com/devnovaa-id/NovaForge).

## License

MIT © DevNova-ID
