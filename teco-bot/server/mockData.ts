/**
 * Banco de dados simulado em memória para a RH Gestão Domiciliar.
 * Permite que o assistente Teco responda com precisão a consultas de escalas,
 * cadastros e faturamento mesmo quando a VPN da empresa estiver offline.
 */

export interface Escala {
  id: string;
  data: string; // YYYY-MM-DD
  data_br: string; // DD/MM/AAAA
  turno: string; // ex: "07:00 - 19:00 (12h)"
  paciente_id: string;
  paciente_nome: string;
  profissional_id: string;
  profissional_nome: string;
  categoria: 'Enfermeiro(a)' | 'Técnico(a) de Enfermagem' | 'Fisioterapeuta' | 'Fonoaudiólogo(a)' | 'Cuidador(a)';
  status: 'confirmado' | 'pendente' | 'cancelado';
  observacoes?: string;
}

export interface Cadastro {
  id: string;
  tipo: 'paciente' | 'profissional' | 'convenio';
  nome: string;
  documento?: string;
  status: 'ativo' | 'inativo' | 'em_analise';
  detalhes: Record<string, string | number | boolean>;
}

export interface Faturamento {
  id: string;
  competencia: string; // YYYY-MM
  competencia_br: string; // MM/AAAA
  convenio: string;
  quantidade_atendimentos: number;
  valor_total_bruto: number;
  valor_glosado: number;
  valor_liquido: number;
  status_pagamento: 'pago' | 'pendente' | 'em_auditoria' | 'glosado';
  data_prevista_pagamento: string;
  nota_fiscal?: string;
}

export const MOCK_ESCALAS: Escala[] = [
  {
    id: "ESC-2026-001",
    data: "2026-11-06",
    data_br: "06/11/2026",
    turno: "07:00 - 19:00 (Diurno 12h)",
    paciente_id: "PAC-101",
    paciente_nome: "Dona Helena Silveira",
    profissional_id: "PRO-501",
    profissional_nome: "Juliana Mendes",
    categoria: "Técnico(a) de Enfermagem",
    status: "confirmado",
    observacoes: "Administração de medicação via SNE e aspiração traqueal."
  },
  {
    id: "ESC-2026-002",
    data: "2026-11-06",
    data_br: "06/11/2026",
    turno: "19:00 - 07:00 (Noturno 12h)",
    paciente_id: "PAC-101",
    paciente_nome: "Dona Helena Silveira",
    profissional_id: "PRO-502",
    profissional_nome: "Marcos Vinicius Lima",
    categoria: "Técnico(a) de Enfermagem",
    status: "confirmado",
    observacoes: "Monitoramento hemodinâmico noturno e troca de decúbito."
  },
  {
    id: "ESC-2026-003",
    data: "2026-11-06",
    data_br: "06/11/2026",
    turno: "14:00 - 15:00 (Sessão 1h)",
    paciente_id: "PAC-102",
    paciente_nome: "Carlos Alberto Santos",
    profissional_id: "PRO-503",
    profissional_nome: "Dra. Beatriz Fontana",
    categoria: "Fisioterapeuta",
    status: "confirmado",
    observacoes: "Fisioterapia motora e respiratória domiciliar."
  },
  {
    id: "ESC-2026-004",
    data: "2026-11-07",
    data_br: "07/11/2026",
    turno: "07:00 - 19:00 (Diurno 12h)",
    paciente_id: "PAC-102",
    paciente_nome: "Carlos Alberto Santos",
    profissional_id: "PRO-504",
    profissional_nome: "Patrícia Albuquerque",
    categoria: "Enfermeiro(a)",
    status: "confirmado",
    observacoes: "Curativo de lesão por pressão (Grau 2) com hidrogel."
  },
  {
    id: "ESC-2026-005",
    data: "2026-11-07",
    data_br: "07/11/2026",
    turno: "08:00 - 20:00 (Plantão 12h)",
    paciente_id: "PAC-103",
    paciente_nome: "Maria Clara Ribeiro",
    profissional_id: "PRO-505",
    profissional_nome: "Ricardo Azevedo",
    categoria: "Cuidador(a)",
    status: "pendente",
    observacoes: "Aguardando confirmação do profissional substituto."
  },
  {
    id: "ESC-2026-006",
    data: "2026-11-08",
    data_br: "08/11/2026",
    turno: "10:00 - 11:00 (Sessão 1h)",
    paciente_id: "PAC-101",
    paciente_nome: "Dona Helena Silveira",
    profissional_id: "PRO-506",
    profissional_nome: "Camila Nogueira",
    categoria: "Fonoaudiólogo(a)",
    status: "confirmado",
    observacoes: "Reabilitação de deglutição e fono pós-AVC."
  },
  {
    id: "ESC-2026-007",
    data: "2026-11-05",
    data_br: "05/11/2026",
    turno: "19:00 - 07:00 (Noturno 12h)",
    paciente_id: "PAC-103",
    paciente_nome: "Maria Clara Ribeiro",
    profissional_id: "PRO-502",
    profissional_nome: "Marcos Vinicius Lima",
    categoria: "Técnico(a) de Enfermagem",
    status: "confirmado",
    observacoes: "Plantão cumprido normalmente sem intercorrências."
  }
];

