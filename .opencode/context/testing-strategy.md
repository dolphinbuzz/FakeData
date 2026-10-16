# Testing Strategy - FakeData

## Overview
- **Framework**: Vitest + jsdom (ESM native, fast, good Chrome API mocking)
- **Coverage Target**: 90% lines global, 90% functions, 80% branches, 90% statements
- **Critical Modules (90%+)**: `generators.js`, `selector-engine.js`, `vehicle-catalog.js`, `messages.js`
- **UI/Integration Modules (85%+)**: `app.js`, `content.js`
- **CI**: Node 22, `npm ci`, `npm run test:coverage`, artifact upload

## Test File Structure
```
tests/
├── setup.js                    # Global mocks, chrome APIs, DOM extensions
├── generators.test.js          # Data generation (pure functions)
├── selector-engine.test.js     # Selector logic (pure functions)
├── vehicle-catalog.test.js     # Catalog CRUD (pure functions)
├── messages.test.js            # ACTIONS enum
├── content.test.js             # Content script (integration, mocks)
├── app.test.js                 # App logic (integration, mocks)
```

## Mocking Strategy

### Global Setup (tests/setup.js)
```javascript
import { vi } from "vitest";

// Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: vi.fn((msg, cb) => cb && cb({})),
    onMessage: { addListener: vi.fn() },
    lastError: null,
    getURL: (path) => `chrome-extension://test/${path}`,
    id: "test-extension-id"
  },
  storage: {
    local: {
      get: vi.fn((keys, cb) => cb && cb({})),
      set: vi.fn((obj, cb) => cb && cb())
    }
  },
  tabs: {
    query: vi.fn((query, cb) => cb && cb([
      { id: 1, url: "https://example.com/page", active: true, title: "Test" }
    ])),
    sendMessage: vi.fn((tabId, msg, cb) => cb && cb({})),
    onActivated: { addListener: vi.fn() },
    create: vi.fn((opts, cb) => cb && cb({ id: 2, url: opts.url }))
  },
  scripting: {
    executeScript: vi.fn((opts, cb) => cb && cb())
  },
  sidePanel: {
    open: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve())
  },
  windows: {
    getCurrent: vi.fn((cb) => cb && cb({ type: "popup", id: 1 }))
  }
};

// DOM / jsdom extensions
Object.defineProperty(window, "CSS", {
  value: { escape: (s) => s.replace(/([^\w-])/g, "\\$1") },
  writable: true
});

Element.prototype.matches = vi.fn((selector) => true);
Element.prototype.closest = vi.fn((selector) => null);
Element.prototype.querySelector = vi.fn(() => null);
Element.prototype.querySelectorAll = vi.fn(() => []);
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  top: 0, left: 0, right: 100, bottom: 30, height: 30, width: 100
}));
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.dispatchEvent = vi.fn(() => true);

window.getComputedStyle = vi.fn(() => ({
  display: "block", visibility: "visible", outline: "", outlineOffset: ""
}));

HTMLInputElement.prototype.value = "";
HTMLSelectElement.prototype.options = [];
HTMLSelectElement.prototype.value = "";

global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn(() => [])
}));

window.history.pushState = vi.fn();
window.history.replaceState = vi.fn();
window.location.href = "https://example.com/page";
```

### Per-Test Chrome Mock Overrides
```javascript
// In test file - override specific behavior
chrome.storage.local.get.mockImplementation((keys, cb) => {
  cb({ "fakedata-field-mappings": { "https://example.com": { pages: [] } } });
});

