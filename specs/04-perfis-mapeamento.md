# Spec: Perfis de Mapeamento

## Visão Geral
Sistema de persistência e gerenciamento de mapeamentos de campos por URL base. Permite salvar, carregar, renomear e excluir perfis com valores fixos.

## Estrutura de Armazenamento

### chrome.storage.local
```
fakedata-field-mappings: {
  "https://base.com": {
    pages: [
      {
        id: "https://base.com/page::123456::abc123",
        name: "Login",
        pageUrl: "https://base.com/page",
        fields: [...],
        audit: [...]
      }
    ]
  }
}
```

### Agrupamento por Base URL
- `getBaseUrl()` normaliza: `app.exemplo.com.br` + `api.exemplo.com.br` → `https://exemplo.com.br`
- Tratamento especial: `.com.br` (3 níveis), `.com` (2 níveis)
- Porta incluída se não padrão

### Normalização de pageUrl
- Remove query string e hash
- `https://exemplo.com/page?foo=1#section` → `https://exemplo.com/page`

## Estrutura de Perfil

```javascript
{
  id: "https://base.com/page::timestamp::random",
  name: "Nome do Perfil",
  pageUrl: "https://base.com/page",  // normalizada
  fields: [
    {
      key: "selector::index",
      selector: "#email",
      label: "E-mail",
      dataType: "email",           // tipo selecionado pelo usuário
      fixed: false,                // checkbox "Fixar valor"
      fixedValue: "",              // valor se fixed, ou último usado
      selectorRule: "id",
      selectorStatus: "stable",
      selectorSuggestion: "",
      locatorName: "login-email-email"
    }
  ],
  audit: [...]  // resultado de getMappingAudit()
}
```

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

## Migração Legada (v1 → v2)
- Formato antigo: `fakedata-field-mappings[url] = fields[]`
- Formato novo: `fakedata-field-mappings[baseUrl].pages[]`
- Executa na inicialização (`migrateLegacyProfiles`)
- Gera `legacyId` para cada mapeamento antigo

## Auditoria
`getMappingAudit()` gera relatório:
- Status: `estável` / `frágil — requer atenção manual`
- Sugestões para seletores frágeis
- Detecção de colisão de `locatorName`

## Arquivos Relacionados
- `src/scripts/app.js` - storage logic, profile management, migration
- `src/scripts/messages.js` - ACTIONS (PAGE_FIELD_FILL_REQUEST)
- `src/scripts/content.js` - floating button click → PAGE_FIELD_FILL_REQUEST