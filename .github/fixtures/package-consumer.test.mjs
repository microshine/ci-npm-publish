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
}
