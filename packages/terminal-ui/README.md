# @devnovaa-id/novaforge-terminal-ui

TTY-aware spinner and progress UI.

```ts
import { createTerminalUI } from "@devnovaa-id/novaforge-terminal-ui";
const ui = createTerminalUI();
const spinner = ui.spinner("Deploying...").start();
await deploy();
spinner.succeed("Deployment complete");
```

Animated output is disabled automatically when the stream is not a TTY.
