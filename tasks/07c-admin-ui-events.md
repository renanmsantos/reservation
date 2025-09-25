# Task 07c – Admin UI for Events & Vans (DONE)

## Objective
Atualizar o painel administrativo para permitir gerenciamento visual de eventos, incluindo criação, associação de vans, atualização de status e exibição de custos e rateios.

## Deliverables
- Seção "Eventos" no painel com lista de cards/tabela contendo nome, data, status, custo total e ações.
- Modal ou drawer para criar/editar evento (nome, data `dd/mm/YYYY`, status, custo total).
- Interface para associar vans existentes ao evento, alterar status (`aberta`, `fechada`, `em espera`) e visualizar custo por passageiro calculado.
- Indicadores visuais (badges, ícones) para estados de evento e vans.
- Exibição do valor por passageiro para vans fechadas, com tooltip explicando cálculo.
- Textos e labels em português, alinhados com estilo minimalista atual.

## Acceptance Criteria
- Fluxo completo: criar evento → associar vans → fechar van → visualizar rateio.
- UI impede alterações quando evento está `finalizado` (somente leitura).
- Atualizações refletem em tempo real sem recarregar página (reuso de hooks/fetchers existentes).
- Respeita tema dark/shadcn e layout responsivo.
- Testes de componentes/cypress (quando disponível) cobrindo caminhos principais.
