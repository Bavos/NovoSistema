# Arquitetura do Módulo Financeiro - RH Gestão Domiciliar

Este documento descreve a arquitetura atual do módulo financeiro da aplicação **RH Gestão Domiciliar**, detalha o funcionamento interno e consumo de dados no componente `SimulatedDashboards.tsx`, e apresenta o roteiro técnico para a transição completa de um modelo híbrido/simulado para um fluxo 100% real baseado no **Cloud Firestore** e **Cloud Functions**, mantendo rigorosamente as políticas de controle de acesso (RBAC) e segurança médica e bancária.

---

## 1. Visão Geral da Arquitetura

O módulo financeiro é responsável pela apuração de serviços prestados, faturamento de assistidos (pacientes), fechamento de folha de pagamento de cuidadores e integração bancária com o Banco Inter (emissão de boletos registrados, QR Code Pix dinâmico e liquidação de transferências em lote).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAMADA DE INTERFACE (UI)                          │
│                                                                             │
│  [SimulatedDashboards.tsx]                                                  │
│   ├── Faturas de Pacientes (Apurador de Período + Serviços Extras)          │
│   ├── Folha de Pagamento (Plantões Realizados - Débitos/Curingas)           │
│   ├── Emissão de Boletos / Cobranças Pix (API Banco Inter v3)               │
│   └── Processamento de Lote (PIX / TED para Colaboradores)                  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                 ┌─────────────────────┴─────────────────────┐
                 ▼                                           ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│   ESTADO GLOBAL & PERSISTÊNCIA  │       │     SERVIÇOS DE INTEGRAÇÃO      │
│                                 │       │                                 │
│  [FirebaseContext.tsx]          │       │  [interService.ts]              │
│   ├── `faturasPacientes`        │       │   ├── `emitirBoletoInter()`     │
│   ├── `folhasPagamento`         │       │   └── `processarFolhaInter()`   │
│   ├── `debitosProfissionais`    │       │                                 │
│   ├── `plantoes`                │       └────────────────┬────────────────┘
│   └── `pacientes`/`profissionais│                        │
└────────────────┬────────────────┘                        │
                 │                                         │
                 ▼                                         ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       FIREBASE FIRESTORE        │       │    CLOUD FUNCTIONS (BACKEND)    │
│                                 │       │                                 │
│  Coleções:                      │       │  [functions/src/index.ts]       │
│   • `faturas_pacientes`         │       │   • `gerarCobrancaInter`        │
│   • `folhas_pagamento`          │       │   • `processarFolhaInter`       │
│   • `debitos_profissionais`     │       │   (mTLS + OAuth 2.0 + Secrets)  │
│   • `logs_auditoria`            │       └─────────────────────────────────┘
└─────────────────────────────────┘
```

---

## 2. Como o `SimulatedDashboards.tsx` Consome os Dados

O componente `SimulatedDashboards.tsx` atua atualmente como uma central analítica e operacional unificada. Ele interage com o ecossistema da seguinte forma:

### 2.1. Ingestão e Reatividade em Tempo Real
O componente consome o hook `useFirebase()`, que mantém listeners ativos (`onSnapshot`) com o Firestore para as seguintes entidades:
* **`plantoes`**: Base de cálculo para apuração de dias trabalhados, horas, valores diurnos/noturnos e status dos plantões (Realizado, Confirmado, Cancelado).
* **`pacientes` e `profissionais`**: Metadados de cobrança, dados bancários (Chave Pix, agência, conta) e contratos de home care.
* **`debitosProfissionais`**: Lançamentos de descontos (Passagens, Curingas, Adiantamentos) a serem deduzidos na folha.
* **`faturasPacientes`**: Registros de faturas fechadas ou em aberto, incluindo o congelamento de plantões apurados e serviços extras.
* **`folhasPagamento`**: Histórico de recibos e holerites emitidos para os cuidadores.

