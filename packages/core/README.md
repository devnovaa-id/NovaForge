# @devnovaa-id/novaforge-core

The dependency-free command engine for NovaForge CLIs.

```ts
import { createCLI } from "@devnovaa-id/novaforge-core";

const cli = createCLI({ name: "nova", version: "0.1.0" });
cli.command("hello <name>")
  .option("--uppercase")
  .action(({ args, options, ui }) => ui.log(options.uppercase ? `HELLO, ${args.name}!` : `Hello, ${args.name}!`));

await cli.run();
```

Supports nested commands, options, config, hooks, plugins, and machine-readable output.
