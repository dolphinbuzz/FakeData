#!/bin/bash
# Pre-commit: Run tests for changed files only
CHANGED=$(git diff --cached --name-only -- "src/**/*.js" "tests/**/*.js" 2>/dev/null)
if [ -n "$CHANGED" ]; then
  echo "Running tests for changed files..."
  npx vitest run --changed
else
  echo "No source/test files changed, skipping tests"
fi