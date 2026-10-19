# Plano de Implementação: ESLint no FakeData

## Contexto do Projeto
- **Tipo**: Extensão Chrome (Manifest V3)
- **Linguagem**: JavaScript (ES2022+ modules)
- **Estrutura**: `src/scripts/` + `tests/`
- **Testes**: Vitest
- **Build**: Nenhum (arquivos servidos diretamente)

## Increments

### Increment 1: Configuração Base do ESLint ✅
- [x] Instalar dependências: `eslint`, `globals`, `@eslint/js`
- [x] Criar `eslint.config.js` (flat config) com:
  - Environment: browser, es2022, webextensions
  - Parser options: ecmaVersion: latest, sourceType: module
  - Regras recomendadas do ESLint (eslint:recommended)
  - Configuração para arquivos de teste (Vitest globals)
  - Ignore patterns: node_modules, coverage, dist, config files
- [x] Adicionar script `lint` no package.json
- [x] Validar: `npm run lint` passa sem erros

### Increment 2: Regras de Estilo e Qualidade ✅
- [x] Adicionar regras de estilo consistentes com o código existente:
  - aspas simples (`quotes: ["error", "single"]`)
  - ponto e vírgula (`semi: ["error", "always"]`)
  - indentação 2 espaços
  - trailing commas em objetos/arrays multiline
  - no-unused-vars com argsIgnorePattern para callbacks
- [x] Regras para ES modules (import rules desabilitadas por incompatibilidade com eslint 10)
- [x] Validar: `npm run lint` passa no código existente (após fix automático + ajustes manuais)

### Increment 3: Integração com Git Hooks ✅
- [x] Verificar hook `pre-commit` existente (`opencode/hooks/pre-commit/01-lint.sh`) - já configurado
- [x] Testar: hook roda `npm run lint` e falha se houver erros
- [x] Validado: `bash opencode/hooks/pre-commit/01-lint.sh` passa

### Increment 4: Documentação e CI ✅
- [x] Atualizar README com instruções de lint (`npm run lint` e `npm run lint:fix`)
- [x] CI já tinha `npm run lint --if-present` no workflow (verificado em `.github/workflows/ci.yml`)

## Dependências Técnicas
- Node.js >= 18 (já disponível - projeto usa Node 22)
- npm (já disponível)

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Configuração flat config incompatível com Node versão | Baixa | Médio | Usar Node 18+ (requerido pelo flat config) |
| Regras conflitam com estilo atual | Média | Baixo | Ajustar regras após primeira execução |
| Hooks pre-commit não executam | Baixa | Médio | Testar manualmente após implementação |
| eslint-plugin-import incompatível com ESLint 10 | Alta | Baixo | Desabilitar regras import, usar apenas regras core |

## Definition of Done por Increment

### Increment 1 ✅
- `npm run lint` executa sem erros
- Configuração usa flat config (eslint.config.js)
- Suporta ES modules e browser/webextensions

### Increment 2 ✅
- Código existente passa no lint sem `--fix` (após correções manuais mínimas)
- Regras de estilo consistentes (single quotes, semi, indent 2, etc.)

### Increment 3 ✅
- `git commit` roda lint automaticamente via hook pre-commit
- Commit falha se houver erros de lint

### Increment 4 ✅
- README documenta `npm run lint` e `npm run lint:fix`
- CI roda lint via `--if-present`

## Cronograma Estimado
- Increment 1: 15 min
- Increment 2: 20 min
- Increment 3: 10 min
- Increment 4: 5 min
- **Total**: ~50 min + buffer 30% = ~1 hora

## Resumo das Mudanças

### Arquivos Criados
- `eslint.config.js` - Configuração flat do ESLint

### Arquivos Modificados
- `package.json` - Adicionados scripts `lint` e `lint:fix`
- `README.md` - Documentação dos comandos de lint
- `src/scripts/app.js` - Removido import não usado `renameVehicleModel`, removida função não usada `setLoading`, prefixados caught errors não usados
- `src/scripts/content.js` - Prefixados caught errors não usados
- `src/scripts/selector-engine.js` - Prefixados caught errors não usados
- `tests/selector-engine.test.js` - Prefixados variáveis não usadas
- `tests/setup.js` - Prefixados parâmetros não usados

### Dependências Adicionadas
- `eslint@10.13.0` (dev)
- `globals@15.x` (dev)
- `@eslint/js@9.x` (dev)