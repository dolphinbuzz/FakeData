# Spec: Arquitetura e Decisões Técnicas

## Visão Geral
Arquitetura Manifest V3 com comunicação direta popup<->content, sem background service worker. Decisões documentadas via ADRs.

## Arquitetura Geral

```
Popup/Side Panel/Tab (extension pages) <---> Content Script (injected)
       |                                        |
       | chrome.runtime.sendMessage             |
       | chrome.tabs.sendMessage                |
       | chrome.scripting.executeScript         |
       v                                        v
   chrome.storage.local                    - selector-engine
                                              - fill/mark
                                              - floating UI
```

## Manifest V3 - Configuracao Critica

- Permissions: sidePanel, storage, activeTab, scripting
- Host permissions: <all_urls>
- Content script: matches <all_urls>, run_at document_idle
- Web accessible resources: selector-engine.js, messages.js
- CSP: script-src 'self'; object-src 'self'

### Pontos-Chave
- Sem background SW: comunicacao direta popup<->content
- activeTab + scripting: injecao programatica via executeScript
- sidePanel: API oficial painel lateral
- web_accessible_resources: necessario para dynamic import
- CSP: script-src 'self' - sem inline scripts, sem eval

## Modulos (ESM)

src/scripts/
  app.js              # Orquestracao UI + Messaging + Storage
  content.js          # Content script (IIFE, strict mode)
  generators.js       # Pure data generation functions
  selector-engine.js  # Pure selector logic + DOM scanning
  messages.js         # ACTIONS enum (Object.freeze)
  data/
    estados.js        # Const: ESTADOS, DDDS
    mapping-types.js  # Const: MAPPING_TYPES (29)
    vehicle-catalog.js # Pure CRUD functions

### Padroes
- Funcoes puras exportadas para testabilidade
- Callbacks para chrome.storage (nao Promises)
- Object.freeze para constantes/enums
- Zero dependencias runtime

## ADRs Principais

### ADR 001: Manifest V3 sem Background SW
Simplicidade: sem ciclo de vida SW. Injecao via scripting.executeScript.

### ADR 002: Messaging Direto Popup<->Content
ACTIONS enum congelado = fonte da verdade. sendMessageToTab com fallback injeção. PAGE_FIELD_FILL_REQUEST para floating buttons.

### ADR 003: Storage por Base URL
Agrupa subdominios. pageUrl normalizada (sem query/hash).

### ADR 004: Seletores Prioridade Estavel > Semantico > Funcional > Fallback
1: #id, data-cy, data-test, data-testid
2: ARIA (role, aria-label, aria-labelledby)
3: Funcional (value, ng-model, name, type)
4: Combinacoes 2-4 attrs
5: Texto estatico / estrutural :nth-of-type (fragile)

### ADR 005: Geracao Dados - Funcoes Puras + Context Object
createGeneratorData({ getState, getCpfFormatted, ... }). Zero deps externas.

### ADR 006: Content Script - Dynamic Import + IIFE + Strict
Lazy load modules via dynamic import. modulesReady Promise evita race condition.

### ADR 007: Floating Controls no documentElement
z-index 2147483647, position absolute. data-fakedata-control para MutationObserver ignorar. Click -> PAGE_FIELD_FILL_REQUEST -> popup responde.

### ADR 008: Testes - Vitest + jsdom + 90% Coverage
Funcoes puras = alta cobertura (95%+). Integracao = mocks complexos (85%+).

## Seguranca
- CSP Compliant: No inline scripts, no eval, no new Function()
- Sanitizacao: escapeHtml() para todo user content no DOM
- Permissoes minimas: activeTab, scripting, storage, sidePanel
- Zero rede: Nenhuma chamada externa, tudo local

## Performance
- Lazy Load: Dynamic imports no content script
- Debounce: Page change notification 250ms
- Cleanup: clearMarks(), removePageControls(), removeEventListener
- Memoization: pageSignature() cached, lastPageSignature comparison
- Batch: MARK_ALL_FIELDS vs loop de MARK_FIELD

## Versionamento (SemVer)
- manifest.json version = package.json version (obrigatorio)
- Patch: Bug fixes
- Minor: Novas features, tipos, mapping types
- Major: Breaking changes (manifest, storage schema, messaging)

## Arquivos Relacionados
- manifest.json - Configuracao principal
- package.json - Scripts, deps, version
- .github/workflows/ci.yml - Pipeline CI
- .opencode/team/context/architecture-decisions.md - ADRs completos