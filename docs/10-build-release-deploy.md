# Spec: Build, Release e Deploy

## Visão Geral
Processo de build, versionamento, publicação na Chrome Web Store e pipeline CI/CD.

## Build e Empacotamento

### Chrome Extension (Manifest V3)
- **Sem build step** (módulos ESM carregados diretamente pelo navegador)
- Arquivos de origem = arquivos de produção
- Zip para Chrome Web Store exclui:
  `node_modules`, `tests`, `coverage`, `.git`, `.opencode`, `*.md`,
  `vitest.config.js`, `package*.json`, `.github`

### Validação do Manifest
```bash
npm run validate-manifest  # ajv-cli + chrome-manifest-schema.json
```

### Chrome Web Store Checklist
1. `npm run test:coverage` - passa com thresholds
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
7. Store listing: descrição, screenshots, privacy policy link
8. Submit for review

## Versionamento (SemVer)

### Regra de Ouro
`manifest.json` version **DEVE** coincidir com `package.json` version

### Versão Atual
- **1.0.1** (em ambos manifest.json e package.json)

### Tipos de Release
| Tipo | Quando | Exemplo |
|------|--------|---------|
| Patch | Bug fixes, small improvements | 1.0.1 -> 1.0.2 |
| Minor | New features, new data types, new mapping types | 1.0.1 -> 1.1.0 |
| Major | Breaking changes (manifest, storage schema, messaging) | 1.0.1 -> 2.0.0 |

### Arquivos de Versão
- `manifest.json`: `"version": "1.0.1"`
- `package.json`: `"version": "1.0.1"`

## CI/CD Pipeline (.github/workflows/ci.yml) — 4 Jobs

| Job | Steps |
|-----|-------|
| **test** | Node 22, npm ci, npm run test:coverage, upload coverage artifact |
| **lint** | npm run lint --if-present |
| **manifest-validation** | npm run validate-manifest (ajv-cli + schema local) |
| **version-consistency** | Compara manifest.json version vs package.json version (falha se mismatch) |

### Triggers
- Push/PR to main branch

## Privacy Policy (LGPD/GDPR)

### Princípios
- **Nenhum dado enviado para servidores** - tudo local
- **Permissões justificadas**: activeTab (acesso aba), scripting (injeção), storage (perfis), sidePanel (UI)
- **Dados coletados**: Perfis mapeamento, catálogo veículos, preferências (tema, UF, floating)
- **Direitos do usuário**: Exclusão via clear storage, sem telemetria, sem analytics

### Arquivos
- `PRIVACY_POLICY.md` - Política completa
- Link no footer da extensão e store listing

## Release Checklist (Pre-Release)

- [ ] Todos os testes passam (`npm run test:coverage`)
- [ ] Coverage: global >= 90% (lines/functions/statements) e >= 80% (branches); thresholds por arquivo >= 90% (vitest.config.js)
- [ ] Version bump em `manifest.json` E `package.json` (SemVer)
- [ ] `CHANGELOG.md` atualizado (Keep a Changelog format)
- [ ] Package zip validado
- [ ] Upload no Chrome Web Store Developer Dashboard
- [ ] Store listing: descrição, screenshots (popup, side panel, mapping), privacy policy link
- [ ] Submit for review

## Versionamento do Manifest (Histórico)

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.0.0 | 2026-01-10 | Release inicial |
| 1.0.1 | 2026-01-15 | Side panel, dedicated tab, vehicle catalog, floating buttons, shortcuts, playground, profiles, theme, base URL grouping, legacy migration |

## Comandos Úteis

### Validar Manifest
```bash
npm run validate-manifest  # usa ajv-cli com schema local
```

### Gerar Zip para Store
Não há script npm de empacotamento. Use o comando `zip -r` do checklist acima (POSIX) ou, no Windows, `Compress-Archive`/7-Zip com a mesma lista de exclusões.

