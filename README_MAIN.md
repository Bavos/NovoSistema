# RH Cuidado Domiciliar - Sistema de Gestão
**Descrição:** Plataforma SaaS para gestão de pacientes, profissionais (cuidadores/enfermeiros), agendamento de plantões e cálculos financeiros (faturamento e folha de pagamento).

## Regras do Dashboard (Visão Executiva)
O dashboard inicial é estritamente operacional e focado no "hoje".
- **Cabeçalho:** Deve conter apenas a Logo (sem texto ao lado), o texto institucional "RH Cuidado Domiciliar" e a saudação "Bem-vindo, {nome do utilizador logado}".
- **Aniversariantes do Dia:** Query diária cruzando dia/mês atual nas coleções `pacientes` e `profissionais`. Exibir lista limpa; se vazio, mostrar "Nenhum aniversariante no dia de hoje".
- **Débitos do Dia:** Query na coleção `debitos_profissionais` filtrando pela data de hoje. Exibir em formato de lista (Nome, Data, Valor, Motivo).
- **Proibições:** Não exibir cards de KPIs genéricos (total de pacientes, plantões do mês) nem gráficos de rosca na tela inicial. Foco 100% na operação diária.
