# FakeData - Equipe de Desenvolvimento Agentico

Este documento descreve a estrutura da equipe de agentes especializados para o desenvolvimento contínuo da extensão FakeData.

## Visão Geral da Arquitetura

```
FakeData/
├── .opencode/
│   ├── team/                    # Configuração da equipe de agentes
│   │   ├── agents/              # Definições dos agentes especializados
│   │   ├── workflows/           # Workflows de desenvolvimento
│   │   ├── context/             # Contexto compartilhado entre agentes
│   │   └── memory/              # Memória persistente entre sessões
│   ├── skills/                  # Skills personalizadas do projeto
│   └── config/                  # Configurações do OpenCode
├── src/                         # Código fonte (já existente)
├── tests/                       # Testes (já existente)
└── docs/                        # Documentação técnica
```

## Agentes Especializados

### 1. **Architect Agent** (`architect/`)
- **Responsabilidade**: Arquitetura geral, decisões técnicas, padrões de código
- **Foco**: Manifest V3, communication patterns, storage strategy, performance

### 2. **UI/UX Agent** (`ui-ux/`)
- **Responsabilidade**: Interface do popup, side panel, página dedicada
- **Foco**: popup.html, popup.css, app.js (UI logic), accessibility, theming

### 3. **Data Generation Agent** (`data-generation/`)
- **Responsabilidade**: Geradores de dados falsos (Pessoa, Veículo, Empresa)
- **Foco**: generators.js, vehicle-catalog.js, estados.js, mapping-types.js

### 4. **Selector Engine Agent** (`selector-engine/`)
- **Responsabilidade**: Mapeamento de elementos, seletores CSS, inferência de tipos
- **Foco**: selector-engine.js, content.js (scanning logic)

### 5. **Content Script Agent** (`content-script/`)
- **Responsabilidade**: Injeção em páginas, preenchimento, floating controls
- **Foco**: content.js (fill, mark, highlight, page controls)

### 6. **Messaging/Communication Agent** (`messaging/`)
- **Responsabilidade**: Comunicação popup↔content, runtime messaging
- **Foco**: messages.js, app.js (messaging), content.js (message handling)

### 7. **Storage/Profile Agent** (`storage-profile/`)
- **Responsabilidade**: chrome.storage, perfis, migração, sincronização
- **Foco**: app.js (profile logic), migration, localStorage sync

### 8. **Testing/QA Agent** (`testing/`)
- **Responsabilidade**: Testes unitários, integração, coverage 90%+
- **Foco**: tests/*.test.js, vitest.config.js, CI/CD

### 9. **DevOps/Release Agent** (`devops/`)
- **Responsabilidade**: Build, release, manifest versioning, Chrome Web Store
- **Foco**: package.json, manifest.json, .github/workflows, PRIVACY_POLICY

### 10. **Documentation Agent** (`documentation/`)
- **Responsabilidade**: README, docs técnicas, changelog, guias
- **Foco**: README.md, docs/, PRIVACY_POLICY.md

## Workflows Principais

### Feature Development Workflow
```
1. Architect → Define especificação técnica
2. Relevant Specialist Agent → Implementa feature
3. Testing Agent → Cria/atualiza testes
4. Documentation Agent → Atualiza docs
5. DevOps Agent → Prepara release se necessário
```

### Bug Fix Workflow
```
1. Testing Agent → Reproduz e isola bug (test case)
2. Relevant Specialist Agent → Corrige
3. Testing Agent → Valida correção + regression tests
4. Documentation Agent → Atualiza se necessário
```

### Refactoring Workflow
```
1. Architect → Define escopo e estratégia
2. Specialist Agents → Refatoram seus domínios
3. Testing Agent → Garante coverage mantido
4. Architect → Code review final
```

## Contexto Compartilhado

Cada agente tem acesso a:
- `context/project-overview.md` - Visão geral do projeto
- `context/architecture-decisions.md` - ADRs (Architecture Decision Records)
- `context/api-contracts.md` - Contratos de messaging/storage
- `context/coding-standards.md` - Padrões de código do projeto
- `context/testing-strategy.md` - Estratégia de testes

## Memória Persistente

Cada agente mantém:
- `memory/agent-name/last-session.md` - Resumo da última sessão
- `memory/agent-name/decisions.md` - Decisões técnicas tomadas
- `memory/agent-name/todo.md` - Backlog do agente
- `memory/agent-name/blockers.md` - Bloqueadores atuais