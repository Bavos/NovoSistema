# Integração Banco Inter API v3 — Cobranças e Conciliação

Documentação técnica do módulo de consulta e conciliação de boletos bancários da API v3 do Banco Inter para o sistema RH Gestão Domiciliar.

---

## 1. Arquitetura de Segurança e mTLS

A comunicação com o Banco Inter requer autenticação mTLS (Mutual Transport Layer Security) juntamente com OAuth 2.0.

- **Segredos GCP (Secret Manager)**: As chaves e credenciais sensíveis estão armazenadas e versionadas no Google Cloud Secret Manager do projeto gen-lang-client-0242962167:
  - INTER_CERT: Certificado público (.crt) em formato PEM/Base64.
  - INTER_KEY: Chave privada (.key) em formato PEM/Base64.
  - INTER_CLIENT_ID: Identificador de aplicação OAuth.
  - INTER_CLIENT_SECRET: Segredo de aplicação OAuth.
- **Carregamento em Memória (functions/inter-api.js)**: O agente HTTPS lê diretamente as variáveis de ambiente (process.env.INTER_CERT e process.env.INTER_KEY), tratando cadeias PEM e strings Base64 sem recorrer à leitura de ficheiros temporários em disco.

---

## 2. Endpoints e Autenticação

- **Ambiente de Produção**: https://cdpj.partners.bancointer.com.br
- **Fluxo de Token**:
  - POST /oauth/v2/token
  - grant_type=client_credentials
  - scope=boleto-cobranca.read boleto-cobranca.write
- **Consulta de Cobrança**:
  - GET /cobranca/v3/cobrancas/{codigoSolicitacao}
  - Cabeçalho: Authorization: Bearer <TOKEN>

---

## 3. Normalização Multicritério de Liquidação

O backend (functions/index.js) normaliza o retorno em diferentes níveis de payload (data.cobranca ou raiz):

| Critério Avaliado | Propriedades Analisadas | Classificação no Sistema |
| :--- | :--- | :--- |
| **Liquidação / Pagamento** | situacao in [PAGO, RECEBIDO, LIQUIDADO, COMPENSADO, MARCADO_RECEBIDO] ou valorTotalRecebido > 0 ou pagamentos preenchido | pago |
| **Vencido / Cancelado** | situacao in [EXPIRADO, CANCELADO, BAIXADO] | vencido |
| **Em Aberto** | Demais estados (A_RECEBER, EMABERTO) | pendente |

---

## 4. Atualização no Prontuário (PatientRecord.tsx)

- **Sincronização Manual**: O botão "Sincronizar" invoca a função consultarStatusBoletoInter.
- **Interface**: Atualização instantânea do estado local com exibição da badge ✅ PAGO assim que a liquidação é confirmada.

---

## 5. Endpoint de Consulta Externa da Agente Vall (`consultarBoletoVall`)

- **URL**: `https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net/consultarBoletoVall`
- **Autenticação**: `Authorization: Bearer AGENT_API_TOKEN` (Chave estática compartilhada)
- **Métodos**: POST / GET
- **Entrada (JSON)**: Aceita `codigoSolicitacao` (UUID do Inter), `faturaId` (ID do Firestore) ou `nossoNumero`.
- **Saída**:
  ```json
  {
    "status": "sucesso",
    "pago": true,
    "vencido": false,
    "situacao": "RECEBIDO",
    "valorNominal": 4236,
    "valorRecebido": 4236,
    "dataPagamento": "2026-11-05",
    "origem": "BOLETO",
    "mensagem": "Pagamento liquidado com sucesso no Banco Inter."
  }
  ```
- **Conciliação Automática**: Sempre que a Vall consulta uma fatura identificada que já foi quitada, o endpoint atualiza automaticamente os campos `status: "pago"` e `dataLiquidacao` no documento do Firestore.