export const MOCK_CADASTROS: Cadastro[] = [
  // Pacientes
  {
    id: "PAC-101",
    tipo: "paciente",
    nome: "Helena Silveira",
    documento: "CPF 123.456.789-00",
    status: "ativo",
    detalhes: {
      idade: 78,
      complexidade: "Alta Complexidade (Home Care 24h)",
      diagnostico_principal: "Sequela de AVC isquêmico + Disfagia",
      convenio: "Unimed Seguros",
      carteirinha: "0054-992144-01",
      endereco: "Rua das Palmeiras, 342 - Apto 51, São Paulo - SP",
      responsavel: "Rodrigo Silveira (Filho)",
      telefone_emergencia: "(11) 98765-4321"
    }
  },
  {
    id: "PAC-102",
    tipo: "paciente",
    nome: "Carlos Alberto Santos",
    documento: "CPF 234.567.890-11",
    status: "ativo",
    detalhes: {
      idade: 69,
      complexidade: "Média Complexidade (Plantão 12h Diurno + Fisio)",
      diagnostico_principal: "DPOC crônica com oxigenoterapia contínua",
      convenio: "Bradesco Saúde",
      carteirinha: "782.110.450.002",
      endereco: "Av. Paulista, 1500 - Bela Vista, São Paulo - SP",
      responsavel: "Carla Santos (Esposa)",
      telefone_emergencia: "(11) 97654-3210"
    }
  },
  {
    id: "PAC-103",
    tipo: "paciente",
    nome: "Maria Clara Ribeiro",
    documento: "CPF 345.678.901-22",
    status: "ativo",
    detalhes: {
      idade: 84,
      complexidade: "Baixa Complexidade (Acompanhamento Cuidador 12h)",
      diagnostico_principal: "Demência vascular leve + Osteoporose",
      convenio: "SulAmérica Saúde",
      carteirinha: "991.002.311.99",
      endereco: "Rua Oscar Freire, 880 - Cerqueira César, São Paulo - SP",
      responsavel: "Fernanda Ribeiro (Filha)",
      telefone_emergencia: "(11) 96543-2109"
    }
  },
  // Profissionais
  {
    id: "PRO-501",
    tipo: "profissional",
    nome: "Juliana Mendes",
    documento: "COREN-SP 432.189-TE",
    status: "ativo",
    detalhes: {
      cargo: "Técnica de Enfermagem",
      especialidade: "Cuidados intensivos domiciliares e sondas",
      telefone: "(11) 99123-1111",
      disponibilidade: "Plantão 12x36 diurno",
      cidade: "São Paulo - SP"
    }
  },
  {
    id: "PRO-502",
    tipo: "profissional",
    nome: "Marcos Vinicius Lima",
    documento: "COREN-SP 312.980-TE",
    status: "ativo",
    detalhes: {
      cargo: "Técnico de Enfermagem",
      especialidade: "Home Care noturno, ventilação mecânica",
      telefone: "(11) 99234-2222",
      disponibilidade: "Plantão 12x36 noturno",
      cidade: "São Paulo - SP"
    }
  },
  {
    id: "PRO-503",
    tipo: "profissional",
    nome: "Beatriz Fontana",
    documento: "CREFITO-3 154.982-F",
    status: "ativo",
    detalhes: {
      cargo: "Fisioterapeuta",
      especialidade: "Fisioterapia respiratória e reabilitação motora",
      telefone: "(11) 99345-3333",
      disponibilidade: "Atendimento pontual por sessões",
      cidade: "São Paulo - SP"
    }
  },
  {
    id: "PRO-504",
    tipo: "profissional",
    nome: "Patrícia Albuquerque",
    documento: "COREN-SP 210.450-ENF",
    status: "ativo",
    detalhes: {
      cargo: "Enfermeira Coordenadora de Campo",
      especialidade: "Estomaterapia, curativos complexos e auditoria clínica",
      telefone: "(11) 99456-4444",
      disponibilidade: "Visitas de supervisão e curativos especiais",
      cidade: "São Paulo - SP"
    }
  },
  // Convênios
  {
    id: "CONV-01",
    tipo: "convenio",
    nome: "Unimed Seguros",
    documento: "ANS 000701",
    status: "ativo",
    detalhes: {
      tabela_preco: "Tabela RH-Unimed v2026",
      prazo_pagamento: "30 dias pós-faturamento",
      canal_autorizacoes: "autorizacoes.homecare@unimed.com.br",
      contato_gestor: "Dr. Marcelo Paiva - (11) 3200-5000"
    }
  },
  {
    id: "CONV-02",
    tipo: "convenio",
    nome: "Bradesco Saúde",
    documento: "ANS 005711",
    status: "ativo",
    detalhes: {
      tabela_preco: "Tabela Bradesco Especial Home Care",
      prazo_pagamento: "45 dias pós-faturamento",
      canal_autorizacoes: "gestaodomiciliar@bradescosaude.com.br",
      contato_gestor: "Cláudia Ramos - (11) 3300-8000"
    }
  },
  {
    id: "CONV-03",
    tipo: "convenio",
    nome: "SulAmérica Saúde",
    documento: "ANS 006246",
    status: "ativo",
    detalhes: {
      tabela_preco: "Tabela SulAmérica Plena",
      prazo_pagamento: "30 dias pós-faturamento",
      canal_autorizacoes: "prorrogacoes.hc@sulamerica.com.br",
      contato_gestor: "Renata Duarte - (11) 3700-1200"
    }
  }
];

