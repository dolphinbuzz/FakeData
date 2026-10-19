# Coding Standards - FakeData

## General Principles
- **ESM Only**: `"type": "module"` em package.json. `import`/`export` exclusivamente.
- **Strict Mode**: `"use strict"` no topo de `content.js` (IIFE).
- **Zero Runtime Dependencies**: Apenas `devDependencies` (vitest, coverage, jsdom).
- **Funções Puras Exportadas**: Toda lógica de negócio em funções puras testáveis.
- **Callbacks para Chrome APIs**: `chrome.storage.local.get/set` usam callbacks, não Promises.
- **Object.freeze para Constantes/Enums**: `ACTIONS`, `MAPPING_TYPES`, `DEFAULT_VEHICLE_CATALOG`.

## File Organization
```
src/scripts/
├── app.js                    # Orquestração UI + Messaging + Storage (popup/sidepanel)
├── content.js                # Content script (IIFE, injetado na página)
├── generators.js             # Pure data generation functions
├── selector-engine.js        # Pure selector logic + DOM scanning
├── messages.js               # ACTIONS enum (frozen)
└── data/
    ├── estados.js            # Const data: ESTADOS, DDDS
    ├── mapping-types.js      # Const: MAPPING_TYPES
    └── vehicle-catalog.js    # Pure CRUD functions for catalog
```

## Naming Conventions
| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `scanPageFields`, `vehicleCatalog` |
| Constants/Enums | SCREAMING_SNAKE_CASE | `ACTIONS`, `DDDS`, `MAPPING_TYPES` |
| Classes | PascalCase | (não usado - funções puras) |
| Private module vars | `_prefix` | `_internalCache` (evitar) |
| Files | kebab-case | `selector-engine.js`, `vehicle-catalog.js` |

## Code Patterns

### Module Structure
```javascript
// Imports first
import { ACTIONS } from "./messages.js";
import { DDDS, ESTADOS } from "./data/estados.js";

// Exported pure functions
export function pureFunction(input) { ... }

// Non-exported helpers (module scope)
function helper() { ... }

// Main exported object/function
export const MainThing = { ... };
```

### Chrome Storage Pattern
```javascript
// SEMPRE verifique lastError
chrome.storage.local.get({ "key": defaultValue }, (result) => {
  if (chrome.runtime.lastError) {
    console.error("Storage get failed:", chrome.runtime.lastError);
    return;
  }
  // Use result.key
});

chrome.storage.local.set({ "key": value }, () => {
  if (chrome.runtime.lastError) {
    console.error("Storage set failed:", chrome.runtime.lastError);
    // Show user feedback
    return;
  }
  // Success
});
```

### Messaging Pattern (Popup -> Content)
```javascript
function sendMessageToTab(tabId, message, callback, allowInjection) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const error = chrome.runtime.lastError;
    if (!error) {
      callback(response, null);
      return;
    }

    if (!allowInjection || !chrome.scripting || !chrome.scripting.executeScript) {
      callback(null, error);
      return;
    }
    injectContentScript(tabId, (injectionError) => {
      if (injectionError) {
        callback(null, injectionError);
        return;
      }
      sendMessageToTab(tabId, message, callback, false); // retry uma vez, sem injetar de novo
    });
  });
}

// Fila por aba: chamadas concorrentes compartilham UMA injeção. A entrada do Map é
// removida ANTES de notificar (libera novas injeções) e cada waiter roda em try/catch.
const pendingInjections = new Map(); // tabId -> [callback]

function injectContentScript(tabId, callback) {
  const waiters = pendingInjections.get(tabId);
  if (waiters) {
    waiters.push(callback);
    return;
  }
  pendingInjections.set(tabId, [callback]);

  const notifyWaiters = (injectionError) => {
    const pendingWaiters = pendingInjections.get(tabId) || [];
    pendingInjections.delete(tabId);
    pendingWaiters.forEach((waiter) => {
      try {
        waiter(injectionError);
      } catch (_error) {
        // waiter já invalidado (ex.: popup fechado)
      }
    });
  };

  try {
    chrome.scripting.executeScript(
      { target: { tabId }, files: ["src/scripts/content.js"] },
      () => notifyWaiters(chrome.runtime.lastError || null)
    );
  } catch (error) {
    // throw síncrono (ex.: contexto invalidado) não pode deixar a entrada órfã
    notifyWaiters(error);
  }
}
```

### Messaging Pattern (Content -> Popup)
```javascript
// Content script - SEMPRE return true para async
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === ACTIONS.SCAN_FIELDS) {
    modulesReady.then(() => sendResponse({ fields: selectorEngine.scan() }));
    return true;  // CRITICAL: keeps channel open for async response
  }
  // ...
  return true;
});
```

### Content Script Injection Safety
```javascript
// content.js - IIFE with strict mode
(() => {
  "use strict";

  // Guarda de re-injeção: o popup/painel pode reinjetar o script (reload completo da página
  // também recria o contexto; navegação SPA same-document NÃO reinjeta). A execução anterior
  // registra uma função de vivacidade: se ela lançar (contexto invalidado por update/reload da
  // extensão) ou retornar falsy, esta execução reinstala listeners/estilo (reparo autoritativo).
  const previousInstall = window.__fakedataContentInstalled;
  if (previousInstall) {
    if (typeof previousInstall !== "function") return; // guarda antiga (booleana), presumida viva
    try {
      if (previousInstall()) return; // instalação viva: não duplica nada
    } catch (_error) {
      // contexto invalidado → reinstala
    }
  }
  window.__fakedataContentInstalled = () => Boolean(chrome.runtime && chrome.runtime.id);

  const modulesReady = Promise.all([
    import(chrome.runtime.getURL("src/scripts/selector-engine.js")),
    import(chrome.runtime.getURL("src/scripts/messages.js"))
  ]);

  let selectorEngine = null;
  let actions = null;

  modulesReady.then(([engine, messages]) => {
    selectorEngine = engine;
    actions = messages.ACTIONS;
  });

  // Listener registrado imediatamente; handlers aguardam modulesReady
  chrome.runtime.onMessage.addListener(handleMessage);

  function handleMessage(message, sender, sendResponse) {
    modulesReady.then(() => {
      // actual handling
    }).catch(() => sendResponse({ error: "Module load failed" }));
    return true;
  }
})();
```

