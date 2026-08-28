# Política de Privacidade — FakeData

**Última atualização:** 27 de agosto de 2026

## Resumo

O FakeData é uma extensão para Google Chrome e Microsoft Edge que gera dados fictícios para testes de QA. A extensão funciona localmente no navegador e não envia dados para servidores externos.

## Dados processados

Nomes, documentos, e-mails, telefones e informações de empresas ou veículos são gerados aleatoriamente no dispositivo do usuário. Esses dados são fictícios, não representam pessoas ou organizações reais e não são enviados para servidores externos.

Quando o usuário solicita o mapeamento de um formulário, a extensão lê apenas os metadados dos campos editáveis da página ativa (como label, `name`, placeholder e seletor CSS). O recurso de captura por alvo observa apenas o próximo clique solicitado pelo usuário para identificar o elemento escolhido. Os seletores e tipos escolhidos podem ser salvos pelo usuário em `chrome.storage.local`, associados à URL da página, para reutilização posterior. Valores já preenchidos nos formulários não são coletados nem armazenados.

## Permissões

A permissão `sidePanel` é utilizada para exibir o gerador no painel lateral. As permissões de armazenamento e acesso à página ativa permitem salvar os mapeamentos escolhidos e ler metadados de campos para preenchê-los sob comando do usuário. A extensão não acessa histórico de navegação, cookies, arquivos ou informações de autenticação.

## Serviços de terceiros

A extensão não utiliza analytics, anúncios, rastreadores, APIs externas ou serviços de terceiros. Os domínios de e-mail exibidos são apenas valores fictícios para testes.

## Alterações e contato

Esta política pode ser atualizada para refletir mudanças na extensão ou na legislação aplicável. Dúvidas podem ser encaminhadas pelo [repositório do projeto no GitHub](https://github.com/dolphinbuzz/FakeData).
