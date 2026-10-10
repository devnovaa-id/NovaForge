# @devnovaa-id/novaforge-prompt

TTY-aware prompts for NovaForge CLIs.

```ts
import { createPrompt } from "@devnovaa-id/novaforge-prompt";
const prompt = createPrompt({ yes: process.argv.includes("--yes") });
const name = await prompt.inputText("Project name", "my-app");
const ok = await prompt.confirm("Continue?", true);
prompt.close();
```

Prompts return defaults in non-interactive environments.
