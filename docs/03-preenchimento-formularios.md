# Spec: Preenchimento de Formulários

## Visão Geral
Sistema de preenchimento automático de campos mapeados, suportando múltiplos tipos de entrada, Select2, componentes customizados e preenchimento em lote sequencial.

## Modos de Preenchimento

### Individual
- Botão 📥 no painel do campo
- Botão flutuante 📥 na página (se habilitado)
- Usa valor fixo (se `fixed=true`) ou gera novo valor

### Preencher Todos
- Sequencial (Promise chain) para evitar race conditions
- Botão "Preencher todos" no painel
- Atalho `Alt+Shift+P`
- Feedback: `X de Y campo(s) preenchido(s)`

### Botões Flutuantes
- Posicionamento: `getBoundingClientRect()` + scroll offsets
- Estilo: 28x28px, z-index 2147483647, canto superior direito do campo
- Visibilidade: Controlada por checkbox "Botões flutuantes" (persiste em `chrome.storage.local` + `localStorage`)
- Click → `PAGE_FIELD_FILL_REQUEST` → popup responde com valor gerado/fixo

## Tipos de Campo Suportados

| Tipo | Tratamento |
|------|------------|
| `text`, `email`, `tel`, `password`, `search`, `url` | `setNativeValue` + `input` + `change` events |
| `number` | Sanitiza: remove não-dígitos, trata vírgula decimal BR |
| `date` | `DD/MM/AAAA` → `YYYY-MM-DD` |
| `month` | `DD/MM/AAAA` → `YYYY-MM` |
| `checkbox` | Click se estado diferente do desejado |
| `radio` | Click para selecionar |
| `select` nativo | `waitForOptions` → match value/text → `input`+`change` |
| `select` (Select2) | Detecta `.select2-hidden-accessible` → preenche nativo oculto |
| Custom select | `multi-select`, `[role=combobox]`, `.ui-autocomplete-multiselect` |

## Select2 Support
- Detecta `select.select2-hidden-accessible`
- Encontra container via `aria-labelledby` → `select2-*-container`
- Ou sibling anterior `.select2-container` → `select` anterior
- Preenche o `<select>` nativo oculto

## Custom Selects
Seletores: `multi-select`, `[role=combobox]`, `.ui-autocomplete-multiselect`
1. Click no trigger (`input`, `[role=combobox]`, `.ui-autocomplete-multiselect`)
2. Busca opções visíveis: `li[list-select]`, `[role=option]`, `.ui-menu-item`, `.select2-results__option`
3. Match por texto normalizado (contains bidirecional)
4. Click na opção → fecha menu (ESC + blur)

## Formatação de Valores (Brasil)
| Tipo | Entrada | Saída (HTML) |
|------|---------|--------------|
| Date | `DD/MM/AAAA` | `YYYY-MM-DD` |
| Month | `DD/MM/AAAA` | `YYYY-MM` |
| Number | `R$ 1.234,56` | `1234.56` |

## Validações
- Elemento deve existir e não estar disabled
- Select aguarda opções (timeout 700ms)
- Select vazio → falha silenciosa
- Custom select sem opções visíveis → falha

## Marcação Visual (Highlight/Mark)
- **Highlight**: Outline vermelho 3px temporário (1.4s) + scrollIntoView
- **Mark**: Outline persistente vermelho 3px + offset 2px (com `!important`)
- **Unmark**: Restaura outline original (com prioridade)
- **Batch**: `MARK_ALL_FIELDS` / `UNMARK_ALL_FIELDS` com relatório de falhas

## Floating Controls Sync
- `UPDATE_PAGE_FIELD_CONTROLS`: Recria botões com campos atuais + visibilidade
- `SET_PAGE_FIELD_CONTROLS_VISIBILITY`: Mostra/esconde (checkbox)
- Posicionamento recalculado a cada sync

## Arquivos Relacionados
- `src/scripts/content.js` - fill, fillSelect, fillCustomSelect, mark, highlight, floating controls, handleMessage, installationProbe, dispose
- `src/scripts/generators.js` - generateMappedValue (valores por tipo)
- `src/scripts/messages.js` - ACTIONS (FILL_FIELD, FILL_ALL, MARK_*, PAGE_FIELD_FILL_REQUEST, etc.)
- `src/scripts/selector-engine.js` - isCustomSelect, normalize, visible, SELECT2_OPTION_SELECTOR