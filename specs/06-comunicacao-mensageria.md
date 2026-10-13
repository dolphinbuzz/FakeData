# Spec: Comunicação e Mensageria

## Visão Geral
Protocolo de mensagens entre Popup/Side Panel (extension pages) e Content Scripts (páginas web). Baseado em `chrome.runtime.sendMessage` + `chrome.tabs.sendMessage` com fallback de injeção.

## ACTIONS (Contrato Imutável)

```javascript
const ACTIONS = Object.freeze({
  // Content → Popup (Notificações)
  PAGE_CONTENT_CHANGED: "PAGE_CONTENT_CHANGED",      // { url, changeType: "route"|"dom" }
  
  // Popup → Content (Comandos)
  SCAN_FIELDS: "SCAN_FIELDS",                        // {} → { fields: Field[] }
  FILL_FIELD: "FILL_FIELD",                          // { selector, value } → { filled: boolean }
  FILL_ALL: "FILL_ALL",                              // { fields: [{selector, value}] } → { filled, total }
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

### Popup → Content (Request/Response)
```javascript
// sendMessageToTab com fallback de injeção
sendMessageToTab(tabId, { action: ACTIONS.SCAN_FIELDS }, callback, allowInjection=true)

// 1. chrome.tabs.sendMessage(tabId, message)
// 2. Se erro "Could not establish connection" + allowInjection:
//    chrome.scripting.executeScript({ target: {tabId}, files: ["src/scripts/content.js"] })
// 3. Retry sendMessage (allowInjection=false)
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

## Injection Strategy
- `web_accessible_resources` em manifest para `selector-engine.js`, `messages.js`
- Content script usa dynamic import: `Promise.all([import(...), import(...)])`
- `modulesReady` Promise garante imports antes de handlers
- Listener registrado imediatamente, handlers aguardam `modulesReady`

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
- `chrome.runtime.lastError` verificado após كل operação
- "Extension context invalidated" → flag silenciosa, não throw
- Timeouts: captureNextClick 30s, page change debounce 250ms

## Arquivos Relacionados
- `src/scripts/messages.js` - ACTIONS enum (Object.freeze)
- `src/scripts/app.js` - sendToPage, sendMessageToTab, getActiveTab, listeners
- `src/scripts/content.js` - handleMessage, chrome.runtime.onMessage