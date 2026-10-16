# API Contracts - FakeData

## Messaging Protocol (messages.js)

### ACTIONS Enum (Fonte da Verdade - Object.freeze)
```javascript
const ACTIONS = {
  // Content -> Popup (Notifications)
  PAGE_CONTENT_CHANGED: "PAGE_CONTENT_CHANGED",      // { url, changeType: "route"|"dom" }
  
  // Popup -> Content (Commands)
  SCAN_FIELDS: "SCAN_FIELDS",                        // {} -> { fields: Field[] }
  FILL_FIELD: "FILL_FIELD",                          // { selector, value } -> { filled: boolean }
  FILL_ALL: "FILL_ALL",                              // { fields: [{selector, value}] } -> { filled: number, total: number }
  HIGHLIGHT_FIELD: "HIGHLIGHT_FIELD",                // { selector } -> { highlighted: boolean }
  MARK_FIELD: "MARK_FIELD",                          // { selector } -> { marked: boolean }
  UNMARK_FIELD: "UNMARK_FIELD",                      // { selector } -> { unmarked: boolean }
  MARK_ALL_FIELDS: "MARK_ALL_FIELDS",                // { selectors: string[] } -> { marked, total, selectors, failed }
  UNMARK_ALL_FIELDS: "UNMARK_ALL_FIELDS",            // { selectors: string[] } -> { unmarked, total }
  COUNT_SELECTOR_MATCHES: "COUNT_SELECTOR_MATCHES",  // { selector } -> { count: number, invalid?: boolean }
  MARK_SELECTOR_MATCHES: "MARK_SELECTOR_MATCHES",    // { selector } -> { count: number }
  UNMARK_SELECTOR_MATCHES: "UNMARK_SELECTOR_MATCHES",// { selector } -> { count: number }
  CAPTURE_NEXT_CLICK: "CAPTURE_NEXT_CLICK",          // {} -> { captured: boolean, field?: Field }
  UPDATE_PAGE_FIELD_CONTROLS: "UPDATE_PAGE_FIELD_CONTROLS",  // { fields: [{key,selector,label}], visible: boolean } -> { updated: boolean, count: number }
  SET_PAGE_FIELD_CONTROLS_VISIBILITY: "SET_PAGE_FIELD_CONTROLS_VISIBILITY", // { visible: boolean } -> { updated: boolean, count: number }
  
  // Content -> Popup (Async Request from Floating Button)
  PAGE_FIELD_FILL_REQUEST: "PAGE_FIELD_FILL_REQUEST" // { key, selector } -> { filled: boolean }
}
```

### Payload Types

#### SCAN_FIELDS Response - Field[]
```typescript
interface Field {
  key: string;                    // "${selector}::${index}" ou "${rule}::${index}"
  selector: string;               // CSS selector único
  label: string;                  // Label legível (max 120 chars)
  inferredType: MappingType;      // Um de MAPPING_TYPES[].value
  tagName: string;                // "input" | "select" | "textarea" | "multi-select"
  inputType: string;              // "text" | "email" | "number" | "date" | "month" | "checkbox" | "radio" | ""
  value: string;                  // Valor atual do campo
  required: boolean;
  disabled: boolean;
  selectorRule: string;           // Regra que gerou: "id" | "data-cy" | "fallback proibido" | etc.
  selectorStatus: "stable" | "fragile";
  selectorSuggestion: string;     // Sugestão se fragile
  locatorName: string;            // "route-context-type" para auditoria
}
```

#### PAGE_FIELD_FILL_REQUEST (Content -> Popup)
```typescript
// Sent when floating button clicked
{ key: string, selector: string }
// Popup responds with generated/fixed value via sendResponse({ filled: boolean })
```

#### PAGE_CONTENT_CHANGED (Content -> Popup)
```typescript
{ url: string, changeType: "route" | "dom" }
// "route": pushState/replaceState/popstate/hashchange
// "dom": MutationObserver detected relevant changes
```

