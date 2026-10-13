# Spec: Estrategia de Testes

## Visao Geral
Framework: Vitest + jsdom (ESM nativo, rapido, bom mocking Chrome APIs). Coverage minimo 90% lines/functions/statements, 80% branches.

## Configuracao

### vitest.config.js
```javascript
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./tests/setup.js"],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    thresholds: {
      lines: 90, functions: 90, statements: 90, branches: 80
    }
  }
}
```

### tests/setup.js - Mocks Globais
- Chrome APIs (runtime, storage, tabs, scripting, sidePanel, windows)
- DOM / jsdom (Element methods, getComputedStyle, MutationObserver, history)

## Estrutura de Testes

| Arquivo | Modulo | Target Coverage | Tipo |
|---------|--------|-----------------|------|
| generators.test.js | generators.js | 95%+ | Pure functions |
| selector-engine.test.js | selector-engine.js | 95%+ | Pure functions |
| vehicle-catalog.test.js | vehicle-catalog.js | 95%+ | Pure functions |
| messages.test.js | messages.js | 100% | Constants |
| content.test.js | content.js | 85%+ | Integration |
| app.test.js | app.js | 85%+ | Integration |

## Padroes de Teste

### Funcoes Puras - Teste Direto
```javascript
import { validarCPF, cpf, gerarChassi } from "../src/scripts/generators.js";
test("validarCPF accepts valid CPF", () => {
  expect(validarCPF("111.444.777-35")).toBe(true);
});
```

### Mocks Chrome APIs
```javascript
chrome.storage.local.get.mockImplementation((keys, cb) => {
  cb({ "fakedata-field-mappings": { "https://example.com": { pages: [] } } });
});
```

### Mocks DOM (jsdom)
```javascript
Element.prototype.matches = vi.fn((selector) => true);
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  top: 0, left: 0, right: 100, bottom: 30, height: 30, width: 100
}));
```

## Plano de Testes por Modulo

### generators.test.js (95%+)
- validarCPF/validarCNPJ/validarChassi: edge cases
- cpf()/cnpj(): formato, digitos verificadores, alfanumerico
- gerarChassi: 17 chars, check digit ISO 3779
- gerarPlaca: Mercosul 60% / antiga 40%
- createGeneratorData: context, fields, opcoes
- generateMappedValue: 29 tipos, inputTypes (checkbox, radio, date, month, number)

### selector-engine.test.js (95%+)
- inferType: autocomplete, labels, select options, patterns
- selectorFor: priority 1-5, dynamic ID detection, combinations, fallback
- scan: visible fields, custom selects, ignored types, duplicate selectors
- captureNextClick: click handler, fieldFromTarget, labelsFor
- normalize: NFD, lowercase, trim, underscore/space handling
- pageSignature/installNavigationObserver: SPA detection

### vehicle-catalog.test.js (95%+)
- normalizeVehicleCatalog: dedup brands/models, case insensitive
- add/remove/rename VehicleModel/Brand
- pickVehicle: custom catalog priority, fallback to DEFAULT

### content.test.js (85%+)
- fill: all input types, Select2 detection, custom selects, date/month/number formatting
- mark/unmark/highlight: outline management, visualTarget
- updatePageControls: floating button creation, positioning, click -> runtime.sendMessage
- handleMessage: all ACTIONS, async responses, error handling

### app.test.js (85%+)
- migrateLegacyProfiles: old format -> new format
- read/write/persistPageMapping: storage operations
- save/load/rename/delete profiles
- sendMessageToTab: injection fallback, error handling
- scanPageFields/fillPageField/fillAllPageFields: integration flows
- getBaseUrl/normalizePageUrl/profileId: pure functions
- Keyboard shortcuts: Alt+Shift+S/P/F/L/M, editable target exclusion

### messages.test.js (100%)
- ACTIONS is frozen Object, all 17 actions present

## Thresholds de Cobertura (vitest.config.js)
```javascript
thresholds: {
  lines: 90, functions: 90, branches: 80, statements: 90,
  "src/scripts/app.js": { lines: 85 },
  "src/scripts/content.js": { lines: 85 },
  "src/scripts/selector-engine.js": { lines: 90, functions: 90, branches: 85 },
  "src/scripts/generators.js": { lines: 95, functions: 95, branches: 90 },
  "src/scripts/messages.js": { lines: 100, functions: 100, branches: 100 }
}
```

## CI Pipeline (.github/workflows/ci.yml)
- Trigger: push/PR to main
- Node 22, npm ci, npm run test:coverage
- Upload coverage artifact

## Debugging
- npm test / npm run test:coverage
- npx vitest run tests/generators.test.js (single file)
- npx vitest --ui (UI mode)
- npx vitest run -t "test name" (specific test)

## Prevencao de Flaky Tests
- vi.useFakeTimers() para timeouts
- Sem network calls (all mocked)
- Deterministic random: vi.spyOn(Math, "random").mockReturnValue(0.5)
- vi.clearAllMocks() em beforeEach
- document.body.innerHTML = "" em beforeEach

## Test Data Builders
```javascript
global.createMockField = (overrides) => ({ key, selector, label, ... });
global.createMockContext = (overrides) => ({ nome, sobrenome, estado, ... });
global.createMockVehicle = (overrides) => ({ marca, modelo, ... });
global.createMockProfile = (overrides) => ({ id, name, pageUrl, ... });
```

## Regressao
- Bug encontrado -> write failing test first -> fix
- Test file naming: *.test.js
- One test file per source module
- Export test utilities from tests/helpers.js if shared