# Pendências da refatoração do `app.js`

Documento vivo das decisões em aberto levantadas durante a execução de
`plan/PLANO-REFATORACAO-APP-JS.md`.

- **Branch:** `refactor/app-js-modularizacao`
- **Último commit registrado neste documento:** `refactor(app): extrai profiles-repository`
- **Atualizado em:** 26/10/2026

> Regra do plano: os achados abaixo foram **registrados** durante o refactor e **não devem ser
> corrigidos** dentro dele, salvo autorização explícita. A exceção até aqui é o **A2**, corrigido
> por decisão do responsável.

## Resumo

| ID | Assunto | Severidade | Status |
|---|---|---|---|
| A1 | Botão "Escanear campos" executa remapeamento sem intenção | Médio | Aberto — aguarda decisão |
| A2 | Marca/modelo incoerentes no preenchimento individual | Médio | **Resolvido** |
| A3 | `getBaseUrl` só colapsa `.com` e `.com.br` | Baixo | Aberto |
| A4 | `clearAllPageFields` não limpa os campos da página | Médio | Aberto — intenção incerta |
| A5 | `field.fixedValue` é sobrescrito a cada preenchimento | Baixo | Aberto |
| A6 | Condição do `onMessage` mistura `&&` e `\|\|` | Baixo | Aberto |
| A7 | `renderPageFields` reconstrói a lista inteira | Baixo | Aberto |
| P1 | "Preencher todos" ignora marca/modelo fixados | Médio | Aberto |
| P2 | `year`/`plate`/`chassi`/`renavam` não derivam do veículo | Baixo | Aberto |
| P3 | Opção B não enxerga digitação manual na página | Baixo | Limitação aceita |
| P4 | Modelo presente em duas marcas: primeira vence | Baixo | Documentado |
| P5 | Configuração dos agentes com ID de modelo inválido | Médio (fora do repo) | Aberto |

---

## A1 — "Escanear campos" remapeia sem intenção

- **Origem:** achado da seção 4 do plano.
- **Evidência:** `scanFieldsButton.addEventListener("click", scanPageFields)` passa o `MouseEvent`
  como primeiro argumento (`remapping`), que é truthy. O atalho `Alt+Shift+S` dispara o mesmo
  `click()`. Já `emptyStateScanButton` e `baseUrlSelect` chamam `scanPageFields()` sem argumento.
- **Efeito:** status "Remapeando campos automaticamente..." e o seletor escaneado sobrescreve o
  seletor salvo no perfil.
- **Estado atual:** comportamento preservado e **coberto por teste de caracterização** em
  `tests/app-lifecycle.test.js` (baseline RT-10).
- **Pendente:** decidir se o botão deve ou não remapear. A decisão altera as regras de
  `domain/field-merge.js` e deve remover/atualizar o teste de caracterização.

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
- **Resíduos:** ver **P1**, **P2** e **P3**.

## A3 — `getBaseUrl` só colapsa `.com` e `.com.br`

- **Evidência:** `src/scripts/domain/url-utils.js`.
- **Efeito:** `qa.app.com` → `app.com`, mas `.org.br` e `.net` mantêm o host completo.
- **Pendente:** decidir se o colapso deve cobrir outros TLDs. Mudança de comportamento, exige
  atualização de `tests/url-utils.test.js`.

## A4 — `clearAllPageFields` não limpa os campos da página

- **Evidência:** corpo da função em `src/scripts/app.js`.
- **Efeito:** apenas o estado em memória é limpo; os campos do formulário permanecem preenchidos.
- **Pendente:** confirmar a intenção. Se for limpar a página, é necessário novo round-trip com o
  content script.

## A5 — `field.fixedValue` é sobrescrito a cada preenchimento

- **Evidência:** `fillPageField`, `fillAllPageFields` e o handler de `onMessage` gravam `fixedValue`
  mesmo em campos não fixados, e o valor é persistido em `persistPageMapping`.
- **Efeito:** provavelmente baixo, mas o perfil salvo acumula valores de execuções anteriores.
- **Interação:** afeta a Opção B do A2, que lê `fixedValue` quando o campo está fixo.

## A6 — Condição do `onMessage` mistura `&&` e `||`

- **Evidência:** `if (!activeTab || sender.tab && ... || sender.tab && ...)`.
- **Efeito:** funciona pela precedência atual, mas é frágil a alterações.
- **Pendente:** extrair para predicado nomeado com parênteses explícitos.

## A7 — `renderPageFields` reconstrói a lista inteira

- **Efeito:** perde foco e scroll a cada mudança; custo cresce com o número de campos.
- **Pendente:** trocar por delegação de eventos; avaliar `store` de estado e divisão da UI por
  painéis.

---

## P1 — "Preencher todos" ignora marca/modelo fixados

- **Origem:** revisão independente do A2.
- **Evidência:** `fillAllPageFields` calcula `pickVehicle(vehicleCatalog, pick)` e não consulta
  `resolveVehicleContext`.
- **Efeito:** se a marca estiver fixada no formulário e o modelo não, o lote grava um par coerente,
  porém de **outra** marca, sobrescrevendo o valor fixado.
- **Pendente:** decidir se o lote deve reutilizar a marca/modelo do formulário. Fora do escopo
  autorizado no A2.

## P2 — `year`/`plate`/`chassi`/`renavam` não derivam do veículo

- **Evidência:** `generators.js` gera esses campos aleatoriamente, sem relação com
  `vehicleContext`.
- **Efeito:** dados de veículo individualmente válidos, mas sem vínculo entre si (ex.: ano
  incompatível com o modelo).
- **Pendente:** decidir se o catálogo deve carregar ano/faixa e se placa/chassi/renavam devem ser
  derivados do veículo escolhido.

## P3 — Opção B não enxerga digitação manual na página

- **Origem:** limitação conhecida da Opção B do A2.
- **Efeito:** o contexto deriva de `field.value`/`field.fixedValue`, que só refletem o que a
  extensão gravou. Se o usuário digitar a marca direto na página, o app não a vê.
- **Pendente:** solução completa exige ler os valores reais da página (nova ação no content
  script). Fora do escopo deste refactor.

## P4 — Modelo presente em duas marcas: a primeira do catálogo vence

- **Evidência:** `resolveVehicleContext` percorre o catálogo e usa o primeiro dono encontrado.
- **Efeito:** com modelos homônimos em marcas diferentes, a marca resolvida é a primeira do
  catálogo.
- **Estado:** comportamento **documentado por teste** em `tests/vehicle-context.test.js`.
- **Pendente:** decidir se deve priorizar a marca já presente no formulário antes de varrer o
  catálogo.

## P5 — Configuração dos agentes com ID de modelo inválido

- **Evidência:** `C:\Users\Gutenberg\.config\opencode\agents\*.md` declara
  `model: opencode/deepSeek-v4.1-flash-free`; o ID real no provider é
  `opencode/deepseek-v4.1-flash-free`.
- **Efeito:** toda delegação para subagentes falha com `Model unavailable`.
- **Contorno usado:** informar explicitamente o ID corrigido na chamada de delegação.
- **Pendente:** corrigir a grafia nos arquivos de agente e em `opencode.json`. Fora do repositório.

---

## Itens de acompanhamento sem ação definida

- Smoke manual RT-01 a RT-10 (seção 5 do plano) segue pendente de execução humana.
- Passos 9 a 11 do plano ainda não executados (passos 7 e 8 concluídos).
