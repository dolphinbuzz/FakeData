import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/scripts/**/*.js"],
      exclude: [
        "src/scripts/privacy.js",
        "tests/**",
        "coverage/**"
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        statements: 90,
        branches: 80,
        "src/scripts/app.js": {
          lines: 85
        },
        "src/scripts/content.js": {
          lines: 85
        },
        "src/scripts/selector-engine.js": {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        "src/scripts/data/vehicle-catalog.js": {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        "src/scripts/generators.js": {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        "src/scripts/messages.js": {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        "src/scripts/data/estados.js": {
          lines: 100
        },
        "src/scripts/data/mapping-types.js": {
          lines: 100
        }
      }
    }
  }
});