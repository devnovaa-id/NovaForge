import type { Writable } from "node:stream";
import { stdout as defaultOutput } from "node:process";

export interface TerminalUIOptions {
  output?: Writable;
  interactive?: boolean;
  quiet?: boolean;
  frames?: string[];
  interval?: number;
}

function isTTY(output: Writable) { return Boolean((output as NodeJS.WriteStream).isTTY); }

export class Spinner {
  private timer?: NodeJS.Timeout;
  private frame = 0;
  private running = false;
  constructor(private readonly message: string, private readonly options: Required<Pick<TerminalUIOptions, "output" | "interactive" | "quiet" | "frames" | "interval">>) {}

  start() {
    if (this.running || this.options.quiet) return this;
    this.running = true;
    if (!this.options.interactive) return this;
    this.render();
    this.timer = setInterval(() => { this.frame++; this.render(); }, this.options.interval);
    return this;
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = undefined; this.running = false; if (this.options.interactive) this.clear(); return this; }
  succeed(message = this.message) { this.stop(); this.write(`✓ ${message}\n`); return this; }
  fail(message = this.message) { this.stop(); this.write(`✖ ${message}\n`); return this; }
  info(message = this.message) { this.stop(); this.write(`• ${message}\n`); return this; }
  private render() { this.write(`\r${this.options.frames[this.frame % this.options.frames.length]} ${this.message}`); }
  private clear() { this.write("\r\x1b[2K"); }
  private write(value: string) { if (!this.options.quiet) this.options.output.write(value); }
}

export class ProgressBar {
  private current = 0;
  constructor(private readonly total: number, private readonly label: string, private readonly options: Required<Pick<TerminalUIOptions, "output" | "interactive" | "quiet">>, private readonly width = 24) {}
  update(value: number, label = this.label) { this.current = Math.max(0, Math.min(this.total, value)); if (this.options.interactive && !this.options.quiet) this.render(label); return this; }
  increment(amount = 1) { return this.update(this.current + amount); }
  complete(label = this.label) { this.current = this.total; if (this.options.interactive && !this.options.quiet) { this.render(label); this.options.output.write("\n"); } return this; }
  private render(label: string) { const ratio = this.total ? this.current / this.total : 1; const filled = Math.round(ratio * this.width); this.options.output.write(`\r${label} [${"█".repeat(filled)}${"░".repeat(this.width - filled)}] ${Math.round(ratio * 100)}%`); }
}

export class TerminalUI {
  readonly interactive: boolean;
  private readonly options: Required<Pick<TerminalUIOptions, "output" | "quiet" | "frames" | "interval">>;
  constructor(options: TerminalUIOptions = {}) {
    const output = options.output ?? defaultOutput;
    this.interactive = options.interactive ?? isTTY(output);
    this.options = { output, quiet: options.quiet ?? false, frames: options.frames ?? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], interval: options.interval ?? 80 };
  }
  spinner(message: string) { return new Spinner(message, { ...this.options, interactive: this.interactive }); }
  progress(total: number, label = "Progress") { if (total < 0) throw new Error("Progress total must not be negative"); return new ProgressBar(total, label, { output: this.options.output, interactive: this.interactive, quiet: this.options.quiet }); }
}

export function createTerminalUI(options?: TerminalUIOptions): TerminalUI { return new TerminalUI(options); }
