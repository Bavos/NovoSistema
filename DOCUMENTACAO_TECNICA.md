# Documentação Técnica do Sistema - CuidarHome S.A.

Este documento tem como objetivo apresentar a arquitetura, regras de negócio e estrutura técnica do sistema corporativo **CuidarHome**, projetado em conformidade com as regras full-stack modernas (React/Vite + TypeScript + Firebase).

---

## 1. Arquitetura Geral do Sistema

O sistema foi arquitetado como uma aplicação **SPA (Single-Page Application)** de alto desempenho utilizando **TypeScript**, estruturada sob frameworks modernos de estilização e transição.

### Tecnologias Utilizadas:
- **Framework Principal:** React 18+ com compilador Vite
- **Estilização Utilitária:** Tailwind CSS
- **Biblioteca de Ícones:** `lucide-react` (ícones nativos importados individualmente)
- **Engine de Animação:** `motion` (importado via `motion/react`)
- **Gestão de Banco de Dados:** Cloud Firestore (Firebase)

---

## 2. Estrutura de Pastas e Diretórios Coorporativa

Conforme planejamento de escala coorporativo, a estrutura de código-fonte em `/src` segue o seguinte mapeamento lógico de responsabilidades:

```
/src
  ├── assets/          # Imagens institucionais, logotipos e ilustrações
  ├── components/      # Botões, Modais, Sidebar, Tabelas de listagem e containers reutilizáveis
  ├── context/         # Estados globais unificados (ex: contexto de autenticação, filtros e preferências)
  ├── hooks/           # Custom hooks para isolamento de requisições e persistência de dados (ex: usePacientes.ts)
  ├── pages/           # Arquitetura física de telas autossuficientes do layout principal
  ├── services/        # Configuração do Firebase Client, autenticação e funções de CRUD do Firestore
  ├── types.ts         # Regras corporativas de tipagem do TypeScript (Interfaces, Schemas e Enums)
  ├── mockData.ts      # Dados de simulação técnica em desenvolvimento offline para testes unitários
  ├── main.tsx         # Ponto de entrada de renderização do ReactDOM
  └── index.css        # Import de fontes corporativas (@theme - Inter/Outfit/JetBrains Mono)
```

---

## 3. Regras de Negócio e Casos de Uso Críticos

### 3.1 Entidades Principais e Schemas (Types)

Dentre as interfaces centrais tipadas no arquivo base, destacam-se:

```typescript
// Entidade de Escala de Plantão
export interface Plantao {
  id: string;
  data: string;          // Exemplo: '2026-06-12'
  profissional: string;   // Exemplo: 'Maria Santos'
  sigla: string;          // Exemplo: 'MS'
  horario: string;        // Exemplo: '07:00 - 19:00 (12h)'
  status: 'Confirmado' | 'Cancelado' | 'Pendente';
  motivoCancelamento?: string;
}

// Entidade de Identificação do Paciente
export interface Paciente {
  id: string;
  nome: string;
  cpf: string;
  nascimento: string;
  idade: number;
  responsavel: string;
  telefoneContato: string;
  grauComplexidade: 'Grau I' | 'Grau II' | 'Grau III';
  status: 'Ativo' | 'Desativado';
  motivoDesativacao?: string;
  endereco: {
    cep: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
  };
  infoMedica: {
    diabetico: boolean;
    hipertenso: boolean;
    alergias: string;
    remediosControlados: string;
    historicoClinico: string;
  };
  planoAtendimento: string; // Instruções e cuidados especiais
  escalaDiaria: Plantao[];
}
```

### 3.2 Lógica do Coordenador de Escalas (Home Care)
1. **Regras de Cancelamento:** Plantões agendados não podem ser removidos fisicamente por motivos de auditoria de prontuários. Ao selecionar cancelar, deve ser fornecida uma justificativa predefinida do escopo clínico, afetando o inventário financeiro futuro e o envio automático de avisos ao aplicativo dos profissionais.
2. **Grau de Dependência Visual:** Classificação que determina a periodicidade dos técnicos em enfermagem (`Grau I` a `Grau III`). Representado visualmente por barras progressivas semânticas.

---

## 4. Integração Segura com a API do Banco Inter (Pix, Boletos e Pagamentos em Lote)

### 4.1 Arquitetura de Segurança (Zero Frontend Secret Exposure)
O sistema foi concebido sob rigoroso padrão de segurança bancária:
- **Nenhum certificado mTLS (`.crt` ou `.key`) ou segredo de autenticação (`Client Secret`) é exposto ou trafega no Frontend (SPA).**
- Todas as transações com a API do Banco Inter são processadas através de **Firebase Cloud Functions (Backend Serverless)** protegidas por autenticação via Firebase Auth.
- Os certificados digitais e credenciais OAuth 2.0 são injetados exclusivamente no ambiente seguro de execução via **Google Cloud Secret Manager**.

### 4.2 Localização dos Módulos no Código
1. **Cloud Functions Seguras (Backend):**
   - `/functions/src/index.ts`: Funções Callables tipadas `gerarCobrancaInter` (Boletos v3 com Pix Copia e Cola) e `processarFolhaInter` (Lotes de pagamentos Pix e TED).
   - `/functions/inter-api.js` e `/functions/index.js`: Handlers mTLS com suporte a rotas HTTP diretas (`processarFolhaInterHttp`).
2. **Serviço Client-side (Frontend):**
   - `/src/services/interService.ts`: Módulo com as funções `emitirBoletoInter()` e `processarFolhaInter()`, com suporte a chamadas diretas via Cloud Function, fallback local e simulação Sandbox (Modo de Testes).
3. **Interface de Usuário:**
   - `/src/components/SimulatedDashboards.tsx`: Aba *Financeiro -> Folha de Pagamento* e *Emissão de Cobrança*, integrado aos serviços de emissão e liquidação.

### 4.3 Como Configurar as Credenciais no Ambiente de Produção
Para habilitar a comunicação real com a API do Banco Inter no Firebase:
```bash
# 1. Definir o Client ID da aplicação no Banco Inter
firebase secrets:set INTER_CLIENT_ID

# 2. Definir o Client Secret da aplicação
firebase secrets:set INTER_CLIENT_SECRET

# 3. Importar o Certificado mTLS (arquivo .crt ou .pem)
firebase secrets:set INTER_CERT < caminho/para/certificado.crt

# 4. Importar a Chave Privada mTLS (arquivo .key)
firebase secrets:set INTER_KEY < caminho/para/chave.key

# 5. Fazer o deploy das Cloud Functions
firebase deploy --only functions
```

