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

/**
 * Higienização prévia no cliente (Camada 1 de Proteção LGPD).
 * Garante que nenhum CPF, RG, telefone ou endereço físico trafegue na rede.
 */
export function sanitizarPayloadAntesDeEnviar(dados: MetricasConsolidadasInput) {
  const pacientesLimpos = (dados.pacientes || []).map((p, idx) => ({
    id: `PAC-${String(idx + 1).padStart(3, '0')}`,
    status: p.status || 'Ativo',
    complexidade: p.complexidade || p.grauComplexidade || 'Média',
    planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h',
    quantidadePlantoesMes: Number(p.quantidadePlantoesMes || p.plantoesMes || 0),
    valorMensal: Number(p.valorMensal || p.mensalidade || p.valorTotal || 0),
    especialidade: p.especialidade || p.categoriaNecessaria || 'Técnico de Enfermagem'
  }));

  const profissionaisLimpos = (dados.profissionais || []).map((prof, idx) => ({
    id: `P-${String(idx + 1).padStart(2, '0')}`,
    categoria: prof.categoria || prof.funcao || 'Cuidador',
    especialidade: prof.especialidade || 'Geral',
    status: prof.status || 'Disponível',
    valorHora: Number(prof.valorHora || prof.valorPlantao || 0),
    plantoesRealizadosMes: Number(prof.plantoesRealizadosMes || prof.totalPlantoes || 0)
  }));

  const escalasLimpas = (dados.escalas || []).slice(0, 150).map((e, idx) => ({
    id: `ESC-${idx + 1}`,
    idPaciente: e.idPaciente || e.pacienteId ? `PAC-REF` : 'PAC-GENERIC',
    idProfissional: (e.idProfissional || e.profissionalId) ? `P-REF` : null,
    tipoTurno: e.tipoTurno || e.turno || e.horario || '12h Diurno',
    status: e.status || 'Agendado',
    data: e.data ? String(e.data).substring(0, 10) : 'N/D'
  }));

  return {
    pacientes: pacientesLimpos,
    profissionais: profissionaisLimpos,
    escalas: escalasLimpas,
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

