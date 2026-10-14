import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const [archive, expectedIntegrity] = process.argv.slice(2);
assert.ok(archive, "Usage: npm run package:check -- <tarball.tgz> [integrity]");
const tarball = resolve(archive);
if (expectedIntegrity) {
  const integrity = `sha512-${createHash("sha512").update(readFileSync(tarball)).digest("base64")}`;
  assert.equal(integrity, expectedIntegrity, "Check the exact archive created by the pack step");
}
if (process.env.EXPECTED_NODE_VERSION) {
  assert.equal(process.versions.node, process.env.EXPECTED_NODE_VERSION.replace(/^v/, ""));
}

const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
const consumer = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), "ci-npm-publish-consumer-"));
try {
  writeFileSync(
    join(consumer, "package.json"),
    JSON.stringify({ name: "ci-npm-publish-consumer", private: true, type: "module" }),
  );
  copyFileSync(
    new URL("../fixtures/package-consumer.test.mjs", import.meta.url),
    join(consumer, "package-consumer.test.mjs"),
  );

  console.log(`Checking ${manifest.name}@${manifest.version} on Node ${process.versions.node}`);
  execFileSync(
    "npm",
    [
      "install",
      tarball,
      "--prefix",
      consumer,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      "--engine-strict",
    ],
    { cwd: consumer, stdio: "inherit" },
  );
  execFileSync(process.execPath, ["--test", "package-consumer.test.mjs"], {
    cwd: consumer,
    stdio: "inherit",
    env: {
      ...process.env,
      EXPECTED_PACKAGE_NAME: manifest.name,
      EXPECTED_PACKAGE_VERSION: manifest.version,
      EXPECTED_PACKAGE_ENGINE: manifest.engines.node,
    },
  });
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
