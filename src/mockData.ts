/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Paciente, Plantao } from './types';

export const INITIAL_PACIENTES: Paciente[] = [
  {
    id: 'pac-1',
    nome: 'João Albuquerque',
    dataNascimento: '1948-05-14',
    cpf: '123.456.789-00',
    nomeResponsavel: 'André Albuquerque (Filho)',
    telefoneResponsavel: '(21) 98888-7766',
    email: 'andre.albuquerque@gmail.com',
    bairro: 'Copacabana',
    status: 'Ativo',
    desativadoEm: null,
    desativadoMotivo: null,
    endereco: {
      rua: 'Avenida Atlântica',
      numero: '1720',
      cep: '22021-001',
      bairro: 'Copacabana',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      logisticaChegada: 'Prédio em frente ao posto 3. Entrada de serviço liberada para cuidadores de plantão. Interfone 802. Portaria 24 horas.',
    },
    informacoesMedicas: {
      diagnosticoPrincipal: 'Alzheimer (Estágio Moderado/Avançado)',
      comorbidades: 'Hipertensão Arterial Sistêmica, Diabetes Tipo 2',
      alergias: 'Penicilina, Corantes Amarelos',
      grauDependencia: 'Alto',
      observacoesClinicas: 'Paciente deambula com auxílio de andador. Risco elevado de queda. Necessita de estímulo cognitivo e auxílio integral para higiene e alimentação.',
    },
    planoAtendimento: {
      tipoEscala: 'Diurno 12h',
      horaInicioPadrao: '07:00',
      valorSugeridoPlantao: 150.00,
    },
    createdAt: '2026-01-10T10:00:00Z',
  },
  {
    id: 'pac-2',
    nome: 'Maria Eduarda Fernandes',
    dataNascimento: '1961-09-22',
    cpf: '987.654.321-11',
    nomeResponsavel: 'Letícia Fernandes (Filha)',
    telefoneResponsavel: '(21) 97111-2233',
    email: 'leticia.f@gmail.com',
    bairro: 'Barra da Tijuca',
    status: 'Ativo',
    desativadoEm: null,
    desativadoMotivo: null,
    endereco: {
      rua: 'Avenida Lúcio Costa',
      numero: '3300',
      cep: '22630-010',
      bairro: 'Barra da Tijuca',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      logisticaChegada: 'Condomínio Barramares, Bloco C, apto 1204. Estacionamento de visitantes disponível com identificação na guarita.',
    },
    informacoesMedicas: {
      diagnosticoPrincipal: 'Recuperação de AVC Isquêmico',
      comorbidades: 'Dislipidemia leve',
      alergias: 'Sem alergias conhecidas',
      grauDependencia: 'Médio',
      observacoesClinicas: 'Realizando fisioterapia motora 3x por semana. Apresenta leve afasia de expressão e fraqueza no dimídio direito.',
    },
    planoAtendimento: {
      tipoEscala: 'Plantão 24h',
      horaInicioPadrao: '08:00',
      valorSugeridoPlantao: 280.00,
    },
    createdAt: '2026-03-15T14:30:00Z',
  },
  {
    id: 'pac-3',
    nome: 'Clara Rezende de Oliveira',
    dataNascimento: '1939-11-05',
    cpf: '456.111.222-33',
    nomeResponsavel: 'Marcos Rezende (Neto)',
    telefoneResponsavel: '(21) 98222-4455',
    email: 'marcos.rezo@hotmail.com',
    bairro: 'Ipanema',
    status: 'Desativado',
    desativadoEm: '2026-06-10',
    desativadoMotivo: 'Troca de equipe para atendimento de home care vinculado diretamente ao plano de saúde hospitalar integral.',
    endereco: {
      rua: 'Rua Visconde de Pirajá',
      numero: '450',
      cep: '22410-003',
      bairro: 'Ipanema',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      logisticaChegada: 'Portaria simples sem elevador com lance de escadas até o primeiro andar de habitação.',
    },
    informacoesMedicas: {
      diagnosticoPrincipal: 'Osteopoerose Grave e Osteoartrose Crônica',
      comorbidades: 'Gastrite Crônica, Insônia crônica',
      alergias: 'Anti-inflamatórios Não Esteroidais (AINEs)',
      grauDependencia: 'Baixo',
      observacoesClinicas: 'Paciente lúcida e orientada. Dificuldades de mobilidade devido à dor crônica nas articulações.',
    },
    planoAtendimento: {
      tipoEscala: 'Diurno 9h',
      horaInicioPadrao: '09:00',
      valorSugeridoPlantao: 120.00,
    },
    createdAt: '2026-02-18T09:15:00Z',
  },
  {
    id: 'pac-4',
    nome: 'Roberto Carlos Silva',
    dataNascimento: '1952-03-30',
    cpf: '555.666.777-88',
    nomeResponsavel: 'Sônia Silva (Esposa)',
    telefoneResponsavel: '(21) 99555-8899',
    email: 'soniasilva@outlook.com',
    bairro: 'Leblon',
    status: 'Ativo',
    desativadoEm: null,
    desativadoMotivo: null,
    endereco: {
      rua: 'Rua Delfim Moreira',
      numero: '120',
      cep: '22441-010',
      bairro: 'Leblon',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      logisticaChegada: 'Prédio de frente para o mar. Subsolo disponível para parar veículo se previamente alinhado com a zeladoria.',
    },
    informacoesMedicas: {
      diagnosticoPrincipal: 'Esclerose Lateral Amiotrófica (ELA)',
      comorbidades: 'Insuficiência Respiratória Crônica em uso de VNI',
      alergias: 'Dipirona Sódica',
      grauDependencia: 'Muito Alto',
      observacoesClinicas: 'Uso imprescindível de ventilação não invasiva durante o repouso. Dieta por GTT (Gastrostomia Endoscópica Percutânea). Cuidado de enfermagem de alta complexidade.',
    },
    planoAtendimento: {
      tipoEscala: 'Plantão 48h',
      horaInicioPadrao: '07:00',
      valorSugeridoPlantao: 650.00,
    },
    createdAt: '2026-04-02T11:45:00Z',
  }
];

