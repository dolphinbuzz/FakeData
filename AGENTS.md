# AGENTS.md — FakeData Extension

## Project Overview
Chrome/Edge Manifest V3 extension for generating fake QA test data and mapping/filling web forms. No backend, zero network requests, all logic runs locally in the browser.

## Essential Commands
```bash
npm ci                    # Install deps (exact versions from package-lock.json)
npm test                  # Run Vitest suite (jsdom)
npm run test:coverage     # Run tests + coverage report (90% lines/functions/statements, 80% branches)
npm run validate-manifest # Validate manifest.json against chrome-manifest-schema.json
```

## Architecture — What's Non-Obvious
- **No background service worker** — direct `popup ↔ content` messaging via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`
- **Dynamic imports in content script** — `selector-engine.js` and `messages.js` loaded via `chrome.runtime.getURL()` + `import()`; `modulesReady` Promise prevents race conditions
- **Web accessible resources required** — `selector-engine.js` and `messages.js` declared in `manifest.json` for dynamic import to work
- **CSP: `script-src 'self'`** — no inline scripts, no `eval`, no `new Function()`; all JS in external files
- **Callbacks, not Promises** — `chrome.storage.local.get/set` use callbacks (not `await`) per Chrome API design
- **ESM everywhere** — `package.json: "type": "module"`, all scripts use `import`/`export`

## Module Map (src/scripts/)
| File | Purpose | Test Coverage Target |
|------|---------|---------------------|
| `app.js` | UI orchestration, messaging, storage, profile management | 85% lines |
| `content.js` | Content script (IIFE, strict mode) — fill, mark, floating controls | 85% lines |
| `generators.js` | Pure data generation (Person, Vehicle, Company) + validators | 95% lines/functions/statements, 90% branches |
| `selector-engine.js` | DOM scanning, type inference, CSS selector generation | 90% lines/functions/statements, 85% branches |
| `messages.js` | `ACTIONS` enum (Object.freeze) — single source of truth for messaging | 100% all metrics |
| `data/estados.js` | `ESTADOS`, `DDDS` constants | 100% lines |
| `data/mapping-types.js` | `MAPPING_TYPES` (29 field types) | 100% lines |
| `data/vehicle-catalog.js` | Vehicle catalog CRUD (stored in `chrome.storage.local`) | 90% lines/functions/statements, 85% branches |

## Testing — Critical Details
- **Framework**: Vitest + jsdom (`vitest.config.js`)
- **Global mocks**: `tests/setup.js` mocks `chrome.*` APIs, DOM methods, `MutationObserver`, `CSS.escape`, `getComputedStyle`
- **Coverage thresholds** — per-file in `vitest.config.js`; global 90/90/90/80
- **Test utilities** in `setup.js`: `createMockField()`, `createMockContext()`, `createMockVehicle()`, `createMockProfile()`
- **Run single test file**: `npx vitest run tests/generators.test.js`
- **CI runs on Node 22** — `npm ci` then `npm run test:coverage`

## Key Conventions (Enforced in CI)
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branch prefixes**: `feature/`, `fix/`, `refactor/`, `docs/`, `chore/`
- **Constants/enums**: `Object.freeze()` (e.g., `ACTIONS`, `MAPPING_TYPES`)
- **Pure functions**: Export for testability; context object pattern in `generators.js`
- **Sanitization**: All user content escaped via `escapeHtml()` before DOM injection
- **Version sync**: `manifest.json` version **must equal** `package.json` version (CI check)

## Storage Schema (chrome.storage.local)
```
profiles: { [baseUrl]: { [pageUrl]: { id, name, fields[], audit[] } } }
vehicleCatalog: { brands: [{ name, models: [] }] }
preferences: { uf: "SP", floatingControlsVisible: true, theme: "light" }
```
- Base URL = normalized origin (protocol + domain + port), groups subdomains
- Page URL = normalized (no query/hash); multiple profiles per page supported
- Fixed values per field persisted in profile via `fixedValue` flag

## Messaging Protocol (`messages.js` — ACTIONS enum)
| Action | Direction | Purpose |
|--------|-----------|---------|
| `SCAN_FIELDS` | popup → content | Trigger field scan |
| `FILL_FIELD` | popup → content | Fill single field |
| `FILL_ALL_FIELDS` | popup → content | Batch fill |
| `MARK_FIELD` / `MARK_ALL_FIELDS` | popup → content | Highlight field(s) |
| `PAGE_FIELD_FILL_REQUEST` | content → popup | Floating button clicked |
| `PAGE_CHANGED` | content → popup | SPA navigation detected |
| `GET_PROFILES` / `SAVE_PROFILE` / `DELETE_PROFILE` | popup ↔ content | Profile CRUD |
| `GET_VEHICLE_CATALOG` / `SAVE_VEHICLE_CATALOG` | popup ↔ content | Vehicle catalog sync |

## CI Pipeline (`.github/workflows/ci.yml`)
| Job | Purpose |
|-----|---------|
| `test` | `npm ci` → `npm run test:coverage` → upload artifact |
| `lint` | `npm run lint --if-present` (optional) |
| `manifest-validation` | `npm run validate-manifest` |
| `version-consistency` | Checks `manifest.json` version = `package.json` version |

## Release Checklist
1. All CI checks pass (test, lint, manifest, version)
2. Coverage ≥ 90% lines/functions/statements, 80% branches
3. `CHANGELOG.md` updated (Keep a Changelog format)
4. Version bump in **both** `manifest.json` and `package.json` (SemVer)
5. Git tag: `git tag vX.Y.Z`
6. Package extension (zip `src/`, `manifest.json`, excluding test/node_modules)
7. Upload to Chrome Web Store Developer Dashboard

## OpenCode Agentic Team (Specialized Skills)
Defined in `opencode.json` — each skill maps to a domain:
- `fakedata-architect` — architecture, ADRs, cross-cutting decisions
- `fakedata-generator` — data generation logic (generators.js, vehicle-catalog.js)
- `fakedata-selector-engine` — selector logic, field scanning, inference
- `fakedata-content-script` — content script injection, fill, floating controls
- `fakedata-messaging` — messaging protocol, ACTIONS enum
- `fakedata-storage-profile` — chrome.storage, profiles, migration
- `fakedata-testing` — Vitest, coverage, CI/CD
- `fakedata-devops` — build, release, manifest versioning
- `fakedata-documentation` — README, CHANGELOG, PRIVACY_POLICY
- `fakedata-ui-ux` — popup.html, popup.css, theming, accessibility

## Common Gotchas
- **Content script not injected** — reload extension on `chrome://extensions`, then reopen popup/sidepanel; next scan injects updated script
- **No fields found** — must be `http(s)://` page; `chrome://`, `edge://`, local files, extension stores blocked
- **Selector fails** — use Playground (sub-tab) to verify selector matches; prefer stable selectors (id, data-test, ARIA)
- **Coverage fails locally** — ensure Node 22, run `npm ci` first; check `vitest.config.js` per-file thresholds
- **Version mismatch** — CI fails if `manifest.json` version ≠ `package.json` version

## References
- `README.md` — user-facing docs, shortcuts, troubleshooting
- `CONTRIBUTING.md` — code standards, branch/commit conventions, agent workflow
- `specs/08-arquitetura-decisoes.md` — ADRs, architecture decisions
- `.github/workflows/ci.yml` — CI pipeline
- `vitest.config.js` — test config, coverage thresholds
- `tests/setup.js` — global mocks, test utilities