## Storage Schemas (chrome.storage.local)

### fakedata-field-mappings
```typescript
interface StorageMappings {
  [baseUrl: string]: {
    pages: Profile[];
  };
}

interface Profile {
  id: string;                     // "${pageUrl}::${timestamp}::${random}"
  name: string;                   // User-defined
  pageUrl: string;                // Normalized (no query/hash)
  fields: StoredField[];
  audit: AuditEntry[];            // From getMappingAudit()
}

interface StoredField {
  key: string;
  selector: string;
  label: string;
  dataType: MappingType;          // User-selected (may differ from inferredType)
  fixed: boolean;                 // Checkbox "Fixar valor"
  fixedValue: string;             // Value if fixed, else last used
  selectorRule: string;
  selectorStatus: "stable" | "fragile";
  selectorSuggestion: string;
  locatorName: string;
}
```

### fakedata-vehicle-catalog
```typescript
interface VehicleCatalogEntry {
  marca: string;
  modelos: string[];              // Unique, case-insensitive deduped
}
// Array<VehicleCatalogEntry>
```

### fakedata-floating-controls
```typescript
boolean;  // true = show floating buttons (default)
```

## localStorage Keys (UI Preferences)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `fakedata-theme` | `"light" \| "dark"` | `"dark"` | Theme preference |
| `fakedata-uf` | string | `"ALL"` | Selected UF (sigla or "ALL") |
| `fakedata-floating-controls` | `"true" \| "false"` | `"true"` | Sync with storage |

## Generator Data Contract (generators.js)

### createGeneratorData Options
```typescript
interface GeneratorOptions {
  getState: () => Estado;                    // Returns { sigla, nome, cidades, ddds }
  ddds: string[];                            // All DDDs fallback
  getCpfFormatted: () => boolean;            // UI checkbox
  getCnpjFormatted: () => boolean;           // UI checkbox
  getCnpjAlphanumeric: () => boolean;        // UI checkbox
  getVehicleCatalog: () => VehicleCatalogEntry[];
}
```

### Generator Definition (per type: person/vehicle/company)
```typescript
interface GeneratorDef {
  title: string;                    // "Pessoa gerada"
  label: string;                    // "Pessoa" (tab button)
  context: () => GeneratorContext;  // Shared context for fields
  fields: [string, (ctx: GeneratorContext) => string][];  // [label, generator]
}
```

### generateMappedValue (Used by Fill Logic)
```typescript
function generateMappedValue(
  type: MappingType,           // One of MAPPING_TYPES[].value
  context: GeneratorContext,   // From person.context()
  inputType: string,           // "checkbox" | "radio" | "date" | "month" | "number" | ""
  options: GeneratorOptions    // Same as createGeneratorData
): any;
```

## Selector Engine Contract (selector-engine.js)

### Exported Functions
```typescript
// Scan all fields in page
function scan(): Field[];

// Infer semantic type from element
function inferType(element: Element): MappingType;

// Generate best selector for element
function selectorFor(element: Element): SelectorResult;

interface SelectorResult {
  selector: string;
  rule: string;           // "id" | "data-cy" | "ng-model + name" | "fallback proibido" | etc.
  priority: number;       // 1-5 (lower = better)
  status: "stable" | "fragile";
  suggestion?: string;    // Only if fragile
}

// Capture next user click for manual mapping
function captureNextClick(sendResponse: (response: CaptureResponse) => void): void;

interface CaptureResponse {
  captured: boolean;
  field?: Field;
}

// Install SPA navigation observers
function installNavigationObserver(): void;

// Page signature for change detection
function pageSignature(): string;

// Utilities
function normalize(value: string): string;
function visible(element: Element): boolean;
function isCustomSelect(element: Element): boolean;
```

