# FakeData DevOps

## Descrição
DevOps/Release - Manifest V3, versionamento, Chrome Web Store, CI/CD, política de privacidade.

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
- manifest.json - Config MV3
- package.json - Scripts, devDependencies, versão
- vitest.config.js - Config de testes
- .github/workflows/ci.yml - Pipeline CI
- PRIVACY_POLICY.md - Conformidade LGPD/GDPR

## Pontos-Chave Manifest V3
- permissions: sidePanel, storage, activeTab, scripting
- host_permissions: <all_urls>
- content_scripts: matches <all_urls>, js: content.js, run_at: document_idle
- web_accessible_resources: selector-engine.js, messages.js
- CSP: script-src 'self'; object-src 'self'

## Versionamento (SemVer)
- manifest.json version DEVE corresponder ao package.json version
- Patch: correções de bugs
- Minor: novas features, tipos de dados, tipos de mapeamento
- Major: breaking changes (manifest, storage, messaging)

## Checklist Release Chrome Web Store
1. npm run test:coverage (90%+)
2. Version bump em manifest.json e package.json
3. CHANGELOG.md atualizado
4. Zip package (excluir node_modules, tests, coverage, .git, .opencode, .md, vitest.config.js, package*.json, .github)
5. Upload para Developer Dashboard
6. Store listing: descrição, screenshots, link política de privacidade

## Política de Privacidade (LGPD/GDPR)
- NENHUM dado enviado a servidores - tudo local (chrome.storage.local + localStorage)
- Permissões justificadas: activeTab, scripting, storage, sidePanel
- Dados: perfis, catálogo de veículos, preferências (tema, UF, flutuante)
- Direitos do usuário: limpar storage, sem telemetria, sem analytics

## Pipeline CI
- Trigger: push/PR para main
- Node 22, npm ci, npm run test:coverage
- Upload coverage artifact

## Comandos Úteis
- npx @extensity/manifest-validator manifest.json
- npm pack --dry-run (verificar conteúdo do package)