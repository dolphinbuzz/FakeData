# FakeData

Extensão para Chrome e Microsoft Edge que gera dados fictícios para testes de QA.

## Instalação local

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha esta pasta.
4. Clique no ícone da extensão **FakeData**.

O popup oferece geradores de Pessoa, Veículo e Empresa. A UF pode ser selecionada antes da geração; com uma UF definida, endereços e DDDs são gerados para o estado escolhido e a seleção também é apresentada no resultado de Veículo. A preferência de UF é mantida localmente. Em Pessoa, são gerados nome, CPF, RG, sexo, e-mail, telefone, data de nascimento, profissão, renda, filiação e endereço completo (CEP, endereço, número, bairro, cidade e estado). Em Empresa, são gerados razão social, CNPJ, inscrição estadual, data de abertura, e-mail, site, telefone, segmento e endereço completo. O CPF pode ser gerado com ou sem pontuação. Em Empresa, o CNPJ pode usar o formato numérico ou alfanumérico e também pode ser exibido com ou sem pontuação. Os e-mails usam domínios reais de provedores populares. Cada resultado pode ser copiado individualmente ou como JSON.

Clique em **↗ Lateral** para abrir o FakeData no painel lateral do navegador. O painel permanece aberto enquanto você navega entre páginas e abas da janela.

## Preenchimento de formulários

Ao abrir o popup ou o painel lateral em uma página HTTP(S), a seção **Mapear campos** lista os inputs, selects, áreas de texto e componentes de seleção customizados editáveis. O tipo é inferido por heurísticas gerais, usando `name`, `autocomplete`, labels associadas, `aria-label`, placeholder, tipo do input e contexto estrutural do formulário (e não apenas IDs). Componentes que usam elementos como `multi-select`, `role="combobox"` ou menus com opções `li` também podem ser preenchidos: uma opção visível é selecionada mesmo quando não existe um `<select>` nativo ou quando os valores não são conhecidos. Selects carregados dinamicamente aguardam brevemente suas opções; quando não há correspondência com o valor gerado, uma opção válida é escolhida aleatoriamente. Select2 é tratado usando o `<select>` nativo e seus eventos para manter o componente visual sincronizado. Cada linha permite:

- escolher ou corrigir o tipo de dado;
- visualizar e editar o seletor CSS;
- usar **Marcar** para destacar o campo com um contorno vermelho persistente;
- usar o botão 🎯 para capturar o próximo clique em um label, input ou texto e sugerir um novo seletor;
- preencher somente aquele campo.

Use **Escanear campos** para atualizar a lista, **Marcar todos** para destacar todos os campos encontrados e **Desmarcar todos** para remover os contornos. A marcação usa o alvo visual correto para controles ocultos, incluindo wrappers do Select2, e evita duplicar o destaque quando mais de um seletor aponta para o mesmo elemento. Use **Salvar seletores** para manter os mapeamentos em `chrome.storage.local`, separados por URL, e **Preencher todos** para gerar valores novos e preencher todos os campos mapeados de uma vez. O preenchimento em lote processa componentes customizados de forma sequencial e fecha menus abertos ao finalizar. Checkboxes recebem marcação aleatória e grupos de radio são selecionados automaticamente. Os eventos `input` e `change` são disparados para manter compatibilidade com frameworks como React, Vue e Angular. Campos em páginas protegidas do navegador (por exemplo, `chrome://`) não podem ser acessados.

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
