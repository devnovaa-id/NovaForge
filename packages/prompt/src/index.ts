import { createInterface, type Interface } from "node:readline";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import type { Readable, Writable } from "node:stream";

export interface PromptOptions {
  input?: Readable;
  output?: Writable;
  interactive?: boolean;
  yes?: boolean;
}

export interface SelectOption<T> { label: string; value: T }

export class Prompt {
  private readonly input: Readable;
  private readonly output: Writable;
  private readonly interactive: boolean;
  private readonly yes: boolean;
  private readline?: Interface;

  constructor(options: PromptOptions = {}) {
    this.input = options.input ?? defaultInput;
    this.output = options.output ?? defaultOutput;
    this.interactive = options.interactive ?? Boolean((this.input as NodeJS.ReadStream).isTTY && (this.output as NodeJS.WriteStream).isTTY);
    this.yes = options.yes ?? false;
  }

  async inputText(message: string, defaultValue = ""): Promise<string> {
    if (!this.interactive) return defaultValue;
    const answer = await this.ask(`${message}${defaultValue ? ` (${defaultValue})` : ""}: `);
    return answer || defaultValue;
  }

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    if (this.yes) return true;
    if (!this.interactive) return defaultValue;
    const suffix = defaultValue ? "Y/n" : "y/N";
    const answer = (await this.ask(`${message} (${suffix}) `)).toLowerCase();
    if (!answer) return defaultValue;
    if (["y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    return defaultValue;
  }

  async select<T>(message: string, options: SelectOption<T>[], defaultIndex = 0): Promise<T | undefined> {
    if (!options.length) return undefined;
    if (!this.interactive) return options[defaultIndex]?.value;
    this.output.write(`${message}\n${options.map((option, index) => `  ${index + 1}) ${option.label}`).join("\n")}\n`);
    const answer = await this.ask(`Choose [${defaultIndex + 1}]: `);
    const index = answer ? Number(answer) - 1 : defaultIndex;
    return Number.isInteger(index) && index >= 0 && index < options.length ? options[index].value : options[defaultIndex]?.value;
  }

  close() { this.readline?.close(); this.readline = undefined; }

  private ask(question: string): Promise<string> {
    this.readline ??= createInterface({ input: this.input, output: this.output });
    return new Promise((resolve) => this.readline!.question(question, resolve));
  }
}

export function createPrompt(options?: PromptOptions): Prompt { return new Prompt(options); }
