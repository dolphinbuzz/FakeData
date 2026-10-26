# Pendências da refatoração do `app.js`

Documento vivo das decisões em aberto levantadas durante a execução de
`plan/PLANO-REFATORACAO-APP-JS.md`.

- **Branch:** `fix/pendencias-refatoracao`
- **Último commit registrado neste documento:** `a07d19d fix(app): corrige A1 A4 A5 A6 A7 e P1`
- **Atualizado em:** 26/10/2026

> Regra do plano: os achados abaixo foram **registrados** durante o refactor e **não devem ser
> corrigidos** dentro dele, salvo autorização explícita. O responsável autorizou a correção na
> branch `fix/pendencias-refatoracao`, onde cada item recebeu commit próprio (ou foi mantido como
> limitação aceita, no caso de P3).

## Resumo

| ID | Assunto | Severidade | Status |
|---|---|---|---|
| A1 | Botão "Escanear campos" executa remapeamento sem intenção | Médio | **Resolvido** |
| A2 | Marca/modelo incoerentes no preenchimento individual | Médio | **Resolvido** |
| A3 | `getBaseUrl` só colapsa `.com` e `.com.br` | Baixo | **Resolvido** |
| A4 | `clearAllPageFields` não limpa os campos da página | Médio | **Resolvido** |
| A5 | `field.fixedValue` é sobrescrito a cada preenchimento | Baixo | **Resolvido** |
| A6 | Condição do `onMessage` mistura `&&` e `\|\|` | Baixo | **Resolvido** |
| A7 | `renderPageFields` reconstrói a lista inteira | Baixo | **Resolvido** |
| P1 | "Preencher todos" ignora marca/modelo fixados | Médio | **Resolvido** |
| P2 | `year`/`plate`/`chassi`/`renavam` não derivam do veículo | Baixo | **Parcial** — ano resolvido; placa/chassi/renavam pendentes de dados |
| P3 | Opção B não enxerga digitação manual na página | Baixo | Limitação aceita |
| P4 | Modelo presente em duas marcas: primeira vence | Baixo | **Resolvido** |
| P5 | Configuração dos agentes com ID de modelo inválido | Médio (fora do repo) | **Resolvido** |

---

## A1 — "Escanear campos" remapeia sem intenção

- **Origem:** achado da seção 4 do plano.
- **Evidência:** `scanFieldsButton.addEventListener("click", scanPageFields)` passa o `MouseEvent`
  como primeiro argumento (`remapping`), que é truthy. O atalho `Alt+Shift+S` dispara o mesmo
  `click()`. Já `emptyStateScanButton` e `baseUrlSelect` chamam `scanPageFields()` sem argumento.
- **Efeito:** status "Remapeando campos automaticamente..." e o seletor escaneado sobrescreve o
  seletor salvo no perfil.
- **Solução aplicada:** o listener passou a ser `() => scanPageFields()`, sem repassar o evento. O
  clique manual e o atalho `Alt+Shift+S` agora apenas escaneiam e mesclam com o mapeamento salvo,
  sem `remapping`. O remapeamento continua disponível no botão dedicado
  (`remapAllFields` → `scanPageFields(true)`).
- **Estado:** **resolvido**. O teste de caracterização foi substituído por um teste que exige
  status "Lendo campos da página..." e preservação do seletor salvo.

## A2 — Marca e modelo incoerentes no preenchimento individual

- **Origem:** achado da seção 4 do plano; investigação obrigatória do Passo 6.
- **Problema:** `generators.js` chama `pickVehicle` a cada geração. `fillAllPageFields` compartilha
  um `vehicleContext` por lote, mas `fillPageField` e o handler de `PAGE_FIELD_FILL_REQUEST` não
  passavam contexto — cada clique sorteava um veículo novo.
- **Solução aplicada (Opção B):** `src/scripts/domain/vehicle-context.js` deriva o veículo do
  estado de `pageFields` antes de gerar; `fillPageField` e `PAGE_FIELD_FILL_REQUEST` passam
  `{ ...generatorOptions, vehicleContext }`. Inclui suporte a `dataType: "auto"`.
- **Estado:** **resolvido**, com testes unitários (`tests/vehicle-context.test.js`) e de integração
  (`tests/app-vehicle-context.test.js`), ambos verificados por regressão manual (falham sem o fix).
