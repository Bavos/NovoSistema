# Guia de Padrões, Regras e UI — RH Gestão Domiciliar

## 1. Identidade Visual e Barra Operacional (PatientRecord)
A barra de controles no prontuário do paciente é dividida em dois níveis de ação com botões arredondados (`rounded-lg`), elevação suave no hover e microinterações:

### Linha 1 — Rotina Operacional
- **+ Agendar**: `bg-sky-600 hover:bg-sky-700` (Azul Céu)
- **+ Serviço Extra**: `bg-blue-600 hover:bg-blue-700` (Azul Royal)
- **Prévia Financeira**: `bg-purple-600 hover:bg-purple-700` (Roxo)
- **Concluir**: `bg-indigo-600 hover:bg-indigo-700` (Índigo)
- **Reabrir**: `bg-amber-600 hover:bg-amber-700` (Âmbar)
- **Exclusão**: `bg-rose-600 hover:bg-rose-700` (Vermelho Rosé) — Confirmação direta com 1 clique, sem trava de digitação.

### Linha 2 — Documentos e Faturamento
- **Excel (.xlsx)**: `bg-amber-500 hover:bg-amber-600` (Laranja)
- **Word (.docx)**: `bg-blue-600 hover:bg-blue-700` (Azul Clássico)
- **Baixar Fatura (PDF)**: `bg-teal-600 hover:bg-teal-700` (Verde Petróleo)
- **Gerar Boleto**: `bg-emerald-600 hover:bg-emerald-700` (Verde Esmeralda)
- **Gerar Fatura**: `bg-emerald-700 hover:bg-emerald-800` (Verde Escuro)

---

## 2. Regras de Escala Automática e Divisão de Plantões

### Padrões de Recorrência
- **12 x 36**: Trabalha 1 dia, folga 1 dia (incremento de +2 dias).
- **24 x 48**: Trabalha 1 dia, folga 2 dias (incremento de +3 dias).
- **48 x 48**: Trabalha 2 dias seguidos, folga 2 dias (incremento de +4 dias).

### Regra Operacional de Plantões 48h
- Todo bloco de 48h é **sempre gravado como 2 plantões independentes de 24h consecutivos** (`cycle: 1` e `cycle: 2`), vinculados por um `idAgendamentoPai`.
- **Objetivo**: Permitir substituição individual de profissional em caso de falta/emergência em um dos dias sem quebrar o faturamento do outro.
- **Ajuda de Custo (Transporte) em 48h**:
  - `Dia 1 (cycle: 1)`: Transporte integral + Alimentação.
  - `Dia 2 (cycle: 2)`: Transporte zerado (R$ 0,00) por padrão, a menos que o checkbox de exceção da casa esteja ativado no modal.

---

## 3. Conciliação Bancária com Banco Inter API

- **Sincronização em Tempo Real**: Chamada direta à Cloud Function `consultarStatusBoletoInter` (região `southamerica-east1`).
- **Estado Reativo**:
  - `pago` ou `recebido`: Badge verde `✅ PAGO`, persistido no Firestore e ocultando botão de Pix.
  - `vencido`: Badge vermelho `⛔ VENCIDO`.
  - `pendente`: Badge âmbar `⏳ EM ABERTO`.
- **Identificadores**: Utiliza prioritariamente `codigoSolicitacao`, com fallback para `nossoNumero`.
