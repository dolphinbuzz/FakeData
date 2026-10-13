# Spec: Armazenamento e Persistência

## Visão Geral
Estratégia de armazenamento local-only (sem backend). Usa `chrome.storage.local` para dados estruturados e `localStorage` para preferências de UI.

## Chrome Storage (chrome.storage.local)

### Chaves Principais

#### `fakedata-field-mappings`
Estrutura hierárquica por Base URL:
```json
{
  "https://exemplo.com.br": {
    "pages": [
      {
        "id": "https://exemplo.com.br/page::123456::abc",
        "name": "Login",
        "pageUrl": "https://exemplo.com.br/page",
        "fields": [...],
        "audit": [...]
      }
    ]
  }
}
```

#### `fakedata-vehicle-catalog`
```json
[
  { "marca": "Toyota", "modelos": ["Corolla", "Yaris"] },
  { "marca": "Ford", "modelos": ["Ka", "Ranger"] }
]
```

#### `fakedata-floating-controls`
```json
true  // boolean: mostra/oculta botões flutuantes
```

### Operações CRUD

#### readProfiles(baseUrl, callback)
```javascript
chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
  callback(result["fakedata-field-mappings"][baseUrl]?.pages || []);
});
```

#### writeProfiles(baseUrl, profiles, callback)
```javascript
chrome.storage.local.get({ "fakedata-field-mappings": {} }, (result) => {
  result["fakedata-field-mappings"] = { ...result, [baseUrl]: { pages: profiles } };
  chrome.storage.local.set({ "fakedata-field-mappings": result }, callback);
});
```

#### Vehicle Catalog
```javascript
// Load
chrome.storage.local.get({ "fakedata-vehicle-catalog": [] }, (r) => {
  vehicleCatalog = normalizeVehicleCatalog(r["fakedata-vehicle-catalog"]);
});

// Save
chrome.storage.local.set({ "fakedata-vehicle-catalog": vehicleCatalog });
```

#### Floating Controls
```javascript
// Load
chrome.storage.local.get({ "fakedata-floating-controls": true }, (r) => {
  floatingControlsVisible = r["fakedata-floating-controls"];
});

// Save (on toggle)
chrome.storage.local.set({ "fakedata-floating-controls": visible });
```

## LocalStorage (Preferências UI)

| Chave | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `fakedata-theme` | `"light"\|"dark"` | `"dark"` | Tema visual |
| `fakedata-uf` | string | `"ALL"` | UF selecionada |
| `fakedata-floating-controls` | `"true"\|"false"` | `"true"` | Sync com storage |

## Geração de IDs

### Profile ID
```javascript
profileId() = "${pageUrl}::${Date.now()}::${Math.random().toString(36).slice(2)}"
```
Ex: `https://exemplo.com/page::1700000000000::abc123`

### Field Key
- Scanned: `${selector}::${index}`
- Manual: `${selector}::manual-${Date.now()}`
- Legacy: `${pageUrl}::legacy`

### Locator Name (selector-engine)
```javascript
"${route}-${context}-${type}"
// route: pathname.lastSegment sanitized
// context: label/name/tagName sanitized
// type: inputType/tagName lowercased
```

## Normalização de URLs

### getBaseUrl(url)
```javascript
// app.exemplo.com.br + api.exemplo.com.br → https://exemplo.com.br
// Tratamento especial .com.br (3 níveis) e .com (2 níveis)
```

### normalizePageUrl(url)
```javascript
// Remove query + hash
// https://exemplo.com/page?foo=1#section → https://exemplo.com/page
```

## Migração Legada (v1 → v2)
```javascript
// Detecta formato antigo: fakedata-field-mappings[url] = fields[]
// Converte para: fakedata-field-mappings[baseUrl].pages[]
// Gera legacyId: "${url}::legacy"
// Preserva todos os dados, não perde mapeamentos
```

## Padrões de Código

### Callbacks (não Promises)
```javascript
chrome.storage.local.get({ key: default }, (result) => { ... });
chrome.storage.local.set({ key: value }, () => { ... });
// Sempre verifica chrome.runtime.lastError
```

### Deep Clone
```javascript
// Ao modificar objetos do storage
{ ...field, fixed: Boolean(field.fixed), fixedValue: field.fixedValue || "" }
```

## Segurança
- Zero dados enviados para servidores
- Tudo local no navegador
- Permissões mínimas: `storage`, `activeTab`, `scripting`, `sidePanel`
- CSP: `script-src 'self'; object-src 'self'`

## Arquivos Relacionados
- `src/scripts/app.js` - Toda lógica de storage/profile
- `manifest.json` - Permissões storage
- `src/scripts/content.js` - Floating controls sync