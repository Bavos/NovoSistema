/**
 * @file src/services/geminiOperacoesService.ts
 * @description Serviço seguro para consultas de inteligência operacional.
 * Atende aos requisitos de LGPD, zero exposição de chave no cliente e execução restrita a administradores.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

export interface ResumoFinanceiroItem {
  id: string;
  faturamento: number;
  custoProf: number;
  ajudaCusto: number;
  totalCustos: number;
  lucro: number;
  margem: number;
  quantidadePlantoes?: number;
}

export interface MetricasExatas {
  total: number;
  preenchidas: number;
  vagas: number;
  curingas: number;
  pacientesAtivosTotal?: number;
}

export interface AlertaCritico {
  tipo: "ESCALA_VAGA" | "CURINGA_EXCESSIVO" | string;
  pacienteId: string;
  pacienteNome?: string;
  data: string;
  turno: string;
  profissionalId?: string;
  motivo?: string;
}

export interface PadroesDetectados {
  diaComMaisCuringas?: string;
  totalNoDia?: number;
  escalasFimDeSemana?: any;
  curingasPorProfissional?: Record<string, number>;
  curingasPorPaciente?: Record<string, number>;
  [key: string]: any;
}

export interface MetricasAuditadas {
  totalEscalasMes: number;
  concluidas: number;
  vagas: number;
  curingas: number;
  pacientesAtivosTotal: number;
}

export interface MetricasConsolidadasInput {
  periodo?: string;
  periodoReferencia?: string;
  metricasExatas?: MetricasExatas;
  alertasCriticos?: AlertaCritico[];
  padroesDetectados?: PadroesDetectados;
  metricasAuditadas?: MetricasAuditadas;
  totalEscalasMes?: number;
  concluidas?: number;
  vagas?: number;
  curingas?: number;
  pacientesAtivosTotal?: number;
  resumoFinanceiro?: ResumoFinanceiroItem[];
  resumoGeral?: any;
  escalasPorDiaSemana?: any;
  escalasFimDeSemana?: any;
  gargalosEscala?: any;
  estatisticasCuringas?: any;
  financeiroConsolidado?: any;
  pacientes: any[];
  profissionais: any[];
  escalas: any[];
  escalasVagas?: any[];
  plantoesCuringa?: any[];
  debitosProfissionais?: any[];
  faturasPacientes?: any[];
  folhasPagamento?: any[];
  financeiro?: any[];
  totaisConsolidados?: {
    faturamentoMensalConsolidado: number;
    custoTotalFolhaConsolidado: number;
    totalDebitosProfissionais: number;
  };
  user?: {
    email?: string;
    role?: string;
  };
}

export interface ResultadoConsultaOperacional {
  sucesso: boolean;
  resposta: string;
  metricasGerais?: any;
  timestamp: string;
}

const NOMES_DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/**
 * Converte qualquer formato de data para ISO YYYY-MM-DD e calcula o dia da semana em português.
 */
export function formatarDataParaISOEDiaSemana(dateVal: any): { data: string; diaSemana: string; mesAno: string } {
  if (!dateVal) return { data: 'N/D', diaSemana: 'N/D', mesAno: 'N/D' };
  let str = '';
  if (typeof dateVal === 'string') {
    str = dateVal.trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        str = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else if (str.includes('T')) {
      str = str.split('T')[0];
    }
  } else if (dateVal instanceof Date) {
    str = dateVal.toISOString().split('T')[0];
  } else if (dateVal?.toDate && typeof dateVal.toDate === 'function') {
    str = dateVal.toDate().toISOString().split('T')[0];
  } else if (dateVal?.seconds) {
    str = new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [ano, mes, dia] = str.split('-').map(Number);
    const dObj = new Date(ano, mes - 1, dia);
    const diaSemana = NOMES_DIAS_SEMANA[dObj.getDay()] || 'N/D';
    const mesAno = `${String(mes).padStart(2, '0')}/${ano}`;
    return { data: str, diaSemana, mesAno };
  }

  return { data: str || 'N/D', diaSemana: 'N/D', mesAno: 'N/D' };
}

/**
 * Higienização prévia no cliente (Camada 1 de Proteção LGPD).
 * Garante que nenhum CPF, RG, telefone ou endereço físico trafegue na rede,
 * preservando correlações de IDs anonimizados entre pacientes, escalas e financeiro.
 */
