# Lógica de Negócio: Plantões e Financeiro

## 1. Calendário e Escala
- O calendário deve abrir no dia atual, com o quadrado de "hoje" levemente destacado com um fundo suave.
- Os plantões renderizados no calendário devem mostrar Horário, Nome e a tag "Curinga" (se aplicável).
- O fluxo de agendamento é feito via **Modal** (janelas sobrepostas para "➕ Agendar", "✏️ Editar" ou "🗑️ Cancelar"), removendo formulários fixos na tela.

## 2. Acréscimos de Feriado (20% ou 50%)
- **Cálculo Fatura Paciente:** (Valor Base Plantão + %) + (Taxa Administração + %) + Ajuda de Custo.
- **Cálculo Folha Profissional:** (Valor Base Plantão + %) + Ajuda de Custo.
- **Regra de Ouro:** A Ajuda de Custo é blindada/imutável. Nunca sofre incidência de percentuais de acréscimo.

## 3. Gestão de Débitos (Folha de Pagamento)
- Módulo localizado na sub-aba de Faturamento.
- Salvo na coleção `debitos_profissionais` contendo data (dd/mm/aaaa), valor, profissional e motivo.
- Ao gerar a Folha de Pagamento, o sistema DEVE subtrair automaticamente a soma dos débitos do período do total a receber do profissional.
