/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UsuarioSistema {
  id: string;
  nome: string;
  email: string;
  nivelAcesso: 'Administrador' | 'Colaborador';
  status: 'Ativo' | 'Inativo';
}

export interface DadosBancarios {
  banco: string;
  agencia: string;
  conta: string;
  pix: string;
}

export interface Profissional {
  id: string;
  nome: string;
  especialidade: string;
  telefone: string;
  email?: string;
  status: 'Ativo' | 'Inativo';
  createdAt: string;
  dadosBancarios?: DadosBancarios;
  foto?: string;
  temMei?: boolean;
  cnpj?: string;
  sexo?: 'Masculino' | 'Feminino' | 'Outro';
  dataNascimento?: string;
  idade?: number;
  profissao?: 'Cuidadora(o)' | 'Téc. Enfermagem' | 'Enfermeira(o)' | 'Fisioterapeuta' | 'Médica(o)';
  rg?: string;
  cpf?: string;
  conselho?: string;
  endereco?: Endereco;
  ativo?: boolean;
  documentos?: {
    cracha?: string;
    certificados?: string;
    comprovanteResidencia?: string;
    vacinas?: string;
    outros?: string;
  };
  documentosAnexos?: DocumentoAnexo[];
  isTitularConta?: boolean | string;
  nomeTitularConta?: string;
  cpfTitularConta?: string;
  grauParentescoTitular?: string;
  pacientesBloqueados?: string[];
}

export interface Ocorrencia {
  id?: string;
  data: string;
  pacienteId: string;
  pacienteNome: string;
  descricao: string;
  bloquearEscala: boolean;
  createdAt?: string;
  tipo?: string;
  paciente?: string;
  timestamp?: any;
}

export interface DocumentoAnexo {
  id: string | number;
  tipo: string;
  arquivo: string | null;
  nomeArquivo?: string;
  nome?: string;
  url?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  collection: string;
  documentId: string;
  description: string;
}

export interface Endereco {
  rua: string;
  numero: string;
  cep: string;
  bairro: string;
  cidade: string;
  estado: string;
  logisticaChegada?: string; // Amplo texto livre para informações de logística de chegada
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
  valorPlantao: number | "";
  ajudaCusto: number | "";
  taxaAdm: number | "";
}

export interface PlanoAtendimento {
  tipoEscala: string;
  horaInicioPadrao: string;
  valorSugeridoPlantao: number | "";
  ajudaCusto?: number | "";
  taxaAdm?: number | "";
  tiposPlantao?: EscalacaoPlano[];
  convenio?: string;
  matricula?: string;
}

export interface DadosPagamento {
  responsavelPagamento: 'O próprio Paciente' | 'Outro Responsável';
  nomePagador?: string;
  cpfPagador?: string;
  opcaoEnvio: 'WhatsApp' | 'E-mail' | 'Ambos';
  whatsappFaturamento?: string;
  emailFaturamento?: string;
}

export interface OcorrenciaPaciente {
  id: string;
  data: string;
  profissionalId: string;
  profissionalNome: string;
  descricao: string;
  bloquearProfissional: boolean;
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
  dadosPagamento?: DadosPagamento;
  createdAt: string;
  profissionaisBloqueados?: string[];
  ocorrencias?: OcorrenciaPaciente[];
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

export interface Agendamento {
  id: string;
  idPaciente: string;
  idProfissional: string;
  nomeProfissional: string;
  data: string;
  horario: string;
  valorPlantao: number;
  valorRepasse: number;
  ajudaCusto: number;
  taxaAdm: number;
  status: 'Aberta' | 'Concluido' | 'Cancelado' | 'Confirmado';
  observacao?: string;
  escalaCongelada?: boolean;
  tipoDia?: 'Normal' | 'Feriado 20%' | 'Feriado 50%';
  isCuringa?: boolean;
  considerarFalta?: boolean;
  motivoFalta?: string;
  atendimentoRealizado?: string;
}

export type CancelingReason =
  | 'Pediu para sair da escala'
  | 'Família pediu substituição'
  | 'Doente'
  | 'Parente doente'
  | 'Tiro'
  | 'Sem condução'
  | 'Cansaço';

export interface DebitoProfissional {
  id: string;
  idProfissional: string;
  nomeProfissional: string;
  data: any; // Saved in full format / Timestamp
  valor: number;
  motivo: 'Curinga' | 'Passagem' | 'Outros' | string;
  idPaciente?: string;
  nomePaciente?: string;
  status?: 'pendente' | 'descontado';
  folhaIdVinculada?: string;
}

export interface FaturaPaciente {
  id: string;
  idPaciente: string;
  nomePaciente: string;
  numeroFatura: string;
  dataEmissao: string;
  periodoApurado: { inicio: string; fim: string };
  valorTotal: number;
  status: 'Aberta' | 'Fechada';
  plantoesCongelados: any[];
}

export interface FolhaPagamento {
  id: string;
  idProfissional: string;
  nomeProfissional: string;
  dataEmissao: string;
  periodoApurado: { inicio: string; fim: string };
  valorTotalPlantoes: number;
  valorTotalDebitos: number;
  valorLiquidoReceber: number;
  status: 'Pendente' | 'Fechada';
  historicoDebitos: any[];
  plantoesCongelados?: any[];
}

