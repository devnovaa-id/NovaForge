import { inspect } from "node:util";
import { existsSync, readFileSync } from "node:fs";

export type OptionValue = string | number | boolean | undefined;
export type Options = Record<string, OptionValue>;
export type Args = Record<string, string | boolean>;

export type OutputFormat = "human" | "json";

export interface TableRow {
  [key: string]: unknown;
}

export interface UI {
  log(...values: unknown[]): void;
  info(...values: unknown[]): void;
  warn(...values: unknown[]): void;
  error(...values: unknown[]): void;
  success(...values: unknown[]): void;
  json(value: unknown): void;
  table(rows: TableRow[]): void;
}

export interface CommandContext {
  args: Args;
  options: Options;
  ui: UI;
  command: Command;
}

export type Action = (context: CommandContext) => void | Promise<void>;
export type OptionParser = (value: string) => OptionValue;
export type OptionType = "string" | "number" | "boolean";
export interface OptionConfig {
  default?: OptionValue;
  parser?: OptionParser;
  type?: OptionType;
  choices?: string[];
  validate?: (value: OptionValue) => boolean | string;
}
export type BeforeCommandHook = (context: CommandContext) => void | Promise<void>;
export type AfterCommandHook = (context: CommandContext) => void | Promise<void>;
export type ErrorHook = (error: unknown, context?: CommandContext) => void | Promise<void>;

export interface CLIHooks {
  beforeCommand?: BeforeCommandHook;
  afterCommand?: AfterCommandHook;
  onError?: ErrorHook;
}

export interface PluginContext {
  cli: CLI;
  command(usage: string): Command;
  hooks: {
    beforeCommand(hook: BeforeCommandHook): void;
    afterCommand(hook: AfterCommandHook): void;
    onError(hook: ErrorHook): void;
  };
}

export interface NovaForgePlugin {
  name: string;
  setup(context: PluginContext): void | Promise<void>;
}

export interface ConfigOptions {
  /** Config files are read in order; later files override earlier files. */
  files?: string[];
  /** Environment variables use this prefix, e.g. NOVA_TEMPLATE. */
  envPrefix?: string;
  /** Values supplied by the host application, below env and CLI flags. */
  values?: Record<string, OptionValue>;
}

export interface CLIOptions {
  name: string;
  version?: string;
  description?: string;
  ui?: Partial<UI>;
  hooks?: CLIHooks;
  config?: ConfigOptions;
  output?: OutputFormat;
}

interface OptionDefinition {
  name: string;
  short?: string;
  description: string;
  takesValue: boolean;
  defaultValue?: OptionValue;
  parser?: OptionParser;
  type?: OptionType;
  choices?: string[];
  validate?: (value: OptionValue) => boolean | string;
}

interface ArgumentDefinition { name: string; required: boolean; variadic: boolean }

function renderTable(rows: TableRow[]): string {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const widths = columns.map((column) => Math.max(column.length, ...rows.map((row) => String(row[column] ?? "").length)));
  const line = (row: TableRow) => columns.map((column, index) => String(row[column] ?? "").padEnd(widths[index])).join("  ");
  return [line(Object.fromEntries(columns.map((column) => [column, column]))), ...rows.map(line)].join("\n");
}

const defaultUI: UI = {
  log: (...values) => console.log(...values),
  info: (...values) => console.log(...values),
  warn: (...values) => console.warn(...values),
  error: (...values) => console.error(...values),
  success: (...values) => console.log(...values),
  json: (value) => console.log(JSON.stringify(value)),
  table: (rows) => console.log(renderTable(rows)),
};

function usageParts(usage: string) {
  return usage.trim().split(/\s+/).filter(Boolean);
}

