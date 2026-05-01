## Integração com Telegram — Alertas e Relatórios da Carteira

Adicionar um bot do Telegram para você receber **alertas inteligentes** e **relatórios** da sua carteira diretamente no app, além de poder pedir informações sob demanda enviando comandos.

---

### O que você vai poder fazer no Telegram

**Receber automaticamente:**
- Alertas inteligentes (mesmos do painel: dividendo silencioso, meta mensal, etc.) assim que forem gerados
- Relatório semanal da IA (quando o cron rodar) entregue no seu chat

**Pedir sob demanda (comandos):**
- `/start` — vincula seu chat do Telegram à sua conta do app (via código)
- `/patrimonio` — saldo total atual, variação, rentabilidade
- `/dividendos` — dividendos recebidos no mês + progresso da meta
- `/alertas` — últimos alertas não lidos
- `/relatorio` — gera e devolve um novo relatório de IA na hora
- `/top` e `/piores` — 5 melhores/piores ativos por variação
- `/ajuda` — lista de comandos

---

### Como funciona (passo a passo para você)

1. Eu configuro a conexão com o **conector Telegram da Lovable** (você só clica e autoriza — não precisa criar bot manualmente nem mexer com tokens).
2. No app, em **Configurações**, aparece um botão "Conectar Telegram" que mostra um código de 6 dígitos.
3. Você abre o bot no Telegram, manda `/start 123456`, e pronto — sua conta fica vinculada.
4. A partir daí, alertas e relatórios chegam automaticamente, e você pode usar os comandos a qualquer momento.

---

### Detalhes técnicos

**Banco de dados (nova migration):**
- `telegram_links` — vincula `user_id` ↔ `chat_id` (com RLS por usuário)
- `telegram_link_codes` — códigos temporários de 6 dígitos com expiração de 10 min
- `telegram_bot_state` — singleton com `update_offset` para o long polling
- `telegram_outbox` — fila de mensagens pendentes (alertas/relatórios) para entrega assíncrona

**Conector:** uso do `standard_connectors--connect` com `connector_id: telegram` (gateway OAuth da Lovable, sem precisar de token manual seu).

**Edge Functions novas:**
- `telegram-poll` — roda a cada 1 min via pg_cron, faz long polling do `getUpdates` por ~55s, processa comandos recebidos e responde
- `telegram-send` — envia mensagens (usado pelos alertas/relatórios e pelos handlers de comando)
- `telegram-link-code` — gera código de vinculação para o usuário logado

**Edge Functions atualizadas:**
- `compute-alerts` — após inserir alertas novos, enfileira no `telegram_outbox` para os usuários vinculados
- `weekly-ai-report` — após gerar relatório, envia resumo + link no Telegram

**Frontend:**
- Nova seção em **Configurações** (ou card na home) com:
  - Status da vinculação (vinculado / não vinculado)
  - Botão "Gerar código de vinculação" → mostra código + instrução `/start <código>` no @SeuBot
  - Botão "Desvincular"
  - Toggle "Receber alertas no Telegram" e "Receber relatórios semanais no Telegram"

**Agendamento (pg_cron):**
- `poll-telegram-updates` rodando a cada minuto invocando `telegram-poll`

**Segurança:**
- RLS em todas as tabelas novas (só o próprio usuário vê seus links/códigos)
- Códigos de vinculação expiram em 10 min e são invalidados após uso
- Comandos só respondem se o `chat_id` estiver vinculado a um `user_id` (exceto `/start` e `/ajuda`)
- Validação de input com Zod em todas as edge functions

---

### Ordem de implementação

1. Conectar o conector Telegram
2. Criar migration com as 4 tabelas + RLS
3. Criar edge functions `telegram-send`, `telegram-poll`, `telegram-link-code`
4. Agendar cron job `poll-telegram-updates`
5. Atualizar `compute-alerts` e `weekly-ai-report` para empurrar mensagens
6. Criar UI de vinculação em Configurações
7. Testar fluxo end-to-end (vincular → comando → alerta automático)
