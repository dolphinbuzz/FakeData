# Contributing to FakeData

Obrigado por considerar contribuir com o FakeData! Este documento orienta como contribuir efetivamente.

## Como Contribuir

### Reportando Bugs
1. Verifique se o bug já foi reportado nas [Issues](https://github.com/seu-usuario/FakeData/issues)
2. Crie uma issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Screenshots (se aplicável)
   - Versão do Chrome/Edge, SO, versão da extensão

### Sugerindo Funcionalidades
1. Abra uma issue com label `enhancement`
2. Descreva a funcionalidade e o caso de uso
3. Discuta a implementação antes de começar

### Pull Requests
1. Fork o repositório
2. Crie uma branch: `git checkout -b feature/nova-funcionalidade` ou `fix/correcao-bug`
3. Faça suas mudanças seguindo os padrões do projeto
4. Execute os testes: `npm run test:coverage`
5. Commit com mensagens convencionais
6. Push e abra o PR

## Padrões de Código

### Commits (Conventional Commits)
```
feat: adiciona novo tipo de dado "endereco-completo"
fix: corrige validação de CPF com zeros à esquerda
refactor: simplifica lógica de selectorFor
test: adiciona testes para gerarChassi
docs: atualiza README com novo atalho
chore: atualiza dependências de desenvolvimento
```

### Branch Naming
- `feature/descricao-curta` - Nova funcionalidade
- `fix/descricao-curta` - Correção de bug
- `refactor/descricao-curta` - Refatoração
- `docs/descricao-curta` - Documentação
- `chore/descricao-curta` - Manutenção

### JavaScript/ESM
- Use `import`/`export` (ESM)
- Funções puras sempre que possível
- `Object.freeze` para constantes/enums
- Callbacks para `chrome.storage` (não Promises)
- Early returns, guard clauses
- Nomes em camelCase, constantes em SCREAMING_SNAKE_CASE
- JSDoc para funções públicas exportadas

### Testes
- Testes em `tests/*.test.js`
- Cobertura mínima: 90% lines/functions/statements, 80% branches
- Mocks de Chrome APIs em `tests/setup.js`
- Funções puras = testes diretos
- Integração = mocks complexos, foco happy paths

## Estrutura do Projeto

```
FakeData/
├── src/
│   ├── popup.html           # Interface principal
│   ├── privacy.html         # Página de privacidade
│   ├── styles/
│   │   ├── popup.css        # Estilos (CSS custom properties)
│   │   └── privacy.css
│   └── scripts/
│       ├── app.js           # Orquestração UI + Messaging + Storage
│       ├── content.js       # Content script (injetado na página)
│       ├── generators.js    # Geração de dados (funções puras)
│       ├── selector-engine.js # Scan, inferência, seletores
│       ├── messages.js      # ACTIONS enum
│       └── data/
│           ├── estados.js       # ESTADOS, DDDS
│           ├── mapping-types.js # MAPPING_TYPES (29 tipos)
│           └── vehicle-catalog.js # Catálogo veículos
├── tests/
│   ├── setup.js             # Mocks globais
│   ├── generators.test.js
│   ├── selector-engine.test.js
│   ├── vehicle-catalog.test.js
│   ├── messages.test.js
│   ├── content.test.js
│   └── app.test.js
├── .github/workflows/ci.yml # CI pipeline
├── manifest.json            # Manifest V3
├── package.json
├── vitest.config.js
└── README.md
```

## Agentes de Desenvolvimento

O projeto usa uma equipe de agentes especializados via OpenCode:

- **Architect** - Arquitetura, ADRs, decisões transversais
- **UI/UX** - Interface, theming, acessibilidade
- **Data Generation** - CPF, CNPJ, VIN, emails, catálogo veículos
- **Selector Engine** - Scan, inferência, seletores CSS
- **Content Script** - Preenchimento, floating controls, Select2
- **Messaging** - Comunicação popup↔content, ACTIONS
- **Storage/Profile** - chrome.storage, perfis, migração
- **Testing** - Vitest, coverage, CI/CD
- **DevOps** - Build, release, Chrome Web Store
- **Documentation** - README, docs, changelog

## Processo de Release

1. Todas as checks CI passam
2. Coverage >= 90%
3. Version bump em `manifest.json` E `package.json` (SemVer)
4. `CHANGELOG.md` atualizado
5. Tag git: `git tag v1.0.2`
6. Package para Chrome Web Store
6. Upload no Developer Dashboard

## Dúvidas?

Abra uma issue com label `question` ou inicie uma discussão.