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
