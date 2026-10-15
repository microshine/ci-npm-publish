import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts", ".github/scripts/**/*.spec.mjs"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/index.ts", ".github/scripts/pr-release-notes.mjs"],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
