/** Options shared by the greeting helpers. */
export interface GreetingOptions {
  /** Greeting prefix; omitted or blank values use "Hello". */
  prefix?: string;
}

/** Return a greeting; omitted or blank names use "world". */
export function greet(name = "world", { prefix = "Hello" }: GreetingOptions = {}): string {
  return `${prefix.trim() || "Hello"}, ${name.trim() || "world"}!`;
}
