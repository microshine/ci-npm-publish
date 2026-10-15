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
}
