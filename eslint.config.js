import js from "@eslint/js";
import globals from "globals";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "*.config.js",
      "vitest.config.js",
      "opencode/**",
      ".opencode/**"
    ]
  },

  // Base configuration for all JS files
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
        chrome: "readonly",
        browser: "readonly"
      },
      parserOptions: {
        ecmaFeatures: {
          modules: true
        }
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    },
    rules: {
      ...js.configs.recommended.rules,

      // Style rules matching existing codebase
      "quotes": ["error", "single", { avoidEscape: true }],
      "semi": ["error", "always"],
      "indent": ["error", 2, { SwitchCase: 1 }],
      "comma-dangle": ["error", "always-multiline"],
      "object-curly-spacing": ["error", "always"],
      "array-bracket-spacing": ["error", "never"],
      "keyword-spacing": ["error", { before: true, after: true }],
      "space-before-function-paren": ["error", { anonymous: "always", named: "never", asyncArrow: "always" }],
      "space-infix-ops": "error",
      "spaced-comment": ["error", "always", { markers: ["/"] }],

      // Best practices
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      "no-undef": "error",
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-shadow": ["error", { allow: ["err", "error", "response", "element", "item", "index", "value", "key", "callback", "input", "resultNormal"] }],
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "multi-line"],
      "block-scoped-var": "error",
      "no-useless-return": "error",
      "no-useless-catch": "error",
      "no-unneeded-ternary": "error",
      "prefer-template": "error",
      "template-curly-spacing": "error",

      // Chrome extension specific
      "no-restricted-globals": ["error", { name: "event", message: "Use parameter instead of global event" }]
    }
  },

  // Test files configuration (Vitest globals)
  {
    files: ["tests/**/*.js", "**/*.test.js", "**/*.spec.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.vitest,
        chrome: "readonly",
        global: "readonly"
      }
    },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "prefer-arrow-callback": "off", // describe/it/test callbacks
      "no-shadow": ["error", { allow: ["input", "resultNormal", "selector"] }]
    }
  },

  // Config files - more lenient
  {
    files: ["*.config.js", "vitest.config.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    },
    rules: {
      "no-unused-vars": "off",
      "import/no-extraneous-dependencies": "off"
    }
  }
];