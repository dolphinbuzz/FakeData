#!/bin/bash
# Pre-commit: Lint check (if configured)
if npm run lint --if-present 2>/dev/null; then
  echo "Lint passed"
else
  echo "No lint script configured or lint failed"
  exit 1
fi