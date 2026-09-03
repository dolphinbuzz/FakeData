import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/scripts/**/*.js"],
      exclude: ["src/scripts/privacy.js"],
      thresholds: {
        lines: 70,
        functions: 65,
        statements: 70,
        branches: 65,
        "src/scripts/generators.js": {
          lines: 90,
          functions: 65,
          statements: 90,
          branches: 90
        },
        "src/scripts/messages.js": {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 90
        }
      }
    }
  }
});