function parseCommandParts(usage: string): { parts: string[]; args: ArgumentDefinition[] } {
  const parts = usageParts(usage).filter((part) => !/^[[<]/.test(part));
  const args: ArgumentDefinition[] = [];
  for (const token of usageParts(usage)) {
    const match = token.match(/^[<[]([^>\]]+)[>\]]$/);
    if (match) args.push({ name: match[1].replace(/\.\.\.$/, ""), required: token[0] === "<", variadic: match[1].endsWith("...") });
  }
  return { parts, args };
}

export class Command {
  readonly usage: string;
  readonly name: string;
  readonly aliases: string[] = [];
  readonly children: Command[] = [];
  descriptionText = "";
  private actionHandler?: Action;
  private readonly options: OptionDefinition[] = [];
  private readonly argumentDefinitions: ArgumentDefinition[];

  constructor(usage: string, private readonly parent?: Command) {
    this.usage = usage;
    const parsed = parseCommandParts(usage);
    this.name = parsed.parts[0] ?? usage;
    this.argumentDefinitions = parsed.args;
  }

  description(value: string) { this.descriptionText = value; return this; }
  alias(...values: string[]) { this.aliases.push(...values); return this; }

  option(flags: string, description = "", config: OptionConfig = {}) {
    const names = flags.split(/[, ]+/).filter(Boolean);
    const long = names.find((n) => n.startsWith("--"));
    const short = names.find((n) => /^-[^-]/.test(n));
    if (!long && !short) throw new Error(`Invalid option: ${flags}`);
    const raw = long ?? short!;
    const takesValue = /(?:\s+|=)[<[A-Za-z]/.test(flags);
    const clean = raw.replace(/^--?/, "").replace(/[ <].*$/, "");
    this.options.push({ name: clean, short: short?.replace(/^-/, ""), description, takesValue, defaultValue: config.default, parser: config.parser, type: config.type, choices: config.choices, validate: config.validate });
    return this;
  }

  action(handler: Action) { this.actionHandler = handler; return this; }

  command(usage: string) {
    // A single declaration can describe a nested command (for example,
    // `api test <url>`), while still returning the leaf for fluent setup.
    const tokens = usageParts(usage);
    const literals: string[] = [];
    const argumentTokens: string[] = [];
    for (const token of tokens) {
      if (/^[<[]/.test(token)) argumentTokens.push(token);
      else if (argumentTokens.length === 0) literals.push(token);
      else throw new Error(`Arguments must come after command names: ${usage}`);
    }
    let owner: Command = this;
    for (const literal of literals) {
      let child = owner.children.find((candidate) => candidate.name === literal);
      if (!child) {
        child = new Command(literal, owner);
        owner.children.push(child);
      }
      owner = child;
    }
    if (argumentTokens.length) {
      // Replace the leaf with an argument-aware command when necessary.
      const leaf = new Command(`${owner.name} ${argumentTokens.join(" ")}`, owner.parent);
      leaf.descriptionText = owner.descriptionText;
      const position = owner.parent?.children.indexOf(owner) ?? -1;
      if (owner.parent && position >= 0) owner.parent.children[position] = leaf;
      owner = leaf;
    }
    return owner;
  }

  findChild(token: string) { return this.children.find((child) => child.name === token || child.aliases.includes(token)); }

  help(path: string[] = []): string {
    const heading = path.length ? path.join(" ") : this.name;
    const lines = [`Usage: ${heading}${this.argumentDefinitions.map((arg) => ` ${arg.required ? `<${arg.name}>` : `[${arg.name}]`}`).join("")}`];
    if (this.descriptionText) lines.push(`\n${this.descriptionText}`);
    if (this.children.length) {
      lines.push("\nCommands:");
      for (const child of this.children) lines.push(`  ${child.usage.padEnd(24)} ${child.descriptionText}`);
    }
    if (this.options.length) {
      lines.push("\nOptions:");
      for (const option of this.options) lines.push(`  ${option.short ? `-${option.short}, ` : "    "}--${option.name}${option.takesValue ? " <value>" : ""}${option.description ? `  ${option.description}` : ""}`);
    }
    return lines.join("\n");
  }

  get allOptions() { return this.options; }
  get argsDefinition() { return this.argumentDefinitions; }
  get handler() { return this.actionHandler; }
}

export interface CLI {
  readonly root: Command;
  command(usage: string): Command;
  use(plugin: NovaForgePlugin): CLI;
  run(argv?: string[]): Promise<number>;
}

class NovaCLI implements CLI {
  readonly root: Command;
  private readonly ui: UI;
  private readonly plugins: NovaForgePlugin[] = [];
  private readonly pluginBefore: BeforeCommandHook[] = [];
  private readonly pluginAfter: AfterCommandHook[] = [];
  private readonly pluginErrors: ErrorHook[] = [];
  private readonly pendingPlugins: Promise<void>[] = [];
  private outputFormat: OutputFormat;
  private quiet = false;
  constructor(private readonly config: CLIOptions) {
    this.root = new Command(config.name);
    this.root.description(config.description ?? "");
    this.outputFormat = config.output ?? "human";
    const base = { ...defaultUI, ...config.ui };
    const print = (values: unknown[], fallback: (...values: any[]) => void) => {
      if (this.quiet) return;
      if (this.outputFormat === "json") console.log(JSON.stringify(values.length === 1 ? values[0] : values));
      else fallback(...values);
    };
    this.ui = {
      ...base,
      log: (...values) => print(values, base.log),
      info: (...values) => print(values, base.info),
      success: (...values) => print(values, base.success),
      json: (value) => print([value], base.json),
      table: (rows) => print([rows], base.table),
    };
  }
  command(usage: string) { return this.root.command(usage); }

  use(plugin: NovaForgePlugin) {
    if (!plugin.name.trim()) throw new Error("Plugin name is required");
    if (this.plugins.some((registered) => registered.name === plugin.name)) throw new Error(`Plugin already registered: ${plugin.name}`);
    this.plugins.push(plugin);
    const context: PluginContext = {
      cli: this,
      command: (usage) => this.command(usage),
      hooks: {
        beforeCommand: (hook) => this.pluginBefore.push(hook),
        afterCommand: (hook) => this.pluginAfter.push(hook),
        onError: (hook) => this.pluginErrors.push(hook),
      },
    };
    this.pendingPlugins.push(Promise.resolve(plugin.setup(context)));
    return this;
  }

  async run(argv = process.argv.slice(2)): Promise<number> {
    let failedContext: CommandContext | undefined;
    try {
      await Promise.all(this.pendingPlugins);
      this.outputFormat = argv.includes("--json") ? "json" : this.config.output ?? "human";
      this.quiet = argv.includes("--quiet");
      argv = argv.filter((argument) => argument !== "--json" && argument !== "--quiet");
      if (argv.includes("--version") || argv.includes("-v")) { this.ui.log(this.config.version ?? "0.0.0"); return 0; }
      let current = this.root;
      const path = [this.config.name];
      let index = 0;
      while (index < argv.length) {
        const child = current.findChild(argv[index]);
        if (!child) break;
        current = child; path.push(argv[index++]);
      }
      if (argv[index] === "--help" || argv[index] === "-h" || (index === argv.length && !current.handler)) { this.ui.log(current.help(path)); return 0; }
      const configValues = loadConfig(this.config.config);
      const { args, options } = parseInput(argv.slice(index), current, configValues);
      if (options.help) { this.ui.log(current.help(path)); return 0; }
      if (!current.handler) throw new Error(`Unknown command or missing action: ${argv[index] ?? ""}`.trim());
      const context: CommandContext = { args, options, ui: this.ui, command: current };
      failedContext = context;
      await this.config.hooks?.beforeCommand?.(context);
      for (const hook of this.pluginBefore) await hook(context);
      await current.handler(context);
      for (const hook of this.pluginAfter) await hook(context);
      await this.config.hooks?.afterCommand?.(context);
      return 0;
    } catch (error) {
      await this.config.hooks?.onError?.(error, failedContext);
      for (const hook of this.pluginErrors) await hook(error, failedContext);
      this.ui.error(error instanceof Error ? error.message : inspect(error));
      return 1;
    }
  }
}

function parseInput(tokens: string[], command: Command, configValues: Record<string, OptionValue> = {}) {
  const args: Args = {};
  const options: Options = { ...configValues };
  for (const definition of command.allOptions) if (options[definition.name] === undefined && definition.defaultValue !== undefined) options[definition.name] = definition.defaultValue;
  const positional: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "--") { positional.push(...tokens.slice(i + 1)); break; }
    if (token === "--help" || token === "-h") { options.help = true; continue; }
    if (token.startsWith("--")) {
      const [raw, inline] = token.slice(2).split("=", 2);
      if (raw.startsWith("no-") && !findOption(command, raw.slice(3))) { options[raw.slice(3)] = false; continue; }
      const definition = findOption(command, raw);
      if (!definition) throw new Error(`Unknown option: --${raw}`);
      if (definition.takesValue) {
        const value = inline ?? tokens[++i];
        if (value === undefined) throw new Error(`Option --${raw} requires a value`);
        options[definition.name] = validateOption(definition, value);
      } else options[definition.name] = true;
    } else if (token.startsWith("-") && token !== "-") {
      const definition = findOption(command, token.slice(1));
      if (!definition) throw new Error(`Unknown option: ${token}`);
      const value = definition.takesValue ? (tokens[++i] ?? (() => { throw new Error(`Option ${token} requires a value`); })()) : true;
      options[definition.name] = definition.takesValue ? validateOption(definition, String(value)) : value;
    } else positional.push(token);
  }
  for (let i = 0; i < command.argsDefinition.length; i++) {
    const definition = command.argsDefinition[i];
    const value = definition.variadic ? positional.slice(i).join(" ") : positional[i];
    if (value === undefined && definition.required) throw new Error(`Missing argument: ${definition.name}`);
    if (value !== undefined) args[definition.name] = value;
  }
  return { args, options };
}
function findOption(command: Command, name: string) { return command.allOptions.find((option) => option.name === name || option.short === name); }

