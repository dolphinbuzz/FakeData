# Testing Strategy - FakeData

## Overview
- **Framework**: Vitest 3 + jsdom (ESM native, fast, explicit Chrome API mocking)
- **Coverage Target**: 90% lines/functions/statements, 80% branches (global); module-specific overrides
- **Mutation Testing**: Stryker 10 + `@stryker-mutator/vitest-runner` on pure modules, break at 60%
- **Core principle**: every test must fail when observable behavior changes. Tests that only execute code or assert mock call counts are rejected.
- **CI**: Node 22, `npm ci`, `npm run test:coverage` on every push/PR, `npm run test:mutation` on pushes to `main`

## Test File Structure
```
tests/
├── setup.js                    # jsdom environment only (NO permissive global mocks)
├── fixtures/
│   ├── chrome-mock.js          # createChromeMock + configurable responses + __testUtils
│   └── dom-factory.js          # createPopupDOM (loads real src/popup.html) + scannedFields
├── helpers/
│   ├── app-loader.js           # loadApp(chromeMock), nextTick, advanceTimers
│   └── interaction.js          # click, type, selectOption, pressShortcut, expectSentAction, ...
├── generators.test.js          # Data generation (pure)
├── selector-engine.test.js     # Selector logic (pure + module state)
├── vehicle-catalog.test.js     # Catalog CRUD (pure)
├── messages.test.js            # ACTIONS enum
├── content.test.js             # Content script (integration)
└── app-*.test.js               # Popup app, split by feature (9 files)
```

## Mocking Strategy

### setup.js — environment only
- Adds `matchMedia` to jsdom (theme support).
- Clears `localStorage` between tests.
- Restores spies after each test (`vi.restoreAllMocks`).

It deliberately does **not**:
- define a global `chrome` object;
- monkey-patch `Element.prototype` / `getComputedStyle`;
- replace `MutationObserver` or `history`.

This prevents "fake passing" tests: assertions run against real jsdom behavior unless the test explicitly opts into a scenario.

### Chrome mock (tests/fixtures/chrome-mock.js)
```javascript
chromeMock = createChromeMock({
  scanFields,
  profiles: [],
  vehicleCatalog: [],
  activeTab: { id: 10, url: "https://app.example.test/form" },
  openTabs: [activeTab],
  windowType: "tab",
  sendMessageResponses: {
    [ACTIONS.SCAN_FIELDS]: { fields: scanFields },
    [ACTIONS.FILL_FIELD]: { filled: true },
  },
});
```
- `tabs.sendMessage` resolves by `action` (function responses receive the message).
- `__testUtils` exposes: sent messages, storage in memory, the app `onMessage` listener, and page-change simulation.
- Override per test with `mockImplementation` for error scenarios (`runtime.lastError`) or missing APIs (`delete chromeMock.tabs.query`).

### Popup DOM (tests/fixtures/dom-factory.js)
```javascript
createPopupDOM(); // loads src/popup.html (real IDs/classes), removes app <script>
```
- Never hand-write a fake popup HTML: it drifts from production.
- `scannedFields` provides a deterministic two-field scan.

### Module state isolation
`selector-engine.js` and `app.js` keep module-level state (`lastPageSignature`, `runtimeContextInvalidated`, queues, etc.).

```javascript
beforeEach(async () => {
  vi.resetModules();
  ({ scan } = await import("../src/scripts/selector-engine.js"));
});
```

Real regression found: after the invalidated-context test, `runtimeContextInvalidated` stayed `true` and silenced notifications in later tests (false positives). `vi.resetModules()` + dynamic import per test fixes it.

## Module-Specific Test Plans

### generators.test.js (Target: 95%+)
| Function | Test Cases |
|----------|------------|
| `validarCPF` | Valid, invalid (wrong DV, all same, wrong length), formatted/unformatted |
| `validarCNPJ` | Valid numeric, valid alphanumeric, invalid DV, wrong length |
| `validarChassi` | Valid 17-char ISO 3779, invalid check digit, wrong length, invalid chars |
| `cpf()` | Formatted (14 chars), unformatted (11 chars), valid DV |
| `cnpj()` | Formatted/unformatted, numeric/alphanumeric, valid DV |
| `gerarChassi` | 17 chars, valid check digit (position 9), valid alphabet |
| `gerarPlaca` | Mercosul pattern (ABC1D23), old pattern (ABC-1234) |
| `gerarAno` | Format YYYY/YYYY, fabrication range, model = fab or fab+1 |
| `gerarEmailPessoa` / `gerarEmailEmpresa` / `gerarSite` | Formats and providers |
| `createGeneratorData` | Returns person/vehicle/company with context(), fields[] |
| `generateMappedValue` | All mapped types + inputTypes (checkbox, radio, date, month, number) |

### selector-engine.test.js (Target: 95%+)
| Function | Test Cases |
|----------|------------|
| `normalize` | NFD, lowercase, trim, underscores/hyphens to spaces, multiple spaces |
| `visible` | display:none, visibility:hidden, zero rects, normal element |
| `inferType` | autocomplete, select options, label patterns, type/name/placeholder |
| `selectorFor` | Priorities 1–5, dynamic ID detection, combinations, structural fallback |
| `scan` | Visible fields, ignored types, custom selects, duplicate selectors, collision behavior |
| `captureNextClick` | Click handler, fieldFromTarget, labelsFor |
| `labelsFor` | element.labels, parent label, aria-labelledby, previous sibling |
| `fallbackSelector` / `staticText` / `escapeAttribute` / `escapeCssIdentifier` | Real selector generation and escaping |
| `pageSignature` | URL + per-field selector/rule/status |
| `installNavigationObserver` | pushState/replaceState/popstate/hashchange/MutationObserver, cleanup |
| Module state | Invalidated context, single notification per signature, isolation between tests |

