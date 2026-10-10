# @devnovaa-id/novaforge-testing

Run NovaForge CLIs in-process and capture output.

```ts
import { runCLI } from "@devnovaa-id/novaforge-testing";
const result = await runCLI(cli, ["hello", "Key"]);
// result.exitCode, result.stdout, result.stderr
```
