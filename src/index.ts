/** Options shared by the greeting helpers. */
export interface GreetingOptions {
  /** Greeting prefix; omitted or blank values use "Hello". */
  prefix?: string;
  /** Text appended after the name, used as-is; defaults to "!". */
  suffix?: string;
  /** Name used for omitted or blank input; omitted or blank values use "world". */
  fallbackName?: string;
}

/** Return a greeting; omitted or blank names use the configured fallback name. */
export function greet(
  name = "",
  { prefix = "Hello", suffix = "!", fallbackName = "world" }: GreetingOptions = {},
): string {
  return `${prefix.trim() || "Hello"}, ${name.trim() || fallbackName.trim() || "world"}${suffix}`;
}

/** Greet each name in order without modifying the input list. */
export function greetMany(names: readonly string[], options?: GreetingOptions): string[] {
  return names.map((name) => greet(name, options));
}
