# FakeData Messaging

## Descrição
Protocolo de mensageria - Enum ACTIONS, comunicação popup<->content, estratégia de injeção.

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

## Módulos Principais
- src/scripts/messages.js - Enum ACTIONS (Object.frozen)
- src/scripts/app.js - Lógica de mensageria do popup
- src/scripts/content.js - Handler de mensagens do content

## Enum ACTIONS (Source of Truth)
PAGE_CONTENT_CHANGED, SCAN_FIELDS, FILL_FIELD, FILL_ALL, HIGHLIGHT_FIELD,
MARK_FIELD, UNMARK_FIELD, MARK_ALL_FIELDS, UNMARK_ALL_FIELDS,
COUNT_SELECTOR_MATCHES, MARK_SELECTOR_MATCHES, UNMARK_SELECTOR_MATCHES,
CAPTURE_NEXT_CLICK, UPDATE_PAGE_FIELD_CONTROLS, SET_PAGE_FIELD_CONTROLS_VISIBILITY,
PAGE_FIELD_FILL_REQUEST

## Popup -> Content (Request/Response)
sendMessageToTab(tabId, message, callback, allowInjection=true)
- Tenta tabs.sendMessage
- On "Could not establish connection" + allowInjection: executeScript(content.js) -> retry uma vez

## Content -> Popup (Async Request)
Click botão flutuante -> PAGE_FIELD_FILL_REQUEST {key, selector}
Popup responde com valor gerado/fixo

## Content -> Popup (Notification)
Navegação SPA/mudança DOM -> PAGE_CONTENT_CHANGED {url, changeType}

## Regras
- NUNCA modificar ACTIONS sem coordenar TODOS os agentes (breaking change)
- SEMPRE retornar true em listeners onMessage para resposta assíncrona
- Validar sender.tab.id antes de responder
- Tratar "Extension context invalidated" graciosamente

## Testes
- Target: 100% para messages.test.js
- Arquivo de teste: tests/messages.test.js, tests/app.test.js, tests/content.test.js