chrome.tabs.sendMessage.mockImplementation((tabId, msg, cb) => {
  if (msg.action === "SCAN_FIELDS") cb({ fields: [...] });
  else cb({});
});
```

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
| `gerarPlaca` | Mercosul pattern (ABC1D23), old pattern (ABC-1234), ~60/40 split |
| `gerarAno` | Format YYYY/YYYY, fabrication 2015-2026, model = fab or fab+1 |
| `gerarEmailPessoa` | Format primeiro.sobrenomeN@provider, providers list |
| `gerarEmailEmpresa` | Format contatoN@provider |
| `gerarSite` | https://www.normalizednameN.com.br |
| `createGeneratorData` | Returns person/vehicle/company with context(), fields[] |
| `generateMappedValue` | All 29 types, inputTypes: checkbox, radio, date, month, number, text |

### selector-engine.test.js (Target: 95%+)
| Function | Test Cases |
|----------|------------|
| `normalize` | NFD, lowercase, trim, underscores/hyphens to spaces, multiple spaces |
| `visible` | display:none, visibility:hidden, zero rects, normal element |
| `inferType` | autocomplete values, select options (state, gender), label patterns, type/name/placeholder |
| `selectorFor` | Priority 1: id, data-cy, data-test, data-testid (unique) |
| | Priority 2: role, aria-label, aria-labelledby |
| | Priority 3: value, ng-model, name, type |
| | Priority 4: combinations (ng-model+name+type, name+type+value, role+aria-label) |
| | Priority 5: static text (fragile), structural fallback (fragile) |
| | Dynamic ID detection (hashes, ember, component, r123) |
| `scan` | Visible fields only, ignored types excluded, custom selects included, duplicate selector detection |
| `captureNextClick` | Click handler registered, fieldFromTarget logic, labelsFor, 30s timeout |
| `labelsFor` | element.labels, parent label, aria-labelledby, previous sibling |
| `fieldFromTarget` | Direct match, option->custom select, label->control/for/nested, container->field |
| `pageSignature` | URL + selector|rule|status for all visible fields |
| `installNavigationObserver` | pushState/replaceState/popstate/hashchange/MutationObserver |

### vehicle-catalog.test.js (Target: 95%+)
| Function | Test Cases |
|----------|------------|
| `normalizeVehicleCatalog` | Dedup brands (case-insensitive), dedup models, filter empty, default catalog fallback |
| `validateVehicleEntry` | Empty brand, empty model, valid |
| `addVehicleModel` | New brand+model, existing brand new model, duplicate model rejected, validation error |
| `removeVehicleModel` | Remove model, remove last model removes brand, case-insensitive |
| `removeVehicleBrand` | Remove brand, case-insensitive |
| `renameVehicleBrand` | Valid rename, empty name error, duplicate name error |
| `renameVehicleModel` | Valid rename, empty name error, duplicate model error |
| `pickVehicle` | Custom catalog priority, fallback to DEFAULT, random selection |

### content.test.js (Target: 85%+)
| Function | Test Cases |
|----------|------------|
| `fill()` | text, email, number (BR format), date (dd/mm/yyyy->yyyy-mm-dd), month, checkbox, radio, select (waitForOptions), Select2 detection, custom select (multi-select, role=combobox) |
| `fillSelect()` | Wait for options, match value/text, random fallback, dispatch input+change |
| `fillCustomSelect()` | Click trigger, find visible option, click, close menu |
| `mark()/unmark()/highlight()` | Outline management, visualTarget (Select2, custom select, normal), cleanup |
| `updatePageControls()` | Button creation, positioning (getBoundingClientRect + scroll), click handler -> PAGE_FIELD_FILL_REQUEST |
| `handleMessage()` | All ACTIONS handlers, async responses, error handling |
| `select2NativeField()` | select.select2-hidden-accessible, aria-labelledby container, previous sibling |

### app.test.js (Target: 85%+)
| Function | Test Cases |
|----------|------------|
| `migrateLegacyProfiles` | Old format (array per URL) -> new format (baseUrl + pages), legacyId generation |
| `readProfiles`/`writeProfiles` | Storage get/set with defaults, callback handling |
| `persistPageMapping` | New profile (modal -> save), existing profile update, storage structure |
| `loadSavedProfile` | Find by id, map fields (fixed Boolean, fixedValue default), render |
| `savePageMappings` | No profile selected -> modal, profile selected -> update |
| `renameSavedProfile`/`deleteSavedProfile` | Modal/confirm, storage update |
| `sendMessageToTab` | Success, injection fallback (once), error propagation |
| `scanPageFields` | Remapping, preserveCurrent, profile matching, status messages |
| `fillPageField`/`fillAllPageFields` | Fixed vs generated, sequential fill, response handling |
| `getBaseUrl`/`normalizePageUrl`/`profileId` | Pure function tests |
| Keyboard shortcuts | Alt+Shift+S/P/F/L/M, editable target exclusion |

### messages.test.js (Target: 100%)
- `ACTIONS` is frozen Object
- All 17 actions present with correct string values

## Coverage Thresholds (vitest.config.js)
```javascript
coverage: {
  provider: "v8",
  reporter: ["text", "html"],
  thresholds: {
    lines: 90,
    functions: 90,
    branches: 80,
    statements: 90
  },
  // Per-file overrides if needed
  // perFile: true
}
```

## Running Tests
```bash
npm test              # vitest run
npm run test:coverage # vitest run --coverage (text + html report)
```

## CI Pipeline (.github/workflows/ci.yml)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

## Debugging Tests
```bash
# Run single test file
npx vitest run tests/generators.test.js

# Run with UI
npx vitest --ui

# Debug specific test
npx vitest run -t "validarCPF accepts valid CPF"

# Coverage only for changed files
npx vitest run --coverage --changed
```

## Flaky Test Prevention
- No real timers (use `vi.useFakeTimers()` for timeouts)
- No network calls (all mocked)
- Deterministic random: `vi.spyOn(Math, "random").mockReturnValue(0.5)`
- Reset mocks: `vi.clearAllMocks()` in `beforeEach`
- Isolated DOM: `document.body.innerHTML = ""` in `beforeEach`

## Test Data Builders
```javascript
// Helper to create field objects
const createField = (overrides = {}) => ({
  key: "test::0",
  selector: "#test",
  label: "Test Field",
  inferredType: "text",
  tagName: "input",
  inputType: "text",
  value: "",
  required: false,
  disabled: false,
  selectorRule: "id",
  selectorStatus: "stable",
  selectorSuggestion: "",
  locatorName: "page-test-text",
  ...overrides
});

// Helper for generator context
const createContext = (overrides = {}) => ({
  nome: "João",
  sobrenome: "Silva Santos",
  sexo: "Masculino",
  estado: { sigla: "SP", nome: "São Paulo", cidades: ["São Paulo"], ddds: ["11"] },
  ...overrides
});
```

## Regression Testing
- When bug found: write failing test first, then fix
- Test file naming: `*.test.js` (not `.spec.js`)
- One test file per source module
- Export test utilities from `tests/helpers.js` if shared