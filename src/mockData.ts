/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Paciente, Plantao } from './types';

export const INITIAL_PACIENTES: Paciente[] = [
  {
    id: 'paciente-demo-24h',
    codigoReferencia: 'PAC-001',
    nome: 'Maria da Silva (Plano 24h)',
    dataNascimento: '1948-05-12',
    cpf: '123.456.789-00',
    nomeResponsavel: 'Carlos Silva',
    telefoneResponsavel: '(21) 98765-4321',
    email: 'carlos.silva@exemplo.com',
    bairro: 'Copacabana',
    status: 'Ativo',
    endereco: {
      rua: 'Avenida Atlântica',
      numero: '1500',
      cep: '22021-000',
      cidade: 'Rio de Janeiro',
      estado: 'RJ',
      bairro: 'Copacabana'
    },
    informacoesMedicas: {
      diagnosticoPrincipal: 'Home Care Integral / Acompanhamento Contínuo',
      comorbidades: 'Hipertensão controlada',
      grauDependencia: 'Alto',
      alergias: 'Sem alergias relatadas',
      observacoesClinicas: 'Cuidados e monitoramento contínuos de 24 horas.'
    },
    planoAtendimento: {
      tipoEscala: 'Plantão 24h',
      horaInicioPadrao: '07:00',
      valorSugeridoPlantao: 300,
      ajudaCusto: 30,
      valorTransporte: 20,
      valorAlimentacao: 10,
      taxaAdm: 50,
      tiposPlantao: [
        {
          id: 'tp-principal-24h',
          tipoEscala: 'Plantão 24h',
          horaInicio: '07:00',
          valorPlantao: 300,
          ajudaCusto: 30,
          valorTransporte: 20,
          valorAlimentacao: 10,
          taxaAdm: 50,
          isPrincipal: true
        }
      ]
    },
    dadosPagamento: {
      responsavelPagamento: 'O próprio Paciente',
      opcaoEnvio: 'WhatsApp'
    },
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_PLANTOES: Plantao[] = [
  {
    id: 'plantao-demo-24h',
    pacienteId: 'paciente-demo-24h',
    data: new Date().toISOString().slice(0, 10),
    diaSemana: 'Segunda-feira',
    profissional: 'Téc. Pedro Albuquerque',
    status: 'Confirmado',
    tipoEscala: 24,
    horaInicio: '07:00',
    dataInicio: new Date().toISOString().slice(0, 10),
    dataTermino: new Date().toISOString().slice(0, 10),
    valorPlantao: 300,
    valorRepasse: 300,
    ajudaCusto: 30,
    taxaAdm: 50
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


