import { describe, expect, it } from "vitest";
import { greet, greetMany } from "./index";

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

  it.each([
    [".", "Hello, CI."],
    ["", "Hello, CI"],
    [" 👋", "Hello, CI 👋"],
  ])("appends the suffix %j without changing it", (suffix, expected) => {
    expect(greet("CI", { suffix })).toBe(expected);
  });

  it.each([undefined, "", " \t\n"])("uses a custom fallback for the name %j", (name) => {
    expect(greet(name, { fallbackName: "  team  " })).toBe("Hello, team!");
  });

  it.each(["", " \t\n"])("uses world when the fallback name is blank %j", (fallbackName) => {
    expect(greet(" ", { fallbackName })).toBe("Hello, world!");
  });

  it("prefers the provided name over the fallback", () => {
    expect(greet(" CI ", { fallbackName: "team" })).toBe("Hello, CI!");
  });

  it.each([
    [": ", "Hello: CI!"],
    ["", "HelloCI!"],
    ["\n", "Hello\nCI!"],
  ])("uses the separator %j without changing it", (separator, expected) => {
    expect(greet("CI", { separator })).toBe(expected);
  });
});

describe("greetMany", () => {
  it("greets names in order without modifying the input list", () => {
    const names = Object.freeze([" microshine ", "CI"]);

    expect(greetMany(names)).toEqual(["Hello, microshine!", "Hello, CI!"]);
    expect(names).toEqual([" microshine ", "CI"]);
  });

  it("shares a custom prefix and uses the default for blank names", () => {
    expect(greetMany(["CI", "  "], { prefix: "Hi" })).toEqual(["Hi, CI!", "Hi, world!"]);
  });

  it("shares a custom suffix with all greetings", () => {
    expect(greetMany(["CI", " "], { prefix: "Hi", suffix: "." })).toEqual(["Hi, CI.", "Hi, world."]);
  });

  it("shares a custom fallback for blank names", () => {
    expect(greetMany(["CI", " "], { prefix: "Hi", suffix: ".", fallbackName: "team" })).toEqual([
      "Hi, CI.",
      "Hi, team.",
    ]);
  });

  it("returns an empty list when there are no names", () => {
    expect(greetMany([])).toEqual([]);
  });

  it("shares the separator with every greeting and the fallback name", () => {
    expect(greetMany([" CI ", " "], { prefix: " Hi ", separator: ": ", suffix: ".", fallbackName: "team" })).toEqual([
      "Hi: CI.",
      "Hi: team.",
    ]);
  });

  it("fills missing entries in sparse name lists with fallback greetings", () => {
    const names: string[] = [];
    names.length = 3;
    names[1] = " CI ";
    Object.freeze(names);

    expect(greetMany(names, { prefix: "Hi", separator: ": ", fallbackName: "team" })).toEqual([
      "Hi: team!",
      "Hi: CI!",
      "Hi: team!",
    ]);
    expect(Object.keys(names)).toEqual(["1"]);
  });
});
