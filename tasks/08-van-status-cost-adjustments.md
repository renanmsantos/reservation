# Task 08 – Ajustes de Vans na Página Principal e Admin

## Objective
Atualizar a experiência do passageiro e do administrador para refletir somente eventos em andamento, remover referências a vans abertas/planned, e centralizar o cálculo de custos por van. Esta iniciativa está detalhada nas subtasks 08a (home pública), 08b (custos de eventos no admin) e 08c (gestão de vans e pagamentos).

## Deliverables
- Página principal sem seções "Planejado" e "Van Aberta", exibindo apenas eventos em andamento.
- Eventos listados na página principal sem blocos ou badges de vans; remover contadores, CTA ou textos específicos de vans.
- Lógica de filtro garantindo que somente eventos com status "em andamento" apareçam na listagem pública.
- Admin sem campo de "custo total" no formulário de evento; cálculo derivado da soma dos custos das vans associadas.
- Campo obrigatório de custo por van no admin, persistido no modelo e API (criação/edição de vans).
- Status automático da van: `aberta` enquanto houver vagas, `cheia` quando atingir capacidade, ação explícita de "Fechar Van" para trocar para `fechada`.
- Cálculo e exibição do valor por integrante (custo total da van ÷ passageiros confirmados) na UI administrativa da van.
- Checklist no admin para marcar passageiros com pagamento confirmado ou pendente, persistindo estado.

## Acceptance Criteria
- Ao carregar a página principal, eventos planejados ou finalizados não aparecem em nenhuma seção.
- Ao remover vans de um evento em andamento, a página principal continua funcional sem erros de dados ausentes.
- Admin recalcula e mostra o custo total do evento como soma das vans; mudanças individuais refletem imediatamente.
- Ajustes de status de van respeitam capacidade e botão manual de fechamento; não é possível reabrir sem fluxo definido.
- Cálculo de rateio falha com mensagem clara se não houver passageiros confirmados.
- Checklist de pagamento salva estados individuais e persiste em reload; exportável via API existente se aplicável.
- Testes e2e/unitários atualizados ou novos cobrem fluxo de listagem pública, criação/edição de vans com custo e checklist.
