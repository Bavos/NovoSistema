# Sistema de Gestão Vallidare

Plataforma integrada de **Gestão e Consultoria em Saúde Domiciliar (Home Care)**, desenvolvida para proporcionar controle total sobre as operações clínicas, alocação de equipes, controle de escalas, faturamento, repasse financeiro e inteligência estratégica com estrita conformidade com a LGPD.

---

## 📋 Sumário

- [Visão Geral](#-visão-geral)
- [Principais Módulos](#-principais-módulos)
- [Arquitetura e Tecnologias](#-arquitetura-e-tecnologias)
- [Segurança e Privacidade (LGPD)](#-segurança-e-privacidade-lgpd)
- [Desenvolvimento Local](#-desenvolvimento-local)
- [Build e Deploy](#-build-e-deploy)
- [Estrutura do Projeto](#-estrutura-do-projeto)

---

## 🏥 Visão Geral

O **Sistema de Gestão Vallidare** atende às demandas complexas de empresas de Home Care, conectando gestores, operadores de escala, profissionais de saúde assistenciais (médicos, enfermeiros, técnicos e cuidadores) e familiares/clientes em um ambiente seguro, ágil e em tempo real.

---

## 🚀 Principais Módulos

### 1. Pacientes e Prontuário Domiciliar
- Cadastro e prontuário completo de pacientes em assistência domiciliar.
- Gestão de graus de complexidade e dependência clínica (Baixa, Média, Alta complexidade).
- Prescrições, planos de cuidado personalizados e relatórios de evolução.
- Exportação e arquivamento seguro de prontuários em PDF.

### 2. Profissionais de Saúde e Cuidadores
- Fichas cadastrais completas com especialidade técnica, conselhos de classe (COREN, CRM, CREFITO) e dados bancários/MEI.
- Gestão e validação documental com upload e travas de integridade técnica.
- Histórico de plantões realizados, médias de avaliação e controle de disponibilidade.

### 3. Escalas e Plantões Operacionais
- Montagem visual de escalas de atendimento diurnas, noturnas e de 24h.
- Rastreamento em tempo real de escalas abertas, coberturas e faltas.
- Suporte nativo à identificação da caixinha **Curinga** para plantões de cobertura emergencial/reserva.
- Alocação inteligente por proximidade geográfica e perfil técnico do paciente.

### 4. Gestão Financeira e Integração Bancária
- **Faturamento a Pacientes/Convênios**: Emissão consolidada de faturas e controle de recebíveis.
- **Folha e Repasse a Profissionais**: Cálculo automatizado por hora/plantão, descontos e acréscimos.
- **Lançamento de Débitos e Créditos**: Registro discriminado com motivos operacionais e vínculo com plantões.
- **Integração com Banco Inter**: Geração de boletos via API oficial com autenticação mTLS (certificado digital X.509 e chave privada), conciliação e baixa automatizada.

### 5. Assistente de Inteligência Operacional (Gemini)
- Análise de indicadores estratégicos através do modelo **Gemini 3.6 Flash**.
- Processamento em linguagem natural de consultas gerenciais (ex.: cruzamento de escalas de agosto com gastos em débito/crédito, volume de plantões curinga e ranking por dia da semana).
- Respostas ricas com métricas e formatação em Markdown na própria interface do administrador.

---

## 🛠 Arquitetura e Tecnologias

- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/).
- **Backend Serverless**: [Firebase Cloud Functions (2nd Gen)](https://firebase.google.com/docs/functions) rodando em Node.js na região `southamerica-east1` (São Paulo).
- **Banco de Dados & Autenticação**: [Firebase Firestore](https://firebase.google.com/docs/firestore) em tempo real e [Firebase Authentication](https://firebase.google.com/docs/auth) com controle de acesso baseado em papéis (RBAC).
- **Inteligência Artificial**: [Google Gemini API](https://ai.google.dev/) via Google Cloud Secret Manager e Cloud Functions Callables.
- **Integrações Externas**: API de Cobrança do Banco Inter (OAuth 2.0 / mTLS).

---

## 🔒 Segurança e Privacidade (LGPD)

O sistema foi arquitetado sob o princípio de **Privacy by Design**:
- **Pseudonimização Reversível no Cliente**: Antes de qualquer envio de métricas para a IA, os nomes reais de pacientes e profissionais são substituídos localmente no navegador por identificadores opacos (`[PAC-XXX]` e `[P-XX]`). A reidratação dos nomes ocorre exclusivamente na máquina do administrador autenticado.
- **Efemeridade Total**: Nenhuma pergunta, payload operacional ou resposta gerada pela IA é gravada no banco de dados ou registrada em logs do Cloud Logging.
- **Proteção de Segredos**: Credenciais críticas (`GEMINI_API_KEY`, certificados do Banco Inter) são gerenciadas exclusivamente através do **Google Cloud Secret Manager**.

---

## 💻 Desenvolvimento Local

### Pré-requisitos
- Node.js versão 18 ou superior.
- Gerenciador de pacotes `npm`.
- Firebase CLI instalado globalmente (`npm install -g firebase-tools`).

### Passos para execução

1. Clone o repositório:
```bash
git clone https://github.com/sua-organizacao/sistema-gestao-vallidare.git
cd sistema-gestao-vallidare
```

2. Instale as dependências da aplicação web:
```bash
npm install
```

3. Instale as dependências das Cloud Functions:
```bash
cd functions
npm install
cd ..
```

4. Configure o arquivo de variáveis de ambiente do cliente (`.env`):
```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu_projeto
VITE_FIREBASE_STORAGE_BUCKET=seu_projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
VITE_FIREBASE_APP_ID=seu_app_id
```

5. Inicie o servidor local de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

---

## 🚀 Build e Deploy

### 1. Verificação de Integridade e Build do Frontend
```bash
# Validação de tipagem TypeScript
npx tsc --noEmit

# Compilação e empacotamento para produção
npm run build
```

### 2. Deploy das Cloud Functions
Configure os segredos necessários no Firebase CLI / Secret Manager:
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set INTER_CERT
firebase functions:secrets:set INTER_KEY
firebase functions:secrets:set INTER_CLIENT_ID
firebase functions:secrets:set INTER_CLIENT_SECRET
```

Em seguida, faça o deploy das funções para a região `southamerica-east1`:
```bash
firebase deploy --only functions
```

### 3. Deploy do Hosting (Frontend)
```bash
firebase deploy --only hosting
```

---

## 📁 Estrutura do Projeto

```
.
├── src/
│   ├── components/            # Componentes visuais e módulos do sistema
│   │   ├── AnaliseInteligenteOperacoes.tsx # Painel de IA com pseudonimização reversível
│   │   ├── PatientRecord.tsx  # Prontuário eletrônico do paciente
│   │   ├── SimulatedDashboards.tsx # Módulos de escalas e painéis operacionais
│   │   └── ...
│   ├── context/               # Contextos React (FirebaseContext, etc.)
│   ├── lib/                   # Clientes e inicializações (Firebase SDK)
│   ├── pages/                 # Rotas e páginas da aplicação
│   ├── services/              # Serviços de comunicação (Gemini, relatórios)
│   ├── types.ts               # Definições de tipagem TypeScript
│   └── App.tsx                # Raiz da aplicação e orquestração de navegação
├── functions/                 # Backend Serverless (Firebase Cloud Functions 2nd Gen)
│   ├── src/
│   │   └── geminiService.ts   # Função Callable de análise operacional
│   └── index.js               # Endpoints callable (Banco Inter e métricas)
├── firestore.rules            # Regras de segurança de banco de dados
├── package.json               # Dependências e scripts do frontend
└── vite.config.ts             # Configuração do bundler Vite
```

---

## 📄 Licença

Este projeto é de uso restrito e confidencial da **Vallidare Gestão e Consultoria em Saúde**. Todos os direitos reservados.
