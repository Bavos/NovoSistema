# CuidarHome S.A. - Portal de Escalas & Prontuários (Home Care)

O **CuidarHome** é uma plataforma corporativa robusta dedicada à gestão integrada de home care, acompanhamento de prontuários clínicos e controle em tempo real de escalas diárias de plantões técnicos.

Esta aplicação foi desenvolvida sob o conceito visual **Geometric Balance**, focado em alto contraste, legibilidade técnica extrema, transições lineares e excelente acomodação de dados de nível clínico.

---

## 🚀 Principais Funcionalidades

- **⚙️ Escala Diária Inteligente (Sub-tab Agendamento):** Veja plantões semanais e diários, edite atribuições técnicas de enfermagem e realize o fluxo seguro de cancelamento com as 7 justificativas regulamentadas de saúde operacional.
- **📄 Prontuário Clínico Detalhado:** Painel dividido em seções para histórico médico, medicações, alergias, plano de cuidados detalhados e controle de complexidade (Graus I, II e III).
- **🔒 Segurança por Inativação:** Fluxo de arquivamento provisório de pacientes com trava total de formulários, inputs em somente leitura (`readonly`) e telas cinzas informativas sob auditorias históricas.
- **🔎 Painéis de Integração e Monitoria:** Dashboards visuais simulando o painel de faturamento financeiro global, gerenciamento contratual de profissionais terceirizados de saúde e controle de auditorias corporativas.
- **📱 Interface Colapsável Eficiente:** Menu lateral com animações fluidas via `motion` economizando espaço crucial de tela para laptops e tablets clínicos.

---

## 🛠️ Detalhes Teóricos da Arquitetura Comercial

A estrutura de código desta aplicação foi organizada seguindo as melhores práticas globais de modularidade no ecossistema React/TypeScript:

- **/src/components:** Todos os módulos estruturantes da interface (`Sidebar`, `PatientList`, `PatientRecord`, `SimulatedDashboards` e `TopHeader`).
- **/src/context:** Centraliza o fluxo de estado compartilhado e filtros globais.
- **/src/types.ts:** Preserva a tipagem corporativa contra efeitos colaterais de compilação de metadados.
- **/src/mockData.ts:** Fonte local e persistente (utilizando `localStorage`) para simulação offline instantânea.

---

## 📦 Inicialização e Desenvolvimento Local

Para executar o ecossistema CuidarHome em seu ambiente local:

### 1. Clonando e instalando dependências
```bash
npm install
```

### 2. Rodando o servidor de desenvolvimento
```bash
npm run dev
```
O servidor de desenvolvimento inicializará por padrão na porta interna associada `3000`.

### 3. Rodando o Linter e Compilação
Antes de cada envio para homologação, confirme as integridades estruturais:
```bash
npm run lint
npm run build
```

---

## 📄 Licença e Uso
Desenvolvido exclusivamente para as operações integradas da rede de Home Care **CuidarHome S.A.** Todos os direitos reservados.
