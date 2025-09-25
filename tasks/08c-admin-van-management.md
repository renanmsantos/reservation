# Task 08c – Gestão de Vans: Custo, Status e Pagamentos

## Objective
Aprimorar a administração de vans com custo obrigatório, status automático e checklist de pagamento para cada passageiro.

## Deliverables
- Campo obrigatório de custo por van no admin, com persistência via API/modelo.
- Regra automática de status: `aberta` quando há vagas, `cheia` ao atingir capacidade, ação manual "Fechar Van" para marcar `fechada`.
- Cálculo de valor por integrante (custo ÷ passageiros confirmados) com exibição na UI administrativa.
- Checklist por passageiro para marcar pagamento confirmado ou pendente, salvando estado.
- Mensagem clara ao tentar calcular rateio sem passageiros confirmados.

## Acceptance Criteria
- Vans sem custo definido não podem ser salvas/atualizadas.
- Mudanças na capacidade ou reservas atualizam status automaticamente entre `aberta` e `cheia`.
- Botão de fechar van muda status para `fechada` e impede novas reservas.
- Rateio mostra valor por integrante e persiste checklist após reload.
- Testes cobrem transições de status, cálculo de rateio e checklist de pagamento.
