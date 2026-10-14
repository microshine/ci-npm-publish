import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const directory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "ci-npm-publish-package-"));
const packages = JSON.parse(
  execFileSync("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", directory], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }),
);

assert.equal(packages.length, 1, "Expected one packed package");
const packed = packages[0];
assert.equal(packed.name, manifest.name);
assert.equal(packed.version, manifest.version);

const tarball = join(directory, packed.filename);
const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
assert.equal(integrity, packed.integrity, "The archive must match npm pack metadata");

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `tarball=${tarball}\nintegrity=${integrity}\n`);
}
console.log(JSON.stringify({ tarball, integrity }, null, 2));
