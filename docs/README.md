# Documentação Técnica - FakeData

Este diretório contém a documentação técnica detalhada de cada funcionalidade da extensão FakeData.

## Índice de Especificações

| # | Arquivo | Descrição |
|---|---------|-----------|
| 01 | [geracao-dados.md](01-geracao-dados.md) | Geração de dados (Pessoa, Veículo, Empresa, Catálogo) |
| 02 | [mapeamento-campos.md](02-mapeamento-campos.md) | Scan automático, inferência de tipo, seletores CSS |
| 03 | [preenchimento-formularios.md](03-preenchimento-formularios.md) | Preenchimento individual/lote, Select2, custom selects, flutuantes |
| 04 | [perfis-mapeamento.md](04-perfis-mapeamento.md) | Storage, perfis por URL, valores fixos, migração legada |
| 05 | [interface-usuario.md](05-interface-usuario.md) | Popup, Side Panel, Tab, abas, temas, acessibilidade, shortcuts |
| 06 | [comunicacao-mensageria.md](06-comunicacao-mensageria.md) | ACTIONS, messaging popup↔content, fila de injeção, guarda de vivacidade |
| 07 | [armazenamento-persistencia.md](07-armazenamento-persistencia.md) | chrome.storage.local, localStorage, migração, IDs |
| 08 | [arquitetura-decisoes.md](08-arquitetura-decisoes.md) | Manifest V3, ADRs (incl. A1/A2), módulos, segurança, performance |
| 09 | [estrategia-testes.md](09-estrategia-testes.md) | Vitest, jsdom, coverage real, mocks, CI/CD 4 jobs |
| 10 | [build-release-deploy.md](10-build-release-deploy.md) | Versionamento, CI/CD, Chrome Web Store, Privacy, hooks/permissions |

---

## Visão Geral da Arquitetura

```
FakeData/
├── src/
│   ├── popup.html              # Interface principal (Popup/Side Panel/Tab)
│   ├── privacy.html            # Página de privacidade
│   ├── styles/
│   │   ├── popup.css           # CSS custom properties (temas light/dark)
│   │   └── privacy.css
│   └── scripts/
│       ├── app.js              # Orquestração UI + Messaging + Storage
│       ├── content.js          # Content script (IIFE, injetado) - fila injeção, dispose, guarda vivacidade
│       ├── generators.js       # Geração de dados pura (funções exportadas)
│       ├── selector-engine.js  # Scan, inferType, selectorFor, captureNextClick, observer nav
│       ├── messages.js         # ACTIONS enum (Object.freeze, 16 actions)
│       ├── privacy.js          # Lógica página privacidade
│       └── data/
│           ├── estados.js      # Const: ESTADOS (27), DDDS
│           ├── mapping-types.js # Const: MAPPING_TYPES (30 entradas: 29 tipos + auto)
│           └── vehicle-catalog.js # CRUD catálogo veículos (puro)
├── tests/                      # 205 testes (100% passing)
│   ├── setup.js               # Mocks globais Chrome + DOM
│   └── *.test.js              # 6 arquivos: app(83), content(33), selector-engine(65), generators(11), vehicle-catalog(12), messages(1)
├── .github/workflows/ci.yml    # Pipeline CI (4 jobs: test, lint, manifest-validation, version-consistency)
├── .opencode/                  # Config agente OpenCode V2
│   ├── context/               # ADRs, API contracts, coding standards, testing strategy
│   ├── skills/                # 10 skills especializadas
│   ├── workflows/             # Feature, bugfix, refactor, release, cross-cutting
│   ├── hooks/                 # Git hooks (pre-commit, pre-push, post-merge, session-*)
│   │   └── git/               # Shims reais (opt-in via core.hooksPath)
│   ├── memory/                # Memória persistente por agente
│   ├── README.md              # Docs do team OpenCode
│   └── workflows/README.md
├── docs/                       # Esta documentação (11 arquivos)
├── manifest.json               # Manifest V3 (host_permissions: <all_urls>)
├── package.json                # Scripts: test, test:coverage, validate-manifest
├── vitest.config.js            # Coverage thresholds por arquivo
├── opencode.jsonc              # Config OpenCode V2 (permissions V2: git push = ask)
├── .gitattributes              # LF forçado em .opencode/hooks/**/*.sh
├── CHANGELOG.md                # Keep a Changelog
├── CONTRIBUTING.md             # Guia de contribuição
├── PRIVACY_POLICY.md           # Política LGPD/GDPR
└── README.md                   # Documentação de instalação/uso
```

---

## Principais Fluxos

### 1. Gerar Dados
Usuário seleciona tipo (Pessoa/Veículo/Empresa) → Configura opções (UF, formato) → Clica Gerar → Copia campo individual ou JSON

### 2. Mapear Campos
Abre aba Mapping → Seleciona URL base → Clica "Escanear" → Revisa campos (tipo, seletor) → Salva perfil

### 3. Preencher Formulário
Seleciona perfil salvo → Clica "Preencher todos" OU clica botão flutuante individual → Valores fixos ou gerados

