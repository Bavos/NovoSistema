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
