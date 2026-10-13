#!/bin/bash
# Pre-push: Verify manifest.json and package.json versions match
MANIFEST_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
PACKAGE_VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
if [ "$MANIFEST_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "ERROR: Version mismatch!"
  echo "  manifest.json: $MANIFEST_VERSION"
  echo "  package.json:  $PACKAGE_VERSION"
  exit 1
fi
echo "Version check passed: $MANIFEST_VERSION"