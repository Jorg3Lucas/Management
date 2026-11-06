# MIR4 Ranking Ops

Painel administrativo para sincronizar o ranking do fórum oficial do MIR4, acompanhar guerras e deslocamentos entre
servidores e controlar quem acessa cada servidor. Foco operacional em **EU11** e **EU21**, com os demais servidores
disponíveis para ativação.

## O que está implementado

- **Sincronização real do fórum** (`forum.mir4global.com/rank`): poder, posição, personagem e clã, por servidor, com
  paginação de 100 jogadores. Cada execução fica registrada em `sync_runs`.
- **Servidores**: todos os 68 servidores publicados no ranking, com chave de grupo e mundo corretas. EU11 e EU21 vêm
  habilitados e marcados como foco; qualquer outro pode ser ativado.
- **Usuários e acesso**: admin cria contas, define papel (administrador/operador) e marca servidor por servidor. O
  operador só vê ranking, guerras e edições dos servidores liberados; as consultas e as ações validam o acesso no
  servidor.
- **Edição manual**: poder atual, nome, clã, classe, nível, observações. Toda mudança entra no histórico de poder. A
  opção **proteger contra sincronização** impede que o coletor sobrescreva o registro.
- **Guerras**: registre início/fim e o servidor onde a batalha aconteceu (pode ser diferente do servidor do jogador).
  O painel soma tempo total, tempo em andamento, tempo por servidor e histórico por jogador.
- **Poder máximo**: o pico é mantido em `characters.peak_power` (sync ou edição manual) e cada variação é registrada
  em `power_history`.
- **Automação**: rodada diária de **todos os servidores às 17h (horário de Brasília)**, dentro do próprio processo
  Next; `POST /api/sync` com `Authorization: Bearer $SYNC_TOKEN` ou sessão de admin; CLI `npm run sync`.

## Stack e requisitos

- Node.js **24+** (usa o módulo nativo `node:sqlite`, sem dependência nativa).
- Next.js 16 (App Router, Server Actions), React 19, TypeScript.
- Banco SQLite local em `data/mir4.db`.

## Como rodar

```bash
npm install
cp .env.example .env.local   # ajuste ADMIN_PASSWORD e SYNC_TOKEN
npm run dev
```

Acesse `http://localhost:3000`.

No primeiro boot o banco é criado, os 68 servidores são cadastrados e um admin é gerado:

- usuário: `admin`
- senha: valor de `ADMIN_PASSWORD` (padrão `admin123`)

**Troque a senha em Usuários → admin → Redefinir senha antes de expor o painel.**

Build de produção:

```bash
npm run build
npm start
```

## Sincronização

URL usada por servidor:

```
https://forum.mir4global.com/rank?ranktype=1&worldgroupid=<grupo>&worldid=<mundo>&loaded=1&page=<n>
```

- `SYNC_MAX_PAGES` (padrão 10) limita a coleta a 1.000 jogadores por servidor (10 páginas de 100).
- `SYNC_DELAY_MS` (padrão 400) evita rajadas de requisições.
- O coletor faz upsert por `(servidor, nome)`, registra histórico quando o poder muda e atualiza o pico.
- Jogadores que saem da janela do top não são removidos: o histórico continua válido.
- Ranking vazio/em compilação é registrado como `empty`, e falha de rede/HTTP como `error`, sem apagar dados.

CLI:

```bash
npm run sync --all          # todos os 68 servidores
npm run sync                # apenas os servidores ativos (sync_enabled)
npm run sync -- EU011 EU021 # servidores específicos
```

### Rodada diária automática

O servidor Next inicia um agendador no boot (`instrumentation.ts` → `lib/scheduler.ts`) que sincroniza **todos os
servidores publicados**, habilitados ou não, **todos os dias às 17:00 de Brasília** (`America/Sao_Paulo`).

- `SYNC_DAILY_HOUR` (padrão `17`) muda o horário da rodada.
- `SYNC_DAILY_ENABLED=0` desliga a rodada automática (útil em desenvolvimento).
- Se o processo subir depois das 17h e a rodada do dia não tiver rodado, ela é executada na hora (janela de 6h).
- As execuções aparecem no histórico de `/sync` com a origem `agendado`.

Em produção o agendador só funciona com um processo Node de longa duração (`npm start`); em ambientes serverless use
um cron externo chamando a CLI ou a rota:

```
0 20 * * * cd /caminho/do/projeto && npm run sync --all   # 20:00 UTC = 17:00 em Brasília
```

## Controle de acesso

- `ADMIN`: vê todos os servidores, gerencia servidores e usuários, pode sincronizar.
- `USER`: vê somente os servidores marcados em **Usuários → servidor → Servidores liberados**; pode editar jogadores e
  registrar guerras nesses servidores.
- Sessões expiram em 7 dias; redefinir senha ou desativar a conta encerra as sessões abertas.
- Não é possível desativar/remover o próprio acesso nem ficar sem administrador ativo.

## O que o fórum não entrega

O ranking público traz posição, personagem, clã e poder. **Classe e nível** não existem nessa fonte — são editáveis
manualmente. **Guerras** também não são expostas pelo fórum: o tempo em guerra é registrado na ficha do jogador
(início/fim), inclusive quando ele luta em outro servidor. Sem esse registro manual não há como inferir a guerra pelo
ranking.

## Estrutura

```
app/            páginas e server actions (login, dashboard, ranking, guerras, servidores, usuários, sync)
components/     shell, navegação, tabelas auxiliares e formulários
lib/            banco, autenticação, consultas, sincronizador e parser do fórum
scripts/        CLI de sincronização
data/           SQLite local (fora do git)
```

## Limitações

- O parser depende do HTML do fórum; se a Wemade mudar o layout, ajuste `lib/mir4/forum.ts`.
- `node:sqlite` ainda é experimental no Node — aparece um aviso no console, sem impacto funcional.
- Sincronizar 68 servidores de uma vez gera 68 × N requisições ao fórum (dezenas de minutos com a janela de 1.000
  jogadores). É o que a rodada diária faz; controle o ritmo com `SYNC_DELAY_MS` e `SYNC_MAX_PAGES`.
- Este projeto é uma ferramenta interna e não tem vínculo com a Wemade/MIR4.
