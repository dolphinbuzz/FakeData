# Development Workflows - FakeData Team

## Feature Development Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Architect  │────▶│ Specialist Agent │────▶│   Testing       │────▶│ Documentation   │────▶│   DevOps    │
│  (Spec)     │     │  (Implementation)│     │  (Validation)   │     │  (Update Docs)  │     │  (Release)  │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘     └─────────────┘
```

### Steps

1. **Architect** creates specification/ADR in `.opencode/team/context/architecture-decisions.md`
2. **Specialist Agent** implements feature:
   - Data Generation → `generators.js`, `vehicle-catalog.js`, `estados.js`
   - Selector Engine → `selector-engine.js`
   - Content Script → `content.js`
   - UI/UX → `popup.html`, `popup.css`, `app.js` (UI logic)
   - Messaging → `messages.js`, `app.js` (messaging), `content.js` (handler)
   - Storage/Profile → `app.js` (storage logic)
3. **Testing** creates/updates tests:
   - Unit tests for pure functions (generators, selector-engine, vehicle-catalog)
   - Integration tests for flows (app, content)
   - Run `npm run test:coverage` - must pass 90% threshold
4. **Documentation** updates:
   - README.md if user-facing change
   - CHANGELOG.md
   - docs/ technical docs
   - API contracts if messaging/storage changed
5. **DevOps** prepares release:
   - Version bump (manifest.json + package.json)
   - Full test suite passes
   - Package for Chrome Web Store

## Bug Fix Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  Testing    │────▶│ Specialist Agent │────▶│   Testing       │────▶│ Documentation   │
│ (Reproduce) │     │  (Fix)           │     │ (Validate +     │     │  (If Needed)   │
│             │     │                  │     │  Regression)    │     │                │
└─────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

### Steps

1. **Testing** creates failing test that reproduces bug
2. **Specialist Agent** fixes the bug
3. **Testing** validates fix + runs regression tests
4. **Documentation** updates if user-facing behavior changed

## Refactoring Workflow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Architect  │────▶│ Specialist Agents│────▶│   Testing       │────▶│  Architect  │
│  (Scope)    │     │  (Refactor)      │     │ (Coverage Check)│     │ (Review)    │
└─────────────┘     └──────────────────┘     └─────────────────┘     └─────────────┘
```

### Steps

1. **Architect** defines scope and strategy (ADR)
2. **Specialist Agents** refactor their domains in parallel
3. **Testing** ensures coverage maintained (90%+)
4. **Architect** final code review

## Cross-Cutting Changes (Messaging, Storage, Manifest)

```
┌─────────────┐     ┌──────────────────────────────────────┐     ┌─────────────────┐
│  Architect  │────▶│ All Affected Agents (Coordinated)    │────▶│  Testing + Docs │
│  (ADR)      │     │ - Update contracts                   │     │  (Validate)     │
│             │     │ - Implement changes                  │     │                 │
└─────────────┘     └──────────────────────────────────────┘     └─────────────────┘
                            │
                            ▼
                   ┌─────────────────┐
                   │    DevOps       │
                   │ (Version Bump)  │
                   └─────────────────┘
```

### Steps

1. **Architect** creates ADR for breaking change
2. **All Affected Agents** coordinate:
   - Update `api-contracts.md`
   - Implement changes in respective modules
   - Update tests
3. **Testing + Documentation** validate
4. **DevOps** bumps version (minor/major)

## Agent Communication Protocol

### Daily Standup (Async)
Each agent updates their memory:
- `.opencode/team/memory/<agent>/last-session.md`
- `.opencode/team/memory/<agent>/todo.md`
- `.opencode/team/memory/<agent>/blockers.md`

### Handoffs
When Agent A needs work from Agent B:
1. Agent A creates issue in Agent B's todo.md
2. Agent B picks up when capacity available
3. Agent B updates memory when complete
4. Agent A validates

### Escalation
- Architect resolves technical disagreements
- DevOps resolves release blockers
- Testing resolves quality gates

## Quality Gates

### Pre-Commit (Local)
- Lint (if configured)
- Tests for changed files only

### Pre-Push (Local/Remote)
- Full test suite with coverage
- Version consistency check (manifest.json = package.json)

### CI (GitHub Actions)
- Node 22
- `npm ci`
- `npm run test:coverage`
- Coverage artifact upload
- Must pass 90% lines/functions/statements, 80% branches

### Release
- All CI checks pass
- Coverage >= 90%
- CHANGELOG updated
- Version bumped
- Package validated

## Tool Commands

Comandos reais deste projeto:

```bash
# Suíte completa
npm test

# Cobertura com thresholds (linhas/funções/statements >= 90%, branches >= 80%)
npm run test:coverage

# Valida a estrutura do manifest.json
npm run validate-manifest
```

> Os workflows e agentes descritos neste diretório são **convenções documentais**. O OpenCode V2 não tem os subcomandos `opencode workflow ...` nem `opencode hook ...` (confira `opencode --help`); não existe execução automática desses fluxos. Os hooks de Git reais ficam em `.opencode/hooks/` e são instalados de forma opt-in via `core.hooksPath` — veja `.opencode/hooks/README.md`.