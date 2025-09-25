# Eventos e vans

Este documento resume como operar o módulo de eventos implementado no painel administrativo.

## Estrutura de dados

- `events`
  - `status`: `planejado`, `em_andamento`, `finalizado`.
  - `total_cost`: valor total do evento (BRL) utilizado para ratear custo por passageiro.
- `event_vans`
  - Registro que vincula uma van a um evento.
  - `status`: `aberta`, `fechada`, `em_espera`.
  - `per_passenger_cost`: valor aplicável aos passageiros confirmados quando a van é fechada.
- `reservations`
  - Possui `event_id` e `charged_amount` (valor cobrado do passageiro quando a van é fechada).

## Fluxo recomendado

1. **Aplicar schema**: `npm run db:apply`.
2. **Seed inicial**: `npm run db:seed:events` cria o evento "Evento Padrão" e atribui vans/reservas existentes.
3. **Criar novos eventos** no painel `/admin` informando nome, data e custo.
4. **Associar vans** ao evento. O status inicial é `aberta` (pode ser ajustado para `em_espera`).
5. **Fechar a van** quando a operação terminar. O sistema calcula `per_passenger_cost` = `total_cost` / passageiros confirmados e grava em `reservations.charged_amount`.
6. **Finalizar o evento** quando todas as vans estiverem fechadas. Eventos finalizados não aceitam novas associações ou alterações.

## Reprocessamento

- Para recalcular o rateio, reabra a van (`aberta` ou `em_espera`) e feche novamente.
- Se o evento for finalizado por engano, ajuste o status via API (respeitando as regras de transição) antes de reabrir qualquer van.

## Rollout e rollback

- **Rollout**: `npm run db:apply` → `npm run db:seed:events` → deploy backend → deploy frontend.
- **Rollback**: `DROP TABLE event_vans; DROP TABLE events;` remover colunas `event_id` e `charged_amount` de `reservations` e `default_event_id` de `vans` (ver histórico de migrations).

## Observabilidade

Use o painel administrativo para conferir custo por passageiro e status. Logs operacionais continuam em `reservation_events`.