## Mapping Types (mapping-types.js)
```typescript
type MappingType = 
  | "auto" | "name" | "cpf" | "cnpj" | "email" | "phone" | "rg" | "cep"
  | "address" | "number" | "neighborhood" | "city" | "state"
  | "profession" | "income" | "birthDate" | "gender" | "mother" | "father"
  | "company" | "brand" | "model" | "year" | "plate" | "chassi"
  | "website" | "checkbox" | "radio" | "text";

const MAPPING_TYPES: [MappingType, string][] = [
  ["auto", "Inferir automaticamente"],
  ["name", "Nome"], ["cpf", "CPF"], ["cnpj", "CNPJ"], ...
];
```

## Estados Data (estados.js)
```typescript
interface Estado {
  sigla: string;
  nome: string;
  cidades: string[];
  ddds: string[];
}

const ESTADOS: Estado[] = [ /* 27 estados */ ];
const DDDS: string[] = [ /* All DDDs flat */ ];
```

## Vehicle Catalog Functions (vehicle-catalog.js)
```typescript
function normalizeVehicleCatalog(input: any[]): VehicleCatalogEntry[];
function validateVehicleEntry(marca: string, modelo: string): string;  // "" if valid
function addVehicleModel(catalog: VehicleCatalogEntry[], marca: string, modelo: string): VehicleCatalogEntry[];
function removeVehicleModel(catalog: VehicleCatalogEntry[], marca: string, modelo: string): VehicleCatalogEntry[];
function removeVehicleBrand(catalog: VehicleCatalogEntry[], marca: string): VehicleCatalogEntry[];
function renameVehicleBrand(catalog: VehicleCatalogEntry[], marca: string, novoNome: string): VehicleCatalogEntry[];
function renameVehicleModel(catalog: VehicleCatalogEntry[], marca: string, modelo: string, novoModelo: string): VehicleCatalogEntry[];
function pickVehicle(catalog: VehicleCatalogEntry[], pick: (arr) => any): { marca: string, modelo: string };
```

## Validation Functions (generators.js)
```typescript
function validarCPF(valor: string): boolean;
function validarCNPJ(valor: string): boolean;
function validarChassi(valor: string): boolean;
function cpf(formatado?: boolean): string;
function cnpj(formatado?: boolean, alfanumerico?: boolean): string;
function gerarChassi(): string;
function gerarPlaca(): string;
function gerarAno(): string;  // "2024/2025"
```

## URL Utilities (app.js)
```typescript
function normalizePageUrl(url: string): string;  // Remove query + hash
function getBaseUrl(url: string): string;        // "https://dominio.com.br" (handles .com.br)
function profileId(): string;                    // "${pageUrl}::${Date.now()}::${random}"
```

## Key Generation Rules

### Field Key
- Scanned: `${selector}::${index}`
- Manual: `${selector}::manual-${Date.now()}`
- Legacy: `${pageUrl}::legacy`

### Profile ID
- `${normalizePageUrl(pageUrl)}::${Date.now()}::${Math.random().toString(36).slice(2)}`

### Locator Name (selector-engine.js)
- `${route}-${context}-${type}`
- route: `window.location.pathname.split("/").pop()` sanitized
- context: label or name or tagName sanitized
- type: inputType or tagName lowercased

## Error Handling Patterns

### Chrome Runtime Errors
```javascript
// Always check
chrome.tabs.sendMessage(tabId, msg, (response) => {
  const error = chrome.runtime.lastError;
  if (error) {
    // Handle: "Could not establish connection" -> inject content.js
    // "Extension context invalidated" -> set flag, don't throw
  }
});
```

### Storage Errors
```javascript
chrome.storage.local.set({ key: value }, () => {
  if (chrome.runtime.lastError) {
    // Show user error, don't crash
  }
});
```

## Version Compatibility
- Manifest V3 required
- Chrome 88+ / Edge 88+ (sidePanel, scripting API)
- Node 18+ for dev (package.json engines)