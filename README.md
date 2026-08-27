# FakeData

Extensão para Chrome e Microsoft Edge que gera dados fictícios para testes de QA.

## Instalação local

1. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
2. Ative o **Modo do desenvolvedor**.
3. Selecione **Carregar sem compactação** e escolha esta pasta.
4. Clique no ícone da extensão **FakeData**.

O popup oferece geradores de Pessoa, Veículo e Empresa. Em Pessoa, o CPF pode ser gerado com ou sem pontuação. Em Empresa, o CNPJ pode usar o formato numérico ou alfanumérico e também pode ser exibido com ou sem pontuação. Os e-mails usam domínios reais de provedores populares. Cada resultado pode ser copiado individualmente ou como JSON.

Clique em **↗ Lateral** para abrir o FakeData no painel lateral do navegador. O painel permanece aberto enquanto você navega entre páginas e abas da janela.

## Estrutura

```text
FakeData/
├── manifest.json
├── PRIVACY_POLICY.md
└── src/
    ├── popup.html
    ├── privacy.html
    ├── scripts/app.js
    └── styles/
        ├── popup.css
        └── privacy.css
```

A política de privacidade também pode ser aberta pelo link **Privacidade** no rodapé da extensão.
