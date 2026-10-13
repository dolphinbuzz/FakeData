# Especificacoes Tecnicas - FakeData

Este diretorio contem a documentacao tecnica detalhada de cada funcionalidade da extensao FakeData.

## Indice de Especificacoes

| # | Arquivo | Descricao |
|---|---------|-----------|
| 01 | [geracao-dados.md](01-geracao-dados.md) | Geracao de dados (Pessoa, Veiculo, Empresa, Catalogo) |
| 02 | [mapeamento-campos.md](02-mapeamento-campos.md) | Scan automatico, inferencia de tipo, seletores CSS |
| 03 | [preenchimento-formularios.md](03-preenchimento-formularios.md) | Preenchimento individual/lote, Select2, custom selects, flutuantes |
| 04 | [perfis-mapeamento.md](04-perfis-mapeamento.md) | Storage, perfis por URL, valores fixos, migracao legada |
| 05 | [interface-usuario.md](05-interface-usuario.md) | Popup, Side Panel, Tab, abas, temas, acessibilidade, shortcuts |
| 06 | [comunicacao-mensageria.md](06-comunicacao-mensageria.md) | ACTIONS, messaging popup<->content, injection strategy |
| 07 | [armazenamento-persistencia.md](07-armazenamento-persistencia.md) | chrome.storage.local, localStorage, migracao, IDs |
| 08 | [arquitetura-decisoes.md](08-arquitetura-decisoes.md) | Manifest V3, ADRs, modulos, seguranca, performance |
| 09 | [estrategia-testes.md](09-estrategia-testes.md) | Vitest, jsdom, coverage 90%, mocks, CI/CD |
| 10 | [build-release-deploy.md](10-build-release-deploy.md) | Versionamento, CI/CD, Chrome Web Store, Privacy |

## Visao Geral da Arquitetura

```
FakeData/
├── src/
│   ├── popup.html              # Interface principal
│   ├── styles/popup.css        # CSS custom properties (temas)
│   └── scripts/
│       ├── app.js              # Orquestracao UI + Messaging + Storage
│       ├── content.js          # Content script (IIFE, injected)
│       ├── generators.js       # Pure data generation
│       ├── selector-engine.js  # Scan, inferType, selectorFor
│       ├── messages.js         # ACTIONS enum (frozen)
│       └── data/
│           ├── estados.js      # ESTADOS, DDDS
│           ├── mapping-types.js # 29 MAPPING_TYPES
│           └── vehicle-catalog.js # CRUD catalogo
├── tests/                      # 133 testes (100% passing)
│   ├── setup.js               # Mocks globais Chrome + DOM
│   └── *.test.js              # 6 arquivos de teste
├── .github/workflows/ci.yml    # Pipeline CI
├── .opencode/                  # Config agente team
│   ├── team/                  # 10 agentes especializados
│   ├── skills/                # 10 skills customizadas
│   ├── hooks/                 # Automation hooks
│   └── config.yaml            # Config OpenCode
└── specs/                     # Esta documentacao
```

## Principais Fluxos

### 1. Gerar Dados
Usuario seleciona tipo (Pessoa/Veiculo/Empresa) -> Configura opcoes (UF, formato) -> Clica Gerar -> Copia campo individual ou JSON

### 2. Mapear Campos
Abre aba Mapping -> Seleciona URL base -> Clica "Escanear" -> Revisa campos (tipo, seletor) -> Salva perfil

### 3. Preencher Formulario
Seleciona perfil salvo -> Clica "Preencher todos" OU clica botao flutuante individual -> Valores fixos ou gerados

### 4. Gerenciamento de Perfis
Salva mapeamento -> Nomeia -> Aparece no dropdown -> Seleciona -> Edita/Renomeia/Exclui

## Tecnologias-Chave

- **Manifest V3** - Chrome Extension API moderna
- **ES Modules** - `type: "module"` no package.json
- **Vitest + jsdom** - Testes unitarios/integracao (90%+ coverage)
- **chrome.storage.local** - Persistencia perfis/catalogo
- **chrome.runtime/tabs/scripting** - Comunicacao popup<->content
- **web_accessible_resources** - Dynamic import no content script
- **Side Panel API** - Painel lateral persistente
- **CSS Custom Properties** - Temas light/dark

## Qualidade

- **133 testes** passando (100%)
- **Coverage**: 94.1% statements, 83.5% branches, 96.9% functions
- **Thresholds**: 90% global, 85% modulos criticos
- **CI**: GitHub Actions (Node 22, npm ci, test:coverage)
- **Lint/Manifest validation**: Pipeline integrado

## Seguranca

- **Zero rede** - Tudo local, sem backend
- **CSP Compliant** - `script-src 'self'`, no eval/inline
- **Sanitizacao** - `escapeHtml()` em todo user content
- **Permissoes minimas** - activeTab, scripting, storage, sidePanel
- **Privacidade** - LGPD/GDPR compliant, sem telemetria

## Comandos Principais

```bash
# Desenvolvimento
npm test                 # vitest run
npm run test:coverage    # vitest run --coverage

# Validacao
npm run validate-manifest  # ajv-cli + schema Chrome

# Release
# 1. Bump version em manifest.json + package.json
# 2. Atualiza CHANGELOG.md
# 3. Zip package (exclui dev files)
# 4. Upload Chrome Web Store
```

## Estrutura de Pastas .opencode (Agent Team)

```
.opencode/
├── config.yaml              # Config principal
├── team/
│   ├── agents/              # 10 agentes YAML
│   ├── context/             # ADRs, API contracts, coding standards
│   ├── memory/              # Memoria persistente por agente
│   └── workflows/           # Feature, bugfix, refactor, release
├── skills/                  # 10 skills especializadas
└── hooks/                   # Pre-commit, pre-push, session hooks
```