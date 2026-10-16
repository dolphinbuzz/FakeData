# FakeData Documentation

## Descrição
Documentação - README, docs, changelog, contributing, ADRs, contratos de API.

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
- README.md - Docs principal (install, usage, shortcuts, troubleshooting, estrutura)
- PRIVACY_POLICY.md - Política de privacidade
- CHANGELOG.md - Formato Keep a Changelog
- CONTRIBUTING.md - Guia de contribuição
- docs/ - Documentação técnica

## Estrutura docs/
```
docs/
├── architecture/
│   ├── overview.md, messaging.md, storage.md, selector-engine.md
├── development/
│   ├── setup.md, coding-standards.md, testing-guide.md, debugging.md
├── user-guide/
│   ├── generating-data.md, mapping-fields.md, filling-forms.md, keyboard-shortcuts.md
└── release/
    ├── versioning.md, chrome-store.md, privacy-compliance.md
```

## Contexto Compartilhado (legível por agentes)
.opencode/team/context/
- architecture-decisions.md - ADRs
- api-contracts.md - Mensageria, schemas de storage, contratos de generator
- coding-standards.md - Estilo de código, patterns
- testing-strategy.md - Planos de teste, mocking, coverage

## Estrutura README.md (manter atualizado)
1. Badges, descrição, screenshot
2. Pré-requisitos
3. Instalação (load unpacked)
4. Modos: Popup, Side Panel, Dedicated Tab
5. Gerar Dados (Pessoa, Veículo, Empresa, Catálogo)
6. Mapear & Preencher (Scan, Playground, Perfis, Valores Fixos)
7. Tabela de Atalhos de Teclado
8. Storage & Privacidade
9. Testes & Coverage
10. Troubleshooting
11. Estrutura do Projeto (tree)
12. Licença

## Formato CHANGELOG.md (Keep a Changelog)
## [1.0.1] - YYYY-MM-DD
### Added
### Changed
### Fixed
### Removed

## Template ADR
## ADR {número}: {Título}
**Status**: Accepted|Proposed|Deprecated|Superseded
**Date**: YYYY-MM-DD
**Context**: Problema?
**Decision**: O que decidido?
**Consequences**: Trade-offs
**Alternatives Considered**: Outras opções

## Coordenação
- Todos os agentes: Atualizar docs ao mudar APIs, schemas, comportamentos
- Architect: ADRs para decisões arquiteturais
- DevOps: CHANGELOG no release, badges do README
- Testing: testing-guide.md com patterns de mock
- UI/UX: Screenshots no README/user-guide