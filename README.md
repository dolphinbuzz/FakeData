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

Ao abrir o popup ou o painel lateral em uma página HTTP(S), a seção **Mapear campos** lista os inputs, selects e áreas de texto editáveis. O tipo é inferido por heurísticas gerais, usando `name`, `autocomplete`, labels associadas, `aria-label`, placeholder, tipo do input e contexto estrutural do formulário (e não apenas IDs). Cada linha permite:

- escolher ou corrigir o tipo de dado;
- visualizar e editar o seletor CSS;
- localizar o campo na página;
- usar o botão 🎯 para capturar o próximo clique em um label, input ou texto e sugerir um novo seletor;
- preencher somente aquele campo.

Use **Salvar seletores** para manter os mapeamentos em `chrome.storage.local`, separados por URL, e **Preencher todos** para gerar um valor novo e preencher todos os campos mapeados de uma vez. Checkboxes recebem marcação aleatória e grupos de radio são selecionados automaticamente. Os eventos `input` e `change` são disparados para manter compatibilidade com frameworks como React e Vue. Campos em páginas protegidas do navegador (por exemplo, `chrome://`) não podem ser acessados.

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
