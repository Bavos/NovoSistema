# Regras de Negócio

Este documento descreve as regras críticas do sistema.

## Módulo: Cadastro de Profissionais

*   **Inicialização**: O formulário de "Novo Profissional" deve abrir obrigatoriamente vazio (sem dados fictícios).
*   **CPF/RG**: Campos de texto de entrada de dados, sem máscaras automáticas que impedem edição.
*   **Lógica MEI**: Quando `temMei` for verdadeiro, o campo CNPJ é habilitado.
*   **Idade**: Deve ser calculada automaticamente com base na Data de Nascimento.

## Módulo: Gestão de Documentos (Anexos)

*   **Dynamic Rows**: A interface de documentos inicia vazia.
*   **Bloqueio de Edição**: Após um arquivo ser anexado a uma linha, o campo "Tipo de Documento" deve ficar desabilitado (`disabled`) para garantir a integridade da relação tipo-arquivo.

## Módulo: Financeiro e Emissão de Boletos (Banco Inter)

*   **Resolução do Pagador**: Na emissão de cobranças, priorizar estritamente o Nome e CPF/CNPJ informados em "DADOS DE FATURAMENTO E PAGAMENTO" (`dadosPagamento.nomePagador`, `dadosPagamento.cpfPagador`) ou responsáveis financeiros. O sistema não utiliza o CPF do paciente quando há pagador/responsável configurado.
*   **Cancelamento e Baixa Bancária**: A exclusão ou cancelamento de registros de boletos na interface/prontuário é estritamente lógico e local, desvinculando o documento no sistema. A baixa bancária definitiva ou o cancelamento formal do título junto ao Banco Inter deve ser realizado manualmente pelo operador através do Internet Banking do Banco Inter.
