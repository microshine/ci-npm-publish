import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const name = process.env.EXPECTED_PACKAGE_NAME;
const require = createRequire(import.meta.url);
const consumer = dirname(fileURLToPath(import.meta.url));
const manifestPath = require.resolve(`${name}/package.json`);
const manifest = require(manifestPath);
const esm = await import(name);
const commonjs = require(name);

test("loads the package from the isolated consumer, without repository devDependencies", () => {
  assert.equal(dirname(manifestPath), join(consumer, "node_modules", ...name.split("/")));
  assert.equal(existsSync(join(consumer, "node_modules", "vitest")), false);
});

test("installed manifest matches the version and Node engine being released", () => {
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, process.env.EXPECTED_PACKAGE_VERSION);
  assert.equal(manifest.engines.node, process.env.EXPECTED_PACKAGE_ENGINE);
});

test("includes the published TypeScript declarations", () => {
  assert.ok(existsSync(join(dirname(manifestPath), manifest.types)));
});

for (const [format, api] of [
  ["ESM import", esm],
  ["CommonJS require", commonjs],
]) {
  test(`${format}: name prefixes work across single, batch, joined, and reusable greetings`, () => {
    const options = { namePrefix: "@", fallbackName: "team" };
    const greeting = api.createGreeter(options);
    assert.equal(api.greet(" CI ", options), "Hello, @CI!");
    assert.deepEqual(api.greetMany(["CI", " "], options), ["Hello, @CI!", "Hello, @team!"]);
    assert.equal(api.greetJoined(["CI", " "], options, " / "), "Hello, @CI! / Hello, @team!");
    options.namePrefix = "#";
    assert.equal(greeting("CI"), "Hello, @CI!");
    assert.equal(greeting(), "Hello, @team!");
  });

  test(`${format}: joins greetings with default and custom delimiters`, () => {
    assert.equal(api.greetJoined([" CI ", "team"]), "Hello, CI!\nHello, team!");
    assert.equal(
      api.greetJoined(["CI", " "], { prefix: "Hi", separator: ": ", fallbackName: "team" }, " / "),
      "Hi: CI! / Hi: team!",
    );
    assert.equal(api.greetJoined([]), "");
    assert.equal(api.greetJoined(["CI", "team"], { suffix: "" }, ""), "Hello, CIHello, team");
  });

  test(`${format}: reusable greeters snapshot options and support fallback names`, () => {
    const options = { prefix: " Hi ", separator: ": ", suffix: ".", fallbackName: " team " };
    const greeting = api.createGreeter(options);
    options.prefix = "Welcome";
    options.fallbackName = "everyone";

    assert.equal(greeting(" CI "), "Hi: CI.");
    assert.equal(greeting(" \t\n"), "Hi: team.");
    assert.equal(greeting(), "Hi: team.");
    assert.equal(api.createGreeter()(), "Hello, world!");
  });

  test(`${format}: greet supports defaults, trimming and custom prefixes`, () => {
    assert.equal(api.greet(), "Hello, world!");
    assert.equal(api.greet("  CI  "), "Hello, CI!");
    assert.equal(api.greet("\t\n"), "Hello, world!");
    assert.equal(api.greet("CI", { prefix: " Hi " }), "Hi, CI!");
    assert.equal(api.greet("CI", { prefix: " " }), "Hello, CI!");
    assert.equal(api.greet(undefined, { prefix: "Hi" }), "Hi, world!");
  });

  test(`${format}: greetMany preserves order and the original list`, () => {
    const names = Object.freeze([" microshine ", "CI", " "]);
    assert.deepEqual(api.greetMany(names, { prefix: "Hi" }), ["Hi, microshine!", "Hi, CI!", "Hi, world!"]);
    assert.deepEqual(names, [" microshine ", "CI", " "]);
    assert.deepEqual(api.greetMany(["CI"]), ["Hello, CI!"]);
    assert.deepEqual(api.greetMany([]), []);
  });

  test(`${format}: greeting helpers support custom and empty suffixes`, () => {
    assert.equal(api.greet("CI", { suffix: "." }), "Hello, CI.");
    assert.equal(api.greet("CI", { suffix: "" }), "Hello, CI");
    assert.equal(api.greet("CI", { suffix: " 👋" }), "Hello, CI 👋");
    assert.deepEqual(api.greetMany(["CI", " "], { prefix: "Hi", suffix: "." }), ["Hi, CI.", "Hi, world."]);
  });

  test(`${format}: greeting helpers support custom fallback names`, () => {
    assert.equal(api.greet(undefined, { fallbackName: " team " }), "Hello, team!");
    assert.equal(api.greet(" \t\n", { fallbackName: "team" }), "Hello, team!");
    assert.equal(api.greet(" ", { fallbackName: " " }), "Hello, world!");
    assert.equal(api.greet(" CI ", { fallbackName: "team" }), "Hello, CI!");
    assert.deepEqual(api.greetMany(["CI", " "], { prefix: "Hi", suffix: ".", fallbackName: "team" }), [
      "Hi, CI.",
      "Hi, team.",
    ]);
  });

  test(`${format}: greeting helpers support custom and empty separators`, () => {
    assert.equal(api.greet("CI", { separator: ": " }), "Hello: CI!");
    assert.equal(api.greet("CI", { separator: "" }), "HelloCI!");
    assert.equal(api.greet("CI", { separator: "\n" }), "Hello\nCI!");
    assert.deepEqual(api.greetMany(["CI", " "], { prefix: "Hi", separator: ": ", fallbackName: "team" }), [
      "Hi: CI!",
      "Hi: team!",
    ]);
  });

  test(`${format}: sparse name lists use fallback greetings without changing the input`, () => {
    const names = [];
    names.length = 3;
    names[1] = " CI ";
    Object.freeze(names);
    assert.deepEqual(api.greetMany(names, { prefix: "Hi", separator: ": ", fallbackName: "team" }), [
      "Hi: team!",
      "Hi: CI!",
      "Hi: team!",
    ]);
    assert.deepEqual(Object.keys(names), ["1"]);
  });

  test(`${format}: inherited values do not replace fallback greetings in sparse lists`, () => {
    const names = [];
    names.length = 3;
    names[1] = " CI ";
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, "0", { value: "inherited" });
    Object.setPrototypeOf(names, prototype);
    Object.freeze(names);

    assert.deepEqual(api.greetMany(names, { fallbackName: "team" }), ["Hello, team!", "Hello, CI!", "Hello, team!"]);
    assert.equal(names[0], "inherited");
    assert.deepEqual(Object.keys(names), ["1"]);
  });
}
