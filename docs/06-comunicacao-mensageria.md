# Spec: Comunicação e Mensageria

## Visão Geral
Protocolo de mensagens entre Popup/Side Panel (extension pages) e Content Scripts (páginas web). Baseado em `chrome.runtime.sendMessage` + `chrome.tabs.sendMessage` com fila de injeção, retry e guarda de re-injeção/dispose (A2).

## ACTIONS (Contrato Imutável — 16 actions)

```javascript
const ACTIONS = Object.freeze({
  // Content → Popup (Notificações)
  PAGE_CONTENT_CHANGED: "PAGE_CONTENT_CHANGED",      // { url, changeType: "route"|"dom" }

  // Popup → Content (Comandos)
  SCAN_FIELDS: "SCAN_FIELDS",                        // {} → { fields: Field[] }
  FILL_FIELD: "FILL_FIELD",                          // { selector, value } → { filled: boolean }
  FILL_ALL: "FILL_ALL",                              // { fields: [{selector, value}] } → { filled, total, failed[] }
  HIGHLIGHT_FIELD: "HIGHLIGHT_FIELD",                // { selector } → { highlighted }
  MARK_FIELD: "MARK_FIELD",                          // { selector } → { marked }
  UNMARK_FIELD: "UNMARK_FIELD",                      // { selector } → { unmarked }
  MARK_ALL_FIELDS: "MARK_ALL_FIELDS",                // { selectors[] } → { marked, total, failed[] }
  UNMARK_ALL_FIELDS: "UNMARK_ALL_FIELDS",            // { selectors[] } → { unmarked, total }
  COUNT_SELECTOR_MATCHES: "COUNT_SELECTOR_MATCHES",  // { selector } → { count, invalid? }
  MARK_SELECTOR_MATCHES: "MARK_SELECTOR_MATCHES",    // { selector } → { count }
  UNMARK_SELECTOR_MATCHES: "UNMARK_SELECTOR_MATCHES",// { selector } → { count }
  CAPTURE_NEXT_CLICK: "CAPTURE_NEXT_CLICK",          // {} → { captured, field? }
  UPDATE_PAGE_FIELD_CONTROLS: "UPDATE_PAGE_FIELD_CONTROLS",  // { fields[], visible } → { updated, count }
  SET_PAGE_FIELD_CONTROLS_VISIBILITY: "SET_PAGE_FIELD_CONTROLS_VISIBILITY", // { visible } → { updated, count }

  // Content → Popup (Request async from floating button)
  PAGE_FIELD_FILL_REQUEST: "PAGE_FIELD_FILL_REQUEST" // { key, selector } → { filled }
});
```

## Fluxos de Comunicação

### Popup → Content (Request/Response) — Com Fila de Injeção (A2)
```javascript
// sendMessageToTab com fila pendingInjections + injectContentScript
sendMessageToTab(tabId, { action: ACTIONS.SCAN_FIELDS }, callback, allowInjection=true)

// 1. chrome.tabs.sendMessage(tabId, message)
// 2. Se erro "Could not establish connection" + allowInjection:
//    injectContentScript(tabId, (injectionError) => {
//      if (injectionError) callback(null, injectionError);
//      else sendMessageToTab(tabId, message, callback, false); // retry sem injeção
//    })

// injectContentScript serializa por tabId:
// - pendingInjections Map<tabId, callback[]> coalesce chamadas concorrentes
// - Uma única executeScript por aba; waiters notificados juntos ao terminar
// - Entry removida ANTES de notificar (evita órfãos se waiter lançar)
```

### Content → Popup (Async Request - Floating Button)
```javascript
// content.js - botão flutuante clicado
chrome.runtime.sendMessage({
  action: ACTIONS.PAGE_FIELD_FILL_REQUEST,
  key: field.key,
  selector: field.selector
}, (response) => { /* update button title */ });
// Popup responde via sendResponse({ filled: boolean })
```

### Content → Popup (Notification - Fire & Forget)
```javascript
// content.js - SPA navigation / DOM change
chrome.runtime.sendMessage({
  action: ACTIONS.PAGE_CONTENT_CHANGED,
  url: window.location.href,
  changeType: "route" | "dom"
});
// Popup listener em app.js: chrome.runtime.onMessage.addListener(...)
```

## Payload Types

### SCAN_FIELDS Response
```typescript
interface Field {
  key: string;                    // "${selector}::${index}"
  selector: string;               // CSS selector único
  label: string;                  // Label legível (max 120)
  inferredType: MappingType;      // 29 tipos
  tagName: "input"|"select"|"textarea"|"multi-select";
  inputType: string;              // "text"|"email"|"number"|"date"|"month"|"checkbox"|"radio"|""
  value: string;
  required: boolean;
  disabled: boolean;
  selectorRule: string;           // "id"|"data-cy"|"fallback proibido"|etc
  selectorStatus: "stable"|"fragile";
  selectorSuggestion: string;     // se fragile
  locatorName: string;            // "rota-contexto-tipo"
}
```

