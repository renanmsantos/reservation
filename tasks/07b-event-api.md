# Task 07b – Event & Van API Extensions (DONE)

## Objective
Disponibilizar endpoints administrativos para criação e gerenciamento de eventos, bem como transições de status das vans associadas.

## Deliverables
- `POST /api/admin/events`: cria evento com nome, data (`dd/mm/YYYY` → `yyyy-mm-dd`), status inicial e custo total.
- `GET /api/admin/events`: lista eventos com vans e seus status.
- `PATCH /api/admin/events/:id`: permite atualizar status do evento (respeitando sequência planejado → em andamento → finalizado) e custo total.
- `POST /api/admin/events/:id/vans`: associa vans ao evento, definindo status inicial (`aberta`).
- `PATCH /api/admin/events/:id/vans/:vanId`: altera status da van, dispara cálculo de rateio ao mudar para `fechada`.
- Função de serviço para cálculo de `per_passenger_cost` e atualização de `charged_amount` em reservas confirmadas.
- Atualização das rotas existentes (`/api/admin/vans`, `/api/reservations`) para aceitar `eventId` e impedir operações inválidas (ex.: reservas em vans `fechadas`).

## Acceptance Criteria
- Endpoints protegem autenticação (reutilizam `isAdminAuthenticated`).
- Validação de payloads com mensagens em português.
- Sequências de status incorretas retornam 422 com explicações claras.
- Rateio ignora passageiros waitlisted e aborta com erro se não houver confirmados.
- Testes Vitest cobrindo cenários positivos/negativos (criação, atualização, rateio, validação de status) passam em `npm test`.
