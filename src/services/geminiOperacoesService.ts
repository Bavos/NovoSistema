/**
 * @file src/services/geminiOperacoesService.ts
 * @description Serviço seguro para consultas de inteligência operacional.
 * Atende aos requisitos de LGPD, zero exposição de chave no cliente e execução restrita a administradores.
 */

import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../lib/firebase';

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

  // 1. Chamada via SDK Oficial do Firebase Functions (região southamerica-east1)
  try {
    const functions = getFunctions(undefined, 'southamerica-east1');
    const consultarIA = httpsCallable<any, any>(functions, 'analisarMetricasHomeCare');

    const result = await consultarIA({
      pergunta: textoPergunta || '',
      metricas: dadosAnonimizados
    });

    const data = result?.data;
    let textoRetornado = '';

    if (typeof data === 'string') {
      textoRetornado = data;
    } else if (data && typeof data === 'object') {
      textoRetornado = data.resposta || data.relatorio || data.relatorioMarkdown || '';
    }

    if (textoRetornado) {
      return {
        sucesso: true,
        resposta: textoRetornado,
        metricasGerais: data?.metricasGerais,
        timestamp: data?.timestamp || new Date().toISOString()
      };
    }
  } catch (cloudFnError: any) {
    console.warn(
      '[Assistente Operacional] Cloud Function indisponível na nuvem ou emulada, acionando rota local segura:',
      cloudFnError?.message || cloudFnError
    );
  }

  // 2. Fallback resiliente: Rota de backend segura (/api/analisar-metricas)
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
      body: JSON.stringify({
        pergunta: textoPergunta || '',
        metricas: dadosAnonimizados
      }),
    });

    const responseText = await response.text();
    let parsedData: any = null;

    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Se o backend retornou texto puro/markdown diretamente
      return {
        sucesso: true,
        resposta: responseText,
        timestamp: new Date().toISOString()
      };
    }

    if (!response.ok || (parsedData && parsedData.sucesso === false)) {
      throw new Error(parsedData?.erro || `Erro HTTP ${response.status}`);
    }

    const textoFinal = 
      parsedData?.resposta || 
      parsedData?.relatorio || 
      parsedData?.relatorioMarkdown || 
      (typeof parsedData === 'string' ? parsedData : '');

    return {
      sucesso: true,
      resposta: textoFinal,
      metricasGerais: parsedData?.metricasGerais,
      timestamp: parsedData?.timestamp || new Date().toISOString()
    };
  } catch (backendError: any) {
    console.error('[Assistente Operacional] Erro nos canais de comunicação:', backendError);
    throw new Error(
      backendError?.message ||
      'Não foi possível obter resposta do Assistente Operacional. Por favor, tente novamente.'
    );
  }
}

// Manter compatibilidade com chamadas existentes
export const gerarRelatorioInsightsOperacionais = (dados: MetricasConsolidadasInput) => {
  return consultarAssistenteOperacional('', dados);
};