export const INITIAL_PLANTOES: Plantao[] = [
  // João Albuquerque (pac-1)
  {
    id: 'plt-1',
    pacienteId: 'pac-1',
    data: '2026-06-12',
    diaSemana: 'Sex',
    profissional: 'Dr. Maria Santos',
    status: 'Confirmado',
    motivoCancelamento: null,
  },
  {
    id: 'plt-2',
    pacienteId: 'pac-1',
    data: '2026-06-13',
    diaSemana: 'Sáb',
    profissional: 'Téc. Pedro Albuquerque',
    status: 'Confirmado',
    motivoCancelamento: null,
  },
  {
    id: 'plt-3',
    pacienteId: 'pac-1',
    data: '2026-06-14',
    diaSemana: 'Dom',
    profissional: 'Cuidador Thiago Neves',
    status: 'Confirmado',
    motivoCancelamento: null,
  },
  {
    id: 'plt-4',
    pacienteId: 'pac-1',
    data: '2026-06-11',
    diaSemana: 'Qui',
    profissional: 'Dra. Maria Santos',
    status: 'Cancelado',
    motivoCancelamento: 'Doente',
  },

  // Maria Eduarda (pac-2)
  {
    id: 'plt-5',
    pacienteId: 'pac-2',
    data: '2026-06-12',
    diaSemana: 'Sex',
    profissional: 'Enf. Juliana Silveira',
    status: 'Confirmado',
    motivoCancelamento: null,
  },
  {
    id: 'plt-6',
    pacienteId: 'pac-2',
    data: '2026-06-13',
    diaSemana: 'Sáb',
    profissional: 'Enf. Rodrigo Mendes',
    status: 'Confirmado',
    motivoCancelamento: null,
  },

  // Clara Rezende (pac-3 - Desativada)
  {
    id: 'plt-7',
    pacienteId: 'pac-3',
    data: '2026-06-09',
    diaSemana: 'Ter',
    profissional: 'Cuidador Carlos Eduardo',
    status: 'Confirmado',
    motivoCancelamento: null,
  },

  // Roberto Carlos (pac-4)
  {
    id: 'plt-8',
    pacienteId: 'pac-4',
    data: '2026-06-12',
    diaSemana: 'Sex',
    profissional: 'Fis. Dra. Luciana Varela',
    status: 'Confirmado',
    motivoCancelamento: null,
  },
  {
    id: 'plt-9',
    pacienteId: 'pac-4',
    data: '2026-06-13',
    diaSemana: 'Sáb',
    profissional: 'Fis. Dr. Roberto Amaral',
    status: 'Confirmado',
    motivoCancelamento: null,
  }
];

export interface Professional {
  name: string;
  role: string;
  id: string;
  status: string;
  tel: string;
  rating: string;
  area: string;
}

export const INITIAL_PROFESSIONALS: Professional[] = [
  { name: 'Dra. Maria Santos', role: 'Médica Geriatra', id: 'prof-1', status: 'Ativo', tel: '(21) 94444-1122', rating: '5.0', area: 'Copacabana / Ipanema' },
  { name: 'Téc. Pedro Albuquerque', role: 'Técnico em Enfermagem', id: 'prof-2', status: 'Em Plantão', tel: '(21) 93333-5566', rating: '4.9', area: 'Zona Sul / Leme' },
  { name: 'Enf. Juliana Silveira', role: 'Enfermeira Padrão', id: 'prof-3', status: 'Ativo', tel: '(21) 92222-7788', rating: '5.0', area: 'Barra / Recreio' },
  { name: 'Cuidador Thiago Neves', role: 'Cuidador Especializado', id: 'prof-4', status: 'Descanso', tel: '(21) 91111-9900', rating: '4.8', area: 'Botafogo / Flamengo' },
  { name: 'Fis. Dra. Luciana Varela', role: 'Fisioterapeuta Motora', id: 'prof-5', status: 'Ativo', tel: '(21) 95555-3344', rating: '4.9', area: 'Leblon / Jardim Botânico' },
];

