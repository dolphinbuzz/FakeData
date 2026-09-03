# FakeData

Extensão para Chrome e Microsoft Edge que gera dados fictícios para testes de QA e ajuda a mapear e preencher formulários em aplicações web.

## Pré-requisitos

- Google Chrome ou Microsoft Edge com suporte a Manifest V3.
- Node.js 22.x e npm para executar os testes locais. As dependências exigem Node.js 18 ou superior.
- Uma página HTTP(S) com um formulário acessível. Páginas internas do navegador, como `chrome://` e `edge://`, não permitem acesso ao content script.

## Instalação da extensão

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação**.
5. Selecione a pasta raiz deste projeto, a que contém `manifest.json`.
6. Clique no ícone do FakeData para abrir o popup.

A extensão solicita `activeTab`, `scripting`, `storage` e `sidePanel`. Essas permissões permitem ler a aba escolhida, injetar o content script quando necessário, salvar perfis localmente e abrir o painel lateral. Nenhum dado é enviado para um servidor.

## Modos de abertura

- **Popup:** abre pelo ícone da extensão. Começa em **Mapear campos** e mostra somente a URL base, os perfis, os campos encontrados, **Escanear campos** e **Preencher todos**.
- **Painel lateral:** use **↗ Lateral** para abrir a extensão ao lado da página. O painel permanece disponível enquanto você navega entre abas.
- **Aba dedicada:** use o botão de expandir no cabeçalho para abrir a interface completa em uma nova aba. Nesse modo ficam disponíveis tanto **Gerar dados** quanto **Mapear campos**.

## Gerar dados

1. Abra a aba **Gerar dados** (não necessário no popup compacto).
2. Escolha **Pessoa**, **Veículo** ou **Empresa**.
3. Opcionalmente selecione a UF. A preferência fica salva localmente.
4. Clique em **Gerar Pessoa**, **Gerar Veículo** ou **Gerar Empresa**.
5. Copie um campo individualmente ou use **Copiar JSON**.

### Pessoa

Gera nome simples ou composto com dois sobrenomes distintos, CPF, RG, sexo, e-mail, telefone, data de nascimento, filiação, profissão, renda e endereço completo. O CPF pode ser exibido com ou sem pontuação.

### Empresa

Gera razão social, CNPJ, inscrição estadual, data de abertura, e-mail, site, telefone, segmento e endereço. O CNPJ pode ser numérico ou alfanumérico e pode ser exibido com ou sem pontuação.

### Veículo e catálogo personalizado

O resultado inclui marca, modelo, ano, placa, cor, chassi VIN de 17 caracteres com dígito verificador ISO 3779 e UF.

Para cadastrar veículos:

1. Selecione **Veículo**.
2. Clique em **Cadastrar Marca x Modelo**, ao lado do seletor de UF.
3. Informe a marca e o modelo e clique em **Adicionar**.
4. Repita a operação para cadastrar vários modelos da mesma marca.
5. Edite ou exclua marcas e modelos diretamente no modal.

O catálogo é salvo em `chrome.storage.local`. Ao gerar um veículo, a extensão escolhe uma marca e somente um modelo vinculado a ela. Se não houver catálogo personalizado, usa o catálogo padrão.

## Mapear e preencher campos

1. Abra **Mapear campos**.
2. Se houver várias páginas HTTP(S) abertas, escolha a **URL base monitorada**. Subdomínios são agrupados em bases como `exemplo.com.br` e `exemplo.com`; o monitoramento continua limitado à aba selecionada.
3. Na subaba **Automático**, clique em **Escanear campos**.
4. Revise cada campo encontrado, seu tipo e seu seletor CSS.
5. Use **Marcar** para destacar um campo, **Localizar** para centralizá-lo na página ou **🎯** para capturar outro elemento.
6. Use **Marcar todos** ou **Preencher todos** quando necessário.
7. Clique em **Salvar seletores** para criar um perfil ou atualizar o perfil selecionado.

Ao lado de **Preencher todos**, o checkbox **Botões flutuantes** controla os botões de preenchimento exibidos junto aos campos na página. Ele vem marcado por padrão e a escolha fica salva para as próximas aberturas da extensão.

### Atalhos de teclado

Na interface da extensão, use os atalhos abaixo para executar ações frequentes:

| Atalho | Ação |
| --- | --- |
| `Alt+Shift+S` | Escanear campos |
| `Alt+Shift+P` | Preencher todos |
| `Alt+Shift+F` | Mostrar ou ocultar botões flutuantes |
| `Alt+Shift+L` | Salvar seletores |
| `Alt+Shift+M` | Marcar todos |

Os atalhos não são executados enquanto o foco estiver em um campo de texto, área editável ou seletor.

O scan inclui inputs, selects, textareas e componentes customizados como `multi-select` e `role="combobox"`. Botões e links podem ser capturados pelo Playground, mas não entram no scan geral de preenchimento.

