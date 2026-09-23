/**
 * @file src/services/geminiOperacoesService.ts
 * @description Serviço seguro para consultas de inteligência operacional.
 * Atende aos requisitos de LGPD, zero exposição de chave no cliente e execução restrita a administradores.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

export interface MetricasConsolidadasInput {
  pacientes: any[];
  profissionais: any[];
  escalas: any[];
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
    const anon = `PAC_${String(pacCount++).padStart(2, '0')}`;
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
    const anon = `PROF_${String(profCount++).padStart(2, '0')}`;
    if (kId) profMap.set(kId, anon);
    if (kNome) profMap.set(kNome, anon);
    return anon;
  };

  const pacientesLimpos = (dados.pacientes || []).map((p) => {
    const anonId = getAnonPacId(p.id, p.nome);
    return {
      id: anonId,
      status: p.status || 'Ativo',
      complexidade: p.complexidade || p.grauComplexidade || p.informacoesMedicas?.grauDependencia || 'Média',
      planoCuidado: p.planoCuidado || p.tipoPlantao || p.planoAtendimento?.tipoEscala || 'Plantão 12h',
      quantidadePlantoesMes: Number(p.quantidadePlantoesMes || p.plantoesMes || 0),
      valorMensal: Number(p.valorMensal || p.mensalidade || p.valorTotal || 0),
      especialidade: p.especialidade || p.categoriaNecessaria || 'Técnico de Enfermagem'
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

  // Mapeamento das escalas com data completa ISO, dia da semana e caixinha Curinga
  const escalasLimpas = (dados.escalas || []).map((e, idx) => {
    const dataInfo = formatarDataParaISOEDiaSemana(e.data || e.dataInicio);
    const pacAnonId = getAnonPacId(e.idPaciente || e.pacienteId, e.pacienteNome || e.nomePaciente);
    const profAnonId = (e.idProfissional || e.profissionalId || e.nomeProfissional || e.profissionalNome)
      ? getAnonProfId(e.idProfissional || e.profissionalId, e.nomeProfissional || e.profissionalNome)
      : null;

    // Regra de Negócio 1: Caixinha Curinga marcada no cadastro/edição
    const isCuringa = Boolean(
      e.curinga === true ||
      e.isCuringa === true ||
      (e.tipoEscala && String(e.tipoEscala).toLowerCase().includes('curinga')) ||
      (e.observacao && String(e.observacao).toUpperCase().includes('CURINGA')) ||
      (e.motivoFalta && String(e.motivoFalta).toUpperCase().includes('CURINGA')) ||
      (e.motivo && String(e.motivo).toUpperCase().includes('CURINGA'))
    );

    return {
      id: `ESC-${idx + 1}`,
      pacienteId: pacAnonId,
      profissionalId: profAnonId,
      data: dataInfo.data, // YYYY-MM-DD
      diaSemana: dataInfo.diaSemana, // ex: Segunda-feira, Domingo, etc.
      horario: e.horario || e.tipoTurno || e.turno || '12h Diurno',
      status: e.status || 'Agendado',
      valorPlantao: Number(e.valorPlantao || 0),
      valorRepasse: Number(e.valorRepasse || 0),
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

  return {
    pacientes: pacientesLimpos,
    profissionais: profissionaisLimpos,
    escalas: escalasLimpas,
    financeiro: lancamentosAnonimizados,
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

  // Chamada exclusiva via SDK Oficial do Firebase Functions (região southamerica-east1)
  const functions = getFunctions(app, 'southamerica-east1');
  const consultarIA = httpsCallable<{ pergunta: string; metricas?: any }, { resposta: string }>(
    functions,
    'analisarMetricasHomeCare'
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

