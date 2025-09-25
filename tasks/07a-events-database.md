# Task 07a – Events & Vans Schema Migration (DONE)

## Objective
Modelar a camada de dados para suportar eventos vinculados às vans, incluindo status e campos de custo que serão usados pelo rateio.

## Deliverables
- Migration Supabase criando tabela `events` com colunas: `id` (uuid), `name`, `event_date` (`date`), `status` (`planejado|em_andamento|finalizado`), `total_cost` (`numeric`), `created_at`, `updated_at`.
- Tabela associativa `event_vans` (`id`, `event_id`, `van_id`, `status` = `aberta|fechada|em_espera`, `per_passenger_cost`, `closed_at`, timestamps) com FKs e índices (`event_id`, `van_id`).
- Alteração na tabela `vans` para armazenar `default_event_id` opcional quando criada sem contexto.
- Alteração na tabela `reservations` adicionando `event_id` (FK) e `charged_amount` (`numeric`).
- Script de migração inicial atribuindo todas as vans existentes a um evento "Padrão" e preenchendo `event_id` nas reservas atuais.

## Acceptance Criteria
- `supabase/schema.sql` atualizado contém toda a estrutura nova e pode ser aplicada sem erros em banco limpo.
- Índices garantem que consultas por `event_id` em `event_vans` e `reservations` sejam eficientes.
- Script de migração (`scripts/apply-schema.ts` ou equivalente) popula o evento padrão sem quebrar restrições existentes.
- `npm run db:apply` roda com sucesso em ambiente local.
