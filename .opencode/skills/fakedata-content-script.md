# FakeData Content Script

## Descrição
Content script - preenchimento, marcação, destaque, controles flutuantes, Select2, selects customizados.

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
- src/scripts/content.js - IIFE, strict mode, imports dinâmicos

## Funções Principais
- fill(selector, value) - Lógica principal de preenchimento
- fillSelect() - Select nativo com waitForOptions
- fillCustomSelect() - multi-select, role=combobox, ui-autocomplete-multiselect
- select2NativeField() - Detecta Select2, retorna select nativo
- visualTarget() - Obtém elemento visível para posicionamento
- mark()/unmark()/highlight() - Gerenciamento de outline
- updatePageControls() - Cria botões flutuantes
- handleMessage() - Roteia todas as ACTIONS

## Fluxo de Lógica de Preenchimento
1. find(selector) -> element
2. select2NativeField(element) -> native select se Select2
3. visualTarget(element) -> elemento visível
4. Por tipo:
   - checkbox/radio: click se estado difere
   - custom select: trigger click -> encontra opção -> click -> fecha menu
   - select: waitForOptions -> match value/text -> set -> dispatch input/change
   - date: dd/mm/yyyy -> yyyy-mm-dd
   - month: dd/mm/yyyy -> yyyy-mm
   - number: remove não-numéricos, trata vírgula decimal
   - default: setNativeValue -> dispatch input/change

## Controles Flutuantes
- Classe: .fakedata-page-fill (z-index: 2147483647)
- Posição: getBoundingClientRect() + scroll offsets
- Click -> chrome.runtime.sendMessage(PAGE_FIELD_FILL_REQUEST)
- Visibilidade: SET_PAGE_FIELD_CONTROLS_VISIBILITY

## Message Actions Manipuladas
SCAN_FIELDS, FILL_FIELD, FILL_ALL, HIGHLIGHT_FIELD, MARK_FIELD, UNMARK_FIELD,
MARK_ALL_FIELDS, UNMARK_ALL_FIELDS, COUNT_SELECTOR_MATCHES, MARK_SELECTOR_MATCHES,
UNMARK_SELECTOR_MATCHES, CAPTURE_NEXT_CLICK, UPDATE_PAGE_FIELD_CONTROLS,
SET_PAGE_FIELD_CONTROLS_VISIBILITY

## Testes
- Target: 85%+ coverage
- Arquivo de teste: tests/content.test.js
- Mocks complexos: chrome.runtime, DOM, MutationObserver