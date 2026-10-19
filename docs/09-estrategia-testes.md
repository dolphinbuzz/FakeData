# Spec: Estratégia de Testes

## Visão Geral
Framework: Vitest + jsdom (ESM nativo, rápido, bom mocking Chrome APIs). Coverage mínimo 90% lines/functions/statements, 80% branches (global). Módulos críticos têm thresholds específicos.

## Configuração

### vitest.config.js
```javascript
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./tests/setup.js"],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/scripts/**/*.js"],
    exclude: [
      "src/scripts/privacy.js",
      "tests/**",
      "coverage/**"
    ],
    thresholds: {
      lines: 90, functions: 90, statements: 90, branches: 80,
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
}
```

### tests/setup.js - Mocks Globais
- Chrome APIs (runtime, storage, tabs, scripting, sidePanel, windows)
- DOM / jsdom (Element methods, getComputedStyle, MutationObserver, history)
- Test utilities: `createMockField`, `createMockContext`, `createMockVehicle`, `createMockProfile`
- Reset automático entre testes (`vi.clearAllMocks`, `document.body.innerHTML = ""`)

## Estrutura de Testes (205 testes total)

| Arquivo | Módulo | Testes | Target Coverage | Tipo |
|---------|--------|--------|-----------------|------|
| generators.test.js | generators.js | 11 | 95%+ | Pure functions |
| selector-engine.test.js | selector-engine.js | 65 | 95%+ (funcs 90%) | Pure functions |
| vehicle-catalog.test.js | vehicle-catalog.js | 12 | 95%+ | Pure functions |
| messages.test.js | messages.js | 1 | 100% | Constants |
| content.test.js | content.js | 33 | 90%+ | Integration |
| app.test.js | app.js | 83 | 90%+ | Integration |
| **Total** | | **205** | | |

## Padrões de Teste

### Funções Puras - Teste Direto
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

## Plano de Testes por Módulo

### generators.test.js (11 testes)
- validarCPF/validarCNPJ/validarChassi: edge cases
- cpf()/cnpj(): formato, dígitos verificadores, alfanumérico
- gerarChassi: 17 chars, check digit ISO 3779
- gerarPlaca: Mercosul 60% / antiga 40%
- createGeneratorData: context, fields, opções
- generateMappedValue: 29 tipos, inputTypes (checkbox, radio, date, month, number)

### selector-engine.test.js (65 testes)
- inferType: autocomplete, labels, select options, patterns
- selectorFor: priority 1-5, dynamic ID detection, combinations, fallback
- scan: visible fields, custom selects, ignored types, duplicate selectors
- captureNextClick: click handler, fieldFromTarget, labelsFor
- normalize: NFD, lowercase, trim, underscore/space handling
- pageSignature/installNavigationObserver: SPA detection, observer cleanup
- isDynamicId: hashes, ember, component, r123, Angular patterns
- hasAngularAttributes / isAngularClass / isAngularAttribute

### vehicle-catalog.test.js (12 testes)
- normalizeVehicleCatalog: dedup brands/models, case insensitive
- add/remove/rename VehicleModel/Brand
- pickVehicle: custom catalog priority, fallback to DEFAULT
- **Novos**: entradas não-array, modelos não-array/vazios, remoção restrita à marca, nomes vazios na renomeação

### content.test.js (33 testes)
- fill: all input types, Select2 detection, custom selects, date/month/number formatting
- mark/unmark/highlight: outline management, visualTarget
- updatePageControls: floating button creation, positioning, click -> runtime.sendMessage
- handleMessage: all ACTIONS, async responses, error handling
- **Novos**: re-injection guard, installationProbe, dispose, navigation observer cleanup, concurrent injection simulation

### app.test.js (83 testes)
- migrateLegacyProfiles: old format -> new format
- read/write/persistPageMapping: storage operations
- save/load/rename/delete profiles
- sendMessageToTab: injection fallback, error handling
- **Fila de injeção (A2)**: pendingInjections coalescing, injectContentScript serialization, waiter notification, error handling
- scanPageFields/fillPageField/fillAllPageFields: integration flows
- getBaseUrl/normalizePageUrl/profileId: pure functions
- Keyboard shortcuts: Alt+Shift+S/P/F/L/M/C, editable target exclusion
- **Novos**: concurrency (duas abas), error/throw handling, dispose simulation

### messages.test.js (1 teste)
- ACTIONS is frozen Object, all 16 actions present

## Thresholds de Cobertura (vitest.config.js) — Reais
```javascript
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
```

## CI Pipeline (.github/workflows/ci.yml) — 4 Jobs

| Job | Descrição |
|-----|-----------|
| **test** | Node 22, npm ci, npm run test:coverage, upload coverage artifact |
| **lint** | npm run lint --if-present (no-op: não há script lint definido) |
| **manifest-validation** | npm run validate-manifest (ajv-cli + schema Chrome) |
| **version-consistency** | Compara manifest.json version vs package.json version |

- Trigger: push/PR to main
- Node 22, npm ci em todos jobs

## Coverage Real (npm run test:coverage)
```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.63 |    89.79 |    97.1 |   98.63 |
 scripts           |   98.54 |    89.23 |   96.98 |   98.54 |
  app.js           |   98.07 |    86.71 |   95.83 |   98.07 | 339-350,1322-1335
  content.js       |     100 |    87.72 |   96.29 |     100 | ...71,478,483-484
  generators.js    |     100 |    96.83 |     100 |     100 | ...24,164-165,345
  messages.js      |     100 |      100 |     100 |     100 |
  selector-engine.js|   97.04 |    91.57 |   94.28 |   97.04 | ...55-258,335-339
 scripts/data      |     100 |      100 |     100 |     100 |
  estados.js       |     100 |      100 |     100 |     100 |
  mapping-types.js |     100 |      100 |     100 |     100 |
  vehicle-catalog.js|     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

**✅ Gate de coverage**: todos os thresholds são atendidos; nenhum threshold por arquivo abaixo de 90% (`app.js`/`content.js` lines, `selector-engine.js`/`vehicle-catalog.js` branches); `vehicle-catalog.js` com 100% branches e `selector-engine.js` functions 94.28% ≥ 90%.

## Debugging
- `npm test` / `npm run test:coverage`
- `npx vitest run tests/generators.test.js` (single file)
- `npx vitest --ui` (UI mode)
- `npx vitest run -t "test name"` (specific test)

## Prevenção de Flaky Tests
- `vi.useFakeTimers()` para timeouts
- Sem network calls (all mocked)
- Deterministic random: `vi.spyOn(Math, "random").mockReturnValue(0.5)`
- `vi.clearAllMocks()` em beforeEach
- `document.body.innerHTML = ""` em beforeEach

## Test Data Builders
```javascript
global.createMockField = (overrides) => ({ key, selector, label, ... });
global.createMockContext = (overrides) => ({ nome, sobrenome, estado, ... });
global.createMockVehicle = (overrides) => ({ marca, modelo, ... });
global.createMockProfile = (overrides) => ({ id, name, pageUrl, ... });
```

## Regressão
- Bug encontrado -> write failing test first -> fix
- Test file naming: *.test.js
- One test file per source module
- Export test utilities from tests/helpers.js if shared