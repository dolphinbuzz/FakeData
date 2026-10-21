# FakeData Testing

## Descrição
Estratégia de testes - Vitest, jsdom, coverage 90%, mocking explícito de Chrome API, mutation testing com Stryker e CI/CD.

## Modelo
opencode/nemotron-3-ultra-free

## Ferramentas
- read
- write
- edit
- glob
- grep
- shell
- question

## Configuração
- vitest.config.js - ESM, jsdom, thresholds coverage (90% lines/functions/statements, 80% branches)
- tests/setup.js - apenas ambiente jsdom (sem mocks globais permissivos)
- tests/fixtures/chrome-mock.js - `createChromeMock` configurável por teste
- tests/fixtures/dom-factory.js - `createPopupDOM` (lê o `src/popup.html` real) e `scannedFields`
- tests/helpers/ - `loadApp`, `nextTick` e interações/asserções compartilhadas
- stryker.config.json - mutation testing (score mínimo 60%)
- .github/workflows/ci.yml - Node 22, npm ci, test:coverage, mutation em main

## Arquivos de Teste
- generators.test.js (95%+) - Funções puras
- selector-engine.test.js (95%+) - Funções puras + estado de módulo
- vehicle-catalog.test.js (95%+) - Funções puras
- messages.test.js (100%) - Enum ACTIONS
- content.test.js (90%+) - Integração
- app-mapping.test.js (90%+) - Popup: mapeamento
- app-lifecycle.test.js (90%+) - Popup: ciclo de vida, fila de injeção, perfis
- app-generator.test.js (90%+) - Popup: gerador
- app-playground.test.js (90%+) - Popup: playground
- app-theme-tabs.test.js (90%+) - Popup: tema, abas e modos
- app-vehicle-catalog.test.js (90%+) - Popup: catálogo de veículos
- app-panel.test.js (90%+) - Popup: maximizar/fechar painel
- app-field-actions.test.js (90%+) - Popup: ações da lista de campos
- app-floating-controls.test.js (90%+) - Popup: preenchimento sob demanda

## Pattern de Mocking Chrome API
```javascript
import { createChromeMock } from "./fixtures/chrome-mock.js";

const chromeMock = createChromeMock({
  scanFields,
  openTabs: [{ id: 10, url: "https://app.test/form", active: true }],
  sendMessageResponses: {
    [ACTIONS.SCAN_FIELDS]: { fields: scanFields },
    [ACTIONS.FILL_FIELD]: { filled: true }
  }
});
```
- Não existe mais `global.chrome` no setup.
- Para simular erro: `chromeMock.runtime.lastError = {...}` dentro de `mockImplementation`.
- Para simular API ausente: `delete chromeMock.tabs.query`.

## DOM (jsdom real)
- `createPopupDOM()` carrega `src/popup.html` (remove apenas o `<script>` do app).
- Nunca mockar `Element.prototype`/`getComputedStyle`; se precisar de comportamento, use DOM real.
- `vi.resetModules()` + import dinâmico para módulos com estado (`app.js`, `selector-engine.js`).

## Comandos
- npm test -> vitest run
- npm run test:coverage -> vitest run --coverage
- npm run test:mutation -> stryker run
- npx vitest run tests/generators.test.js (arquivo único)
- npx vitest --ui (modo UI)
- npx stryker run --dryRunOnly (valida configuração)

## Thresholds de Coverage
- Módulos críticos (generators, selector-engine, vehicle-catalog, messages): 90%+
- Módulos de integração (app, content): 90%+
- Mutation score mínimo (break): 60% em selector-engine, generators e vehicle-catalog

## Testes de Regressão
- Bug encontrado -> escrever teste falhando primeiro -> corrigir
- Nomeação arquivo de teste: *.test.js
- `app.js` dividido por feature em `app-*.test.js`
- Utilitários compartilhados em `tests/fixtures/` e `tests/helpers/`
