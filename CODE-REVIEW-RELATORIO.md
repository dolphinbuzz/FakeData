# Relatório de Revisão de Código - FakeData Extensão

**Branch revisada:** `feat/visual-improvements`  
**Metodologias aplicadas:** Code Review (checklist sistemático por severidade) + Secure Code Review (OWASP Top 10 + CWE)  
**Data:** 16/10/2026

---

## Resumo Executivo

| Categoria | Quantidade |
|-----------|------------|
| 🔴 Blocking | 0 |
| 🟡 Major | 4 |
| 🟢 Minor / Suggestion | 9 |
| 🔒 Segurança (Critical/High) | 0 |
| 🔒 Segurança (Medium/Low/Info) | 3 |

**Decisão:** **Comment** (apenas minors/suggestions e observações de segurança de baixo risco). Não há blocking findings. Os majors são recomendações fortes, não impedem o merge mas devem ser endereçados em seguida.

---

## 🔴 Blocking (0)

Nenhum achado de bloqueio encontrado.

---

## 🟡 Major (Recomendação forte de correção)

### Arquivo: src/scripts/content.js:395-404 — [Major] — Problema: Preenchimento em lote não trata erro individual de forma granular

```javascript
if (message.action === actions.FILL_ALL) {
  const fields = message.fields || [];
  fields.reduce((chain, item) => chain.then(async (results) => {
    results.push(await fill(item.selector, item.value));
    return results;
  }), Promise.resolve([])).then((results) => {
    closeCustomMenus();
    sendResponse({ filled: results.filter(Boolean).length, total: results.length });
  });
}
```

Sugestão: Adicionar `try/catch` dentro do `reduce` para que um falha em um campo não interrompa o preenchimento dos campos subsequentes, e retornar detalhes de quais campos falharam e por quê.

Razão: Atualmente, se `fill()` lançar uma exceção (não retorna apenas `false`), toda a promise chain quebrará e nenhum campo subsequente será preenchido. O usuário fica sem feedback parcial.

---

### Arquivo: src/scripts/app.js:294-431 — [Major] — Problema: Handler de `PAGE_FIELD_FILL_REQUEST` depende de `data.person.context()` fixo para todos os tipos de campo

```javascript
const value = field.fixed
  ? field.fixedValue
  : generateMappedValuePure(type, data.person.context(), field.inputType, generatorOptions);
```

Sugestão: Permitir que o contexto de geração seja informado pelo tipo de campo (ex: tipo `brand`/`model` deve usar contexto de veículo, tipo `cnpj`/`company` deve usar contexto de empresa). Ou ao menos expor opção de selecionar o "perfil de dados" (Pessoa/Veículo/Empresa) no mapeamento de campos.

Razão: Ao mapear um campo de CNPJ em um formulário de empresa, o sistema ainda gera dados de pessoa (nome, CPF, RG) como fallback, oque é incoerente para cenários de cadastro empresarial.

---

### Arquivo: src/scripts/selector-engine.js:149-157 — [Major] — Problema: Elementos com atributos Angular são forçados a fallback, mesmo quando possuem `data-cy`/`data-testid` estável

```javascript
if (hasAngularAttributes(element)) {
  return {
    selector: fallbackSelector(element),
    rule: "fallback: atributos Angular detectados",
    priority: 4,
    status: "fragile",
    suggestion: "..."
  };
}
```

Sugestão: Verificar atributos de teste explícitos (`data-cy`, `data-test`, `data-testid`) ANTES da detecção de Angular. Se houver um atributo de teste estável e único, usá-lo mesmo em elementos Angular.

Razão: Aplicações Angular modernas frequentemente adicionam `data-cy` intencionalmente para testes. Bloquear o uso desses atributos por causa de `ng-reflect-*` prejudica a usabilidade em SPAs Angular.

---

### Arquivo: src/scripts/content.js:4-7 — [Major] — Problema: Carregamento dinâmico de módulos sem fallback se a extensão for recarregada enquanto a página está aberta

```javascript
const modulesReady = Promise.all([
  import(chrome.runtime.getURL("src/scripts/selector-engine.js")),
  import(chrome.runtime.getURL("src/scripts/messages.js"))
]);
```

Sugestão: Adicionar `try/catch` ao redor dos `import()` dinâmicos e, em caso de falha, tentar recarregar o content script via `chrome.runtime.reload()` ou notificar o popup de que a página precisa ser recarregada.

Razão: Se a extensão for atualizada/recarregada no `chrome://extensions`, o contexto de extensão dos tabs já abertos é invalidado. Os `import()` dinâmicos podem falhar silenciosamente, deixando o content script inutilizável até que o usuário recarregue a página manualmente.

---

## 🟢 Minor / Suggestion (Opcional, educativo)

### Arquivo: src/scripts/generators.js:296-303 — [Minor] — Nomeação: campo `year` do veículo retorna string no formato `AAAA/AAAA` mas o label é apenas "Ano"

