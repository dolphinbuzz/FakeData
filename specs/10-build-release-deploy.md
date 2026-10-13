# Spec: Build, Release e Deploy

## Visao Geral
Processo de build, versionamento, publicacao na Chrome Web Store e pipeline CI/CD.

## Build e Empacotamento

### Chrome Extension (Manifest V3)
- Sem build step (modulos ESM carregados diretamente pelo navegador)
- Arquivos de origem = arquivos de producao
- Zip para Chrome Web Store exclui: node_modules, tests, coverage, .git, .opencode, *.md, vitest.config.js, package*.json, .github

### Validacao do Manifest
```bash
npx @extensity/manifest-validator manifest.json
# ou usar schema JSON via ajv-cli
```

### Chrome Web Store Checklist
1. `npm run test:coverage` - passa com 90%+
2. `manifest.json` version incrementado
3. `package.json` version sincronizado
4. `CHANGELOG.md` atualizado
5. Zip package:
```bash
zip -r fakedata-v{X.Y.Z}.zip . \
  -x "node_modules/*" "tests/*" "coverage/*" \
      ".git/*" ".opencode/*" "*.md" \
      "vitest.config.js" "package*.json" ".github/*"
```
6. Upload no Developer Dashboard
7. Store listing: descricao, screenshots, privacy policy link
8. Submit for review

## Versionamento (SemVer)

### Regra de Ouro
`manifest.json` version **DEVE** coincidir com `package.json` version

### Tipos de Release
| Tipo | Quando | Exemplo |
|------|--------|---------|
| Patch | Bug fixes, small improvements | 1.0.1 -> 1.0.2 |
| Minor | New features, new data types, new mapping types | 1.0.1 -> 1.1.0 |
| Major | Breaking changes (manifest, storage schema, messaging) | 1.0.1 -> 2.0.0 |

### Arquivos de Versao
- `manifest.json`: `"version": "1.0.1"`
- `package.json`: `"version": "1.0.1"`

## CI/CD Pipeline (.github/workflows/ci.yml)

### Jobs
```yaml
test:
  - Node 22, npm ci, npm run test:coverage
  - Upload coverage artifact

lint:
  - npm run lint --if-present

manifest-validation:
  - npm install -g @extensity/manifest-validator (ou ajv-cli)
  - manifest-validator manifest.json

version-consistency:
  - Compara manifest.json version vs package.json version
  - Falha se mismatch
```

### Triggers
- Push/PR to main branch

## Privacy Policy (LGPD/GDPR)

### Principios
- **Nenhum dado enviado para servidores** - tudo local
- **Permissoes justificadas**: activeTab (acesso aba), scripting (injecao), storage (perfis), sidePanel (UI)
- **Dados coletados**: Perfis mapeamento, catalogo veiculos, preferencias (tema, UF, floating)
- **Direitos do usuario**: Exclusao via clear storage, sem telemetria, sem analytics

### Arquivos
- `PRIVACY_POLICY.md` - Politica completa
- Link no footer da extensao e store listing

## Release Checklist (Pre-Release)

- [ ] Todos os testes passam (`npm run test:coverage`)
- [ ] Coverage >= 90% (global) / 85% (app.js, content.js)
- [ ] Version bump em `manifest.json` E `package.json`
- [ ] `CHANGELOG.md` atualizado (Keep a Changelog format)
- [ ] Package zip validado
- [ ] Upload no Chrome Web Store Developer Dashboard
- [ ] Store listing: descricao, screenshots (popup, side panel, mapping), privacy policy link
- [ ] Submit for review

## Versionamento do Manifest (Historico)

| Versao | Data | Mudancas |
|--------|------|----------|
| 1.0.0 | 2026-01-10 | Release inicial |
| 1.0.1 | 2026-01-15 | Side panel, dedicated tab, vehicle catalog, floating buttons, shortcuts, playground, profiles, theme, base URL grouping, legacy migration |

## Comandos Uteis

### Validar Manifest
```bash
npx @extensity/manifest-validator manifest.json
# ou
npm run validate-manifest  # usa ajv-cli com schema local
```

### Gerar Zip para Store
```bash
npm pack --dry-run 2>&1 | grep -v "node_modules\|tests\|coverage\|\.git\|\.opencode\|\.md$"
```

### Verificar Versoes
```bash
# Manifest
grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/'

# Package
grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/'
```

## Chrome Web Store - Store Listing

### Necessario
- Nome: FakeData
- Descricao curta: Gere dados falsos para testes de QA de forma rapida
- Descricao detalhada: README.md adaptado
- Capturas de tela: Popup, Side Panel, Mapping Automático, Playground, Gerar Dados
- Categoria: Developer Tools / Productivity
- Privacy Policy URL: link para PRIVACY_POLICY.md no GitHub

### Screenshots Recomendadas
1. Popup compacto (modo mapping)
2. Side panel aberto
3. Aba Gerar Dados (Pessoa/Veiculo/Empresa)
4. Mapeamento automatico com campos
5. Playground seletor CSS
6. Modal catálogo veiculos
7. Perfis salvos

## Arquivos Relacionados
- `manifest.json` - Configuracao principal
- `package.json` - Scripts, devDependencies, version
- `vitest.config.js` - Test config
- `.github/workflows/ci.yml` - Pipeline CI
- `PRIVACY_POLICY.md` - Politica privacidade
- `CHANGELOG.md` - Historico versoes
- `README.md` - Documentacao instalacao/uso