### PAGE_FIELD_FILL_REQUEST
```typescript
// Content → Popup
{ key: string, selector: string }
// Popup responde: { filled: boolean }
```

### PAGE_CONTENT_CHANGED
```typescript
{ url: string, changeType: "route" | "dom" }
// "route": pushState/replaceState/popstate/hashchange
// "dom": MutationObserver detected relevant changes
```

## Tab Management

### getActiveTab()
- Filtra tabs `http(s)://`
- Prioriza ativa, depois primeira da `selectedBaseUrl`
- Retorna `{ id, url, active }`

### refreshBaseUrlOptions()
- Agrupa tabs por base URL (`getBaseUrl()`)
- Atualiza dropdown `#base-url-select`
- Seleciona base da tab ativa ou primeira

### Tab Activation Listener
```javascript
chrome.tabs.onActivated.addListener(() => {
  activeTab = null;
  activePageUrl = "";
  activeBaseUrl = "";
  refreshBaseUrlOptions(() => scanPageFields());
});
```

## Injection Strategy (A2 — Fila + Retry + Coalescência)
- `web_accessible_resources` em manifest para `selector-engine.js`, `messages.js`
- Content script usa dynamic import: `Promise.all([import(...), import(...)])`
- `modulesReady` Promise garante imports antes de handlers
- Listener registrado imediatamente, handlers aguardam `modulesReady`
- **Fila por aba**: `pendingInjections = new Map()` em `app.js`
  - `injectContentScript(tabId, callback)` adiciona callback à fila da aba
  - Se já há injeção em andamento, callback entra na fila (coalescência)
  - `chrome.scripting.executeScript` chamado uma única vez
  - `notifyWaiters` remove entry do Map **antes** de notificar (evita órfãos)
  - Try/catch síncrono em `executeScript` para capturar erro de contexto invalidado

## Guarda de Re-injeção / Dispose (A2 — content.js)
```javascript
// No topo do content.js (IIFE):
const previousInstall = window.__fakedataContentInstalled;
if (previousInstall) {
  if (typeof previousInstall !== "function") return; // guarda antiga (booleana)
  try {
    if (previousInstall()) return; // probe de vivacidade: !disposed && chrome.runtime?.id
  } catch (_error) {
    // Contexto invalidado: segue para reinstalação
  }
  try {
    previousInstall.dispose?.(); // cleanup autoritativo
  } catch (_error) { /* ignora */ }
}

let disposed = false;
let disposeNavigationObserver = () => {};

// ... modulesReady, setup ...

// Probe de vivacidade exposto globalmente:
const installationProbe = () => !disposed && Boolean(chrome.runtime && chrome.runtime.id);
installationProbe.dispose = () => {
  if (disposed) return;
  disposed = true;
  disposeNavigationObserver(); // cleanup observer nav (retornado por installNavigationObserver)
  clearMarks();
  removePageControls();
  controlStyle.remove();
  try {
    chrome.runtime?.onMessage?.removeListener?.(messageListener);
  } catch (_error) { /* runtime anterior pode estar invalidado */ }
};
window.__fakedataContentInstalled = installationProbe;
```

- **Probe**: `installationProbe()` retorna `true` se instalação viva (não disposed + runtime.id existe)
- **Dispose**: Remove listener, limpa marcações (`clearMarks`), remove controles flutuantes, remove estilo injetado, chama cleanup do observer de navegação
- **Re-instalação autoritativa**: Se probe falha (retorna falsy ou lança), nova execução prossegue e sobrescreve `window.__fakedataContentInstalled`

## Side Panel API
```javascript
// Abrir
chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT })

// Fechar (ao abrir aba dedicada)
chrome.sidePanel.close({ windowId })
```

## Error Handling
- Sempre `return true` em `onMessage` listeners (async response)
- Valida `sender.tab.id` antes de responder
- `chrome.runtime.lastError` verificado após **toda** operação
- "Extension context invalidated" → flag silenciosa (`runtimeContextInvalidated` em `selector-engine.js`), não throw
- Timeouts: captureNextClick 30s, page change debounce 250ms

## Arquivos Relacionados
- `src/scripts/messages.js` - ACTIONS enum (Object.freeze, 16 actions)
- `src/scripts/app.js` - sendToPage, sendMessageToTab, injectContentScript, pendingInjections, getActiveTab, listeners
- `src/scripts/content.js` - handleMessage, chrome.runtime.onMessage, installationProbe, dispose, disposeNavigationObserver
- `src/scripts/selector-engine.js` - installNavigationObserver (retorna cleanup function)