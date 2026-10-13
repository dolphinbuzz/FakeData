#!/bin/bash
# Post-merge: Install deps if package.json changed
if git diff HEAD@{1}..HEAD --name-only | grep -q "package.json"; then
  echo "package.json changed, installing dependencies..."
  npm ci
else
  echo "No package.json changes, skipping install"
fi