O preenchimento dispara eventos `input` e `change`, processa campos sequencialmente e suporta:

- inputs de texto, número, data e mês;
- selects nativos e Select2;
- radios e checkboxes;
- menus customizados e componentes com opções visíveis.

Cada campo possui um botão de preenchimento no painel. Enquanto o mapeamento está aberto, a página também recebe um botão flutuante junto ao campo correspondente.

### Perfis e valores fixos

Os perfis são agrupados por origem (protocolo, domínio e porta) e identificados por uma URL de página normalizada, sem query string ou fragmento. Uma mesma aplicação pode ter vários perfis nomeados para páginas diferentes.

- Informe um nome ao salvar um novo perfil.
- Com um perfil selecionado, **Salvar seletores** atualiza esse perfil sem criar outro.
- **Renomear** altera o nome do perfil; **Excluir** remove somente o perfil selecionado.
- Edite o nome, o tipo e o seletor de cada campo antes de salvar.
- O campo **Valor** mostra o último valor enviado.
- Marque **Fixar valor** para reutilizar um valor literal nos próximos preenchimentos daquele perfil.
- Valores preenchidos são persistidos no perfil mesmo quando não estão fixados.

Na mesma URL, alterações relevantes do DOM atualizam a lista e preservam as edições existentes. Ao mudar de rota, query, fragmento ou página, o estado visual é limpo e um novo scan pode ser executado. Os dados salvos não são apagados automaticamente.

### Subaba Playground

Na subaba **Playground**:

1. Digite um seletor CSS no campo **Verificar seletor CSS**.
2. Consulte inline a quantidade de correspondências.
3. Use **🎯** para capturar o seletor de um elemento da página.
4. Clique em **Marcar encontrados** ou **Desmarcar encontrados**.

Seletores inválidos são sinalizados no próprio campo. O gerador prioriza `id` único, atributos de teste, ARIA/semânticos, `value`, `ng-model`, `name` e `type`; classes e estilos não são usados. Fallbacks estruturais ficam marcados como frágeis. **Copiar JSON**, na subaba Automático, copia somente os pares `locatorName: selector`.

## Armazenamento e privacidade

Perfis, valores fixos, valores usados, catálogo de veículos e preferência de UF são salvos apenas no armazenamento local do navegador. A extensão não possui backend nem envia os dados para a internet. Consulte `PRIVACY_POLICY.md` ou o link **Privacidade** no rodapé para detalhes.

## Testes e cobertura

Instale as dependências e execute:

```bash
npm ci
npm test
npm run test:coverage
```

`npm test` executa a suíte Vitest. `npm run test:coverage` gera os relatórios texto e HTML e exige pelo menos 90% de Lines globalmente e nos principais módulos de produção. O CI usa Node.js 22.x, executa `npm ci` e `npm run test:coverage` em cada push e pull request para `main`. O relatório é publicado como artefato do workflow.

## Solução de problemas

### Nenhum campo foi encontrado

Confirme que a aba ativa é uma página `http://` ou `https://`, que o formulário já foi carregado e que você selecionou a URL base correta. Clique em **Escanear campos** após a aplicação terminar a navegação. Páginas `chrome://`, `edge://`, lojas de extensões, arquivos locais e outras páginas protegidas não podem ser escaneadas.

### A extensão foi recarregada e o preenchimento parou

Recarregue a extensão em `chrome://extensions` ou `edge://extensions` e abra novamente o popup/painel. O próximo scan injeta o content script atualizado quando o navegador permitir. Os perfis salvos permanecem no armazenamento local.

### Um seletor não marca ou não preenche o campo

Use **Localizar** para confirmar se o elemento existe na página atual. Verifique se o seletor é válido e único no Playground. Em aplicações dinâmicas, use **🎯** ou **Remapear todos** depois que os campos forem renderizados.

### A cobertura falha no CI

Use Node.js 22.x e execute `npm ci` antes dos testes. Rode `npm run test:coverage` localmente e confira o arquivo que ficou abaixo de 90% em Lines. O limiar está configurado em `vitest.config.js`.

## Estrutura do projeto

```text
FakeData/
├── .github/
│   └── workflows/ci.yml
├── manifest.json
├── package.json
├── package-lock.json
├── vitest.config.js
├── PRIVACY_POLICY.md
├── src/
│   ├── popup.html
│   ├── privacy.html
│   ├── scripts/
│   │   ├── app.js
│   │   ├── content.js
│   │   ├── generators.js
│   │   ├── messages.js
│   │   ├── selector-engine.js
│   │   └── data/
│   │       ├── estados.js
│   │       ├── mapping-types.js
│   │       └── vehicle-catalog.js
│   └── styles/
│       ├── popup.css
│       └── privacy.css
└── tests/
    ├── app.test.js
    ├── content.test.js
    ├── generators.test.js
    ├── messages.test.js
    ├── selector-engine.test.js
    └── vehicle-catalog.test.js
```