### Verificar Versões
```bash
# Manifest
grep '"version"' manifest.json | sed 's/.*"version": "\(.*\)".*/\1/'

# Package
grep '"version"' package.json | sed 's/.*"version": "\(.*\)".*/\1/'
```

## Chrome Web Store - Store Listing

### Necessário
- Nome: FakeData
- Descrição curta: Gere dados falsos para testes de QA de forma rápida
- Descrição detalhada: README.md adaptado
- Capturas de tela: Popup, Side Panel, Mapping Automático, Playground, Gerar Dados
- Categoria: Developer Tools / Productivity
- Privacy Policy URL: link para PRIVACY_POLICY.md no GitHub

### Screenshots Recomendadas
1. Popup compacto (modo mapping)
2. Side panel aberto
3. Aba Gerar Dados (Pessoa/Veículo/Empresa)
4. Mapeamento automático com campos
5. Playground seletor CSS
6. Modal catálogo veículos
7. Perfis salvos

## Hooks Git / Permissions V2 (A1) — Configuração Atual

### opencode.jsonc — Permissions V2
```jsonc
"permissions": [
  { "action": "shell", "resource": "git push *", "effect": "ask" },
  { "action": "shell", "resource": "*git push*", "effect": "ask" },
  { "action": "shell", "resource": "*git -C * push*", "effect": "ask" },
  { "action": "shell", "resource": "*git -c * push*", "effect": "ask" },
  { "action": "shell", "resource": "*git.exe*push*", "effect": "ask" },
  { "action": "shell", "resource": "*git.cmd*push*", "effect": "ask" }
]
```
- Seção legada `hooks` removida (não suportada no V2)
- Campo `git.hooksEnabled` removido
- Política base = allow; últimas regras que casam vencem

### .opencode/hooks/git/* — Shims Reais (Opt-in)
Instalação manual (nada automático):
```bash
git config core.hooksPath .opencode/hooks/git
```
Arquivos (POSIX, LF forçado via `.gitattributes`):
- `pre-commit`: executa `.opencode/hooks/pre-commit/*.sh` (lint, test-changed)
- `pre-push`: executa `.opencode/hooks/pre-push/*.sh` (confirm-push, full-test, version-check)
- `post-merge`: executa `.opencode/hooks/post-merge/*.sh` (install-deps, clear-cache)

### .opencode/hooks/pre-push/00-confirm-push.sh
- Consome stdin (refs do Git) para evitar SIGPIPE
- `CONFIRM_PUSH=true` → aprovação não-interativa
- Terminal interativo: lê `/dev/tty` com timeout 60s
- Bloqueia push se sem confirmação (exit 1)

### .gitattributes
```
.opencode/hooks/*/*.sh text eol=lf
.opencode/hooks/git/* text eol=lf
```
Garante LF no checkout no Windows (evita quebra de shebang/comandos com `core.autocrlf=true`)

## Limitações Conhecidas (A1)
- **`--no-verify`**: `git push --no-verify` bypassa hooks locais (Git behavior, não configurável)
- **`opencode --auto`**: o modo automático pode dispensar o prompt de `ask`; o hook git (se instalado) continua valendo
- **"Allow always"**: aprovação persistente oferecida pela UI, quando aceita, dispensa novas confirmações de `ask`; por isso o hook git é a segunda camada
- **Aliases git**: `git p` (alias para push) não reconhecido por pattern textual

## Arquivos Relacionados
- `manifest.json` - Configuração principal (version 1.0.1)
- `package.json` - Scripts, devDependencies, version 1.0.1
- `vitest.config.js` - Test config + coverage thresholds
- `.github/workflows/ci.yml` - Pipeline CI (4 jobs)
- `PRIVACY_POLICY.md` - Política privacidade
- `CHANGELOG.md` - Histórico versões (precisa entradas A1/A2)
- `README.md` - Documentação instalação/uso
- `opencode.jsonc` - Config OpenCode V2
- `.opencode/hooks/git/*` - Shims git
- `.gitattributes` - LF forçado