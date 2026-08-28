# Política de Privacidade — FakeData

**Última atualização:** 27 de agosto de 2026

## Resumo

O FakeData é uma extensão para Google Chrome e Microsoft Edge que gera dados fictícios para testes de QA. A extensão funciona localmente no navegador e não envia dados para servidores externos.

## Dados processados

Nomes, documentos, e-mails, telefones e informações de empresas ou veículos são gerados aleatoriamente no dispositivo do usuário. Esses dados são fictícios, não representam pessoas ou organizações reais e não são enviados para servidores externos.

Quando o usuário solicita o mapeamento de um formulário, a extensão lê apenas os metadados dos campos editáveis da página ativa (como label, `name`, placeholder e seletor CSS). O recurso de captura por alvo observa apenas o próximo clique solicitado pelo usuário para identificar o elemento escolhido. O painel lateral pode observar alterações de navegação e estrutura da página para limpar a lista exibida quando a aplicação muda de aba; essa observação não armazena o conteúdo da página. Os seletores, tipos, nomes de páginas e valores fixados escolhidos pelo usuário podem ser salvos em `chrome.storage.local`, agrupados pela origem da aplicação e associados às URLs das páginas, para reutilização posterior. Valores já preenchidos nos formulários não são coletados nem armazenados automaticamente; apenas valores literais explicitamente informados como fixos são armazenados.
O verificador de seletor CSS consulta apenas a quantidade de elementos correspondentes na página ativa quando solicitado pelo usuário; essa contagem não é armazenada.
O relatório de auditoria contém apenas metadados dos elementos interativos, seletores e sugestões de atributos estáveis. Ele pode ser copiado/baixado pelo usuário e salvo localmente junto ao perfil, sem enviar dados para servidores externos.

## Permissões

A permissão `sidePanel` é utilizada para exibir o gerador no painel lateral. As permissões de armazenamento e acesso à página ativa permitem salvar os mapeamentos escolhidos e ler metadados de campos para preenchê-los sob comando do usuário. A extensão não acessa histórico de navegação, cookies, arquivos ou informações de autenticação.

## Serviços de terceiros

A extensão não utiliza analytics, anúncios, rastreadores, APIs externas ou serviços de terceiros. Os domínios de e-mail exibidos são apenas valores fictícios para testes.

## Alterações e contato

Esta política pode ser atualizada para refletir mudanças na extensão ou na legislação aplicável. Dúvidas podem ser encaminhadas pelo [repositório do projeto no GitHub](https://github.com/dolphinbuzz/FakeData).
