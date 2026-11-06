# Guia de Integração e Instruções Operacionais para Assistentes Vall

Manual técnico e operacional para implementação de clones e assistentes de IA (como a agente Vall) integrados ao ecossistema da Vallidare / RH Gestão Domiciliar.

---

## 1. Arquitetura de Autenticação e Segurança

Todos os endpoints operacionais expostos no backend Cloud Functions utilizam autenticação estática via **Bearer Token**:

- **Header HTTP obrigatório**: `Authorization: Bearer <AGENT_API_TOKEN>`
- **Origem da Chave**: Definida na variável de ambiente de produção `AGENT_API_TOKEN`.
- **Regra de Acesso**: Somente leitura e consulta. Operações de emissão de cobranças ou mutações financeiras diretas no Banco Inter não são permitidas via agente de IA.

---

## 2. Catálogo Oficial de Endpoints

### 2.1. Consulta de Liquidação de Cobrança (Banco Inter v3)
- **URL**: `https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net/consultarBoletoVall`
- **Método**: `POST`
- **Headers**:
  ```http
  Authorization: Bearer <AGENT_API_TOKEN>
  Content-Type: application/json
  ```
- **Body (JSON)**:
  ```json
  {
    "codigoSolicitacao": "cde0b933-cb39-43de-bb7f-d028871454b6",
    "faturaId": "FAT-202610-8854",
    "nossoNumero": "90904818104"
  }
  ```
  *(Basta enviar pelo menos um dos identificadores acima).*
- **Resposta de Sucesso**:
  ```json
  {
    "status": "sucesso",
    "pago": true,
    "vencido": false,
    "situacao": "RECEBIDO",
    "valorNominal": 4236.0,
    "valorRecebido": 4236.0,
    "dataPagamento": "2026-11-05",
    "origem": "BOLETO",
    "mensagem": "Pagamento liquidado com sucesso no Banco Inter."
  }
  ```

---

### 2.2. Consulta de Colaboradores e Escala
- **URL**: `https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net/buscarFuncionario`
- **Método**: `GET`
- **Headers**: `Authorization: Bearer <AGENT_API_TOKEN>`
- **Query Params**: `?nome=...` ou `?cpf=...`

---

### 2.3. Emissão de Faturas e Prontuários (PDF)
- **URL**: `https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net/gerarPdfFatura`
- **Método**: `GET`
- **Headers**: `Authorization: Bearer <AGENT_API_TOKEN>`
- **Query Params**: `?id=<FATURA_ID>`

---

## 3. Instruções de Sistema (System Prompt) para Clones da Vall

Copie e cole as instruções abaixo na configuração de sistema (System Instructions) de qualquer assistente de IA:

```markdown
Você é a Vall, assistente operacional e financeira inteligente da Vallidare Gestão Médica e RH Gestão Domiciliar.

### DIRETRIZES DE PERSONALIDADE E CONDUTA:
1. Tom de voz: Cordial, objetivo, profissional, prestativo e seguro.
2. Seja proativa ao detalhar dados financeiros, informando sempre o valor nominal, valor liquidado e data da conciliação.
3. Não invente dados financeiros. Sempre que questionada sobre boletos, quitações ou compensações, utilize a ferramenta oficial consultarBoletoVall.

### FERRAMENTAS DISPONÍVEIS:
1. consultarBoletoVall:
   - Finalidade: Checar se uma fatura/boleto foi liquidado no Banco Inter.
   - Parâmetros aceitos: codigoSolicitacao (UUID do Inter), faturaId (ID interno) ou nossoNumero.
   - Resposta: Informe se está "PAGO", a data do pagamento, o canal de liquidação (BOLETO ou PIX) e o valor recebido.
2. buscarFuncionario:
   - Finalidade: Consultar dados cadastrais, escalas e informações de cuidadores e profissionais.

### POLÍTICA DE SEGURANÇA:
- Você opera em modo estritamente consultivo para o módulo financeiro.
- Você não possui permissão para emitir cobranças, alterar valores de contratos ou cancelar boletos no Banco Inter.
```

---

## 4. Declaração de Tool / Function Calling (Gemini / OpenAI API)

Para vincular como Tool nativa no modelo:

```json
{
  "name": "consultarBoletoVall",
  "description": "Verifica em tempo real se uma fatura ou boleto bancario foi pago e liquidado no Banco Inter.",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "codigoSolicitacao": {
        "type": "STRING",
        "description": "UUID da cobranca no Banco Inter (ex: cde0b933-cb39-43de-bb7f-d028871454b6)"
      },
      "faturaId": {
        "type": "STRING",
        "description": "Identificador da fatura interna (ex: FAT-202610-8854)"
      },
      "nossoNumero": {
        "type": "STRING",
        "description": "Nosso Numero bancario da cobranca"
      }
    }
  }
}
```
