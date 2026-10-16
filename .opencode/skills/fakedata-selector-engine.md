# FakeData Selector Engine

## Descrição
Selector engine - scan, inferType, selectorFor, captureNextClick, observer navegação SPA.

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
- src/scripts/selector-engine.js - Toda lógica de seletores

## Funções Exportadas
- scan() - Retorna Field[] para todos inputs/selects/textareas/custom-selects visíveis
- inferType(element) - Retorna MappingType (29 tipos)
- selectorFor(element) - Retorna {selector, rule, priority, status, suggestion}
- captureNextClick(sendResponse) - Captura próximo click para mapeamento manual
- installNavigationObserver() - Roteamento SPA + MutationObserver
- pageSignature() - Detecção de mudança de página
- normalize(), visible(), isCustomSelect()

## Prioridade de Seletores (1=melhor, 5=fallback)
1. #id, [data-cy], [data-test], [data-testid] - únicos por definição
2. [role], [aria-label], [aria-labelledby] - semântico/acessibilidade
3. [value], [ng-model], [name], [type] - atributos funcionais
4. Combinações: ng-model+name+type, name+type+value, role+aria-label, etc.
5. Texto estático (frágil), cadeia estrutural :nth-of-type (frágil)

## Regras
- NUNCA usar classes CSS (.btn, .form-control) - instáveis
- NUNCA usar estilos ([style*="color"]) - mudam constantemente
- SEMPRE validar unicidade: querySelectorAll(selector).length === 1
- Detecção de ID dinâmico: hashes, ember, component, padrões r123
- Selects customizados: multi-select, [role="combobox"], .ui-autocomplete-multiselect
- Status: "stable" ou "fragile" com selectorSuggestion

## Testes
- Target: 95%+ coverage
- Arquivo de teste: tests/selector-engine.test.js
- Funções puras - fáceis de testar