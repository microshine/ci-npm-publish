/** Options shared by the greeting helpers. */
export interface GreetingOptions {
  /** Greeting prefix; omitted or blank values use "Hello". */
  prefix?: string;
  /** Text appended after the name, used as-is; defaults to "!". */
  suffix?: string;
  /** Name used for omitted or blank input; omitted or blank values use "world". */
  fallbackName?: string;
  /** Text between the prefix and name, used as-is; defaults to ", ". */
  separator?: string;
}

function normalizeOptions({
  prefix = "Hello",
  suffix = "!",
  fallbackName = "world",
  separator = ", ",
}: GreetingOptions = {}): Required<GreetingOptions> {
  return {
    prefix: prefix.trim() || "Hello",
    suffix,
    fallbackName: fallbackName.trim() || "world",
    separator,
  };
}

function formatGreeting(name = "", { prefix, suffix, fallbackName, separator }: Required<GreetingOptions>): string {
  return `${prefix}${separator}${name.trim() || fallbackName}${suffix}`;
}

/** Return a greeting; omitted or blank names use the configured fallback name. */
export function greet(name = "", options?: GreetingOptions): string {
  return formatGreeting(name, normalizeOptions(options));
}

/** Create a reusable greeting function that snapshots the options when it is created. */
export function createGreeter(options?: GreetingOptions): (name?: string) => string {
  const normalizedOptions = normalizeOptions(options);
  return (name) => formatGreeting(name, normalizedOptions);
}

/** Greet every own array position in order, using the fallback for holes even when an inherited value exists. */
export function greetMany(names: readonly string[], options?: GreetingOptions): string[] {
  const normalizedOptions = normalizeOptions(options);
  return Array.from({ length: names.length }, (_, index) =>
    formatGreeting(Object.hasOwn(names, index) ? names[index] : undefined, normalizedOptions),
  );
}
