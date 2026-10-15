import { execFileSync } from "node:child_process";
import createAngularPreset from "conventional-changelog-angular";
import { writeChangelogString } from "conventional-changelog-writer";
import { CommitParser } from "conventional-commits-parser";

/** Match immutable version tags, excluding moving major aliases such as v0. */
const versionTagPattern = /^v\d+\.\d+\.\d+$/;

/** Select merged PRs whose merge, squash, or final rebased commit is in the release range. */
export function selectPullRequests(pullRequests, commits, baseBranch) {
  const seen = new Set();
  return pullRequests.filter((pullRequest) => {
    if (
      !pullRequest.merged_at ||
      pullRequest.base.ref !== baseBranch ||
      !commits.has(pullRequest.merge_commit_sha) ||
      seen.has(pullRequest.number)
    ) {
      return false;
    }
    seen.add(pullRequest.number);
    return true;
  });
}

/** Use Git ancestry rather than timestamps to avoid missing late merges or including other branches. */
export function collectPullRequests({ repository, version, baseBranch = "main", cwd, run = execFileSync }) {
  const options = { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 };
  const tags = run("git", ["tag", "--merged", "HEAD", "--sort=-version:refname"], options).trim().split("\n");
  if (tags.includes(`v${version}`)) {
    throw new Error(`Version ${version} is already tagged. Bump the package version before generating a changelog.`);
  }
  const previousTag = tags.find((tag) => versionTagPattern.test(tag));
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const commits = new Set(run("git", ["rev-list", range], options).trim().split("\n").filter(Boolean));
  if (commits.size === 0) {
    return { previousTag, pullRequests: [] };
  }

  // Paginate all closed PRs: a fixed limit or merge-date cutoff can silently drop release entries.
  const endpoint = `repos/${repository}/pulls?state=closed&base=${encodeURIComponent(baseBranch)}&per_page=100`;
  const pages = JSON.parse(run("gh", ["api", "--paginate", "--slurp", endpoint], options));
  return { previousTag, pullRequests: selectPullRequests(pages.flat(), commits, baseBranch) };
}

/** Reuse the Angular parser, filtering, grouping and sorting, replacing commit links with PR links. */
export async function generateReleaseNotes(pullRequests, { repository, version, previousTag, date }) {
  const preset = createAngularPreset();
  const parser = new CommitParser({
    ...preset.parser,
    breakingHeaderPattern: /^(\w*)(?:\((.*)\))?!: (.*)$/,
  });
  const commits = pullRequests.map((pullRequest) => ({
    ...parser.parse(pullRequest.title),
    pullNumber: pullRequest.number,
  }));
  const [owner, name] = repository.split("/");
  const repositoryUrl = `https://github.com/${repository}`;
  return writeChangelogString(
    commits,
    {
      host: "https://github.com",
      owner,
      repository: name,
      version,
      currentTag: `v${version}`,
      previousTag,
      linkCompare: Boolean(previousTag),
      ...(date && { date }),
    },
    {
      ...preset.writer,
      commitPartial: (context, commit) =>
        `${preset.writer.commitPartial(context, commit)} ([#${commit.pullNumber}](${repositoryUrl}/pull/${commit.pullNumber}))`,
    },
  );
}
