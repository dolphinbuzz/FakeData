#!/bin/bash
# Session end: Save agent memory
AGENT_NAME=${OPENCODE_AGENT_NAME:-"unknown"}
MEMORY_DIR=".opencode/team/memory/$AGENT_NAME"
mkdir -p "$MEMORY_DIR"

cat > "$MEMORY_DIR/last-session.md" << EOF
# Last Session - $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Agent: $AGENT_NAME
Working Directory: $(pwd)
Git Branch: $(git branch --show-current 2>/dev/null || echo "unknown")
Last Commit: $(git log -1 --oneline 2>/dev/null || echo "no commits")
EOF

echo "Session memory saved for agent: $AGENT_NAME"