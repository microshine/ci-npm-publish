import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const endMarker = "<!-- /release-notes -->";

function startMarker(version) {
  return `<!-- release-notes:v${version} -->`;
}

function trimBlankLines(text) {
  // Preserve indentation and trailing spaces used for Markdown code and line breaks.
  return text.replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, "");
}

export function createReleasePrBody(version, bump, generatedNotes) {
  // Conventional Changelog includes a version heading; the PR and Release already have a title.
  const notes = trimBlankLines(generatedNotes.replace(/\r\n/g, "\n").replace(/^#{1,2} [^\n]*(?:\n|$)/, ""));

  return [
    `Version bump: \`${bump}\` → \`v${version}\``,
    "",
    "Review the version and the release notes below before merging. Edit notes between the HTML markers; keep the markers intact.",
    "If the generated notes are empty, add a release description before merging.",
    "",
    "## Release notes",
    "",
    startMarker(version),
    notes,
    endMarker,
    "",
    "After merging into `main`, **Publish** verifies the package, publishes to GitHub Packages, pushes the version and major tags, and copies these release notes to a GitHub Release.",
    "",
  ].join("\n");
}

export function extractReleaseNotes(body, version) {
  const lines = (body ?? "").replace(/\r\n/g, "\n").split("\n");
  const starts = lines.flatMap((line, index) => (line === startMarker(version) ? [index] : []));
  const ends = lines.flatMap((line, index) => (line === endMarker ? [index] : []));

  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    throw new Error(
      `Expected one release-notes block for v${version} in the release PR description. Keep its HTML markers intact.`,
    );
  }

  const notes = trimBlankLines(lines.slice(starts[0] + 1, ends[0]).join("\n"));
  if (!notes.replace(/<!--[\s\S]*?-->/g, "").trim()) {
    throw new Error(
      `Release notes for v${version} are empty. Add them to the release PR description before publishing.`,
    );
  }

  return `${notes}\n`;
}

export function findReleasePr(pullRequests, commitSha) {
  const matches = pullRequests.filter(
    (pr) =>
      pr.merged_at &&
      pr.base.ref === "main" &&
      pr.head.ref === "release/version-bump" &&
      pr.merge_commit_sha === commitSha,
  );

  if (matches.length !== 1) {
    throw new Error(
      `Expected one merged release/version-bump PR for commit ${commitSha}, found ${matches.length}. Publish a version through Version Bump and re-run the original publish run to recover a failed release.`,
    );
  }

  return matches[0];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, inputPath, outputPath] = process.argv.slice(2);
    const version = process.env.VERSION;
    if (!version || !inputPath || !outputPath) {
      throw new Error("Usage: VERSION=x.y.z node release-notes.mjs <prepare|extract> <input> <output>");
    }

    const input = readFileSync(inputPath, "utf8");
    if (command === "prepare") {
      writeFileSync(outputPath, createReleasePrBody(version, process.env.BUMP, input));
    } else if (command === "extract") {
      const pr = findReleasePr(JSON.parse(input), process.env.GITHUB_SHA);
      writeFileSync(outputPath, extractReleaseNotes(pr.body, version));
      console.log(`Release notes for v${version} copied from PR #${pr.number}`);
    } else {
      throw new Error(`Unknown release-notes command: ${command}`);
    }
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