```javascript
["Ano", () => gerarAno()],
```

Sugestão: Renomear label para "Ano (Fabricação/Modelo)" ou adicionar tooltip explicativo no popup.

Razão: Clareza para o usuário sobre o que o formato `2024/2025` representa.

---

### Arquivo: src/scripts/generators.js:119-121 — [Minor] — `gerarTelefoneCelular` não gera telefone fixo separado

Sugestão: Adicionar função `gerarTelefoneFixo` já existente (linha 123) como opção separada no gerador de pessoa, permitindo escolher entre celular e fixo.

Razão: Formulários reais frequentemente solicitam telefone fixo e celular separadamente.

---

### Arquivo: src/popup.html:184-196 — [Suggestion] — Duplicação de HTML: painel do Playground aparece duas vezes

O bloco do Playground (`id="playground-mapping-panel"`) está duplicado no HTML (linhas 88-99 e 184-195).

Sugestão: Remover o bloco duplicado.

Razão: Manutenibilidade; HTML duplicado pode causar confusão e bugs se um dia um dos blocos for editado sem o outro.

---

### Arquivo: src/scripts/app.js:108-125 — [Suggestion] — `data` e `generatorOptions` são objetos quase idênticos com pequena diferença em `getRenavamFormatted`

```javascript
const data = createGeneratorData({ ... getRenavamFormatted: () => document.querySelector("#renavam-formatted").checked ... });
const generatorOptions = { ... getRenavamFormatted: () => false ... };
```

Sugestão: Unificar em um único objeto de configuração, derivando variações por necessidade, em vez de manter dois objetos paralelos.

Razão: Reduz duplicação e risco de divergência futura entre as configurações.

---

### Arquivo: src/scripts/content.js:15-41 — [Suggestion] — CSS injetado diretamente no `<head>` da página host

O `<style>` com id `fakedata-page-control-style` é anexado a `document.documentElement`.

Sugestão: Usar Shadow DOM para encapsular os estilos dos controles flutuantes, evitando vazamento de estilos para a página host e conflitos de seletores CSS.

Razão: Isolamento completo de estilos da extensão em relação ao CSS da página alvo.

---

### Arquivo: src/scripts/selector-engine.js:349-359 — [Suggestion] — `pageSignature()` chama `selectorFor()` para cada elemento visível, o que pode ser custoso em páginas com muitos campos

Sugestão: Adicionar memoização/cache da assinatura por URL, comparando apenas se o número de elementos mudou antes de recalcular a assinatura completa.

Razão: Performance em páginas dinâmicas com muitos formulários; evitar recálculo desnecessário a cada MutationObserver.

---

### Arquivo: src/popup.html:207-219 — [Suggestion] — Modal de mapeamento não fecha ao clicar fora (backdrop) apenas via `data-modal-close`

O backdrop tem `data-modal-close`, mas não há listener explícito para clique fora do dialog além do atributo no HTML.

Sugestão: Verificar se o clique no backdrop realmente fecha o modal em todos os cenários (teclado, mouse, touch).

Razão: UX consistente para fechamento de modais.

---

### Arquivo: vitest.config.js:13-17 — [Suggestion] — `privacy.js` excluído da cobertura

```javascript
exclude: [
  "src/scripts/privacy.js",
  ...
]
```

Sugestão: Adicionar teste para `privacy.js` (toggle de tema) ou justificar a exclusão no comentário.

Razão: Cobertura de código completa; `privacy.js` tem lógica simples mas não testada.

---

### Arquivo: src/scripts/app.js:679-681 — [Suggestion] — `profileId()` usa `Date.now()` + `Math.random()` sem garantia de unicidade forte

```javascript
return `${activePageUrl}::${Date.now()}::${Math.random().toString(36).slice(2)}`;
```

Sugestão: Usar `crypto.randomUUID()` (disponível em extensões Chrome MV3) para IDs de perfil.

Razão: Colisão teórica de IDs em execuções rápidas; `crypto.randomUUID()` é mais adequado para identificadores únicos.

---

### Arquivo: src/scripts/content.js:339-355 — [Suggestion] — Botão flutuante não mostra estado de "preenchendo" visual além de `disabled`

Sugestão: Adicionar indicador visual de carregamento (spinner ou texto "Preenchendo...") no botão flutuante durante a requisição ao popup.

Razão: Feedback visual ao usuário durante operação assíncrona.

---

## 🔒 Secure Code Review (OWASP Top 10 + CWE)

### CSP e Execução de Código — [Info] — Conforme

**Arquivo:** `manifest.json:44-46`

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

A CSP está restrita: sem `unsafe-eval`, sem `unsafe-inline`, sem carregamento de scripts externos. O uso de `import()` dinâmico com `chrome.runtime.getURL()` é compatível com `'self'`.

**CWE:** Nenhuma aplicável (controle adequado).  
**Recomendação:** Manter essa política restrita em futuras versões.

---

### Permissões e Host Access — [Info] — Conforme

