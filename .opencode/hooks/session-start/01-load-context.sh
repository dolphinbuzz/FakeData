#!/bin/bash
# Session start: Load project context for agent
echo "=== FakeData Project Context ==="
echo "Architecture Decisions:"
cat .opencode/team/context/architecture-decisions.md 2>/dev/null | head -50
echo ""
echo "API Contracts:"
cat .opencode/team/context/api-contracts.md 2>/dev/null | head -50
echo ""
echo "Coding Standards:"
cat .opencode/team/context/coding-standards.md 2>/dev/null | head -30
echo ""
echo "Testing Strategy:"
cat .opencode/team/context/testing-strategy.md 2>/dev/null | head -30
echo ""
echo "=== Context Loaded ==="