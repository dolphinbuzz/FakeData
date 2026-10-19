# Spec: Arquitetura e Decisões Técnicas

## Visão Geral
Arquitetura Manifest V3 com comunicação direta popup↔content, sem background service worker. Decisões documentadas via ADRs.

## Arquitetura Geral

```
Popup/Side Panel/Tab (extension pages) <---> Content Script (injetado)
       |                                        |
       | chrome.runtime.sendMessage             |
       | chrome.tabs.sendMessage                |
       | chrome.scripting.executeScript         |
       v                                        v
  chrome.storage.local                    - selector-engine
                                             - fill/mark
                                             - floating UI
                                             - navigation observer
```

## Manifest V3 - Configuração Crítica

- Permissions: sidePanel, storage, activeTab, scripting
- Host permissions: `<all_urls>` (restaurado em `34fa850`)
- Content script: **não declarado** em `content_scripts`; injeção sob demanda via `chrome.scripting.executeScript` (com `activeTab` + `scripting`)
- Web accessible resources: selector-engine.js, messages.js
- CSP: script-src 'self'; object-src 'self'

### Pontos-Chave
- Sem background SW: comunicação direta popup↔content
- activeTab + scripting: injeção programática via executeScript
- sidePanel: API oficial painel lateral
- web_accessible_resources: necessário para dynamic import
- CSP: script-src 'self' - sem inline scripts, sem eval

## Módulos (ESM)

src/scripts/
  app.js              # Orquestração UI + Messaging + Storage
  content.js          # Content script (IIFE, strict mode) - fila injeção, dispose, guarda vivacidade
  generators.js       # Pure data generation functions
  selector-engine.js  # Pure selector logic + DOM scanning + navigation observer (cleanup)
  messages.js         # ACTIONS enum (Object.freeze, 16 actions)
  privacy.js          # Privacy page logic
  data/
    estados.js        # Const: ESTADOS (27), DDDS
    mapping-types.js  # Const: MAPPING_TYPES (30 entradas: 29 tipos + auto)
    vehicle-catalog.js # Pure CRUD functions

### Padrões
- Funções puras exportadas para testabilidade
- Callbacks para chrome.storage (não Promises)
- Object.freeze para constantes/enums
- Zero dependências runtime

## ADRs Principais

### ADR 001: Manifest V3 sem Background SW
Simplicidade: sem ciclo de vida SW. Injeção via scripting.executeScript.

### ADR 002: Messaging Direto Popup↔Content
ACTIONS enum congelado = fonte da verdade. sendMessageToTab com fallback injeção. PAGE_FIELD_FILL_REQUEST para floating buttons.

### ADR 003: Storage por Base URL
Agrupa subdomínios. pageUrl normalizada (sem query/hash).

### ADR 004: Seletores Prioridade Estável > Semântico > Funcional > Fallback
1: #id, data-cy, data-test, data-testid
2: ARIA (role, aria-label, aria-labelledby)
3: Funcional (value, ng-model, name, type)
4: Combinações 2-4 attrs
5: Texto estático / estrutural :nth-of-type (fragile)

### ADR 005: Geração Dados - Funções Puras + Context Object
createGeneratorData({ getState, getCpfFormatted, ... }). Zero deps externas.

### ADR 006: Content Script - Dynamic Import + IIFE + Strict
Lazy load modules via dynamic import. modulesReady Promise evita race condition.

### ADR 007: Floating Controls no documentElement
z-index 2147483647, position absolute. data-fakedata-control para MutationObserver ignorar. Click -> PAGE_FIELD_FILL_REQUEST -> popup responde.

### ADR 008: Testes - Vitest + jsdom + 90% Coverage
Funções puras = alta cobertura (95%+). Integração = mocks complexos (85%+).

---

