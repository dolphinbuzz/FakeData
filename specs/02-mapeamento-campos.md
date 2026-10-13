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

## Inferência de Tipo (29 tipos)

| Categoria | Tipos | Heurística |
|-----------|-------|------------|
| Identificação | `name`, `cpf`, `cnpj`, `rg` | name, placeholder, autocomplete, pattern |
| Contato | `email`, `phone` | type=email/tel, autocomplete, label |
| Endereço | `cep`, `address`, `number`, `neighborhood`, `city`, `state` | autocomplete, label, select options (UF) |
| Pessoal | `birthDate`, `gender`, `mother`, `father`, `profession`, `income` | label, type=date/month, select options |
| Veículo | `brand`, `model`, `year`, `plate`, `chassi` | label, placeholder |
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

## Validações
- **Unicidade**: `document.querySelectorAll(selector).length === 1`
- **IDs dinâmicos detectados**: hashes, `ember-`, `component-`, `r123` → evitados
- **Colisão pós-scan**: Múltiplos elementos com mesmo seletor → `fragile`
- **Sugestões**: `data-cy` recomendado para elementos `fragile`

## Locator Names
Formato: `rota-contexto-tipo` (ex: `cadastro-email-email`)
- Rota: último segmento do pathname sanitizado
- Contexto: label/name/tagName sanitizado
- Tipo: inputType ou tagName lowercased

## Observação de Navegação (SPA)
- `history.pushState/replaceState` interceptados
- `popstate`, `hashchange` listeners
- `MutationObserver` no body (ignora `data-fakedata-control`)
- Debounce 250ms → notifica `PAGE_CONTENT_CHANGED`

## Arquivos Relacionados
- `src/scripts/selector-engine.js` - Scan, inferType, selectorFor, captureNextClick
- `src/scripts/content.js` - captureNextClick handler, fieldFromTarget
- `src/scripts/messages.js` - ACTIONS (SCAN_FIELDS, CAPTURE_NEXT_CLICK, etc.)