### vehicle-catalog.test.js (Target: 95%+)
| Function | Test Cases |
|----------|------------|
| `normalizeVehicleCatalog` | Dedup brands/models, case-insensitive, invalid entries, default fallback |
| `validateVehicleEntry` | Empty brand, empty model, valid |
| CRUD | add/remove/rename brand and model, duplicate names |
| `pickVehicle` | Custom catalog priority, fallback to DEFAULT |

### content.test.js (Target: 90%+)
| Function | Test Cases |
|----------|------------|
| `fill()` | text, email, number, date, month, checkbox, radio, select, Select2, custom select |
| `fillSelect()` / `fillCustomSelect()` | Options waiting, value/text match, events dispatched |
| `mark()/unmark()/highlight()` | Outline management, visualTarget, cleanup |
| `updatePageControls()` | Floating button creation/positioning, click → PAGE_FIELD_FILL_REQUEST |
| `handleMessage()` | All ACTIONS, async responses, error handling |
| Lifecycle | Re-injection guard, installationProbe, dispose, navigation observer |

### app-*.test.js (Target: 90%+ for app.js)
Split by feature:
| File | Focus |
|------|-------|
| `app-mapping.test.js` | Scan, mapping rendering, field edits, profiles, shortcuts, copy JSON |
| `app-lifecycle.test.js` | SPA changes, injection queue, storage/profile lifecycle, mark/fill errors, floating preference |
| `app-generator.test.js` | Person/vehicle/company generation, UF options, copy |
| `app-playground.test.js` | Selector check/mark/capture and their failures |
| `app-theme-tabs.test.js` | Theme persistence, tabs/subtabs, popup vs dedicated tab mode |
| `app-vehicle-catalog.test.js` | Catalog CRUD, validation and error paths |
| `app-panel.test.js` | Maximize/close side panel, missing APIs, window fallbacks |
| `app-field-actions.test.js` | Remap, label edit (Enter), highlight toggle, add selector, mark-all, clear values |
| `app-floating-controls.test.js` | PAGE_FIELD_FILL_REQUEST (found/absent/no tab/error), fixed value |

### messages.test.js (Target: 100%)
- `ACTIONS` is frozen
- All actions present with correct string values

## Coverage Thresholds (vitest.config.js)
```javascript
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov"],
  thresholds: {
    lines: 90, functions: 90, branches: 80, statements: 90,
    "src/scripts/app.js": { lines: 90 },
    "src/scripts/content.js": { lines: 90 },
    "src/scripts/selector-engine.js": { lines: 90, functions: 90, statements: 90, branches: 90 },
    "src/scripts/data/vehicle-catalog.js": { lines: 90, functions: 90, statements: 90, branches: 90 },
    "src/scripts/generators.js": { lines: 95, functions: 95, statements: 95, branches: 90 },
    "src/scripts/messages.js": { lines: 100, functions: 100, statements: 100, branches: 100 },
    "src/scripts/data/estados.js": { lines: 100 },
    "src/scripts/data/mapping-types.js": { lines: 100 }
  }
}
```

## Mutation Testing (stryker.config.json)
- **Scope**: `selector-engine.js`, `generators.js`, `data/vehicle-catalog.js`.
- **Config**: `coverageAnalysis: "perTest"`, `ignoreStatic: true`, `disableTypeChecks: false`, `timeoutMS: 20000`.
- **Thresholds**: `high: 80`, `low: 60`, `break: 60`.
- **Report**: `reports/mutation/index.html` (gitignored).
- **Why not app/content**: integration-heavy; use `--since` for incremental mutation when including them.
- Survivors must be triaged: either add a failing test or document the equivalent mutant.

## Running Tests
```bash
npm test                                        # vitest run
npm run test:coverage                           # with coverage
npm run test:mutation                           # Stryker
npx vitest run tests/generators.test.js         # single file
npx vitest run -t "test name"                   # single test
npx stryker run --mutate src/scripts/selector-engine.js
```

## CI Pipeline (.github/workflows/ci.yml)
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  test:                     # coverage + artifacts (all pushes/PRs)
  mutation:                 # npm run test:mutation (push to main / manual)
  lint:                     # npm run lint --if-present (no-op)
  manifest-validation:      # node scripts/validate-manifest.mjs (ajv 8) against Chrome schema
  version-consistency:      # manifest.json vs package.json
```

## Flaky Test Prevention
- No network calls (all Chrome APIs mocked explicitly).
- Fake timers for timeout-dependent tests.
- `vi.restoreAllMocks()` in setup and `loadApp` cleanup.
- `localStorage.clear()` + `vi.resetModules()` where module state exists.
- No shared state between files; each file builds its own DOM and mock.

## Test Data Builders
- `scannedFields` in `tests/fixtures/dom-factory.js` (deterministic scan payload).
- Chrome scenarios via `createChromeMock` options (`scanFields`, `profiles`, `vehicleCatalog`, `openTabs`, `windowType`, `sendMessageResponses`).
- Prefer real `src/popup.html` over hand-written DOM fixtures.

## Regression Testing
- Bug found: write a failing test first, then fix.
- Test file naming: `*.test.js` (not `.spec.js`).
- One file per logic module; `app.js` split by feature (`app-<feature>.test.js`).
- Shared utilities live in `tests/fixtures/` and `tests/helpers/`.
