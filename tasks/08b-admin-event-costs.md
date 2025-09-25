# Task 08b – Custos de Evento Derivados das Vans

## Objective
Eliminar o campo de custo total no cadastro de eventos do admin e recalcular o valor com base na soma das vans associadas.

## Deliverables
- Remover input de custo total do formulário/criação/edição de eventos.
- Atualizar modelo/API para persistir `totalCost` como soma dos custos das vans.
- Exibir no admin o valor total calculado em tempo real conforme vans são adicionadas/alteradas.
- Garantir que remover/adicionar vans atualize imediatamente o total exibido.

## Acceptance Criteria
- Criação/edição de evento sem custo direto continua funcionando e salva corretamente.
- Total do evento mostrado no admin corresponde à soma dos custos de todas as vans associadas.
- Mudanças no custo individual de uma van atualizam total sem reload.
- Testes unitários/integrados confirmam cálculo e atualização do campo derivado.
