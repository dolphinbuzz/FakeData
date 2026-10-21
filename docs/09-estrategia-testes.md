# Spec: Estratégia de Testes

## Visão Geral

- **Framework**: Vitest 3 + jsdom (ESM nativo, rápido, mocking das Chrome APIs por fixture).
- **Cobertura mínima**: 90% lines/functions/statements e 80% branches (global). Módulos críticos têm thresholds específicos.
- **Mutation testing**: Stryker 10 + `@stryker-mutator/vitest-runner` nos módulos puros, com score mínimo de **60%** (`break`).
- **Princípio central**: todo teste precisa falhar se o comportamento observável mudar. Testes que apenas executam código ou conferem contagem de chamadas de mock são considerados "viciados" e não são aceitos.

## Configuração

### vitest.config.js

```javascript
test: {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./tests/setup.js"],
  include: ["tests/**/*.test.js"],
  coverage: {
    provider: "v8",
    reporter: ["text", "html", "lcov"],
    include: ["src/scripts/**/*.js"],
    exclude: ["src/scripts/privacy.js", "tests/**", "coverage/**"],
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

### stryker.config.json

```json
{
  "testRunner": "vitest",
  "plugins": ["@stryker-mutator/vitest-runner"],
  "coverageAnalysis": "perTest",
  "ignoreStatic": true,
  "disableTypeChecks": false,
  "mutate": [
    "src/scripts/selector-engine.js",
    "src/scripts/generators.js",
    "src/scripts/data/vehicle-catalog.js"
  ],
  "reporters": ["clear-text", "progress", "html"],
  "thresholds": { "high": 80, "low": 60, "break": 60 },
  "timeoutMS": 20000
}
```

- `coverageAnalysis: "perTest"` executa apenas os testes que cobrem a linha mutada.
- `ignoreStatic: true` ignora mutantes avaliados apenas no carregamento do módulo (evita rodar a suíte inteira por mutante).
- `disableTypeChecks: false` evita o pré-processador tentar interpretar `src/popup.html` (projeto é JavaScript puro).
- Escopo inicial: módulos puros e críticos. `app.js`/`content.js` ficam fora por serem integrações caras; podem ser adicionados depois com `--since`.

### tests/setup.js — somente ambiente

O `setup.js` **não** define mocks globais permissivos de `chrome` nem substitui métodos nativos do jsdom. Ele apenas:

- garante `matchMedia` no jsdom (usado pelo tema);
- limpa `localStorage` entre testes;
- restaura spies (`vi.restoreAllMocks`) após cada teste.

Consequências deliberadas:

- Nenhum teste "passa" porque `Element.prototype.querySelectorAll` foi mockado para retornar `[]`.
- Comportamentos reais do jsdom (ex.: `new Event`, `window.close`, `location`) são exercitados de verdade.
- Mocks de Chrome APIs vivem em `tests/fixtures/chrome-mock.js` e são explícitos por teste.

## Estrutura de Testes (218 testes, 14 arquivos)

| Arquivo | Módulo alvo | Testes | Tipo |
|---|---|---|---|
| `generators.test.js` | `generators.js` | 11 | Funções puras |
| `selector-engine.test.js` | `selector-engine.js` | 74 | Funções puras + estado de módulo |
| `vehicle-catalog.test.js` | `data/vehicle-catalog.js` | 12 | Funções puras |
| `messages.test.js` | `messages.js` | 1 | Constantes |
| `content.test.js` | `content.js` | 33 | Integração (DOM real + mock de runtime) |
| `app-mapping.test.js` | `app.js` (mapeamento) | 16 | Integração do popup |
| `app-lifecycle.test.js` | `app.js` (ciclo de vida, fila, perfis) | 26 | Integração do popup |
| `app-generator.test.js` | `app.js` (gerador) | 6 | Integração do popup |
| `app-playground.test.js` | `app.js` (playground de seletores) | 7 | Integração do popup |
| `app-theme-tabs.test.js` | `app.js` (tema, abas, modo popup/aba) | 8 | Integração do popup |
| `app-vehicle-catalog.test.js` | `app.js` (catálogo de veículos) | 7 | Integração do popup |
| `app-panel.test.js` | `app.js` (maximizar/fechar painel) | 5 | Integração do popup |
| `app-field-actions.test.js` | `app.js` (ações da lista de campos) | 10 | Integração do popup |
| `app-floating-controls.test.js` | `app.js` (preenchimento sob demanda) | 2 | Integração do popup |
| **Total** | | **218** | |

O antigo `app.test.js` (83 testes em um único arquivo) foi desmembrado por feature e removido. A cobertura de linhas de `app.js` é idêntica antes e depois da divisão; os únicos trechos não cobertos (`setLoading` e `autovalidar`) já não eram cobertos pelo arquivo antigo.

### Suporte compartilhado

```
tests/
├── setup.js                     # Ambiente jsdom (sem mocks permissivos)
├── fixtures/
│   ├── chrome-mock.js           # createChromeMock + respostas por action + __testUtils
│   └── dom-factory.js           # createPopupDOM (lê src/popup.html real) + scannedFields
├── helpers/
│   ├── app-loader.js            # loadApp(chromeMock), nextTick, advanceTimers
│   └── interaction.js           # click, type, selectOption, pressShortcut,
│                                # expectSentAction, getLastSentMessage,
│                                # getPageFieldsStatus, getMappedFields, getResultFieldValues
└── *.test.js
```

- **`createChromeMock`**: mock configurável de `runtime`, `storage`, `tabs`, `scripting`, `sidePanel`, `windows` e `tabs.onActivated`. `tabs.sendMessage` responde por `action` (`sendMessageResponses`) e `__testUtils` expõe mensagens enviadas, storage em memória, listener de `onMessage` do app e simulação de mudança de página.
- **`createPopupDOM`**: carrega o `src/popup.html` real (com o `<script>` do app removido), garantindo que seletores e atributos testados existem de fato no HTML.
- **`loadApp`**: instala o mock, chama `vi.resetModules()`, importa `app.js` dinamicamente e devolve utilitários de cleanup/inspeção. O `resetModules` é obrigatório porque `app.js` e `selector-engine.js` possuem estado de módulo.
- **`interaction.js`**: centraliza interações reais de DOM e asserções de mensagens, evitando duplicação de helpers entre arquivos.

## Princípios de Qualidade (anti-testes viciados)

1. **Sem mocks globais permissivos.** `setup.js` não cria `chrome` nem sobrescreve métodos do DOM. Cada teste monta o cenário que precisa.
2. **Asserção de comportamento observável.** Valida-se DOM renderizado, storage gravado, mensagem enviada (payload exato) ou valor retornado — nunca apenas "foi chamado".
3. **Contagem de chamadas não é cobertura.** Testes que verificavam `expect(sendMessage).toHaveBeenCalledTimes(n)` sem validar o efeito foram removidos ou reescritos.
4. **`toBeDefined` isolado não é teste.** Asserções fracas foram substituídas por verificações de conteúdo, tipo e efeito.
5. **Isolamento de estado de módulo.** Arquivos com estado (`selector-engine.js`, `app.js`) são recarregados por teste via `vi.resetModules()` + `import()` dinâmico. Exemplo real: após um teste de contexto invalidado, `runtimeContextInvalidated` permanecia `true` e silenciava notificações nos testes seguintes.
6. **Nenhum teste depende de ordem.** `beforeEach` recria DOM, mock e módulo; `afterEach` restaura spies e fecha a janela.
7. **Sem duplicatas.** Um comportamento é coberto uma única vez, no arquivo da feature correspondente.

## Padrões de Teste

### Funções puras — teste direto

```javascript
import { validarCPF, cpf } from "../src/scripts/generators.js";

