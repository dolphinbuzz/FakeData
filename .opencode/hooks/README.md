# Hooks do FakeData

Este diretório guarda **dois mecanismos diferentes e independentes**:

1. **Gate de push do agente (OpenCode V2)** — regras de permissão em `opencode.jsonc` que fazem o OpenCode pedir confirmação antes de rodar comandos `git push` pelo shell.
2. **Hooks de Git reais** — scripts em `.opencode/hooks/<hook>/*.sh`, executados pelos shims de `.opencode/hooks/git/` e instalados de forma **opt-in** via `core.hooksPath`.

> O OpenCode V2 **não executa** nenhum script deste diretório: não existe campo `hooks` na configuração do V2 (a seção existia por engano em `opencode.jsonc` e foi removida) e não existem comandos `opencode hook install/run/list`.

## 1. Gate de push no OpenCode V2 (`permissions`)

Em `opencode.jsonc`:

```jsonc
"permissions": [
  { "action": "shell", "resource": "git push *", "effect": "ask" },
  { "action": "shell", "resource": "*git push*", "effect": "ask" },
  { "action": "shell", "resource": "*git -C * push*", "effect": "ask" },
  { "action": "shell", "resource": "*git -c * push*", "effect": "ask" },
  { "action": "shell", "resource": "*git.exe*push*", "effect": "ask" },
  { "action": "shell", "resource": "*git.cmd*push*", "effect": "ask" }
]
```

- `"effect": "ask"` faz o cliente pedir aprovação antes de executar o comando; em `permissions` a **última regra que casa vence**.
- O `resource` é comparado com a string crua do comando produzida pelo scanner de shell, usando curingas de valor inteiro: `*` = zero ou mais caracteres (inclusive `/`), `?` = um caractere. Um pattern terminado em `" *"` também casa o comando sem argumentos — por isso `"git push *"` cobre `git push`, `git push origin main`, `git push --force-with-lease`, etc.
- `"*git push*"` cobre comandos prefixados/compostos, que o scanner pode reportar como uma única string, como `$env:CONFIRM_PUSH='true'; git push origin main` (PowerShell) ou `cd repo && git push`.
- As regras com `-C`/`-c`/`.exe`/`.cmd` cobrem variações que **não** começam com `git push` (`git -C repo push`, `git -c k=v push`, `C:\...\git.exe push`). Sem regra que case, vale a política base do V2 (`"*"`/`"*"` → `allow`), por isso as variações são declaradas explicitamente.
- Referência: <https://opencode.ai/v2/docs/permissions>.

**Limites conhecidos:**

- Esse gate vale para comandos executados **pelo agente dentro do OpenCode**. Um `git push` digitado manualmente pelo humano no terminal não passa por ele — para isso existe o hook de Git da seção 2.
- `opencode --auto` (auto-aprova permissões que não sejam `deny`) neutraliza o `ask`. Aprovações salvas ("Allow always") também pulam o prompt nas execuções seguintes. Ou seja: o `permissions` é uma barreira do fluxo interativo padrão, não de execução autônoma.
- O gate efetivo contra push não autorizado do agente é o `permissions`; por isso a evolução estrutural recomendada é "ask por padrão + allowlist estreita" (comentário em `opencode.jsonc`).

## 2. Hooks de Git reais (instalação opt-in)

Instalar:

```bash
git config core.hooksPath .opencode/hooks/git
```

Desinstalar (volta a usar `.git/hooks`):

```bash
git config --unset core.hooksPath
```

Notas:

- **Nada é instalado automaticamente.** Enquanto o `git config` acima não for executado, os scripts deste diretório não rodam em `git commit`/`git push`/`git merge`.
- Em POSIX/macOS, os arquivos precisam do bit de execução: `chmod +x .opencode/hooks/git/*`. No índice deste repositório eles já estão registrados como executáveis (`git update-index --chmod=+x`), então um clone preserva o modo correto.
- A quebra de linha (LF) destes scripts está fixada no `.gitattributes` (`eol=lf`): no Windows, `core.autocrlf=true` converteria os arquivos para CRLF e quebraria o bash (shebang, caminhos e linhas como `exit 1`).
- No Windows/Git Bash, o Git for Windows executa os shims com o próprio bash, sem depender do chmod.
- `core.hooksPath` **substitui toda a pasta de hooks**: hooks não fornecidos aqui (ex.: `commit-msg`, `prepare-commit-msg`) deixam de rodar enquanto a configuração estiver ativa.
- O hook de Git é **defesa em profundidade**, não uma barreira inviolável: `git push --no-verify`, `git commit --no-verify` e `git -c core.hooksPath=... push` pulam os hooks. Isso é inerente ao Git — quem tem acesso ao terminal sempre pode contornar. Ele cobre o uso normal; o gate do agente é o `permissions` da seção 1.
- Cada shim (`pre-commit`, `pre-push`, `post-merge`) roda, em ordem alfabética, todos os `.sh` da pasta correspondente e para no primeiro que falhar (`exit != 0`). O shim também fixa o CWD na raiz do repositório, então funciona mesmo se invocado de outro diretório.

## 3. Scripts disponíveis

| Script | O que faz |
| --- | --- |
| `pre-commit/01-lint.sh` | Lint tolerante: `npm run lint --if-present`. Nesta branch não existe script `lint`, então passa sem erro (nenhum `lint` é criado no `package.json`). |
| `pre-commit/02-test-changed.sh` | Roda `npx vitest run --changed` quando há arquivos de `src/**/*.js` ou `tests/**/*.js` no stage; senão, pula. |
| `pre-push/00-confirm-push.sh` | Gate de confirmação: libera só com `CONFIRM_PUSH=true` ou resposta `y` em `/dev/tty`; caso contrário bloqueia (`exit 1`). |
| `pre-push/01-full-test.sh` | `npm run test:coverage`. |
| `pre-push/02-version-check.sh` | Compara o `version` de `manifest.json` e `package.json` e falha se divergirem. |
| `post-merge/01-install-deps.sh` | Roda `npm ci` se o merge alterou `package.json`. |
| `post-merge/02-clear-cache.sh` | Remove o diretório `coverage/`. |

### Confirmação de push (`pre-push/00-confirm-push.sh`)

No `pre-push` o stdin contém as refs do push (é um pipe, **não** um TTY — `[ -t 0 ]` é sempre falso nesse contexto), então o script primeiro consome as refs e depois decide:

1. `CONFIRM_PUSH=true` no ambiente → aprova (`exit 0`);
2. existe terminal controlador (`/dev/tty` acessível) → pergunta `y/N` (espera até 60s) e aborta (`exit 1`) se a resposta não começar com `y`/`Y`;
3. nenhum dos dois → `exit 1` com a mensagem de como aprovar.

Fluxo não interativo (CI ou agente):

```bash
CONFIRM_PUSH=true git push origin fix/a1-a2-followups
```

`CONFIRM_PUSH=true` é uma **aprovação explícita por ambiente** (bypass self-service previsto para CI e para quando o humano autoriza o agente). O gate efetivo contra push não autorizado do agente é o `permissions` da seção 1; o hook existe para o uso humano no terminal e como defesa em profundidade.

## 4. O que não existe neste repositório

- Campo `hooks` em `opencode.jsonc`: **não é suportado pelo OpenCode V2** e foi removido.
- Comandos `opencode hook install`, `opencode hook run`, `opencode hook list`: inexistentes.
- `.opencode/config/hooks.yaml`: nunca existiu.
- `.opencode/team/**`: nunca existiu (os scripts de sessão referenciam caminhos legados).
- `session-start/` e `session-end/`: **não têm mecanismo de execução no OpenCode V2**. Nenhum evento do V2 dispara esses scripts e eles também não estão ligados aos shims de Git; servem apenas como referência e podem ser rodados manualmente (`bash .opencode/hooks/session-start/01-load-context.sh`).
