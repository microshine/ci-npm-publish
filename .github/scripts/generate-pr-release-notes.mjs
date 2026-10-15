import { readFileSync } from "node:fs";
import { collectPullRequests, generateReleaseNotes } from "./pr-release-notes.mjs";

try {
  const { version, repository: packageRepository } = JSON.parse(readFileSync("package.json", "utf8"));
  const repository =
    process.env.GITHUB_REPOSITORY || new URL(packageRepository.url).pathname.replace(/^\/|\.git$/g, "");
  const { previousTag, pullRequests } = collectPullRequests({
    repository,
    version,
    baseBranch: process.env.RELEASE_BASE_BRANCH || "main",
  });
  const notes = await generateReleaseNotes(pullRequests, { repository, version, previousTag });
  process.stdout.write(notes);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
