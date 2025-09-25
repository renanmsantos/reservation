# Task 07 – Event Scheduling & Cost Sharing (DONE)

## Objective
Expand the reservation system to suport event management: organizers devem cadastrar eventos com data específica, vincular vans e controlar o ciclo de vida (planejado, em andamento, finalizado). Cada van dentro do evento precisa de status próprio (aberta, fechada, em espera) e, quando fechada, gerar automaticamente o valor por passageiro com base no custo total do evento.

## Deliverables
- Modelagem de banco (migrations Supabase) adicionando tabela de eventos, relacionamento evento ↔ vans e colunas de status e custo pertinentes.
- API endpoints ou rotas existentes estendidas para criar/listar/atualizar eventos, incluindo alteração de status das vans dentro do evento.
- Cálculo persistido de `custo_por_passageiro` quando uma van for marcada como `fechada`, redistribuindo com base nos passageiros confirmados.
- Atualizações de UI admin para cadastrar eventos, atribuir vans, editar status e visualizar custos (total e por passageiro).
- Cobertura de testes (unit/integration) garantindo transições válidas de status e rateio correto, com mensagens em português.
- Documentação no README explicando fluxo de eventos, status disponíveis e regras de rateio.

## Implementation Plan
1. **Database & Supabase**
   - Criar tabela `events` (`id`, `name`, `event_date`, `status`, `total_cost`, timestamps).
   - Adicionar tabela pivot `event_vans` ligando evento ↔ van, contendo status da van no evento (`aberta`, `fechada`, `em_espera`) e campo `per_passenger_cost`.
   - Migration para adicionar FK `event_id` opcional em `reservations` (facilita queries agregadas) e colunas auxiliares (`closed_at`).
2. **API Layer**
   - Nova rota REST (`/api/admin/events`) com métodos para criar, listar, atualizar status e anexar vans.
   - Ajustar rotas de vans/reservas para aceitar `eventId` e validar estados (ex.: impedir fechar van com waitlist pendente sem confirmação).
   - Serviço para cálculo de rateio disparado ao fechar van (trigger via API ou Supabase function).
3. **Admin UI**
   - Tela de listagem + formulário de criação/edição de eventos com seletor de data `dd/mm/YYYY` e status.
   - Wizard/section para anexar vans existentes ao evento, alterar status e exibir custo por passageiro.
   - Indicadores visuais (badges) para estados de evento e vans.
4. **Testing & Tooling**
   - Testes Vitest para rotas (criação de evento, mudança de status, cálculo de rateio com casos de borda).
   - Tests de componentes para novos formulários/listagens.
   - Scripts/helpers para seed de evento em ambientes locais.

## Data Migration Strategy
- Migration inicial atribui todas as vans atuais a um evento "Padrão" com status `em andamento`, data = data atual, custo total = 0.
- Atualizar registros existentes de reservas com `event_id` correspondente ao evento padrão.
- Criar script utilitário (`npm run db:seed:events`) para migrar dados em produção, permitindo customizar nome/data/status inicial.
- Documentar procedimento de rollback (drop colunas/tabelas novas e remover FKs) caso necessário.
- Validar performance em ambientes com grande número de reservas (adicionar índices em `event_vans.event_id`, `reservations.event_id`).

## Acceptance Criteria
- Organizadores conseguem criar evento informando nome, data (`dd/mm/YYYY`), custo total e status inicial `planejado`.
- Vans podem ser associadas/desassociadas de um evento, mantendo lista de passageiros e permitindo alterar seu status para `aberta`, `fechada` ou `em espera` (com validação de transições).
- Ao definir uma van como `fechada`, o sistema calcula e persiste o custo por passageiro confirmado; se houver zero confirmados, o sistema retorna erro amigável.
- Eventos mudam de status apenas seguindo a ordem planejado → em andamento → finalizado e impedem edições após finalização (exceto histórico/leitura).
- Painel admin exibe custo total do evento, status e valor individual por passageiro nas vans fechadas.
- Testes automatizados cobrindo criação de evento, mudança de status e cálculo de rateio passam em `npm test`.