- **Resíduos:** ver **P2** e **P3**. O **P1** e o **P4** foram resolvidos posteriormente.

## A3 — `getBaseUrl` só colapsava `.com` e `.com.br`

- **Evidência:** `src/scripts/domain/url-utils.js`.
- **Efeito original:** `qa.app.com` → `app.com`, mas `.org.br` e `.net` mantinham o host completo.
- **Solução aplicada:** colapso genérico para os dois últimos labels, com exceção para sufixos de
  segundo nível conhecidos (`com.br`, `org.br`, `net.br`, `edu.br`, `gov.br`, `mil.br`, `art.br`,
  `blog.br`, `dev.br`, `app.br`, `co.uk`, `org.uk`, `ac.uk`, `com.au`, `net.au`, `co.jp`, `co.kr`),
  que preservam três labels. IPs (IPv4 e IPv6) e `localhost` permanecem intactos. TLDs reservados
  (`test`, `example`, `invalid`, `localhost` — RFC 2606/6761) também não são colapsados, o que
  preserva bases distintas nas fixtures (`*.example.test`).
- **Estado:** **resolvido** em `18afa86`, com 26 testes em `tests/url-utils.test.js`.

## A4 — `clearAllPageFields` não limpava os campos da página

- **Evidência:** corpo da função em `src/scripts/app.js`.
- **Efeito original:** apenas o estado em memória era limpo; os campos do formulário permaneciam
  preenchidos.
- **Solução aplicada:** nova ação `ACTIONS.CLEAR_PAGE_FIELDS` (contrato em `messages.js` e
  `tests/messages.test.js`), com implementação no content script. O popup envia os seletores e só
  limpa `value`/`fixedValue` em memória para os campos confirmados; falhas por seletor são
  reportadas na barra de status e preservam o estado dos campos afetados.
- **Contrato:** request `{ selectors: string[] }`; response
  `{ cleared, total, failed: [{ selector, error }] }`.
- **Estado:** **resolvido** em `b205181` (content) e `a07d19d` (popup). Cobre input, textarea,
  select nativo, custom select, checkbox/radio e `contenteditable`.

## A5 — `field.fixedValue` era sobrescrito a cada preenchimento

- **Evidência original:** `fillPageField`, `fillAllPageFields` e o handler de `onMessage` gravavam
  `fixedValue` mesmo em campos não fixados, e o valor era persistido em `persistPageMapping`.
- **Solução aplicada:** `fixedValue` só é gravado em memória e persistido quando `field.fixed` é
  `true`. Para campos não fixados, `persistPageMapping` grava `""`.
- **Estado:** **resolvido** em `a07d19d`, com teste em `tests/app-mapping.test.js`.

## A6 — Condição do `onMessage` misturava `&&` e `||`

- **Evidência original:** `if (!activeTab || sender.tab && ... || sender.tab && ...)`.
- **Solução aplicada:** a condição foi extraída para o predicado nomeado
  `shouldHandlePageContentChange(sender)`, com parênteses explícitos e a mesma semântica: rejeita
  quando não há `activeTab`, quando `sender.tab.id` difere do ativo, ou quando `sender.tab.url`
  aponta para outra base; aceita quando `sender.tab` está ausente.
- **Estado:** **resolvido** em `a07d19d`, com dois testes em `tests/app-lifecycle.test.js`
  (rejeição por aba/origem e aceitação sem `sender.tab`).

## A7 — `renderPageFields` reconstruía a lista inteira

- **Efeito:** perdia foco e scroll a cada mudança; custo crescia com o número de campos.
- **Solução aplicada:** listeners delegados no container `#page-fields` para `click`, `change`,
  `input`, `keydown` e `focusout`. As interações de linha (fixar, editar rótulo, marcar/localizar,
  preencher) atualizam o DOM pontualmente. `renderPageFields` permanece para reconstruções
  estruturais (scan, carregar perfil, limpar).
- **Estado:** **resolvido** em `a07d19d`, com a suíte de UI existente passando.

---

## P1 — "Preencher todos" ignorava marca/modelo fixados

- **Origem:** revisão independente do A2.
- **Evidência original:** `fillAllPageFields` calculava `pickVehicle(vehicleCatalog, pick)` e não
  consultava `resolveVehicleContext`.