### ADR 009 (A1): Gate de Push — Permissions V2 + Hooks Opt-in + .gitattributes
**Status**: Accepted
**Date**: 2026-10-19
**Context**: Necessidade de exigir confirmação explícita antes de `git push` para evitar pushes acidentais, compatível com OpenCode V2.
**Decision**:
- `opencode.jsonc`: bloco `permissions` com regras `effect: "ask"` para `git push *`, `*git push*`, `*git -C * push*`, `*git -c * push*`, `*git.exe*push*`, `*git.cmd*push*`
- Removida seção legada `hooks` (não suportada no V2) e campo `git.hooksEnabled`
- `.opencode/hooks/git/`: shims reais (pre-commit, pre-push, post-merge) — instalação **opt-in** via `git config core.hooksPath .opencode/hooks/git`
- `.opencode/hooks/pre-push/00-confirm-push.sh`: consome stdin (refs do Git), lê `/dev/tty` para confirmação interativa (timeout 60s), aceita `CONFIRM_PUSH=true` para não-interativo
- `.gitattributes`: LF forçado em `.opencode/hooks/**/*.sh` (`text eol=lf`) para evitar quebra de shebang/comandos no Windows com `core.autocrlf=true`
**Consequences**:
- Push bloqueado por padrão; usuário aprova via terminal interativo ou `CONFIRM_PUSH=true`
- Aliases de git (ex.: `git p`) não cobertos por pattern textual — limitação conhecida
- Evolução recomendada: inverter política base para `ask` + allowlist estreita
**Alternatives Considered**: Hooks client-side via Husky — rejeitado por dependência extra; pre-push apenas local — rejeitado por não cobrir CI/agentes.

### ADR 010 (A2): Fila de Injeção + Guarda de Vivacidade + Dispose Autoritativo
**Status**: Accepted
**Date**: 2026-10-19
**Context**: Race conditions em injeção concorrente (múltiplas abas/painéis), content script órfão após reload/extensão atualizada, navegação SPA sem cleanup de observers.
**Decision**:
- **Fila por aba** (`app.js`): `pendingInjections = Map<tabId, callback[]>`
  - `injectContentScript(tabId, callback)` coalesce chamadas concorrentes na mesma aba
  - Uma única `executeScript` por aba; waiters notificados juntos
  - Entry removida **antes** de notificar (evita órfãos se waiter lançar)
  - Try/catch síncrono em `executeScript` captura erro de contexto invalidado
- **Guarda de re-injeção** (`content.js`): `window.__fakedataContentInstalled` = `installationProbe`
  - `installationProbe()` retorna `!disposed && Boolean(chrome.runtime?.id)` — probe de vivacidade
  - Se instalação anterior responde "viva", nova execução sai silenciosamente
  - Se lança (contexto invalidado) ou retorna falsy, prossegue para reinstalação autoritativa
- **Dispose autoritativo** (`content.js`): `installationProbe.dispose()`
  - `disposed = true`
  - `disposeNavigationObserver()` — cleanup do observer de navegação (retornado por `installNavigationObserver`)
  - `clearMarks()`, `removePageControls()`, `controlStyle.remove()`
  - `chrome.runtime.onMessage.removeListener(messageListener)` (try/catch)
- **Navigation Observer com cleanup** (`selector-engine.js`):
  - `installNavigationObserver()` retorna função cleanup:
    - `observer?.disconnect()`
    - `window.removeEventListener("popstate", ...)` / `hashchange`
    - Restaura `history.pushState` / `replaceState` originais
    - `clearTimeout(pageChangeTimer)`
**Consequences**:
- Elimina race condition de injeção múltipla
- Garante cleanup completo ao recarregar extensão/navegar
- SPA navigation observer não vaza entre reinstalações
- Probe de vivacidade evita conteúdo script zumbi
**Alternatives Considered**: Background SW para gerenciar injeção — rejeitado (ADR 001); content script persistente via `run_at: document_start` — rejeitado por complexidade.

---

## Segurança
- CSP Compliant: No inline scripts, no eval, no new Function()
- Sanitização: escapeHtml() para todo user content no DOM
- Permissões mínimas: activeTab, scripting, storage, sidePanel
- Zero rede: Nenhuma chamada externa, tudo local

## Performance
- Lazy Load: Dynamic imports no content script
- Debounce: Page change notification 250ms
- Cleanup: clearMarks(), removePageControls(), removeEventListener, disposeNavigationObserver
- Memoization: pageSignature() cached, lastPageSignature comparison
- Batch: MARK_ALL_FIELDS vs loop de MARK_FIELD

## Versionamento (SemVer)
- manifest.json version = package.json version (obrigatório)
- Patch: Bug fixes
- Minor: Novas features, tipos, mapping types
- Major: Breaking changes (manifest, storage schema, messaging)

## Arquivos Relacionados
- manifest.json - Configuração principal
- package.json - Scripts, deps, version
- .github/workflows/ci.yml - Pipeline CI (4 jobs)
- opencode.jsonc - Config OpenCode V2 (permissions, skills, workflows, context)
- .opencode/context/architecture-decisions.md - ADRs 001-008 (A1/A2 documentados neste arquivo)
- .opencode/hooks/git/* - Shims git (opt-in)
- .gitattributes - LF forçado em hooks