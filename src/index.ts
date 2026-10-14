/** Options shared by the greeting helpers. */
export interface GreetingOptions {
  /** Greeting prefix; omitted or blank values use "Hello". */
  prefix?: string;
}

/** Return a greeting; omitted or blank names use "world". */
export function greet(name = "world", { prefix = "Hello" }: GreetingOptions = {}): string {
  return `${prefix.trim() || "Hello"}, ${name.trim() || "world"}!`;
}

/** Greet each name in order without modifying the input list. */
export function greetMany(names: readonly string[], options?: GreetingOptions): string[] {
  return names.map((name) => greet(name, options));
}
