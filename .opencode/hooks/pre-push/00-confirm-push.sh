#!/bin/bash
# Pre-push: Require manual confirmation before pushing
# This hook ensures pushes only happen when explicitly requested

# Check if running in an interactive terminal
if [ -t 0 ]; then
  read -p "Confirm push to remote? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Push cancelled by user"
    exit 1
  fi
else
  # Non-interactive (CI, scripts) - allow push
  echo "Non-interactive environment detected, allowing push"
fi