### 4. Gerenciamento de Perfis
Salva mapeamento → Nomeia → Aparece no dropdown → Seleciona → Edita/Renomeia/Exclui

---

## Tecnologias-Chave

- **Manifest V3** - Chrome Extension API moderna (`host_permissions: ["<all_urls>"]`)
- **ES Modules** - `type: "module"` no package.json
- **Vitest + jsdom** - Testes unitários/integração (thresholds 90%/80%/90%/90%)
- **chrome.storage.local** - Persistência perfis/catálogo
- **chrome.runtime/tabs/scripting** - Comunicação popup↔content
- **web_accessible_resources** - Dynamic import no content script (selector-engine, messages)
- **Side Panel API** - Painel lateral persistente
- **CSS Custom Properties** - Temas light/dark

---

## Qualidade

- **205 testes** passando (100%)
- **Coverage real**: 98.63% statements, 89.79% branches, 97.1% functions, 98.63% lines
- **✅ Gate de coverage**: todos os thresholds atendidos (`selector-engine.js` functions 94.28%)
- **Thresholds**: 90% global (lines/functions/statements), 80% branches; mínimo 90% por arquivo (críticos 95-100%)
- **CI**: GitHub Actions (Node 22, npm ci, test:coverage, manifest-validation, version-consistency; job de lint é no-op, pois não há script lint)
- **Manifest validation**: integrada ao pipeline (ajv-cli); lint não configurado

---

## Segurança

- **Zero rede** - Tudo local, sem backend
- **CSP Compliant** - `script-src 'self'`, no eval/inline
- **Sanitização** - `escapeHtml()` em todo user content
- **Permissões mínimas** - activeTab, scripting, storage, sidePanel
- **Privacidade** - LGPD/GDPR compliant, sem telemetria

---

## Comandos Principais

```bash
# Desenvolvimento
npm test                 # vitest run
npm run test:coverage    # vitest run --coverage (falha se thresholds não atingidos)

# Validação
npm run validate-manifest  # ajv-cli + schema Chrome Manifest V3

# Release (manual, sem script de build automatizado)
# 1. Bump version em manifest.json + package.json (SemVer)
# 2. Atualiza CHANGELOG.md
# 3. Zip package (exclui dev files: node_modules, tests, coverage, .git, .opencode, *.md, vitest.config.js, package*.json, .github)
# 4. Upload Chrome Web Store Developer Dashboard
```

---

## Decisões Recentes (A1/A2)

### A1 - Gate de Push (Permissions V2 + Hooks Opt-in)
- `opencode.jsonc`: `permissions` com `effect: "ask"` para `git push *` e variações (`*git push*`, `*git -C * push*`, `*git -c * push*`, `*git.exe*push*`, `*git.cmd*push*`)
- Removida seção legada `hooks` inválida no V2 e `git.hooksEnabled`
- `.opencode/hooks/git/*`: shims reais (pre-commit, pre-push, post-merge) — opt-in via `git config core.hooksPath .opencode/hooks/git`
- `.opencode/hooks/pre-push/00-confirm-push.sh`: consome stdin (refs do Git), lê `/dev/tty` para confirmação interativa, aceita `CONFIRM_PUSH=true`
- `.gitattributes`: LF forçado em `.opencode/hooks/**/*.sh`

### A2 - Fila de Injeção + Guarda de Vivacidade + Dispose
- `app.js`: `pendingInjections` (Map\<tabId, callback[]\>) + `injectContentScript()` serializa injeção por aba; waiters notificados juntos
- `content.js`: instalação autoritativa — `previousInstall.dispose?.()` remove listener, marcações, controles, estilo e observer; `installationProbe` retorna `!disposed && Boolean(chrome.runtime?.id)` e expõe `dispose()`
- `selector-engine.js`: `installNavigationObserver()` retorna função cleanup (disconnect MutationObserver, remove popstate/hashchange, restaura pushState/replaceState, limpa timer)

---

## Estrutura de Pastas .opencode (OpenCode V2)

```
.opencode/
├── context/
│   ├── architecture-decisions.md  # ADRs 001-008 (A1/A2 neste doc)
│   ├── api-contracts.md
│   ├── coding-standards.md
│   └── testing-strategy.md
├── skills/                  # 10 skills (fakedata-architect, generator, selector-engine, content-script, messaging, storage-profile, testing, devops, documentation, ui-ux)
├── workflows/               # feature-development, bug-fix, refactoring, cross-cutting-change, release-preparation
├── hooks/
│   ├── git/                 # Shims: pre-commit, pre-push, post-merge
│   ├── pre-commit/          # 01-lint.sh, 02-test-changed.sh
│   ├── pre-push/            # 00-confirm-push.sh, 01-full-test.sh, 02-version-check.sh
│   ├── post-merge/          # 01-install-deps.sh, 02-clear-cache.sh
│   ├── session-start/       # 01-load-context.sh
│   └── session-end/         # 01-save-memory.sh
├── memory/                  # Memória por agente
└── README.md                # Documentação do team
```