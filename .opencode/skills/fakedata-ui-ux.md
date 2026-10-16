# FakeData UI/UX

## Descrição
UI/UX - popup, side panel, dedicated tab, theming, acessibilidade, atalhos de teclado.

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

## Arquivos Principais
- src/popup.html - Estrutura principal
- src/styles/popup.css - Estilos (CSS custom properties para theming)
- src/scripts/app.js - Lógica UI (renderPageFields, modais, tabs, eventos)
- src/privacy.html + src/styles/privacy.css

## Fluxos UI Principais
- detectPopupMode() -> applyPopupMode() - Popup vs Side Panel vs Tab
- activateTab("generator"|"mapping") - Abas principais
- activateMappingSubtab("automatic"|"playground") - Sub-abas de mapeamento
- renderPageFields() - Linhas de campo dinâmicas com editores
- Modais: nome do mapeamento, catálogo de veículos, confirmações

## Theming
- CSS custom properties: --fg, --bg, --accent, --border, --muted
- localStorage: fakedata-theme ("light"|"dark")
- applyTheme() alterna documentElement.dataset.theme

## Acessibilidade
- ARIA labels em todos elementos interativos
- Navegação por teclado: Tab, Enter, Escape
- Gerenciamento de foco em modais
- Compatível com screen readers

## Atalhos de Teclado (Alt+Shift+)
- S: Scan fields
- P: Fill all
- F: Toggle floating controls
- L: Save mappings
- M: Mark all
- Bloqueado quando foco em input/textarea/select/contentEditable

## Patterns
- Atributo hidden (não display:none inline)
- Event delegation em pageFieldsElement
- escapeHtml() para todo conteúdo do usuário
- Estilos scoped (sem vazamento para página host)

## Coordenação
- Architect: mudanças manifest (sidePanel, permissões)
- Data Generation: novos tipos -> novos inputs mapping type
- Selector Engine: selectorStatus -> badges de warning
- Content Script: posicionamento/visibilidade controles flutuantes