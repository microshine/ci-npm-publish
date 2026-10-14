import { describe, expect, it } from "vitest";
import { createReleasePrBody, extractReleaseNotes, findReleasePr } from "./release-notes.mjs";

const version = "0.3.0";
const sha = "release-merge-sha";
const generatedNotes =
  "# [0.3.0](https://example.com/compare/v0.2.0...v0.3.0) (2026-10-14)\n\n### Features\n\n* Add release notes to PR descriptions.\n";
const body = createReleasePrBody(version, "minor", generatedNotes);

function releasePr(overrides = {}) {
  return {
    number: 3,
    merged_at: "2026-10-14T21:00:00Z",
    base: { ref: "main" },
    head: { ref: "release/version-bump" },
    merge_commit_sha: sha,
    body,
    ...overrides,
  };
}

describe("release notes in PR descriptions", () => {
  it("prepares a PR body and extracts only the release notes", () => {
    expect(body).toContain("Version bump: `minor` → `v0.3.0`");
    expect(extractReleaseNotes(body, version)).toBe("### Features\n\n* Add release notes to PR descriptions.\n");
  });

  it("also removes the patch release heading", () => {
    const patchBody = createReleasePrBody(
      "0.3.1",
      "patch",
      "## [0.3.1](https://example.com)\n\n### Bug Fixes\n\n* Fix a bug.\n",
    );
    expect(extractReleaseNotes(patchBody, "0.3.1")).toBe("### Bug Fixes\n\n* Fix a bug.\n");
  });

  it("publishes edited Markdown instead of regenerating it", () => {
    const edited = body.replace(
      "* Add release notes to PR descriptions.",
      "* Reviewed description with `code`, **Markdown**, and $literal text.\n\n### Migration\n\nUse the new CI flow.",
    );
    expect(extractReleaseNotes(edited, version)).toBe(
      "### Features\n\n* Reviewed description with `code`, **Markdown**, and $literal text.\n\n### Migration\n\nUse the new CI flow.\n",
    );
  });

  it("handles CRLF line endings", () => {
    expect(extractReleaseNotes(body.replace(/\n/g, "\r\n"), version)).toBe(extractReleaseNotes(body, version));
  });

  it("preserves Markdown code indentation and hard line breaks", () => {
    const markdown = "    const greeting = greet();\n\nFirst line  \nSecond line  ";
    const codeBody = createReleasePrBody(version, "minor", `\n\n${markdown}\n\n`);
    expect(extractReleaseNotes(codeBody, version)).toBe(`${markdown}\n`);
  });

  it("allows an empty generated section to be filled in before merging", () => {
    const emptyBody = createReleasePrBody(version, "minor", "# [0.3.0](https://example.com)\n\n");
    expect(() => extractReleaseNotes(emptyBody, version)).toThrow("are empty");
    const filledBody = emptyBody.replace(
      `<!-- release-notes:v${version} -->`,
      `<!-- release-notes:v${version} -->\n\nMaintenance release.`,
    );
    expect(extractReleaseNotes(filledBody, version)).toBe("Maintenance release.\n");
  });

  it("rejects a section containing only comments", () => {
    const commentBody = createReleasePrBody(version, "minor", "<!-- Add notes here -->");
    expect(() => extractReleaseNotes(commentBody, version)).toThrow("are empty");
  });

  it.each([null, "", body.replace("v0.3.0 -->", "v0.4.0 -->"), body.replace("<!-- /release-notes -->", "")])(
    "rejects missing or wrong-version markers",
    (invalidBody) => {
      expect(() => extractReleaseNotes(invalidBody, version)).toThrow("Expected one release-notes block");
    },
  );

  it("rejects duplicate markers", () => {
    expect(() => extractReleaseNotes(`${body}\n${body}`, version)).toThrow("Expected one release-notes block");
  });

  it("rejects markers in reverse order", () => {
    expect(() =>
      extractReleaseNotes(`<!-- /release-notes -->\nNotes\n<!-- release-notes:v${version} -->`, version),
    ).toThrow("Expected one release-notes block");
  });
});

describe("finding the merged release PR", () => {
  it("uses the PR for the exact merge commit", () => {
    const correct = releasePr();
    expect(findReleasePr([releasePr({ merge_commit_sha: "older-release" }), correct], sha)).toBe(correct);
  });

  it.each([
    { merged_at: null },
    { base: { ref: "other-branch" } },
    { head: { ref: "feature" } },
    { merge_commit_sha: "different-commit" },
  ])("rejects an unrelated or unmerged PR: %j", (overrides) => {
    expect(() => findReleasePr([releasePr(overrides)], sha)).toThrow("found 0");
  });

  it("rejects missing and ambiguous PR associations", () => {
    expect(() => findReleasePr([], sha)).toThrow("found 0");
    expect(() => findReleasePr([releasePr(), releasePr({ number: 4 })], sha)).toThrow("found 2");
  });
});
