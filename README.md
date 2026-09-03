# FakeData

## Testes

Execute `npm test` para rodar a suíte unitária. Use `npm run test:coverage` para gerar o relatório HTML/texto de cobertura; a configuração mantém uma meta global mínima de 70% enquanto os módulos puros críticos possuem limiares específicos mais altos.

Extensão para Chrome e Microsoft Edge que gera dados fictícios para testes de QA.

## Instalação local

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha esta pasta.
4. Clique no ícone da extensão **FakeData**.

O popup oferece geradores de Pessoa, Veículo e Empresa. A interface é dividida nas abas **Gerar dados** e **Mapear campos**, com a aba de geração selecionada por padrão. A UF pode ser selecionada antes da geração; com uma UF definida, endereços e DDDs são gerados para o estado escolhido e a seleção também é apresentada no resultado de Veículo. A preferência de UF é mantida localmente. Em Pessoa, são gerados nome, CPF, RG, sexo, e-mail, telefone, data de nascimento, profissão, renda, filiação e endereço completo (CEP, endereço, número, bairro, cidade e estado). Em Empresa, são gerados razão social, CNPJ, inscrição estadual, data de abertura, e-mail, site, telefone, segmento e endereço completo. O CPF pode ser gerado com ou sem pontuação. Em Empresa, o CNPJ pode usar o formato numérico ou alfanumérico e também pode ser exibido com ou sem pontuação. Os e-mails usam domínios reais de provedores populares. Cada resultado pode ser copiado individualmente ou como JSON.

Clique em **↗ Lateral** para abrir o FakeData no painel lateral do navegador. O painel permanece aberto enquanto você navega entre páginas e abas da janela.
Use o botão de expandir no cabeçalho, entre o controle de tema e o botão lateral, para abrir a extensão em uma nova aba e fechar o popup ou painel lateral atual.

## Preenchimento de formulários

Ao abrir o popup ou o painel lateral em uma página HTTP(S), selecione a aba **Mapear campos** para listar os inputs, selects, áreas de texto e componentes de seleção customizados editáveis. O tipo é inferido por heurísticas gerais, usando `name`, `autocomplete`, labels associadas, `aria-label`, placeholder, tipo do input e contexto estrutural do formulário (e não apenas IDs). Componentes que usam elementos como `multi-select`, `role="combobox"` ou menus com opções `li` também podem ser preenchidos: uma opção visível é selecionada mesmo quando não existe um `<select>` nativo ou quando os valores não são conhecidos. Selects carregados dinamicamente aguardam brevemente suas opções; quando não há correspondência com o valor gerado, uma opção válida é escolhida aleatoriamente. Select2 é tratado usando o `<select>` nativo e seus eventos para manter o componente visual sincronizado. Cada linha permite:

- escolher ou corrigir o tipo de dado;
- visualizar e editar o seletor CSS;
- usar **Marcar** para destacar o campo com um contorno vermelho persistente;
- usar o botão 🎯 para capturar o próximo clique em um label, input ou texto e sugerir um novo seletor;
- preencher somente aquele campo.

Use **Escanear campos** para atualizar a lista, **Marcar todos** para destacar todos os campos encontrados e **Desmarcar todos** para remover os contornos. Quando uma aplicação web muda de conteúdo na mesma URL, o painel atualiza automaticamente e adiciona os campos novos, preservando nomes, tipos, seletores e valores fixos já editados. Quando a rota/URL muda, a página é tratada como uma nova tela e o scan é refeito. Se houver um único template salvo para a URL atual, ele será selecionado automaticamente e seus campos serão carregados. A marcação usa o alvo visual correto para controles ocultos, incluindo wrappers do Select2, e evita duplicar o destaque quando mais de um seletor aponta para o mesmo elemento. Os **Seletores salvos** são agrupados automaticamente pela origem da aplicação (protocolo, domínio e porta), com várias páginas nomeadas dentro de cada aplicação. Ao salvar, informe o nome da página; o perfil selecionado pode ser renomeado ou excluído. **Remapear** captura novamente um campo e **Remapear todos** atualiza os campos encontrados automaticamente. Cada campo possui um botão com ícone de **Colar** no painel e, enquanto o mapeamento está aberto, também um botão flutuante junto ao campo correspondente na página. Ambos preenchem usando o valor fixado ou um dado gerado. O botão **Localizar** do painel rola a página até o campo e o centraliza na tela. Cada campo pode ser fixado com um valor literal, que será usado sempre no preenchimento daquele perfil. Use **Salvar seletores** para manter os mapeamentos em `chrome.storage.local` e **Preencher todos** para gerar valores novos e preencher todos os campos mapeados de uma vez. O preenchimento em lote processa componentes customizados de forma sequencial e fecha menus abertos ao finalizar. Checkboxes recebem marcação aleatória e grupos de radio são selecionados automaticamente. Os eventos `input` e `change` são disparados para manter compatibilidade com frameworks como React, Vue e Angular. Campos em páginas protegidas do navegador (por exemplo, `chrome://`) não podem ser acessados.
Use o campo global **Verificar seletor CSS** para digitar um seletor e ver inline quantos elementos ele encontra na página; o botão 🎯 captura um elemento e preenche somente o seletor CSS, sem `cy.get(...)`. Use **Marcar encontrados** para destacar todos os elementos correspondentes e **Desmarcar encontrados** para remover esses destaques. Seletores inválidos são sinalizados no próprio campo.

A auditoria de seletores informa problemas diretamente com um ícone vermelho ao lado do campo, cujo tooltip explica a correção. O botão **Copiar JSON**, na aba **Automático**, copia um objeto `chave: valor` com os locators nomeados e seus seletores. Use **Adicionar seletor** para capturar um novo elemento da página e incluí-lo na lista; depois de editar o nome pelo lápis, o seletor e seu valor fixo podem ser salvos no perfil atual com **Salvar seletores**. Seletores priorizam primeiro o `id` existente e único do elemento, seguido por `data-cy`, `data-test`, `data-testid`, atributos ARIA/semânticos, `value` (com igualdade exata e depois parcial), `ng-model`, `name` e `type`; combinações de `ng-model`, `value`, `name` e `type` resolvem colisões antes do fallback. Classes e estilos não são usados. Um fallback estrutural posicional pode ser usado apenas para manter a operação de campos sem atributos estáveis e fica sempre marcado como frágil.

A separação por abas deixa o fluxo de mapeamento isolado do gerador atual e prepara a extensão para uma futura edição de dados fixos por formulário, sem alterar os mapeamentos existentes.

## Estrutura

```text
FakeData/
├── manifest.json
├── PRIVACY_POLICY.md
└── src/
    ├── popup.html
    ├── privacy.html
    ├── scripts/app.js
    ├── scripts/content.js
    └── styles/
        ├── popup.css
        └── privacy.css
```

A política de privacidade também pode ser aberta pelo link **Privacidade** no rodapé da extensão.