it("valida CPF com dígitos verificadores corretos", () => {
  expect(validarCPF("111.444.777-35")).toBe(true);
});
```

### Integração do popup — DOM real + mock explícito

```javascript
import { createChromeMock } from "./fixtures/chrome-mock.js";
import { createPopupDOM, scannedFields } from "./fixtures/dom-factory.js";
import { loadApp } from "./helpers/app-loader.js";
import { click, expectSentAction, getPageFieldsStatus } from "./helpers/interaction.js";

beforeEach(async () => {
  createPopupDOM();
  chromeMock = createChromeMock({ scanFields: scannedFields });
  appUtils = await loadApp(chromeMock);
});

it("escaneia e renderiza os campos encontrados", async () => {
  expect(document.querySelectorAll(".page-field")).toHaveLength(2);
  expect(expectSentAction(chromeMock, ACTIONS.SCAN_FIELDS)).toBe(true);
  expect(getPageFieldsStatus()).toContain("2 campo(s) encontrado(s)");
});
```

### Estado de módulo — recarregar por teste

```javascript
beforeEach(async () => {
  vi.resetModules();
  ({ scan, installNavigationObserver } = await import("../src/scripts/selector-engine.js"));
});
```

### Erros e fallbacks — simular a resposta real da API

```javascript
chromeMock.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
  chromeMock.runtime.lastError = { message: "Receiver unavailable" };
  callback();
  chromeMock.runtime.lastError = null;
});
```

## Plano de Testes por Módulo

### generators.test.js (11 testes)

- `validarCPF`/`validarCNPJ`/`validarChassi`: formatos válidos, DV incorreto, tamanho e caracteres inválidos.
- `cpf()`/`cnpj()`: formato com e sem pontuação, numérico e alfanumérico.
- `gerarChassi`: 17 caracteres, dígito verificador ISO 3779, alfabeto válido.
- `gerarPlaca`: padrão Mercosul e antigo.
- `createGeneratorData`: contexto e fields de pessoa/veículo/empresa.
- `generateMappedValue`: tipos mapeados e `inputType` (checkbox, radio, date, month, number).

### selector-engine.test.js (74 testes)

- `inferType`: autocomplete, labels, opções de select, patterns.
- `selectorFor`: prioridades 1–5, detecção de ID dinâmico, combinações, fallback estrutural.
- `scan`: campos visíveis, tipos ignorados, selects customizados, seletores duplicados e colisão.
- `captureNextClick`: handler de clique, `fieldFromTarget`, `labelsFor`.
- `normalize`, `escapeAttribute`, `escapeCssIdentifier`, `staticText`, `labelsFor`, `fallbackSelector`.
- `pageSignature` e `installNavigationObserver`: SPA (pushState/replaceState/popstate/hashchange), mutações de DOM, cleanup.
- Estado de módulo: contexto invalidado, notificação única por assinatura, isolamento entre testes.

### vehicle-catalog.test.js (12 testes)

- `normalizeVehicleCatalog`: deduplicação, case-insensitive, entradas inválidas.
- CRUD de marcas e modelos, validações e nomes duplicados.
- `pickVehicle`: catálogo customizado vs. padrão.

### content.test.js (33 testes)

- `fill`: todos os tipos de input, Select2, selects customizados, datas/mês/número.
- `mark`/`unmark`/`highlight`: gerenciamento de outline e `visualTarget`.
- `updatePageControls`: criação/posicionamento dos botões flutuantes e clique → `runtime.sendMessage`.
- `handleMessage`: todas as ACTIONS, respostas assíncronas, erros.
- Re-injeção, `installationProbe`, `dispose`, observer de navegação e injeção concorrente.

### app-mapping.test.js (16 testes)

- Scan inicial e renderização dos mapeamentos; preservação de edições em mudança de DOM.
- Tipos inferidos, seletor manual, valores fixos e preenchimento individual.
- Salvar/atualizar perfil, renomear/excluir, migração de perfis legados.
- Copiar JSON, atalhos de teclado e playground (casos básicos).
- Catálogo de veículos (abertura/fechamento do modal).

### app-lifecycle.test.js (26 testes)

- Navegação SPA: atualização por `PAGE_CONTENT_CHANGED` e limpeza em mudança de rota.
- Injeção do content script: fallback, serialização por aba, filas separadas, erro síncrono e waiter que falha após a injeção.
- Tolerância a APIs ausentes (`tabs.query`, `tabs.sendMessage`, `scripting.executeScript`).
- Persistência: salvar/renomear/excluir perfil, validação de modal, tipos e valores fixos.
- Marcação/localização/preenchimento em lote e seus erros.
- Preferência de botões flutuantes.

### app-generator.test.js (6 testes)

- Geração de pessoa, veículo, empresa, opções de UF e cópia de resultado/JSON.

### app-playground.test.js (7 testes)

- Verificação de seletor, marcação/desmarcação, captura de elemento.
- Erros: página inacessível, falha de comunicação, captura não realizada.

### app-theme-tabs.test.js (8 testes)

- Alternância de tema com persistência, navegação entre abas e subtabs.
- Modo popup vs. aba dedicada; ausência de `chrome.windows` na detecção de modo.

### app-vehicle-catalog.test.js (7 testes)

- Adicionar, editar e remover marcas/modelos.
- Erros: falha ao salvar, marca duplicada, modelo ausente, nome vazio ao renomear + cancelamento.

### app-panel.test.js (5 testes)

- Maximizar: abrir em nova aba, fechar painel lateral com `windowId` real.
- Fallbacks: `sidePanel` ausente, janela inválida, rejeição ao fechar e fechamento garantido da janela.

### app-field-actions.test.js (10 testes)

- Remapear todos, confirmar edição de label com Enter.
- Marcar/desmarcar campo, seletor não encontrado.
- Adicionar seletor (página acessível e inacessível).
- Validações de "marcar todos" e falha de comunicação.
- Limpar valores preenchidos e caso sem preenchimentos.

### app-floating-controls.test.js (2 testes)

- `PAGE_FIELD_FILL_REQUEST`: campo encontrado, campo ausente, sem `sender.tab`, falha de comunicação.
- Uso de valor fixo do perfil e atualização do campo na UI.

## Thresholds de Cobertura (Reais)

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

## Mutation Testing

### Comandos

```bash
npm run test:mutation                  # Stryker com a configuração do projeto
npx stryker run --mutate src/scripts/selector-engine.js   # escopo pontual
npx stryker run --dryRunOnly           # valida configuração sem executar mutantes
```

Relatório HTML em `reports/mutation/index.html` (ignorado pelo git).

### Gate

- `break: 60` — a build falha se o mutation score ficar abaixo de 60%.
- `low: 60` / `high: 80` — cores do relatório.
- Mutantes sobreviventes devem ser investigados: ou revelam lacuna de teste (adicionar teste que falhe), ou são mutantes equivalentes (documentar).

### Escopo

- `selector-engine.js`, `generators.js` e `data/vehicle-catalog.js`.
- `messages.js`/`mapping-types.js` são constantes estáticas; mutá-las não agrega sinal útil.
- `app.js` e `content.js` exigem integração pesada; recomenda-se `--since` em CI para mutação incremental quando forem incluídos.

## CI Pipeline (.github/workflows/ci.yml) — 5 Jobs

| Job | Descrição |
|---|---|
| **test** | Node 22, `npm ci`, `npm run test:coverage`, upload do coverage |
| **mutation** | Node 22, `npm ci`, `npm run test:mutation`, upload de `reports/` — executado em push para `main` e `workflow_dispatch` |
| **lint** | `npm run lint --if-present` (no-op: não há script lint definido) |
| **manifest-validation** | `npm run validate-manifest` (script Node + `ajv@8` + schema Chrome) |
| **version-consistency** | Compara `manifest.json` version vs `package.json` version |

- Trigger: push/PR para `main`; mutation em push para `main` (evita tempo extra em PRs).
- Node 22, `npm ci` em todos os jobs.

## Coverage Real (`npm run test:coverage`)

```
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.38 |    83.83 |   97.44 |   98.84 |
 scripts           |   96.21 |    83.16 |   97.31 |   98.79 |
  app.js           |   94.83 |    78.62 |   95.85 |   97.99 | 340-348,1323-1333
  content.js       |   97.94 |    84.45 |   96.66 |   99.65 | 346
  generators.js    |   99.51 |    93.75 |     100 |     100 | ...64-165,199,345
  messages.js      |     100 |      100 |     100 |     100 |
  selector-engine.js|   96.36 |    91.13 |   98.64 |   99.57 | 196
 scripts/data      |     100 |      100 |     100 |     100 |
  estados.js       |     100 |      100 |     100 |     100 |
  mapping-types.js |     100 |      100 |     100 |     100 |
  vehicle-catalog.js|    100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

