/**
 * @file src/services/geminiOperacoesService.ts
 * @description Serviço seguro para geração de relatórios de inteligência operacional via Gemini.
 * Atende aos requisitos de LGPD, zero exposição de chave no cliente e execução restrita a administradores.
 */

import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../lib/firebase';

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

export interface ResultadoAnaliseOperacoes {
  sucesso: boolean;
  relatorioMarkdown: string;
  metricasGerais?: {
    totalPacientesCadastrados: number;
    pacientesAtivos: number;
    totalProfissionaisCadastrados: number;
    profissionaisAtivos: number;
    totalEscalasRegistradas: number;
    escalasSemProfissionalAlocado: number;
    escalasConcluidas: number;
    totaisConsolidados?: any;
  };
  requisicoesRestantesMinuto?: number;
  timestamp: string;
}

/**
 * Higienização prévia no cliente (Camada 1 de Proteção LGPD).
 * Garante que nenhum CPF, RG, telefone ou endereço físico trafegue na rede.
 */
function sanitizarPayloadAntesDeEnviar(dados: MetricasConsolidadasInput) {
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
    pacienteId: e.pacienteId ? `PAC-REF` : 'PAC-GENERIC',
    profissionalId: e.profissionalId ? `P-REF` : null,
    tipoTurno: e.tipoTurno || e.turno || '12h Diurno',
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
 * Dispara a análise de métricas para a rota segura no servidor / Cloud Function
 */
export async function gerarRelatorioInsightsOperacionais(
  dados: MetricasConsolidadasInput
): Promise<ResultadoAnaliseOperacoes> {
  const payloadHigienizado = sanitizarPayloadAntesDeEnviar(dados);

  // 1. Tentar primeiro via Firebase Cloud Function (httpsCallable)
  try {
    const chamarAnaliseCloud = httpsCallable<any, ResultadoAnaliseOperacoes>(
      functions,
      'analisarMetricasHomeCare'
    );
    const resultado = await chamarAnaliseCloud(payloadHigienizado);
    if (resultado?.data && resultado.data.sucesso) {
      return resultado.data;
    }
  } catch (cloudFnError: any) {
    console.warn(
      '[geminiOperacoesService] Cloud Function indisponível ou emulada, acionando endpoint seguro /api/analisar-metricas:',
      cloudFnError?.message
    );
  }

  // 2. Fallback resiliente: Endpoint seguro de backend (/api/analisar-metricas)
  try {
    let idToken = '';
    if (auth.currentUser) {
      idToken = await auth.currentUser.getIdToken(false);
    }

    const response = await fetch('/api/analisar-metricas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: idToken ? `Bearer ${idToken}` : '',
      },
      body: JSON.stringify(payloadHigienizado),
    });

    const data = await response.json();

    if (!response.ok || !data.sucesso) {
      throw new Error(data.erro || `Erro do servidor HTTP ${response.status}`);
    }

    return data as ResultadoAnaliseOperacoes;
  } catch (backendError: any) {
    console.error('[geminiOperacoesService] Erro em ambos os canais:', backendError);
    throw new Error(
      backendError?.message ||
        'Não foi possível conectar ao serviço de inteligência operacional. Verifique a conexão ou tente novamente.'
    );
  }
}
