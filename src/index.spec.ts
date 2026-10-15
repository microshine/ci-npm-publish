import { describe, expect, it } from "vitest";
import { createGreeter, greet, greetJoined, greetMany } from "./index";

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

  it.each([
    ["@", "Hello, @CI!"],
    ["", "Hello, CI!"],
    ["\n", "Hello, \nCI!"],
  ])("uses the name prefix %j without changing it", (namePrefix, expected) => {
    expect(greet(" CI ", { namePrefix })).toBe(expected);
  });

  it("adds the name prefix to the fallback name", () => {
    expect(greet(undefined, { namePrefix: "@", fallbackName: "team" })).toBe("Hello, @team!");
  });
});

describe("createGreeter", () => {
  it("snapshots the name prefix for named and fallback greetings", () => {
    const options = { namePrefix: "@", fallbackName: "team" };
    const greeting = createGreeter(options);
    options.namePrefix = "#";

    expect(greeting("CI")).toBe("Hello, @CI!");
    expect(greeting()).toBe("Hello, @team!");
  });

  it("greets with defaults when no options or name are provided", () => {
    const greeting = createGreeter();

    expect(greeting()).toBe("Hello, world!");
    expect(greeting(" CI ")).toBe("Hello, CI!");
  });

  it("shares custom options across named and fallback greetings", () => {
    const greeting = createGreeter({ prefix: " Hi ", separator: ": ", suffix: ".", fallbackName: " team " });

    expect(greeting(" CI ")).toBe("Hi: CI.");
    expect(greeting(" \t\n")).toBe("Hi: team.");
    expect(greeting()).toBe("Hi: team.");
  });

  it("keeps a snapshot when the original options are changed", () => {
    const options = { prefix: "Hi", separator: ": ", suffix: ".", fallbackName: "team" };
    const greeting = createGreeter(options);
    options.prefix = "Welcome";
    options.separator = " / ";
    options.suffix = "?";
    options.fallbackName = "everyone";

    expect(greeting("CI")).toBe("Hi: CI.");
    expect(greeting()).toBe("Hi: team.");
  });

  it("keeps independently configured greeters separate", () => {
    const first = createGreeter({ prefix: "Hi", separator: "", suffix: "" });
    const second = createGreeter({ prefix: "Welcome", fallbackName: "team" });

    expect(first("CI")).toBe("HiCI");
    expect(second()).toBe("Welcome, team!");
    expect(first()).toBe("Hiworld");
  });
});

describe("greetMany", () => {
  it("does not read options for empty batches or their joined output", () => {
    let reads = 0;
    const options = {
      get prefix() {
        reads++;
        return "Hi";
      },
    };

    expect(greetMany([], options)).toEqual([]);
    expect(greetJoined([], options)).toBe("");
    expect(reads).toBe(0);
  });

  it("shares a name prefix with every position", () => {
    expect(greetMany([" CI ", " "], { namePrefix: "@", fallbackName: "team" })).toEqual([
      "Hello, @CI!",
      "Hello, @team!",
    ]);
  });

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

  it("uses fallback greetings for holes that have inherited array values", () => {
    const names: string[] = [];
    names.length = 3;
    names[1] = " CI ";
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, "0", { value: "inherited" });
    Object.setPrototypeOf(names, prototype);
    Object.freeze(names);

    expect(greetMany(names, { fallbackName: "team" })).toEqual(["Hello, team!", "Hello, CI!", "Hello, team!"]);
    expect(names[0]).toBe("inherited");
    expect(Object.keys(names)).toEqual(["1"]);
  });
});

describe("greetJoined", () => {
  it("supports name prefixes when joining greetings", () => {
    expect(greetJoined(["CI", " "], { namePrefix: "@", fallbackName: "team" }, " / ")).toBe(
      "Hello, @CI! / Hello, @team!",
    );
  });

  it("joins greetings with newlines without changing the input", () => {
    const names = Object.freeze([" CI ", "world"]);

    expect(greetJoined(names)).toBe("Hello, CI!\nHello, world!");
    expect(names).toEqual([" CI ", "world"]);
  });

  it("shares greeting options and accepts a custom joiner", () => {
    expect(greetJoined(["CI", " "], { prefix: "Hi", separator: ": ", suffix: ".", fallbackName: "team" }, " / ")).toBe(
      "Hi: CI. / Hi: team.",
    );
  });

  it("supports an empty joiner", () => {
    expect(greetJoined(["CI", "team"], { suffix: "" }, "")).toBe("Hello, CIHello, team");
  });

  it("returns an empty string for an empty name list", () => {
    expect(greetJoined([])).toBe("");
  });

  it("uses fallback greetings for inherited sparse entries", () => {
    const names: string[] = [];
    names.length = 2;
    names[1] = "CI";
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, "0", { value: "inherited" });
    Object.setPrototypeOf(names, prototype);

    expect(greetJoined(names, { fallbackName: "team" }, " | ")).toBe("Hello, team! | Hello, CI!");
  });
});
