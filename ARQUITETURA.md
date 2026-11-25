Markdown

# Arquitetura do Ecossistema — RH Gestão Domiciliar (Teco Bot + NovoSistema)

Este documento descreve a arquitetura técnica, os fluxos de integração, a camada de resiliência de IA e o armazenamento de dados entre os canais de mensageria (**Telegram** e **WhatsApp**), a **VPS Hostinger**, as **Cloud Functions** e o **Firebase**.

---

## 1. Visão Geral da Topologia

[ Usuário Gestor ]
├── Telegram (Bot API / Telegraf)
└── WhatsApp (Evolution API -> Webhook :3000)
│
▼
┌─────────────────────────────────────────────────────────────┐
│ VPS HOSTINGER (Ubuntu 26.04 LTS | Caddy Reverse Proxy | PM2) │
│ Diretório: /root/teco-bot                                   │
│                                                             │
│  1. Buffer de Álbuns (media_group_id) & Janela de 3 min     │
│  2. Extração Multimodal (Gemini 3 Flash / Flash-Lite)       │
│  3. Fallback Resiliente (pdftoppm + Tesseract PT-BR + Groq) │
│  4. Normalização Title Case & Classificação de Foto/Anexos  │
└──────────────────────────┬──────────────────────────────────┘
│ HTTPS POST (JSON + Base64)
▼
┌─────────────────────────────────────────────────────────────┐
│ GOOGLE CLOUD / FIREBASE (Projeto: gen-lang-client-0242962167)│
│                                                             │
│  ├── Cloud Functions (Node.js)                              │
│  │    ├── consultarProfissionalPorCpf                       │
│  │    └── salvarProfissionalComAnexos                       │
│  │                                                          │
│  ├── Firebase Storage (CORS habilitado)                     │
│  │    ├── profissional_fotos/{timestamp}{nome} (Avatar)    │
│  │    └── profissionais/{profId}/{timestamp}{doc} (Anexos) │
│  │                                                          │
│  ├── Cloud Firestore                                        │
│  │    └── Coleção: profissionais (dados + foto + anexos)    │
│  │                                                          │
│  └── Firebase Hosting (Painel Web React/TypeScript)         │
│       └── Profissionais.tsx (Ficha, Anexos e Crachá PNG)    │
└─────────────────────────────────────────────────────────────┘


---

## 2. Componentes da Infraestrutura

### 2.1. Servidor de Automação (`/root/teco-bot` — VPS Hostinger)
* **Sistema Operacional & Processos:** Ubuntu LTS gerenciado pelo **PM2** (`teco-bot`), protegido por proxy reverso **Caddy** com isolamento de portas.
* **Canais de Entrada:**
  * **Telegram (`bot.js`):** Biblioteca `Telegraf` com *debounce* de 10 segundos para agrupar mensagens sequenciais e suporte a álbuns (`media_group_id`).
  * **WhatsApp (`whatsapp.js`):** Servidor Express na porta `3000` (`/webhook/whatsapp`) conectado à instância `teco-whatsapp` da **Evolution API** (Modo Gestor autenticado por número administrador).
* **Utilitários Locais de Processamento:**
  * `poppler-utils` (`pdftoppm`): Conversão de documentos PDF (até 3 páginas por arquivo em 180 DPI) para imagens PNG.
  * `tesseract-ocr` (`tesseract-ocr-por`): Motor OCR local offline treinado em português (`-l por --psm 6`).

### 2.2. Backend Serverless (`~/NovoSistema/functions` — Cloud Functions)
* **`consultarProfissionalPorCpf`:** Verifica se o CPF extraído já existe no Firestore para decidir entre **Novo Cadastro** ou **Atualização Incremental** (sem duplicidade).
* **`salvarProfissionalComAnexos`:**
  * Recebe o payload estruturado, a foto de perfil e os documentos em Base64.
  * Formata o nome completo e titulares bancários em *Title Case* (`formatarNomeProprioBR`), preservando preposições em minúsculo (`da`, `das`, `de`, `do`, `dos`, `e`).
  * Realiza o upload binário para o **Firebase Storage** gerando tokens de download permanentes.
  * Persiste ou mescla os dados na coleção `profissionais` do **Cloud Firestore**.

