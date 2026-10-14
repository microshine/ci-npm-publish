import { describe, expect, it } from "vitest";
import { greet } from "./index";

describe("greet", () => {
  it("greets the world by default", () => {
    expect(greet()).toBe("Hello, world!");
  });

  it("greets a named person", () => {
    expect(greet("microshine")).toBe("Hello, microshine!");
  });

  it("trims surrounding whitespace", () => {
    expect(greet("  CI  ")).toBe("Hello, CI!");
  });

  it.each(["", "   ", "\t\n"])("uses the default greeting for a blank name %j", (name) => {
    expect(greet(name)).toBe("Hello, world!");
  });

  it("supports a custom greeting prefix", () => {
    expect(greet("CI", { prefix: "Hi" })).toBe("Hi, CI!");
  });

  it("trims the greeting prefix", () => {
    expect(greet("CI", { prefix: "  Hi  " })).toBe("Hi, CI!");
  });

  it.each(["", " \t\n"])("uses the default greeting prefix for a blank value %j", (prefix) => {
    expect(greet("CI", { prefix })).toBe("Hello, CI!");
  });

  it("supports a custom prefix with the default name", () => {
    expect(greet(undefined, { prefix: "Hi" })).toBe("Hi, world!");
  });
});
