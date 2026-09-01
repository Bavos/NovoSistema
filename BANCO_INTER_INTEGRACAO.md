# Documentação Técnica: Integração Banco Inter API v3 & Módulo Financeiro

Documentação da arquitetura, fluxo de autenticação mTLS, Cloud Functions e componentes de interface do módulo financeiro da **RH Gestão Domiciliar**.

---

## 1. Visão Geral da Arquitetura
- **Frontend (React):** Gerenciamento e faturamento via `SimulatedDashboards.tsx` com download de PDF, cópia de linha digitável, código de barras e Pix.
- **Backend (Cloud Functions v2):** `emitirBoletoInter` e `obterPdfBoletoInter` com autenticação mTLS e OAuth2 na região southamerica-east1.
- **Banco Inter API v3:** Endpoints `/oauth/v2/token`, `/cobranca/v3/cobrancas` e `/cobranca/v3/{id}/pdf`.
- **Firestore:** Coleção `faturas` para rastreamento de status em tempo real.

---

## 2. Credenciais de Segurança (Secret Manager)
- `INTER_CERT`: Certificado público digital (.crt).
- `INTER_KEY`: Chave privada digital (.key).
- `INTER_CLIENT_ID`: Client ID da aplicação no Banco Inter.
- `INTER_CLIENT_SECRET`: Client Secret OAuth2.

---

## 3. Endpoints e Cloud Functions
- **emitirBoletoInter:** Realiza o registro da cobrança via mTLS, aguarda a confirmação bancária e consolida código de barras, linha digitável, Pix e PDF.
- **obterPdfBoletoInter:** Busca sob demanda o binário Base64 do PDF oficial caso o banco ainda esteja renderizando o documento.

---

## 4. Recursos da Interface (Frontend)
- **Download Direto do PDF:** Dispara o download automático do arquivo `.pdf` no navegador.
- **Cópia Rápida:** Botões para Linha Digitável, Código de Barras (44 dígitos) e Pix Copia e Cola.
