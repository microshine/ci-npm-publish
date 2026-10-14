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

  it("returns an empty list when there are no names", () => {
    expect(greetMany([])).toEqual([]);
  });
});