export const MOCK_FATURAMENTO: Faturamento[] = [
  {
    id: "FAT-2026-10-01",
    competencia: "2026-10",
    competencia_br: "10/2026",
    convenio: "Unimed Seguros",
    quantidade_atendimentos: 124,
    valor_total_bruto: 84500.00,
    valor_glosado: 1200.00,
    valor_liquido: 83300.00,
    status_pagamento: "pago",
    data_prevista_pagamento: "2026-11-05",
    nota_fiscal: "NF-e 8941"
  },
  {
    id: "FAT-2026-10-02",
    competencia: "2026-10",
    competencia_br: "10/2026",
    convenio: "Bradesco Saúde",
    quantidade_atendimentos: 98,
    valor_total_bruto: 62300.00,
    valor_glosado: 0.00,
    valor_liquido: 62300.00,
    status_pagamento: "pendente",
    data_prevista_pagamento: "2026-11-20",
    nota_fiscal: "NF-e 8942"
  },
  {
    id: "FAT-2026-10-03",
    competencia: "2026-10",
    competencia_br: "10/2026",
    convenio: "SulAmérica Saúde",
    quantidade_atendimentos: 60,
    valor_total_bruto: 39800.00,
    valor_glosado: 2500.00,
    valor_liquido: 37300.00,
    status_pagamento: "em_auditoria",
    data_prevista_pagamento: "2026-11-25",
    nota_fiscal: "NF-e 8943"
  },
  {
    id: "FAT-2026-11-01",
    competencia: "2026-11",
    competencia_br: "11/2026",
    convenio: "Unimed Seguros",
    quantidade_atendimentos: 28,
    valor_total_bruto: 19400.00,
    valor_glosado: 0.00,
    valor_liquido: 19400.00,
    status_pagamento: "pendente",
    data_prevista_pagamento: "2026-12-05",
    nota_fiscal: "NF-e Prévia 8990"
  },
  {
    id: "FAT-2026-09-01",
    competencia: "2026-09",
    competencia_br: "09/2026",
    convenio: "Bradesco Saúde",
    quantidade_atendimentos: 102,
    valor_total_bruto: 64100.00,
    valor_glosado: 450.00,
    valor_liquido: 63650.00,
    status_pagamento: "pago",
    data_prevista_pagamento: "2026-10-20",
    nota_fiscal: "NF-e 8810"
  }
];
