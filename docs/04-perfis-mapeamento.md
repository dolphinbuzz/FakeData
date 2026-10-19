# Spec: Perfis de Mapeamento

## Visão Geral
Sistema de persistência e gerenciamento de mapeamentos de campos por URL base. Permite salvar, carregar, renomear e excluir perfis com valores fixos.

## Estrutura de Armazenamento

### chrome.storage.local

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
  const stored = result["fakedata-field-mappings"] || {};
  stored[baseUrl] = { pages: profiles };
  chrome.storage.local.set({ "fakedata-field-mappings": stored }, callback);
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
// Porta incluída se não padrão
```

### normalizePageUrl(url)
```javascript
// Remove query + hash
// https://exemplo.com/page?foo=1#section → https://exemplo.com/page
```

## Migração Legada (v1 → v2)
- Formato antigo: `fakedata-field-mappings[url] = fields[]`
- Formato novo: `fakedata-field-mappings[baseUrl].pages[]`
- Executa na inicialização (`migrateLegacyProfiles`)
- Gera `legacyId` para cada mapeamento antigo: `${url}::legacy`
- Preserva todos os dados, não perde mapeamentos

## Auditoria
`getMappingAudit()` gera relatório:
- Status: `estável` / `frágil — requer atenção manual`
- Sugestões para seletores frágeis
- Detecção de colisão de `locatorName`

## Campo Fixo vs Gerado
| Configuração | Comportamento |
|-------------|---------------|
| `fixed=false` | Gera novo valor a cada preenchimento |
| `fixed=true` | Usa `fixedValue` (persistido) |
| Após preenchimento | `value` e `fixedValue` atualizados (mesmo se não fixo) |

## Fluxos Principais

### Salvar Mapeamento
1. Se perfil selecionado → atualiza (`existingId`)
2. Se novo → modal nome → `profileId()` → cria novo
3. Persiste em `chrome.storage.local`
4. Atualiza dropdown `savedMappingsSelect`

### Carregar Perfil
1. Usuário seleciona no dropdown
2. `loadSavedProfile(id)` → popula `pageFields`
3. `fixed` → Boolean, `fixedValue` default ""
4. Re-render UI

### Renomear/Excluir
- **Renomear**: Modal com nome atual → atualiza storage
- **Excluir**: Confirmação → remove do array `pages`

## Arquivos Relacionados
- `src/scripts/app.js` - Toda lógica de storage/profile/migration
- `src/scripts/messages.js` - ACTIONS (PAGE_FIELD_FILL_REQUEST)
- `src/scripts/content.js` - floating button click → PAGE_FIELD_FILL_REQUEST