### 2.2. Motor de Apuração e Fechamento
Ao selecionar um paciente ou profissional e definir o período apurado (Data Início e Data Fim):
1. **Filtro de Plantões:** O sistema filtra os plantões do profissional/paciente compreendidos no intervalo, computando o valor bruto de cada plantão.
2. **Cálculo de Descontos e Acréscimos:**
   - No caso de **Profissionais**, busca os débitos pendentes na coleção `debitos_profissionais` vinculados ao profissional e calcula:
     $$\text{Valor Líquido} = \sum \text{Plantões} - \sum \text{Débitos Pendentes}$$
   - No caso de **Pacientes**, soma os valores dos plantões e os lançamentos da sub-lista `servicosExtras` (ex.: medicamentos, insumos, horas adicionais).
3. **Persistência do Fechamento:**
   - A função `addFaturaPaciente()` ou `addFolhaPagamento()` persiste o documento estruturado no Firestore com um *snapshot* (`plantoesCongelados`), garantindo que alterações futuras nas escalas não alterem retroativamente relatórios já fechados.

### 2.3. Integração com Banco Inter
O componente aciona o serviço client-side `src/services/interService.ts`:
* **Emissão de Boleto / Pix Copia e Cola:** Aciona a Cloud Function `gerarCobrancaInter` transmitindo apenas os dados do pagador e valor (sem trafegar certificados no navegador).
* **Pagamento em Lote:** Aciona `processarFolhaInter` enviando a lista de colaboradores com suas chaves Pix ou contas bancárias para liquidação em lote.

---

## 3. Mecanismo de Alternância: Modo Simulação / Sandbox vs. Modo Real

O sistema conta com uma chave global **`isTestMode`** (Modo de Testes / Sandbox):

| Característica | Modo de Testes (Sandbox Ativo) | Modo Real (Produção) |
| :--- | :--- | :--- |
| **Emissão de Boletos** | Gera linha digitável e código Pix simulados com validação de formato matemático imediato, sem gerar custos bancários. | Conecta via mTLS às APIs v2/v3 do Banco Inter via Cloud Function, gerando boleto registrado oficial no CIP/Bacen. |
| **Folha de Pagamento** | Simula liquidação das transferências e retorna *EndToEndId* fictício para validação do fluxo operacional da equipe. | Dispara ordens reais de pagamento Pix / TED debitando da conta PJ do Banco Inter. |
| **Persistência Firestore** | Os documentos de faturas e folhas continuam salvos com marcação de teste ou podem ser purgados sem afetar o balanço contábil real. | Registros gravados no Firestore com logs de auditoria imutáveis (`logs_auditoria`). |

---

## 4. Plano de Transição: Da Simulação para o Fluxo Real em Firestore

Para consolidar o módulo financeiro em uma arquitetura 100% modular e desvinculada do componente de simulação, siga o roteiro em 4 etapas:

### Etapa 1: Desacoplamento da Interface em Módulos Dedicados
Substituir a visualização monolítica em `SimulatedDashboards.tsx` por páginas e componentes isolados na árvore do projeto:
```
src/
├── pages/
│   └── Financeiro/
│       ├── index.tsx                  # Dashboard principal de métricas financeiras
│       ├── FaturamentoPacientes.tsx   # Gestão de Faturas e Emissão de Boletos
│       ├── FolhaColaboradores.tsx     # Apuração de Plantões e Fechamento de Folha
│       └── ConciliacaoBancaria.tsx    # Extrato e conciliação de liquidações Pix/Boleto
```

### Etapa 2: Coleções Firestore e Modelos de Dados em Produção
Garantir a persistência normalizada nas seguintes coleções estruturadas:

1. **`faturas_pacientes`**:
   ```typescript
   {
     id: string;
     idPaciente: string;
     nomePaciente: string;
     numeroFatura: string;
     periodoApurado: { inicio: string; fim: string };
     valorTotal: number;
     status: 'Aberta' | 'Emitida' | 'Paga' | 'Cancelada';
     dadosBoleto?: {
       nossoNumero: string;
       codigoBarra: string;
       linhaDigitavel: string;
       pixCopiaECola: string;
       dataVencimento: string;
     };
     plantoesCongelados: Array<{ idPlantao: string; data: string; valor: number }>;
     servicosExtras?: Array<{ descricao: string; valor: number }>;
     criadoEm: Timestamp;
     atualizadoEm: Timestamp;
   }
   ```

