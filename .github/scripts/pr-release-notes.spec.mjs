import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { collectPullRequests, generateReleaseNotes, selectPullRequests } from "./pr-release-notes.mjs";
import { createReleasePrBody, extractReleaseNotes } from "./release-notes.mjs";

const repository = "microshine/ci-npm-publish";
const context = { repository, version: "0.2.0", previousTag: "v0.1.0", date: "2026-10-15" };
const directories = [];

function pull(number, title, mergeCommit = `commit-${number}`) {
  return { number, title, merge_commit_sha: mergeCommit, merged_at: "2026-10-15T00:00:00Z", base: { ref: "main" } };
}

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "pr-release-notes-"));
  directories.push(cwd);
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Release Notes Test");
  git("config", "user.email", "release-notes@example.com");
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({ version: "0.2.0", repository: { url: `https://github.com/${repository}.git` } }),
  );
  git("add", ".");
  git("commit", "--quiet", "--message=feat: initial commit");
  return { cwd, git };
}

function mockGitHub(cwd, pages, failure = false) {
  // The real CLI and Git run in a temporary repository; only the network boundary is replaced.
  writeFileSync(
    join(cwd, "gh"),
    `#!/usr/bin/env node
if (${failure}) { console.error("GitHub API unavailable"); process.exit(1); }
if (!process.argv.includes("--paginate") || !process.argv.includes("--slurp")) process.exit(2);
process.stdout.write(${JSON.stringify(JSON.stringify(pages))});
`,
    { mode: 0o755 },
  );
  vi.stubEnv("PATH", `${cwd}:${process.env.PATH}`);
}

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("release notes from PR titles", () => {
  it("reuses Angular groups, scopes, ordering and filtering with links to PRs", async () => {
    const notes = await generateReleaseNotes(
      [
        pull(1, "feat(api): add greeting options"),
        pull(2, "fix: handle blank names"),
        pull(3, "perf: cache greetings"),
        pull(4, "docs: update README"),
        pull(5, "ci: update workflows"),
        pull(6, "chore(release): v0.1.0"),
        pull(7, "an ordinary PR title"),
        pull(8, "feat: add a default greeting"),
        pull(9, "revert: remove an option"),
      ],
      context,
    );
    expect(notes).toBe(`# [0.2.0](https://github.com/${repository}/compare/v0.1.0...v0.2.0) (2026-10-15)

### Bug Fixes

* handle blank names ([#2](https://github.com/${repository}/pull/2))

### Features

* add a default greeting ([#8](https://github.com/${repository}/pull/8))
* **api:** add greeting options ([#1](https://github.com/${repository}/pull/1))

### Performance Improvements

* cache greetings ([#3](https://github.com/${repository}/pull/3))

### Reverts

* remove an option ([#9](https://github.com/${repository}/pull/9))
`);
  });

  it("includes breaking changes marked with !, including otherwise filtered types", async () => {
    const notes = await generateReleaseNotes(
      [pull(1, "feat(api)!: change the greeting signature"), pull(2, "ci!: require Node.js 24")],
      context,
    );
    expect(notes).toContain("### Features\n\n* **api:** change the greeting signature ([#1]");
    expect(notes).toContain("### Continuous Integration\n\n* require Node.js 24 ([#2]");
    expect(notes).toContain("### BREAKING CHANGES\n\n* **api:** change the greeting signature\n* require Node.js 24");
  });

  it("retains issue references and renders title text without executing it", async () => {
    const notes = await generateReleaseNotes([pull(1, "fix(*): handle `$(echo hello)` in #42")], context);
    expect(notes).toContain(`handle \`$(echo hello)\` in [#42](https://github.com/${repository}/issues/42)`);
    expect(notes).toContain(`([#1](https://github.com/${repository}/pull/1))`);
    expect(notes).not.toContain("**");
  });

  it("generates a patch heading and a first-release heading without a compare link", async () => {
    const notes = await generateReleaseNotes([pull(1, "fix: first release")], {
      repository,
      version: "0.1.1",
      date: "2026-10-15",
    });
    expect(notes).toMatch(/^## 0\.1\.1 \(2026-10-15\)/);
    expect(notes).not.toContain("/compare/");
  });

  it.each([{ pulls: [] }, { pulls: [pull(1, "docs: update README"), pull(2, "chore: update tooling")] }])(
    "leaves only a heading for an empty or entirely filtered release: %#",
    async ({ pulls }) => {
      const notes = await generateReleaseNotes(pulls, { repository, version: "0.2.0" });
      expect(notes.trim()).toMatch(/^# 0\.2\.0 \(\d{4}-\d{2}-\d{2}\)$/);
    },
  );
});

describe("PR selection", () => {
  it("excludes unmerged, already released and other-branch PRs and removes duplicates", () => {
    const merged = pull(1, "feat: add an option");
    const unmerged = { ...pull(2, "fix: pending"), merged_at: null };
    const otherBranch = { ...pull(3, "fix: another branch"), base: { ref: "develop" } };
    expect(
      selectPullRequests(
        [merged, merged, unmerged, otherBranch, pull(4, "feat: already released")],
        new Set(["commit-1", "commit-2", "commit-3"]),
        "main",
      ),
    ).toEqual([merged]);
  });

  it("uses reachable version tags, ignores the major alias and reads every API page", () => {
    const { cwd, git } = fixture();
    const releasedCommit = git("rev-parse", "HEAD");
    git("tag", "v0.1.0");
    git("commit", "--quiet", "--allow-empty", "--message=docs: unrelated commit text");
    const unreleasedCommit = git("rev-parse", "HEAD");
    git("tag", "v0");
    git("checkout", "--quiet", "-b", "unmerged");
    git("commit", "--quiet", "--allow-empty", "--message=feat: not in main");
    git("tag", "v9.0.0");
    git("checkout", "--quiet", "main");
    const merged = pull(2, "feat: use the PR title", unreleasedCommit);
    mockGitHub(cwd, [[pull(1, "fix: already released", releasedCommit)], [merged, merged]]);

    expect(collectPullRequests({ repository, version: "0.2.0", cwd })).toEqual({
      previousTag: "v0.1.0",
      pullRequests: [merged],
    });
  });

  it("includes the complete history when there is no version tag", () => {
    const { cwd, git } = fixture();
    git("tag", "v0");
    const merged = pull(1, "feat: initial release", git("rev-parse", "HEAD"));
    mockGitHub(cwd, [[merged]]);
    expect(collectPullRequests({ repository, version: "0.2.0", cwd }).pullRequests).toEqual([merged]);
  });

  it("does not request PRs if there are no commits after the last version tag", () => {
    const { cwd, git } = fixture();
    git("tag", "v0.1.0");
    const run = vi.fn((command, args, options) => execFileSync(command, args, options));
    expect(collectPullRequests({ repository, version: "0.2.0", cwd, baseBranch: "main", run })).toEqual({
      previousTag: "v0.1.0",
      pullRequests: [],
    });
    expect(run.mock.calls.every(([command]) => command === "git")).toBe(true);
  });

  it("rejects a version that is already tagged", () => {
    const { cwd, git } = fixture();
    git("tag", "v0.2.0");
    expect(() => collectPullRequests({ repository, version: "0.2.0", cwd })).toThrow("already tagged");
  });
});

describe("release notes CLI", () => {
  it("runs the CLI against real Git history and uses PR titles rather than commit messages", () => {
    const { cwd, git } = fixture();
    git("tag", "v0.1.0");
    git("commit", "--quiet", "--allow-empty", "--message=fix: commit message should not appear");
    mockGitHub(cwd, [[pull(1, "feat: title from a merged PR", git("rev-parse", "HEAD"))]]);
    vi.stubEnv("GITHUB_REPOSITORY", "");
    vi.stubEnv("RELEASE_BASE_BRANCH", "main");
    const script = fileURLToPath(new URL("./generate-pr-release-notes.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`title from a merged PR ([#1](https://github.com/${repository}/pull/1))`);
    expect(result.stdout).not.toContain("commit message should not appear");

    // Generated notes must survive the existing release PR preparation and publication flow.
    const body = createReleasePrBody("0.2.0", "minor", result.stdout);
    const notes = extractReleaseNotes(body, "0.2.0");
    expect(notes).toContain("### Features");
    expect(notes).toContain(`([#1](https://github.com/${repository}/pull/1))`);
    expect(notes).not.toContain("# [0.2.0]");

    const secondRun = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    expect(secondRun.status, secondRun.stderr).toBe(0);
    expect(secondRun.stdout).toBe(result.stdout);
  });

  it("fails without emitting release notes or changing the package if the GitHub API fails", () => {
    const { cwd } = fixture();
    const packageJson = readFileSync(join(cwd, "package.json"), "utf8");
    mockGitHub(cwd, [], true);
    vi.stubEnv("GITHUB_REPOSITORY", repository);
    const script = fileURLToPath(new URL("./generate-pr-release-notes.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("GitHub API unavailable");
    expect(result.stdout).toBe("");
    expect(readFileSync(join(cwd, "package.json"), "utf8")).toBe(packageJson);
  });
});
