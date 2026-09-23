# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.4.0] - 2026-09-22

### Adicionado
- **Assistente de Inteligência Operacional (Gemini 3.6 Flash)**:
  - Módulo interativo para análise executiva e suporte a tomada de decisão em gestão de home care.
  - Atualização do modelo analítico para o `gemini-3.6-flash` via Cloud Functions Callable (`analisarMetricasHomeCare`).
  - Suporte ao cruzamento avançado de escalas mensais com lançamentos financeiros de débito e crédito.
  - Reconhecimento automático e contagem de plantões marcados com a caixinha **Curinga** (coberturas e reservas operacionais).
  - Análise estatística de dias da semana em ordem crescente de demandas de plantões e percentuais relativos ao mês.

### Segurança & Privacidade (LGPD)
- **Pseudonimização Reversível no Cliente (Privacy by Design)**:
  - Mapeamento temporário e volátil em memória no navegador antes do envio de métricas operacionais.
  - Substituição de dados pessoais de profissionais e pacientes por códigos opacos (`[P-XX]` e `[PAC-XXX]`).
  - Reversão local ("de-para") realizada estritamente na máquina do administrador antes da renderização na interface.
  - Algoritmo de substituição com ordenação decrescente de chaves por comprimento (`b.length - a.length`), prevenindo substituições parciais ou truncamentos de códigos compostos (ex.: `[PAC-016]` e `[PAC-01]`).
  - Varredura exaustiva de identificadores de escalas (`idProfissional`, `cuidadorId`, `funcionarioId`) e resolução a partir da base completa de colaboradores.
- **Efemeridade Estrita**:
  - Eliminação de qualquer gravação ou persistência de conversas, perguntas, métricas ou respostas geradas pela IA no Firestore.
  - Supressão de logs com dados operacionais sensíveis no Cloud Logging e console do Firebase.
- **Google Cloud Secret Manager**:
  - Centralização segura da chave de acesso da API Gemini (`GEMINI_API_KEY`) sem exposição em variáveis públicas de ambiente.

---

## [2.3.0] - 2026-08-15

### Adicionado
- **Módulo Financeiro com Integração ao Banco Inter**:
  - Emissão automatizada de boletos de cobrança via API v2 oficial do Banco Inter.
  - Conexão segura utilizando autenticação mTLS com certificados digitais (`INTER_CERT` e `INTER_KEY`) gerenciados via Secret Manager.
  - Conciliação bancária automática com consulta de status de liquidação e registro de créditos.
  - Sistema discriminado de lançamento de débitos operacionais e repasses vinculados a escalas e profissionais.

### Modificado
- Otimização das consultas de faturas e consolidação de métricas financeiras mensais.

---

## [2.2.0] - 2026-07-20

### Adicionado
- **Prontuário Eletrônico Domiciliar**:
  - Registro detalhado de evolução clínica de pacientes, planos de cuidado e diagnósticos.
  - Classificação de pacientes por grau de complexidade assistencial (Baixa, Média, Alta).
  - Exportação e arquivamento seguro de prontuários clínicos em formato PDF.

### Corrigido
- **Clean Forms & Integridade de Cadastro**:
  - Remoção total de dados fictícios ou estáticos da inicialização dos cadastros de profissionais e pacientes.
  - Substituição de placeholders ambíguos por textos informativos e instrucionais.
  - Trava de integridade no cadastro de documentação técnica: bloqueio do campo de tipo de documento após realização de upload de arquivo.

---

## [2.1.0] - 2026-06-10

### Adicionado
- Módulo de Escalas e Alocação de Plantões com visualização em calendário semanal e mensal.
- Painel de Gestão de Acessos com controle granular de perfis (Administrador, Coordenador, Financeiro, Operador).
- Auditoria de alterações em prontuários e agendamentos.

---

## [2.0.0] - 2026-05-01

### Adicionado
- Lançamento da arquitetura moderna do Sistema de Gestão Vallidare com React 18, Vite, TypeScript e Tailwind CSS.
- Migração de backend para Firebase Firestore e Cloud Functions 2nd Gen na região `southamerica-east1`.
