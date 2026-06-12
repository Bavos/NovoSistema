# Layout e Diretrizes de UX - CuidarHome S.A.

Este documento detalha o conceito visual, decisões estéticas e diretrizes de Experiência do Usuário (UX/UI) adotadas no desenvolvimento do sistema corporativo **CuidarHome**, em conformidade com o tema **Geometric Balance**.

---

## 1. Identidade Visual & Conceito Estético

O design baseia-se na estabilidade, legibilidade técnica e equilíbrio geométrico. Linhas finas, contrastes precisos e espaçamentos simétricos criam uma interface operacional segura para coordenadores de home care.

### 🎨 Paleta de Cores (Tailwind CSS)
- **Fundo Principal (Canvas):** `#F3F4F6` (Cinza claro e neutro) - Fornece alto contraste sem cansar as vistas durante longas jornadas operacionais.
- **Menu Lateral (Sidebar):** `#0F172A` (Slate Navy escuro) - Oferece uma âncora visual sólida à esquerda do sistema, simbolizando sobriedade e segurança.
- **Destaque Primário:** `bg-blue-600` e derivados correspondentes (Azul Cirúrgico/Clínico) - Indica caminhos críticos e ações principais (como Salvar, Novo Paciente e Tabs Ativas).
- **Alerta de Inativação / Erro:** `bg-red-50`, `border-red-500`, `text-rose-700` - Sinalizadores críticos com baixa saturação para garantir legibilidade e conforto visual.
- **Sucesso / Confirmação:** `bg-emerald-50`, `text-emerald-700` - Utilizados em feedbacks de prontidão clínica e badges ativos.

### ✍️ Tipografia
- **Fontes Importadas:** *Inter*, *Outfit* e *JetBrains Mono*.
- **Cabeçalhos e Destaques:** *Outfit* ou *Inter* em negrito forte (`font-sans font-extrabold tracking-tight`) para criar hierarquia imediata.
- **Dados Técnicos / Metadados:** *JetBrains Mono* (`font-mono text-xs`) para códigos identificadores, CPF, horas de início e datas de plantão.

---

## 2. Padrões de Layout e Componentização

O sistema foi estruturado de forma a evitar sobrecarga de informação, dividindo as telas em áreas geométricas funcionais bem demarcadas.

### 2.1 Sidebar Colapsável (Menu Lateral)
- **Comportamento Padrão:** O menu inicia recolhido para maximizar a área de trabalho do usuário.
- **Interação:** Expande suavemente ao passar o mouse (Hover) ou clicar no botão hambúrguer, com transição fluida garantida via animadores nativos do `motion`.
- **Efeito Visual:** Sombra suave (`shadow-2xl`) de forma a criar distinção de profundidade sob a área de conteúdo.

### 2.2 Top Header (Barra Superior)
- Mantém a barra de busca unificada de foco global e controle da conta ativa com dropdown rápido para segurança do usuário.
- Altura rígida de 64px (`h-16`) para manter consistência estrutural.

### 2.3 Listagem de Pacientes (Tabela)
- **Linhas Limpas:** Alternância suave de coloração em linhas pares/ímpares para facilitar o acompanhamento visual.
- **Badges de Status:** Badges proeminentes com círculos indicativos animados para status `Ativo` versus `Desativado`, minimizando falhas de interpretação clínica.

### 2.4 Prontuário do Paciente (Split-Screen)
- **Card Fixo de Identificação (Esquerda):** Painel que acompanha visualmente todos os passos, garantindo que o operador saiba exatamente qual paciente está editando de forma estática.
- **Pills Dinâmicas (Direita):** Transições rápidas entre sub-abas clínicas (`Geral`, `Endereço`, `Info Médica`, `Plano`, `Agendamento`).

---

## 3. Diretrizes Críticas de UX Implementadas

### A. Fluxo de Cancelamento de Plantão Sem Exclusão
O cancelamento de uma escala na sub-aba **Agendamento** em hipótese alguma apaga o registro do banco de dados. Um modal sobreposto força a escolha exclusiva dentro de um de 7 motivos regulamentados (`Sem condução`, `Doente`, `Cansaço`, etc.), alterando o status para uma linha riscada sob baixa opacidade com tarja vermelha identificadora.

### B. Bloqueio Completo para Pacientes Desativados
Caso um paciente esteja desativado no Firebase:
- Uma barra de aviso em gradiente vermelho se estabelece no topo do prontuário com o motivo histórico.
- Todos os campos de entrada, seletores de grau de dependência e campos de texto livre recebem propriedades `readonly` ou `disabled`.
- O botão salvar desparece, sendo substituído por um fluxo imediato de reativação clínica.