**Gate de coverage**: todos os thresholds atendidos. `app.js` (340-348: `setLoading`; 1323-1333: `autovalidar`) não é coberto nem pelos testes antigos; `selector-engine.js` mantém lines 99.57% e branches 91.13% (≥90).

## Debugging

```bash
npm test                                        # suíte completa
npm run test:coverage                           # com cobertura
npm run test:mutation                           # mutation testing
npx vitest run tests/generators.test.js         # arquivo único
npx vitest run -t "nome do teste"               # teste específico
npx vitest --ui                                 # modo UI
```

## Prevenção de Flaky Tests

- Sem chamadas de rede: todas as APIs são mockadas explicitamente.
- Timers falsos (`vi.useFakeTimers()`) quando o teste depende de timeout.
- `vi.restoreAllMocks()` no `afterEach` do `setup.js` e no cleanup do `loadApp`.
- `localStorage.clear()` e `vi.resetModules()` no `beforeEach` de arquivos com estado de módulo.
- Nenhum teste depende de execução anterior (sem estado compartilhado entre arquivos).

## Regressão

- Bug encontrado → escrever teste que falha reproduzindo o comportamento → corrigir → garantir que o teste passa e falha sem a correção.
- Nomeação: `*.test.js` (não `.spec.js`).
- `app.js` é dividido por feature (`app-<feature>.test.js`); módulos de lógica têm um arquivo por módulo.
- Utilitários compartilhados vivem em `tests/fixtures/` e `tests/helpers/`.
