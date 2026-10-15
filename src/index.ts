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
  /** Text before the name, used as-is; defaults to an empty string. */
  namePrefix?: string;
}

interface NormalizedGreetingOptions {
  opening: string;
  suffix: string;
  fallbackName: string;
}

function normalizeOptions({
  prefix = "Hello",
  suffix = "!",
  fallbackName = "world",
  separator = ", ",
  namePrefix = "",
}: GreetingOptions = {}): NormalizedGreetingOptions {
  return {
    opening: `${prefix.trim() || "Hello"}${separator}${namePrefix}`,
    suffix,
    fallbackName: fallbackName.trim() || "world",
  };
}

function formatGreeting(name = "", { opening, suffix, fallbackName }: NormalizedGreetingOptions): string {
  return `${opening}${name.trim() || fallbackName}${suffix}`;
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

/** Join ordered greetings with the given text; defaults to a newline and returns an empty string for an empty list. */
export function greetJoined(names: readonly string[], options?: GreetingOptions, joiner = "\n"): string {
  return greetMany(names, options).join(joiner);
}
