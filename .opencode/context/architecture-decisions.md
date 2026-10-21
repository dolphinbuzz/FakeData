# Architecture Decision Records (ADRs)

## ADR 001: Manifest V3 com Service Worker Implícito
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Chrome está descontinuando Manifest V2. Precisamos migrar para MV3.
**Decision**: Usar Manifest V3 com `action.popup` + `side_panel` + `content_scripts`. Não usar background service worker explícito - comunicação direta popup↔content via `chrome.runtime.sendMessage` + `chrome.tabs.sendMessage`.
**Consequences**: 
- Simplicidade: sem service worker para gerenciar ciclo de vida
- Limitação: content script não persiste estado entre navegações (resolvido com `PAGE_CONTENT_CHANGED`)
- Injeção programática via `chrome.scripting.executeScript` quando content script não carregado
**Alternatives Considered**: Background service worker persistente - rejeitado por complexidade desnecessária

## ADR 002: Comunicação Popup↔Content via Message Passing Direto
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Necessidade de coordenar scan, fill, mark entre UI e página.
**Decision**: `ACTIONS` enum em `messages.js` como contrato único. Popup usa `sendMessageToTab()` com fallback de injeção. Content script usa `chrome.runtime.sendMessage()` para notificações (PAGE_CONTENT_CHANGED) e requests (PAGE_FIELD_FILL_REQUEST).
**Consequences**:
- Baixa latência, sem intermediário
- `ACTIONS` é fonte da verdade - mudanças exigem coordenação total
- Async request/response pattern com `return true` em listeners
**Alternatives Considered**: BroadcastChannel, SharedWorker - rejeitados por suporte limitado em extensões

## ADR 003: Storage Schema - Perfis Agrupados por Base URL
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Usuários testam múltiplas páginas da mesma aplicação (subdomínios, rotas).
**Decision**: `fakedata-field-mappings` = `{ "https://base.com": { pages: [{ id, name, pageUrl, fields, audit }] } }`. `pageUrl` normalizada (sem query/hash). `baseUrl` via `getBaseUrl()` agrupa `app.exemplo.com.br` + `api.exemplo.com.br` → `https://exemplo.com.br`.
**Consequences**:
- Organização lógica por aplicação
- Migração legada necessária (formato v1: array por URL completa)
- Lookup O(1) por base URL
**Alternatives Considered**: Flat array com todos perfis - rejeitado por performance e UX

## ADR 004: Seletores CSS - Prioridade Estável > Semântico > Funcional > Fallback
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Seletores frágeis quebram testes QA. Precisa de algoritmo determinístico.
**Decision**: `selectorFor()` tenta em ordem: 1) `#id`, `[data-cy]`, `[data-test]`, `[data-testid]` 2) `[role]`, `[aria-label]`, `[aria-labelledby]` 3) `[value]`, `[ng-model]`, `[name]`, `[type]` 4) Combinações 2-4 attrs 5) Texto estático / structural `:nth-of-type`. Cada seletor validado com `querySelectorAll().length === 1`. Status: `stable` ou `fragile` com `selectorSuggestion`.
**Consequences**:
- Incentiva boas práticas de teste (data-cy)
- Fallback funcional mas marcado para atenção
- Detecção de colisão pós-scan
**Alternatives Considered**: XPath, CSS Path completo - rejeitados por fragilidade e performance

## ADR 005: Geração de Dados - Funções Puras + Context Object Pattern
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Testabilidade, reutilização, configuração via UI (formatted CPF, UF, catálogo veículos).
**Decision**: `createGeneratorData({ getState, ddds, getCpfFormatted, getCnpjFormatted, getCnpjAlphanumeric, getVehicleCatalog })` retorna objeto com `person`, `vehicle`, `company` cada um com `context()` e `fields[]`. `generateMappedValue(type, context, inputType, options)` para preenchimento de mapeamento.
**Consequences**:
- 100% testável sem mocks complexos
- UI passa callbacks para opções dinâmicas
- Zero dependências externas
**Alternatives Considered**: Classes com estado, Faker.js - rejeitados por bundle size e controle

## ADR 006: Content Script - Dynamic Import + IIFE + Strict Mode
**Status**: Accepted
**Date**: 2026-01-15
**Context**: MV3 não permite scripts não-modulares em `web_accessible_resources`. Precisa importar selector-engine e messages.
**Decision**: Content script é IIFE `(async () => { "use strict"; const modulesReady = Promise.all([import(...), import(...)]); ... })()`. `modulesReady` garante imports antes de handlers. `chrome.runtime.onMessage` listener registrado imediatamente, handlers aguardam `modulesReady`.
**Consequences**:
- Carregamento lazy dos módulos pesados
- `web_accessible_resources` necessário para imports
- Race condition evitada com `modulesReady`
**Alternatives Considered**: Bundler (webpack/rollup) - rejeitado para manter zero build step

## ADR 007: Floating Controls - Injetados no document.documentElement
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Botões de preenchimento ao lado de cada campo na página.
**Decision**: Buttons criados em `document.documentElement` com `position: absolute`, `z-index: 2147483647`. Posicionados via `getBoundingClientRect()` + scroll. Marcados com `data-fakedata-control="true"` para MutationObserver ignorar. Click → `chrome.runtime.sendMessage(PAGE_FIELD_FILL_REQUEST)` → popup responde com valor gerado/fixo.
**Consequences**:
- Isolados da página (não interferem layout)
- Alto z-index garante visibilidade
- Cleanup em `removePageControls()` / `setPageControlsVisibility(false)`
**Alternatives Considered**: Shadow DOM - rejeitado por complexidade de posicionamento cross-shadow

## ADR 008: Testes - Vitest + jsdom + 90% Coverage Threshold
**Status**: Accepted
**Date**: 2026-01-15
**Context**: Necessidade de CI confiável, mocking Chrome APIs, funções puras testáveis.
**Decision**: Vitest (ESM nativo, rápido) + jsdom (DOM simulation). `vitest.config.js` com `coverage.thresholds.lines: 90`. Mock global `chrome.*` APIs. Testes de funções puras (generators, selector-engine, vehicle-catalog) = alta cobertura. Testes integração (app, content) = mocks complexos, foco happy paths.
**Consequences**:
- CI falha se coverage < 90%
- Funções puras exportadas = fácil testar
- `app.js`/`content.js` mais difíceis - meta 90%
**Alternatives Considered**: Jest - rejeitado por config ESM complexa. Playwright - overkill para unit.