### 2.3. Frontend Web (`~/NovoSistema/src` — Firebase Hosting)
* **Stack:** React, TypeScript, Vite e Tailwind CSS (`src/pages/Profissionais.tsx` e `src/context/FirebaseContext.tsx`).
* **Crachá Digital:** Consome o campo `foto` do documento no Firestore com `crossOrigin="anonymous"` (apoiado por regra **CORS** configurada no bucket do Storage) para permitir visualização em tela e exportação direta em PNG (`Baixar Crachá (PNG)`).

---

## 3. Fluxo Completo de Cadastro de Profissionais

1. **Recepção de Mídias:**
   * O gestor envia fotos de documentos (RG, CNH, COREN, comprovante de residência, ficha cadastral), PDFs e/ou uma foto de rosto/retrato da profissional, acompanhados do comando/legenda (ex.: `Cadastrar profissional` ou `Atualizar cadastro`).
   * Caso as mídias sejam enviadas sem legenda antes do comando de texto, o bot recupera os arquivos do buffer recente (janela de 3 minutos).
2. **Extração Inteligente e Blindagem contra Indisponibilidade:**
   * **Camada 1 (Multimodal Nativo):** O módulo `cadastro_profissional.js` envia as imagens/PDFs para a cadeia ativa do Gemini (`gemini-3-flash-preview` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-flash-lite-latest` $\rightarrow$ `gemini-3.1-flash-lite-preview`) com retentativas progressivas.
   * **Camada 2 (Fallback OCR + LLM):** Se todos os modelos Gemini retornarem `503 UNAVAILABLE` ou `429 RESOURCE_EXHAUSTED`, o sistema aciona automaticamente o `pdftoppm` + `tesseract` localmente na VPS e envia o texto consolidado para a API do **Groq** (`llama-3.3-70b-versatile`) retornar o JSON estruturado.
3. **Classificação de Foto de Perfil vs. Documentos:**
   * Arquivos identificados como retrato/selfie recebem a categoria **`Foto de Perfil`**.
   * Documentos recebem categorias padronizadas: `Identidade`, `Comprovante de residência`, `Vacinas`, `Certificado`, `Formulário` ou `Outros`.
4. **Prévia e Confirmação Humana (*Human-in-the-Loop*):**
   * O Teco envia uma prévia formatada no chat informando dados pessoais, dados bancários, status de detecção da foto de perfil e se o registro será criado ou atualizado.
   * Somente após a confirmação explícita (`Ok`) o bot dispara a requisição HTTPS para a Cloud Function.
5. **Persistência no Firebase:**
   * **Foto de Perfil** $\rightarrow$ salva em `profissional_fotos/{timestamp}_{nome}` e vinculada ao campo `foto` no Firestore (alimentando o avatar e o crachá).
   * **Documentos** $\rightarrow$ salvos em `profissionais/{profId}/{timestamp}_{nome}` e adicionados ao array `anexos` do Firestore.

---

## 4. Integrações Secundárias do Teco Bot

| Módulo | API / Serviço | Finalidade Operacional |
| :--- | :--- | :--- |
| **Agenda & E-mail** | Google Calendar & Gmail API | Gestão de compromissos e disparo de e-mails oficiais via `rhgestaodomiciliar@gmail.com` após confirmação. |
| **Rotas & Logística** | Google Maps Platform | Cálculo de distância e tempo de deslocamento entre cuidadoras e residências de pacientes. |
| **Áudio** | Groq (`whisper-large-v3`) | Transcrição automática de mensagens de voz enviadas no Telegram ou WhatsApp. |
| **Rotinas Agendadas** | Node Cron (`America/Sao_Paulo`) | Relatório matinal diário (09:00) de profissionais curingas disponíveis. |
| **Memória Persistente** | `MEMORY.md` (local na VPS) | Armazenamento de diretrizes operacionais e regras de negócio permanentes do gestor. |

---

## 5. Segurança e Governança

## 5. Segurança e Governança

* **Controle de Acesso:** O bot responde exclusivamente aos IDs/números autorizados nas variáveis de ambiente (`.env` com `ADMIN_CHAT_ID` e número do gestor).
* **Proteção de Credenciais:** Chaves de API (`GEMINI_API_KEY`, `GROQ_API_KEY`, credenciais OAuth2 e tokens Evolution) permanecem isoladas no `.env` da VPS (ignoradas pelo `.gitignore`).
* **CORS no Storage:** Configurado no bucket do Firebase Storage para permitir requisições `GET`/`HEAD` do painel web sem bloqueio de renderização no canvas do crachá digital.