function validateOption(definition: OptionDefinition, raw: string): OptionValue {
  let value: OptionValue = definition.parser ? definition.parser(raw) : raw;
  if (!definition.parser && definition.type === "number") {
    value = Number(raw);
    if (Number.isNaN(value)) throw new Error(`Option --${definition.name} must be a number`);
  }
  if (!definition.parser && definition.type === "boolean") {
    if (!["true", "false"].includes(raw.toLowerCase())) throw new Error(`Option --${definition.name} must be true or false`);
    value = raw.toLowerCase() === "true";
  }
  if (definition.choices && !definition.choices.includes(String(value))) throw new Error(`Invalid value for --${definition.name}: ${value}. Expected: ${definition.choices.join(", ")}`);
  const result = definition.validate?.(value);
  if (result !== undefined && result !== true) throw new Error(typeof result === "string" ? result : `Invalid value for --${definition.name}`);
  return value;
}

function loadConfig(config: ConfigOptions | undefined): Record<string, OptionValue> {
  if (!config) return {};
  const values: Record<string, OptionValue> = { ...(config.values ?? {}) };
  for (const file of config.files ?? []) {
    if (!existsSync(file)) continue;
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Config file must contain an object: ${file}`);
    Object.assign(values, parsed);
  }
  if (config.envPrefix) {
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(config.envPrefix) && value !== undefined) {
        const name = key.slice(config.envPrefix.length).toLowerCase().replace(/_([a-z])/g, (_, character: string) => character.toUpperCase());
        values[name] = value;
      }
    }
  }
  return values;
}

export function createCLI(options: CLIOptions): CLI { return new NovaCLI(options); }
