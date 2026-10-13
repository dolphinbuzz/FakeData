# OpenCode Hooks - FakeData Team

## Hook Types

### Pre-Commit Hooks (`.opencode/hooks/pre-commit/`)
```bash
#!/bin/bash
# .opencode/hooks/pre-commit/01-lint.sh
npm run lint 2>/dev/null || echo "No lint script configured"

# .opencode/hooks/pre-commit/02-test-changed.sh
# Run tests only for changed files
CHANGED=$(git diff --cached --name-only -- "src/**/*.js" "tests/**/*.js")
if [ -n "$CHANGED" ]; then
  npx vitest run --changed
fi
```

### Pre-Push Hooks (`.opencode/hooks/pre-push/`)
```bash
#!/bin/bash
# .opencode/hooks/pre-push/01-full-test.sh
npm run test:coverage

# .opencode/hooks/pre-push/02-version-check.sh
# Verify manifest.json and package.json versions match
MANIFEST_VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/')
PACKAGE_VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
if [ "$MANIFEST_VERSION" != "$PACKAGE_VERSION" ]; then
  echo "Version mismatch: manifest.json ($MANIFEST_VERSION) != package.json ($PACKAGE_VERSION)"
  exit 1
fi
```

### Post-Merge Hooks (`.opencode/hooks/post-merge/`)
```bash
#!/bin/bash
# .opencode/hooks/post-merge/01-install-deps.sh
if git diff HEAD@{1}..HEAD --name-only | grep -q "package.json"; then
  npm ci
fi

# .opencode/hooks/post-merge/02-clear-cache.sh
rm -rf coverage/
```

## Agent Session Hooks

### Session Start (`.opencode/hooks/session-start/`)
```bash
#!/bin/bash
# .opencode/hooks/session-start/01-load-context.sh
# Load project context for agent
echo "Loading FakeData context..."
cat .opencode/team/context/architecture-decisions.md
cat .opencode/team/context/api-contracts.md
cat .opencode/team/context/coding-standards.md
```

### Session End (`.opencode/hooks/session-end/`)
```bash
#!/bin/bash
# .opencode/hooks/session-end/01-save-memory.sh
# Save agent memory
AGENT_NAME=${OPENCODE_AGENT_NAME:-"unknown"}
mkdir -p .opencode/team/memory/$AGENT_NAME
cat > .opencode/team/memory/$AGENT_NAME/last-session.md << EOF
# Last Session - $(date)
Agent: $AGENT_NAME
Working Directory: $(pwd)
Git Branch: $(git branch --show-current)
Last Commit: $(git log -1 --oneline)
EOF
```

## Custom Hook Commands

### `opencode hook run test-changed`
```bash
# Runs tests only for files changed in current session
npx vitest run --changed
```

### `opencode hook run coverage-check`
```bash
# Verifies coverage thresholds
npx vitest run --coverage --reporter=text | grep -E "Lines|Functions|Branches|Statements"
```

### `opencode hook run manifest-validate`
```bash
# Validates manifest.json structure
npx @extensity/manifest-validator manifest.json
```

### `opencode hook run package-version-sync`
```bash
# Syncs manifest.json and package.json versions
VERSION=$(grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/')
sed -i "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" manifest.json
```

## Integration with Agents

Each agent can define its own hooks in `.opencode/team/agents/<agent-name>/hooks/`:

```
.opencode/team/agents/
├── architect/
│   └── hooks/
│       ├── pre-task.sh      # Validate ADR format before architectural decisions
│       └── post-task.sh     # Update architecture-decisions.md
├── testing/
│   └── hooks/
│       ├── pre-task.sh      # Ensure test file exists for new functions
│       └── post-task.sh     # Run coverage check
├── devops/
│   └── hooks/
│       ├── pre-release.sh   # Full test suite, version bump check
│       └── post-release.sh  # Tag git, update changelog
└── ui-ux/
    └── hooks/
        ├── pre-task.sh      # Check for accessibility issues
        └── post-task.sh     # Visual regression check (if configured)
```

## Hook Configuration (`.opencode/config/hooks.yaml`)
```yaml
hooks:
  pre-commit:
    - "01-lint.sh"
    - "02-test-changed.sh"
  pre-push:
    - "01-full-test.sh"
    - "02-version-check.sh"
  post-merge:
    - "01-install-deps.sh"
    - "02-clear-cache.sh"
  session-start:
    - "01-load-context.sh"
  session-end:
    - "01-save-memory.sh"

agent-hooks:
  architect:
    pre-task: ["validate-adr-format.sh"]
    post-task: ["update-architecture-decisions.sh"]
  testing:
    pre-task: ["ensure-test-file.sh"]
    post-task: ["run-coverage-check.sh"]
  devops:
    pre-task: ["validate-manifest.sh"]
    post-release: ["tag-release.sh", "update-changelog.sh"]
  ui-ux:
    pre-task: ["check-accessibility.sh"]
    post-task: ["visual-check.sh"]
```

## Usage

```bash
# Install hooks
opencode hook install

# Run specific hook
opencode hook run pre-commit

# List available hooks
opencode hook list

# Run agent-specific hook
opencode hook run architect:pre-task
```