### DOM Safety
```javascript
// SEMPRE verifique existência
const element = document.querySelector("#id");
if (!element) return;

// Use optional chaining
const value = element?.value ?? "";

// Escape HTML para prevenir XSS
function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "&#039;");
}

// Use hidden attribute, não display:none inline
element.hidden = true;  // ou element.hidden = false
```

### Event Listeners
```javascript
// Cleanup em content script
function captureNextClick(sendResponse) {
  const onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    document.removeEventListener("click", onClick, true);  // Cleanup
    // ...
  };
  document.addEventListener("click", onClick, true);
  setTimeout(() => document.removeEventListener("click", onClick, true), 30000);  // Timeout safety
}

// Keyboard shortcuts - check editable target
function isEditableTarget(target) {
  return target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable);
}

document.addEventListener("keydown", (event) => {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return;
  // ...
});
```

### Async/Await vs Callbacks
```javascript
// Chrome APIs: callbacks (não promisify)
chrome.storage.local.get({ key: [] }, (result) => { ... });

// Promises internas OK para coordenação
const modulesReady = Promise.all([import(...), import(...)]);

// Fill sequencial com Promise chain (content.js)
fields.reduce((chain, item) => chain.then(async (results) => {
  results.push(await fill(item.selector, item.value));
  return results;
}), Promise.resolve([])).then((results) => {
  sendResponse({ filled: results.filter(Boolean).length, total: results.length });
});
```

### Error Boundaries
```javascript
// Try/catch em pontos de falha conhecidos
try {
  vehicleCatalog = addVehicleModel(vehicleCatalog, brand, model);
  saveVehicleCatalog();
} catch (error) {
  vehicleCatalogStatus.textContent = error.message;  // User feedback
}

// Extension context invalidated
try {
  chrome.runtime.sendMessage({ action: ACTIONS.PAGE_CONTENT_CHANGED, ... });
} catch (error) {
  if (!/Extension context invalidated/i.test(String(error?.message))) throw error;
  runtimeContextInvalidated = true;  // Silently handle
}
```

## Testing Patterns

### Pure Functions - Direct Test
```javascript
// generators.test.js
import { validarCPF, cpf, gerarChassi } from "../src/scripts/generators.js";

test("validarCPF accepts valid CPF", () => {
  expect(validarCPF("111.444.777-35")).toBe(true);
});

test("cpf() returns 14 chars formatted", () => {
  const result = cpf(true);
  expect(result).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
});
```

### Chrome APIs Mocking
```javascript
// Global setup (tests/setup.js or per file)
global.chrome = {
  runtime: {
    sendMessage: vi.fn((msg, cb) => cb({})),
    onMessage: { addListener: vi.fn() },
    lastError: null,
    getURL: (path) => `chrome-extension://test/${path}`
  },
  storage: {
    local: {
      get: vi.fn((keys, cb) => cb({ "key": defaultValue })),
      set: vi.fn((obj, cb) => cb && cb())
    }
  },
  tabs: {
    query: vi.fn((q, cb) => cb([{ id: 1, url: "http://test.com", active: true }])),
    sendMessage: vi.fn((tabId, msg, cb) => cb({})),
    onActivated: { addListener: vi.fn() },
    create: vi.fn((opts, cb) => cb({}))
  },
  scripting: { executeScript: vi.fn((opts, cb) => cb && cb()) },
  sidePanel: { open: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) },
  windows: { getCurrent: vi.fn((cb) => cb({ type: "popup", id: 1 })) }
};
```

### DOM Mocking (jsdom)
```javascript
// Element methods
Element.prototype.matches = vi.fn((selector) => true);
Element.prototype.closest = vi.fn((selector) => null);
Element.prototype.querySelector = vi.fn(() => null);
Element.prototype.querySelectorAll = vi.fn(() => []);
Element.prototype.getBoundingClientRect = vi.fn(() => ({ top: 0, left: 0, right: 100, bottom: 30, height: 30, width: 100 }));
Element.prototype.scrollIntoView = vi.fn();

// window.getComputedStyle
window.getComputedStyle = vi.fn(() => ({ display: "block", visibility: "visible" }));

// MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn()
}));

// history
window.history.pushState = vi.fn();
window.history.replaceState = vi.fn();
```

## Performance Guidelines
- **Lazy Load**: Dynamic imports no content script (`modulesReady`)
- **Debounce**: Page change notification 250ms (`pageChangeTimer`)
- **Cleanup**: `clearMarks()`, `removePageControls()`, `removeEventListener`
- **Memoization**: `pageSignature()` cached, `lastPageSignature` comparison
- **Batch Operations**: `MARK_ALL_FIELDS` vs loop de `MARK_FIELD`

## Security
- **CSP Compliant**: No inline scripts, no `eval()`, no `new Function()`
- **Sanitize**: `escapeHtml()` para todo user-generated content no DOM
- **Minimal Permissions**: `activeTab`, `scripting`, `storage`, `sidePanel` only
- **No External Requests**: Zero network calls, tudo local

## Git/Commit
- **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branch**: `feature/`, `fix/`, `refactor/`, `docs/`
- **PR Template**: Description, testing, screenshots (UI), related issue