**Arquivo:** `manifest.json:13-21`

```json
"permissions": ["sidePanel", "storage", "activeTab", "scripting"],
"host_permissions": ["<all_urls>"]
```

Permissões mínimas para o funcionamento da extensão. `<all_urls>` é necessário para injetar content script em qualquer página HTTP(S) que o usuário esteja visitando, mas não concede acesso a páginas internas do navegador (`chrome://`, `edge://`).

**CWE:** Nenhuma.  
**Recomendação:** Manter permissões mínimas; não adicionar `tabs` ou `webNavigation` a menos que haja justificativa clara.

---

### Sanitização de Conteúdo do Usuário — [Info] — Conforme

**Arquivo:** `src/scripts/app.js:502-509`

A função `escapeHtml()` é aplicada a todo conteúdo do usuário antes de injetar no DOM (labels, seletores, nomes de mapeamento).

**CWE-79 (XSS):** Mitigado. Não há evidência de injeção de HTML não sanitizado.

**Recomendação:** Continuar usando `escapeHtml()` em todos os pontos onde dados do storage ou do usuário são renderizados no DOM.

---

### Armazenamento Local — [Info] — Conforme

**Arquivo:** `src/scripts/app.js` — uso de `chrome.storage.local` para perfis, catálogo de veículos e preferências.

Nenhum dado é enviado para servidores externos. Zero rede. Conforme a política de privacidade declarada.

**CWE:** Nenhuma.

**Recomendação:** Manter abordagem local-only. Se no futuro houver sincronização em nuvem, aplicar criptografia e autenticação adequadas.

---

### Content Script Injection — [Low] — Defense in Depth

**Arquivo:** `src/scripts/app.js:562-586`

A função `sendMessageToTab` tenta injetar o content script via `chrome.scripting.executeScript` se `chrome.tabs.sendMessage` falhar.

**CWE-668 (Exposure of Resource to Wrong Sphere):** O content script é injetado apenas na tab ativa selecionada pelo usuário, via `activeTab`. Não há injeção em massa em todas as tabs.

**Recomendação:** Manter injeção seletiva (não injetar em todas as tabs automaticamente).

---

### Angular Attribute Detection — [Low] — Hardening

**Arquivo:** `src/scripts/selector-engine.js:108-127`

Detecção de atributos Angular instáveis (`ng-reflect-*`, `_ngcontent-*`, IDs do Angular Material) evita geração de seletores quebrados.

**Recomendação:** Manter e, se possível, expandir a detecção para outros frameworks (Vue, React, Svelte) que geram atributos dinâmicos.

---

### Keyboard Event Capture — [Info] — Conforme

**Arquivo:** `src/scripts/content.js:139`

```javascript
document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
```

Usado para fechar menus customizados. Não há risco de injeção de teclado malicioso pois é evento sintético disparado no próprio DOM da página.

---

## Critérios de Cobertura de Testes

O `vitest.config.js` exige:
- Linhas globais ≥ 90%
- `src/scripts/generators.js`: ≥ 95% (linhas, funções, statements)
- `src/scripts/content.js`: ≥ 85%
- `src/scripts/selector-engine.js`: ≥ 90%

Os testes existentes cobrem:
- ✅ `generators.test.js` — CPF, CNPJ, RENAVAM, VIN, e-mail, placa, ano, context, generateMappedValue
- ✅ `selector-engine.test.js` — inferência de tipos, geração de seletores, detecção Angular, captura de clique, MutationObserver
- ✅ `app.test.js` — UI, perfis, storage, atalhos, catálogo de veículos, playground, navegação SPA
- ✅ `content.test.js` — preenchimento, selects, custom selects, Select2, datas/números, marking, floating controls
- ✅ `vehicle-catalog.test.js` — CRUD do catálogo
- ✅ `messages.test.js` — contrato de ações imutáveis

**Cobertura aparente:** Alta, conforme exigido pelo CI. Não há testes para `privacy.js` (excluído da cobertura).

---

## Decisão Final

**Comment** — Não há blocking findings. Os 4 achados Major são recomendações fortes que melhoram robustez e usabilidade, mas não impedem o merge. Os 3 achados de segurança são de nível Info/Low (defense in depth, hardening).

O código está bem estruturado, funções puras para testabilidade, callbacks para Chrome APIs (conforme ADR), CSP restrita, zero rede, sanitização de saída, e boa cobertura de testes.

---

## Follow-up Sugerido

1. Endereçar os 4 Majors em um PR separado (ou este, se o escopo permitir).
2. Adicionar teste para `privacy.js` ou remover exclusão da cobertura.
3. Considerar `crypto.randomUUID()` para IDs de perfil.
4. Remover HTML duplicado do Playground em `popup.html`.

---

## Push para Branch Remota

Como não há alterações de código a serem commitadas (esta é uma revisão apenas), o push será do estado atual da branch `feat/visual-improvements`. Se houver alterações decorrentes desta revisão, elas devem ser commitadas antes do push.