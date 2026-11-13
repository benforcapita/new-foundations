import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.ts"],
    reporters: process.env.CI === undefined ? ["default"] : ["verbose"],
    coverage: {
      provider: "v8",
      include: ["packages/shared/src/rules/**/*.ts"],
      exclude: ["packages/shared/src/rules/**/*.test.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
