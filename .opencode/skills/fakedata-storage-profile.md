# FakeData Storage/Profile

## Descrição
Storage e perfis - chrome.storage.local, localStorage, perfis por baseUrl, migração.

## Modelo
opencode/nemotron-3-ultra-free

## Ferramentas
- read
- write
- edit
- glob
- grep
- shell
- question

## Módulo Principal
- src/scripts/app.js - Funções de storage/perfil

## Chaves de Storage (chrome.storage.local)
- fakedata-field-mappings: {baseUrl: {pages: Profile[]}}
- fakedata-vehicle-catalog: VehicleCatalogEntry[]
- fakedata-floating-controls: boolean

## Estrutura do Perfil
Profile: {id, name, pageUrl (normalizado), fields: StoredField[], audit}
StoredField: {key, selector, label, dataType, fixed, fixedValue, selectorRule, selectorStatus, selectorSuggestion, locatorName}

## Funções Principais
- readProfiles(baseUrl, callback)
- writeProfiles(baseUrl, profiles, callback)
- persistPageMapping(name, existingId)
- loadSavedProfile(id)
- savePageMappings() -> persistPageMapping()
- renameSavedProfile()/deleteSavedProfile()
- migrateLegacyProfiles() - v1 array -> v2 baseUrl+pages
- loadFloatingControlsPreference()
- updateSavedProfiles()
- getBaseUrl()/normalizePageUrl()/profileId() - funções puras

## localStorage (prefs UI)
- fakedata-theme: "light"|"dark"
- fakedata-uf: "ALL"|UF sigla
- fakedata-floating-controls: "true"|"false"

## Regras
- Callbacks para chrome.storage (não Promises)
- Sempre verificar chrome.runtime.lastError
- Deep clone ao modificar: {...field, fixed: Boolean(field.fixed)}
- Agrupamento por Base URL: getBaseUrl() trata .com.br, .com

## Testes
- Target: 85%+ coverage
- Arquivo de teste: tests/app.test.js
- Mock chrome.storage.local.get/set