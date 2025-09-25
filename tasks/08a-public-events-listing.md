# Task 08a – Página Principal Apenas com Eventos em Andamento

## Objective
Atualizar a home pública para remover seções de eventos planejados/vans abertas e exibir apenas eventos com status "em andamento".

## Deliverables
- Remover blocos/headers "Planejado" e "Van Aberta" da página principal.
- Ajustar copy dos eventos para não mencionar vans nem CTAs relacionados.
- Implementar filtro no carregamento de eventos que retorne somente status "em andamento".
- Tratar layout vazio com mensagem amigável se nenhum evento estiver em andamento.

## Acceptance Criteria
- Eventos planejados ou finalizados nunca aparecem na lista pública.
- A página não renderiza componentes de vans removidos (evitar warnings/erros de dados faltantes).
- Responsividade do grid/lista mantém padrão existente.
- Teste de integração/cypress valida que apenas eventos em andamento são exibidos.