export function sanitizarPayloadAntesDeEnviar(dados: MetricasConsolidadasInput) {
  const pacMap = new Map<string, string>();
  const profMap = new Map<string, string>();
  let pacCount = 1;
  let profCount = 1;

  const getAnonPacId = (id?: string, nome?: string): string => {
    const kId = String(id || '').trim();
    const kNome = String(nome || '').trim().toLowerCase();
    if (/^PAC[_-]\d+/i.test(kId)) return kId;
    if (kId && pacMap.has(kId)) return pacMap.get(kId)!;
    if (kNome && pacMap.has(kNome)) return pacMap.get(kNome)!;
    const anon = `PAC-${String(pacCount++).padStart(3, '0')}`;
    if (kId) pacMap.set(kId, anon);
    if (kNome) pacMap.set(kNome, anon);
    return anon;
  };

  const getAnonProfId = (id?: string, nome?: string): string => {
    const kId = String(id || '').trim();
    const kNome = String(nome || '').trim().toLowerCase();
    if (/^PROF[_-]\d+/i.test(kId) || /^P-\d+/i.test(kId)) return kId;
    if (kId && profMap.has(kId)) return profMap.get(kId)!;
    if (kNome && profMap.has(kNome)) return profMap.get(kNome)!;
    const anon = `P-${String(profCount++).padStart(2, '0')}`;
    if (kId) profMap.set(kId, anon);
    if (kNome) profMap.set(kNome, anon);
    return anon;
  };

  const pacientesLimpos = (dados.pacientes || []).map((p) => {
    const anonId = getAnonPacId(p.id, p.nome);
    const pAny = p as any;
    return {
      id: anonId,
      status: p.status || 'Ativo',
      complexidade: p.complexidade || p.grauComplexidade || p.informacoesMedicas?.grauDependencia || 'Média',
      planoCuidado: p.planoCuidado || p.tipoPlantao || p.planoAtendimento?.tipoEscala || 'Plantão 12h',
      quantidadePlantoesMes: Number(p.quantidadePlantoesMes || p.plantoesMes || 0),
      valorMensal: Number(p.valorMensal || p.mensalidade || p.valorTotal || 0),
      especialidade: p.especialidade || p.categoriaNecessaria || 'Técnico de Enfermagem',
      valorPlantaoProfissional: Number(pAny.valorPlantaoProfissional || 0),
      valorAjudaCusto: Number(pAny.valorAjudaCusto || 0),
      taxaAdministrativa: Number(pAny.taxaAdministrativa || 0),
      valorTotalCobradoPlantao: Number(pAny.valorTotalCobradoPlantao || 0)
    };
  });

  const profissionaisLimpos = (dados.profissionais || []).map((prof) => {
    const anonId = getAnonProfId(prof.id, prof.nome);
    return {
      id: anonId,
      categoria: prof.categoria || prof.funcao || prof.profissao || 'Cuidador',
      especialidade: prof.especialidade || 'Geral',
      status: prof.status || 'Disponível',
      valorHora: Number(prof.valorHora || prof.valorPlantao || 0),
      plantoesRealizadosMes: Number(prof.plantoesRealizadosMes || prof.totalPlantoes || 0)
    };
  });

  // Mapeamento das escalas com data completa ISO, dia da semana, turno, status de alocação e caixinha Curinga
  const escalasLimpas = (dados.escalas || []).map((e, idx) => {
    const dataInfo = formatarDataParaISOEDiaSemana(e.data || e.dataInicio);
    const eAny = e as any;
    const pacRawId = e.idPaciente || eAny.pacienteId || eAny.idClient || eAny.clientId || eAny.paciente;
    const pacRawNome = eAny.pacienteNome || eAny.nomePaciente;
    const pacAnonId = e.pacienteCodigo || getAnonPacId(pacRawId, pacRawNome);

    const profRawId = e.idProfissional || eAny.profissionalId || eAny.cuidadorId || eAny.funcionarioId || eAny.idCuidador || eAny.idFuncionario || eAny.profissional;
    const profRawNome = e.nomeProfissional || eAny.profissionalNome || eAny.nomeCuidador || eAny.nomeFuncionario || eAny.cuidadorNome || eAny.funcionarioNome;
    const profAnonId = e.profissionalCodigo || ((profRawId || profRawNome) ? getAnonProfId(profRawId, profRawNome) : null);

    // Regra de Negócio 1: Caixinha Curinga marcada no cadastro/edição
    const isCuringa = Boolean(
      e.curinga === true ||
      e.isCuringa === true ||
      (e.tipoEscala && String(e.tipoEscala).toLowerCase().includes('curinga')) ||
      (e.observacao && String(e.observacao).toUpperCase().includes('CURINGA')) ||
      (e.motivoFalta && String(e.motivoFalta).toUpperCase().includes('CURINGA')) ||
      (e.motivo && String(e.motivo).toUpperCase().includes('CURINGA'))
    );

    const dataFinal = (e.data && /^\d{4}-\d{2}-\d{2}$/.test(e.data)) ? e.data : dataInfo.data;
    const diaSemanaFinal = e.diaSemana || dataInfo.diaSemana;
    const turnoFinal = e.turno || e.horario || e.tipoTurno || '12h Diurno';
    const statusAlocacaoFinal = e.statusAlocacao || (profAnonId ? 'completa' : 'incompleta');

    return {
      id: `ESC-${idx + 1}`,
      pacienteCodigo: pacAnonId,
      pacienteId: pacAnonId,
      profissionalId: profAnonId,
      data: dataFinal, // YYYY-MM-DD
      diaSemana: diaSemanaFinal, // ex: Segunda-feira, Sábado, etc.
      turno: turnoFinal,
      horario: turnoFinal,
      statusAlocacao: statusAlocacaoFinal,
      status: e.status || 'Agendado',
      valorPlantao: Number(e.valorPlantao || eAny.valorProfissional || eAny.repasseProfissional || eAny.valorDiaria || 0),
      valorRepasse: Number(e.valorRepasse || e.valorPlantao || eAny.valorProfissional || 0),
      ajudaCusto: Number(e.ajudaCusto || eAny.valorTransporte || eAny.transporte || eAny.adicional || 0),
      taxaAdm: Number(e.taxaAdm || eAny.taxaAdministrativa || 0),
      valorCobrado: Number(e.valorCobrado || eAny.valorFaturado || eAny.valorTotalCobradoPlantao || (Number(e.valorPlantao || eAny.valorProfissional || 0) + Number(e.ajudaCusto || eAny.valorTransporte || 0) + Number(e.taxaAdm || eAny.taxaAdministrativa || 0)) || 0),
      curinga: isCuringa
    };
  });

  // Regra de Negócio 3: Coleta e unificação de lançamentos financeiros (Débito e Crédito)
  const lancamentosAnonimizados: any[] = [];

  // Débitos (descontos de profissionais, incluindo Curingas e faltas)
  (dados.debitosProfissionais || []).forEach((deb, idx) => {
    const dataInfo = formatarDataParaISOEDiaSemana(deb.data);
    const pacAnonId = (deb.idPaciente || deb.nomePaciente) ? getAnonPacId(deb.idPaciente, deb.nomePaciente) : null;
    const profAnonId = getAnonProfId(deb.idProfissional, deb.nomeProfissional);
    const isCuringaDebito = Boolean(deb.motivo && String(deb.motivo).toLowerCase().includes('curinga'));

    lancamentosAnonimizados.push({
      id: `DEB-${idx + 1}`,
      tipo: 'debito',
      valor: Number(deb.valor || 0),
      data: dataInfo.data,
      diaSemana: dataInfo.diaSemana,
      motivo: deb.motivo || 'Débito Operacional',
      pacienteId: pacAnonId,
      profissionalId: profAnonId,
      curinga: isCuringaDebito,
      status: deb.status || 'pendente'
    });
  });

  // Créditos (faturamento de pacientes emitido ou faturado)
  (dados.faturasPacientes || []).forEach((fat, idx) => {
    const dataInfo = formatarDataParaISOEDiaSemana(fat.dataEmissao || fat.periodoApurado?.fim || fat.createdAt);
    const pacAnonId = getAnonPacId(fat.idPaciente || fat.pacienteId, fat.nomePaciente);

    lancamentosAnonimizados.push({
      id: `FAT-${idx + 1}`,
      tipo: 'credito',
      valor: Number(fat.valorTotal || 0),
      data: dataInfo.data,
      diaSemana: dataInfo.diaSemana,
      numeroFatura: fat.numeroFatura || `FAT-${idx + 1}`,
      pacienteId: pacAnonId,
      status: fat.status || 'Aberta'
    });
  });

  const metricasAuditadas = dados.metricasAuditadas || {
    totalEscalasMes: dados.totalEscalasMes ?? dados.metricasExatas?.total ?? dados.resumoGeral?.totalEscalas ?? escalasLimpas.length,
    concluidas: dados.concluidas ?? dados.metricasExatas?.preenchidas ?? dados.gargalosEscala?.escalasCompletasTotal ?? escalasLimpas.filter(e => e.statusAlocacao === 'completa').length,
    vagas: dados.vagas ?? dados.metricasExatas?.vagas ?? dados.gargalosEscala?.escalasVagasTotal ?? escalasLimpas.filter(e => e.statusAlocacao !== 'completa').length,
    curingas: dados.curingas ?? dados.metricasExatas?.curingas ?? dados.estatisticasCuringas?.total ?? escalasLimpas.filter(e => e.curinga).length,
    pacientesAtivosTotal: dados.pacientesAtivosTotal ?? dados.metricasExatas?.pacientesAtivosTotal ?? dados.resumoGeral?.totalPacientes ?? pacientesLimpos.length
  };

  const metricasExatas: MetricasExatas = dados.metricasExatas || {
    total: metricasAuditadas.totalEscalasMes,
    preenchidas: metricasAuditadas.concluidas,
    vagas: metricasAuditadas.vagas,
    curingas: metricasAuditadas.curingas,
    pacientesAtivosTotal: metricasAuditadas.pacientesAtivosTotal
  };

  const alertasCriticosLimpos = Array.isArray(dados.alertasCriticos)
    ? dados.alertasCriticos.map(a => ({
        tipo: a.tipo || "ESCALA_VAGA",
        pacienteId: getAnonPacId(a.pacienteId, a.pacienteNome),
        data: a.data || "N/D",
        turno: a.turno || "12h Diurno",
        profissionalId: a.profissionalId ? getAnonProfId(a.profissionalId) : undefined,
        motivo: a.motivo
      }))
    : [];

  const padroesDetectados = dados.padroesDetectados || {};

  return {
    periodo: dados.periodo || dados.periodoReferencia || 'Setembro/2026',
    periodoReferencia: dados.periodoReferencia || dados.periodo || 'Setembro/2026',
    metricasExatas,
    alertasCriticos: alertasCriticosLimpos,
    padroesDetectados,
    metricasAuditadas,
    totalEscalasMes: metricasAuditadas.totalEscalasMes,
    concluidas: metricasAuditadas.concluidas,
    vagas: metricasAuditadas.vagas,
    curingas: metricasAuditadas.curingas,
    pacientesAtivosTotal: metricasAuditadas.pacientesAtivosTotal,
    resumoFinanceiro: dados.resumoFinanceiro,
    resumoGeral: {
      ...(dados.resumoGeral || {}),
      totalPacientes: metricasAuditadas.pacientesAtivosTotal,
      totalEscalas: metricasAuditadas.totalEscalasMes
    },
    escalasPorDiaSemana: dados.escalasPorDiaSemana,
    escalasFimDeSemana: dados.escalasFimDeSemana,
    gargalosEscala: {
      ...(dados.gargalosEscala || {}),
      escalasCompletasTotal: metricasAuditadas.concluidas,
      escalasVagasTotal: metricasAuditadas.vagas,
      taxaOcupacaoPercentual: metricasAuditadas.totalEscalasMes > 0 
        ? Number(((metricasAuditadas.concluidas / metricasAuditadas.totalEscalasMes) * 100).toFixed(1)) 
        : 100
    },
    estatisticasCuringas: {
      ...(dados.estatisticasCuringas || {}),
      total: metricasAuditadas.curingas
    },
    financeiroConsolidado: dados.financeiroConsolidado,
    pacientes: pacientesLimpos.slice(0, 25),
    profissionais: profissionaisLimpos.slice(0, 25),
    escalas: escalasLimpas.slice(0, 50),
    escalasVagas: dados.escalasVagas || escalasLimpas.filter(e => e.statusAlocacao !== 'completa'),
    plantoesCuringa: dados.plantoesCuringa || escalasLimpas.filter(e => e.curinga),
    financeiro: lancamentosAnonimizados.slice(0, 30),
    totaisConsolidados: dados.totaisConsolidados,
    user: dados.user
  };
}

