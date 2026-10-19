#!/bin/bash
# Session start: Load project context for agent
echo "=== FakeData Project Context ==="
echo "Architecture Decisions:"
cat .opencode/context/architecture-decisions.md 2>/dev/null | head -50
echo ""
echo "API Contracts:"
cat .opencode/context/api-contracts.md 2>/dev/null | head -50
echo ""
echo "Coding Standards:"
cat .opencode/context/coding-standards.md 2>/dev/null | head -30
echo ""
echo "Testing Strategy:"
cat .opencode/context/testing-strategy.md 2>/dev/null | head -30
echo ""
echo "=== Context Loaded ==="