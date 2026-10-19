#!/bin/bash
# Pre-push: Require manual confirmation before pushing
# This hook ensures pushes only happen when explicitly requested
# ALWAYS requires confirmation - even in non-interactive environments

# Check if running in an interactive terminal
if [ -t 0 ]; then
  read -p "Confirm push to remote? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Push cancelled by user"
    exit 1
  fi
else
  # Non-interactive (CI, scripts) - REQUIRE explicit confirmation via env var
  if [ -z "$CONFIRM_PUSH" ] || [ "$CONFIRM_PUSH" != "true" ]; then
    echo "ERROR: Push requires explicit confirmation"
    echo "Set CONFIRM_PUSH=true environment variable to allow push in non-interactive mode"
    echo "Example: CONFIRM_PUSH=true git push origin branch-name"
    exit 1
  fi
  echo "Push confirmed via CONFIRM_PUSH=true"
fi