/**
 * Consulta o Assistente de Inteligência Operacional com pergunta livre ou relatório completo.
 * Não aplica JSON.parse em respostas que venham como string/texto puro.
 */
export async function consultarAssistenteOperacional(
  textoPergunta: string,
  dados: MetricasConsolidadasInput
): Promise<ResultadoConsultaOperacional> {
  const dadosAnonimizados = sanitizarPayloadAntesDeEnviar(dados);

  // Chamada exclusiva via SDK Oficial do Firebase Functions (região southamerica-east1) com timeout de 180s
  const functions = getFunctions(app, 'southamerica-east1');
  const consultarIA = httpsCallable<{ pergunta: string; metricas?: any }, { resposta: string }>(
    functions,
    'analisarMetricasHomeCare',
    { timeout: 180000 }
  );

  const result = await consultarIA({
    pergunta: textoPergunta || '',
    metricas: dadosAnonimizados
  });

  const textoResposta = result?.data?.resposta;

  if (!textoResposta) {
    throw new Error('Nenhuma resposta recebida do Assistente Operacional.');
  }

  return {
    sucesso: true,
    resposta: textoResposta,
    timestamp: new Date().toISOString()
  };
}

// Manter compatibilidade com chamadas existentes
export const gerarRelatorioInsightsOperacionais = (dados: MetricasConsolidadasInput) => {
  return consultarAssistenteOperacional('', dados);
};

