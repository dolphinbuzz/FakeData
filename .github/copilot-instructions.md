## Build Commands
- npm test — roda a suíte de testes
- npm run lint — valida convenções de código

## Code Style
- Módulos ES nativos, sem framework de bundler
- Funções puras (sem `document`/`window`) vivem em generators.js e data/*.js
- Nenhuma string de `chrome.runtime` action fora de messages.js

## Workflow
- Rodar testes após cada etapa de refactor
- Um commit por etapa concluída