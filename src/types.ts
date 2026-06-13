/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Endereco {
  rua: string;
  numero: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
  logisticaChegada: string; // Amplo texto livre para informações de logística de chegada
}

export interface InformacoesMedicas {
  diagnosticoPrincipal: string;
  comorbidades: string;
  alergias: string;
  grauDependencia: 'Baixo' | 'Médio' | 'Alto' | 'Muito Alto';
  observacoesClinicas: string;
}

export interface EscalacaoPlano {
  id: string; // unique identifier within this patient configurations
  tipoEscala: string;
  horaInicio: string;
  valorPlantao: number;
  ajudaCusto: number;
  taxaAdm: number;
}

export interface PlanoAtendimento {
  tipoEscala: string;
  horaInicioPadrao: string;
  valorSugeridoPlantao: number;
  ajudaCusto?: number;
  taxaAdm?: number;
  tiposPlantao?: EscalacaoPlano[];
}

export interface Paciente {
  id: string;
  nome: string;
  dataNascimento: string;
  cpf: string;
  nomeResponsavel: string;
  telefoneResponsavel: string;
  email: string;
  bairro: string;
  status: 'Ativo' | 'Desativado';
  desativadoEm?: string | null;
  desativadoMotivo?: string | null;
  endereco: Endereco;
  informacoesMedicas: InformacoesMedicas;
  planoAtendimento: PlanoAtendimento;
  createdAt: string;
}

export interface Plantao {
  id: string;
  pacienteId: string;
  data: string;
  diaSemana: string;
  profissional: string;
  status: 'Confirmado' | 'Cancelado';
  motivoCancelamento?: string | null;

  // Custom nested structured scale document support properties
  tipoEscala?: number;
  dataInicio?: string;
  horaInicio?: string;
  dataTermino?: string;
  horaTermino?: string;
  observacaoAgendamento?: string;
  valorPlantao?: number;
  valorRepasse?: number;
  feriado?: '20%' | '50%' | null;
  ajudaCusto?: number;
  taxaAdm?: number;
  criadoEm?: string;
  criadoPor?: string;
  escalaCongelada?: boolean;
}

export type CancelingReason =
  | 'Pediu para sair da escala'
  | 'Família pediu substituição'
  | 'Doente'
  | 'Parente doente'
  | 'Tiro'
  | 'Sem condução'
  | 'Cansaço';