2. **`folhas_pagamento`**:
   ```typescript
   {
     id: string;
     idProfissional: string;
     nomeProfissional: string;
     periodoApurado: { inicio: string; fim: string };
     valorTotalPlantoes: number;
     valorTotalDebitos: number;
     valorLiquidoReceber: number;
     status: 'Pendente' | 'Processando' | 'Paga' | 'Erro';
     dadosTransferencia?: {
       tipo: 'PIX' | 'TED';
       endToEndId?: string;
       comprovanteUrl?: string;
       pagoEm?: Timestamp;
     };
     historicoDebitos: Array<{ idDebito: string; motivo: string; valor: number }>;
     plantoesCongelados: Array<{ idPlantao: string; data: string; valor: number }>;
     criadoEm: Timestamp;
   }
   ```

3. **`debitos_profissionais`**:
   Atualizar o campo `status` de `'pendente'` para `'descontado'` e associar o `folhaIdVinculada` no momento em que a folha é fechada.

### Etapa 3: Webhooks de Notificação Bancária (Banco Inter)
Implementar uma Cloud Function HTTPS (`interWebhookHandler`) para escutar callbacks de liquidação de boletos e confirmação de transferências Pix:
* **Evento `BOLETO_PAGO`**: Atualiza o status da `fatura_paciente` para `'Paga'` e alimenta o fluxo de caixa.
* **Evento `PIX_LIQUIDADO`**: Atualiza a `folha_pagamento` correspondente para `'Paga'`.

---

## 5. Regras de Acesso (RBAC) e Segurança Firestore

Para preservar o sigilo bancário e atender às normas de compliance e LGPD, as regras de segurança do Firestore (`firestore.rules`) devem restringir rigorosamente as coleções financeiras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // Perfil Financeiro ou Diretoria (Acesso total às operações financeiras)
    function isFinancialOrAdmin() {
      return isAuthenticated() && (
        request.auth.token.role == 'financeiro' ||
        request.auth.token.role == 'diretoria' ||
        request.auth.token.role == 'admin'
      );
    }

    // Regras para Faturas de Pacientes
    match /faturas_pacientes/{faturaId} {
      allow read: if isAuthenticated();
      allow create, update: if isFinancialOrAdmin();
      allow delete: if isFinancialOrAdmin();
    }

    // Regras para Folhas de Pagamento de Colaboradores
    match /folhas_pagamento/{folhaId} {
      // O profissional pode visualizar apenas a sua própria folha de pagamento
      allow read: if isFinancialOrAdmin() || 
        (isAuthenticated() && resource.data.idProfissional == request.auth.uid);
      allow write: if isFinancialOrAdmin();
    }

    // Regras para Débitos de Profissionais (Curingas, Passagens)
    match /debitos_profissionais/{debitoId} {
      allow read: if isFinancialOrAdmin() ||
        (isAuthenticated() && resource.data.idProfissional == request.auth.uid);
      allow create, update, delete: if isFinancialOrAdmin();
    }

    // Logs de Auditoria Financeira (Imutáveis)
    match /logs_auditoria/{logId} {
      allow read: if isFinancialOrAdmin();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Ninguém pode alterar ou apagar logs
    }
  }
}
```

---

## 6. Sumário de Recomendações Técnicas

1. **Gestão de Segredos:** Mantenha os certificados do Banco Inter e as chaves de API exclusivamente no **Google Secret Manager**, sem jamais transitar chaves privadas pelo frontend.
2. **Imutabilidade de Fechamento:** Mantenha a prática de congelamento de plantões (`plantoesCongelados`) nos documentos de faturas e folhas para garantir integridade contábil retroativa.
3. **Auditoria Contínua:** Toda ação de pagamento em lote ou emissão de cobrança deve registrar um evento em `logs_auditoria` contendo o UID do operador, data/hora e identificador bancário retornado.
