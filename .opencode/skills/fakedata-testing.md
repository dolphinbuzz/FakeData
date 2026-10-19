# FakeData Testing

## Descrição
Estratégia de testes - Vitest, jsdom, 90% coverage, mocking Chrome API, CI/CD.

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
- tests/setup.js - Mocks globais (se criados)
- .github/workflows/ci.yml - Node 22, npm ci, test:coverage, artifact upload

## Arquivos de Teste
- generators.test.js (95%+) - Funções puras
- selector-engine.test.js (95%+) - Funções puras
- vehicle-catalog.test.js (95%+) - Funções puras
- messages.test.js (100%) - Enum ACTIONS
- content.test.js (90%+) - Integração, mocks complexos
- app.test.js (90%+) - Integração, mocks complexos

## Pattern de Mocking Chrome API
```javascript
global.chrome = {
  runtime: { sendMessage, onMessage: {addListener}, lastError, getURL },
  storage: { local: { get, set } },
  tabs: { query, sendMessage, onActivated: {addListener}, create },
  scripting: { executeScript },
  sidePanel: { open, close },
  windows: { getCurrent }
}
```

## DOM Mocking (jsdom)
- Element.prototype: matches, closest, querySelector, querySelectorAll, getBoundingClientRect, scrollIntoView, dispatchEvent
- window.getComputedStyle -> {display: "block", visibility: "visible"}
- MutationObserver, history.pushState/replaceState

## Comandos
- npm test -> vitest run
- npm run test:coverage -> vitest run --coverage
- npx vitest run tests/generators.test.js (arquivo único)
- npx vitest --ui (modo UI)

## Thresholds de Coverage
- Módulos críticos (generators, selector-engine, vehicle-catalog, messages): 90%+
- Módulos de integração (app, content): 90%+

## Testes de Regressão
- Bug encontrado -> escrever teste falhando primeiro -> corrigir
- Nomeação arquivo de teste: *.test.js
- Exportar utilitários de teste de tests/helpers.js se compartilhados