- **Efeito original:** se a marca estivesse fixada no formulário e o modelo não, o lote gravava um
  par coerente, porém de **outra** marca, sobrescrevendo o valor fixado.
- **Solução aplicada:** o lote monta uma lista em que campos não fixados têm `value: ""` e chama
  `resolveVehicleContext` uma única vez, compartilhando o resultado entre todos os campos. Sem
  campos fixados, o resultado continua sendo um sorteio novo por lote.
- **Estado:** **resolvido** em `a07d19d`, com teste em `tests/app-vehicle-context.test.js`.

## P2 — `year`/`plate`/`chassi`/`renavam` não derivam do veículo

- **Evidência original:** `generators.js` gerava esses campos aleatoriamente, sem relação com
  `vehicleContext`.
- **Solução aplicada (ano):** `data/vehicle-catalog.js` passou a exportar `DEFAULT_MODEL_YEARS`
  (faixa por `"marca|modelo"` normalizado) e `pickModelYear`. `pickVehicle` inclui `ano` quando a
  faixa é conhecida. `createGeneratorData().vehicle.context()` expõe `ano`; `generateMappedValue`
  usa `vehicle.ano` ou deriva via `pickModelYear`, caindo em `gerarAno()` para catálogos sem faixa.
  O contrato de `resolveVehicleContext` permanece `{ marca, modelo }`; a derivação do ano fica no
  gerador.
- **Estado:** **parcialmente resolvido** em `33b0d1f` — o **ano** agora é coerente com o modelo.
- **Pendente:** **placa, chassi e renavam continuam aleatórios** porque o catálogo não carrega
  dados suficientes (série, planta, sequência). Resolver exige ampliar o modelo de dados do
  catálogo; não foi inventado vínculo.

## P3 — Opção B não enxerga digitação manual na página

- **Origem:** limitação conhecida da Opção B do A2.
- **Efeito:** o contexto deriva de `field.value`/`field.fixedValue`, que só refletem o que a
  extensão gravou. Se o usuário digitar a marca direto na página, o app não a vê.
- **Estado:** **limitação aceita**. A solução completa exige ler os valores reais da página (nova
  ação no content script) e permanece fora do escopo.

## P4 — Modelo presente em duas marcas: a primeira do catálogo vencia

- **Evidência original:** `resolveVehicleContext` percorria o catálogo e usava o primeiro dono
  encontrado.
- **Solução aplicada:** no ramo `targetType === "brand"`, se a marca já presente no formulário
  também possui o modelo informado (comparação case-insensitive), ela vence a varredura do
  catálogo. Se não possuir, o dono do modelo continua vencendo, preservando o comportamento
  anterior.
- **Estado:** **resolvido** em `33b0d1f`, com teste de regressão de modelo homônimo em
  `tests/vehicle-context.test.js`.

## P5 — Configuração dos agentes com ID de modelo inválido

- **Evidência:** `C:\Users\Gutenberg\.config\opencode\agents\*.md` declarava
  `model: opencode/deepSeek-v4.1-flash-free`; o ID real no provider é
  `opencode/deepseek-v4.1-flash-free`.
- **Efeito:** toda delegação para subagentes falhava com `Model unavailable`.
- **Solução aplicada:** 21 substituições em 19 arquivos fora do repositório — 16 agentes +
  `opencode.json` e 3 arquivos de `team-docs`. O ID foi confirmado via `tools.opencode.models`.
- **Estado:** **resolvido**. Nenhuma ocorrência de `deepSeek` com S maiúsculo permaneceu.
- **Observação:** `service.json` contém senha em texto claro e não foi alterado; os agentes
  `po.md` e `sec-*` usam `opencode/mimo-v2.6-flash-free`, cujo ID não foi verificado.

---

## Itens de acompanhamento sem ação definida

- Smoke manual RT-01 a RT-10 (seção 5 do plano) não foi executado; o responsável autorizou seguir
  para o Passo 11 assumindo o risco.
- Passos 0 a 11 do plano concluídos. Estado após a branch `fix/pendencias-refatoracao`: **345
  testes em 24 arquivos**, cobertura global de 96,68% de statements, 85,21% de branches, 98,61% de
  funções e 99,88% de linhas; `app.js` com 100% de linhas.
- Plano B (seção 8) não iniciado, conforme instrução do plano.
