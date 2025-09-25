# Task 07d – Testing, Seeding & Deployment Plan (DONE)

## Objective
Garantir que as novas funcionalidades de eventos sejam entregues com cobertura de testes adequada, scripts de seed/migração e instruções de rollout/rollback seguras.

## Deliverables
- Testes Vitest para serviços de cálculo de rateio, endpoints de eventos/vans e validações de status.
- Atualização/adição de fixtures para simular eventos e vans em diferentes estágios.
- Scripts `npm run db:seed:events` e documentação de uso para ambientes locais e homologação.
- Plano de rollout descrevendo ordem de aplicação: migrations → seed de evento padrão → deploy backend → deploy frontend.
- Plano de rollback listando comandos para remover dados/tabelas caso necessário.
- Documentação no README (ou `docs/events.md`) explicando como operar eventos, alterar status e interpretar rateios.

## Acceptance Criteria
- `npm test` continua passando em ambiente limpo após inclusão das novas suites.
- Seeds podem ser executados idempotentemente.
- Plano de release revisado e anexado ao PR correspondente.
- Documentação cobre perguntas frequentes (como fechar van, recalcular custo, lidar com casos sem passageiros).
