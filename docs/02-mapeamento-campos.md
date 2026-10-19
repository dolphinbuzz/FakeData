# Spec: Mapeamento de Campos

## Visão Geral
Sistema de descoberta, inferência e mapeamento de campos de formulário em páginas web. Permite scan automático, edição manual e validação de seletores CSS.

## Sub-abas

### Automático
- **Escanear campos**: Descobre inputs, selects, textareas, custom selects
- **Revisar campos**: Tipo inferido, seletor CSS, label, status
- **Ações por campo**: Marcar, Localizar, Capturar (🎯), Preencher
- **Ações em lote**: Marcar todos, Preencher todos, Salvar seletores

### Playground
- **Verificar seletor CSS**: Conta matches em tempo real
- **Capturar seletor**: 🎯 clica na página → captura seletor
- **Marcar/Desmarcar encontrados**: Highlight visual dos matches
- **Copiar JSON**: Exporta `locatorName: selector`

## Inferência de Tipo (29 tipos + `auto`)

| Categoria | Tipos | Heurística |
|-----------|-------|------------|
| Identificação | `name`, `cpf`, `cnpj`, `rg` | name, placeholder, autocomplete, pattern |
| Contato | `email`, `phone` | type=email/tel, autocomplete, label |
| Endereço | `cep`, `address`, `number`, `neighborhood`, `city`, `state` | autocomplete, label, select options (UF) |
| Pessoal | `birthDate`, `gender`, `mother`, `father`, `profession`, `income` | label, type=date/month, select options |
| Veículo | `brand`, `model`, `year`, `plate`, `chassi`, `renavam` | label, placeholder |
| Empresa | `company`, `website` | autocomplete=organization, label |
| UI | `checkbox`, `radio`, `text`, `number` | type attribute |

## Geração de Seletores (Prioridade)

| Prioridade | Tipo | Exemplo | Status |
|------------|------|---------|--------|
| 1 | ID único | `#user-email` | stable |
| 1 | data-cy | `[data-cy="email"]` | stable |
| 1 | data-test | `[data-test="email"]` | stable |
| 1 | data-testid | `[data-testid="email"]` | stable |
| 2 | ARIA | `[aria-label="Email"]`, `[role="textbox"]` | stable |
| 3 | Funcional | `[name="email"]`, `[type="email"]`, `[value="x"]`, `[ng-model="x"]` | stable |
| 4 | Combinações | `name+type+value`, `role+aria-label` | stable |
| 5 | Texto estático | Label visível curto | fragile |
| 5 | Estrutural | `form > div:nth-of-type(2) > input` | fragile |

**Nota**: Atributos de teste (`data-cy`, `data-test`, `data-testid`) são verificados ANTES da detecção Angular, permitindo seletores estáveis mesmo em elementos Angular.

## Validações
- **Unicidade**: `document.querySelectorAll(selector).length === 1`
- **IDs dinâmicos detectados**: hashes, `ember-`, `component-`, `r123`, padrões Angular (`mat-input-*`, `cdk-describedby-*`) → evitados
- **Atributos Angular instáveis**: `ng-reflect-*`, `_ngcontent-*`, `_nghost-*`, `ng-version` → seletor marcado `fragile` com sugestão
- **Colisão pós-scan**: Múltiplos elementos com mesmo seletor → `fragile` + sugestão
- **Sugestões**: `data-cy` recomendado para elementos `fragile`

## Locator Names
Formato: `rota-contexto-tipo` (ex: `cadastro-email-email`)
- Rota: último segmento do pathname sanitizado
- Contexto: label/name/tagName sanitizado
- Tipo: inputType ou tagName lowercased

## Observação de Navegação (SPA) — Atualizada A2
- `history.pushState`/`replaceState` interceptados (wrappers restaurados no cleanup)
- `popstate`, `hashchange` listeners (removidos no cleanup)
- `MutationObserver` no body (ignora `data-fakedata-control`)
- Debounce 250ms → notifica `PAGE_CONTENT_CHANGED`
- **Cleanup**: `installNavigationObserver()` retorna função que desconecta observer, remove listeners, restaura `history.pushState`/`replaceState` originais, limpa timer

## Arquivos Relacionados
- `src/scripts/selector-engine.js` - Scan, inferType, selectorFor, captureNextClick, installNavigationObserver (retorna cleanup), normalize, visible, isDynamicId, hasAngularAttributes
- `src/scripts/content.js` - captureNextClick handler, fieldFromTarget, messageListener, installationProbe, dispose
- `src/scripts/messages.js` - ACTIONS (SCAN_FIELDS, CAPTURE_NEXT_CLICK, PAGE_CONTENT_CHANGED, etc.)