/** Return a greeting; omitted or blank names use "world". */
export function greet(name = "world"): string {
  return `Hello, ${name.trim() || "world"}!`;
}
