#!/bin/bash
# Pre-push: exige confirmação explícita antes de enviar commits ao remoto.
#
# Como o Git invoca este hook:
#   - o stdin contém as refs do push ("<local_ref> <local_sha> <remote_ref> <remote_sha>"),
#     ou seja, NÃO é um TTY - por isso "[ -t 0 ]" nunca é verdadeiro aqui;
#   - não há parâmetros de linha de comando garantidos.
# A confirmação só pode vir de:
#   1. variável de ambiente CONFIRM_PUSH=true (aprovação explícita, uso não interativo); ou
#   2. resposta "y" digitada em /dev/tty, quando existe terminal controlador.
# Qualquer outro cenário bloqueia o push (exit 1).

# Consome as refs enviadas pelo Git no stdin (evita erro de escrita/SIGPIPE no git push).
# Só faz sentido quando o stdin não é um terminal (chamada manual).
if [ ! -t 0 ]; then
  while read -r _local_ref _local_sha _remote_ref _remote_sha; do
    :
  done
fi

if [ "$CONFIRM_PUSH" = "true" ]; then
  echo "Push confirmado via CONFIRM_PUSH=true."
  exit 0
fi

answer=""
has_tty=0
# Abre (e descarta) o terminal controlador para saber se ele existe, sem poluir o stderr.
(exec </dev/tty) 2>/dev/null && has_tty=1
if [ "$has_tty" = "1" ]; then
  # -t evita travar indefinidamente quando existe tty mas ninguém responde (agentes/scripts).
  read -r -t 60 -p "Confirmar push para o remoto? (y/N) " answer < /dev/tty || answer=""
fi

case "$answer" in
  [Yy]*)
    echo "Push confirmado pelo usuário."
    exit 0
    ;;
  "")
    echo "ERRO: push bloqueado - nenhuma confirmação disponível (sem resposta no terminal e sem CONFIRM_PUSH=true)." >&2
    ;;
  *)
    echo "Push cancelado pelo usuário." >&2
    ;;
esac

echo "Para aprovar: CONFIRM_PUSH=true git push <remote> <branch>" >&2
echo "Ou execute o push em um terminal interativo e responda 'y'." >&2
exit 1
