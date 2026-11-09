/**
 * Gateway de integração com a API interna da RH Gestão Domiciliar.
 * Suporta autenticação Bearer, mapeamento flexível de datas (ISO <-> BR),
 * detecção de timeout / falha de VPN e contingência com simulador local em memória.
 */

import { auditLogger } from './auditLogger.ts';
import { normalizeDate } from './dateUtils.ts';
import { MOCK_CADASTROS, MOCK_ESCALAS, MOCK_FATURAMENTO } from './mockData.ts';

// Configuração de modo Mock em tempo de execução
let isMockModeActive = process.env.USE_MOCK_INTERNAL_API !== 'false';

export function getMockMode(): boolean {
  return isMockModeActive;
}

export function setMockMode(active: boolean): void {
  isMockModeActive = active;
}

export interface InternalApiResponse<T = unknown> {
  sucesso: boolean;
  fonte: 'api_real' | 'simulador_mock';
  endpoint: string;
  dados?: T;
  total_registros?: number;
  erro?: string;
  mensagem?: string;
  detalhes_tecnicos?: string;
}

/**
 * Consulta de Escalas de Home Care
 */
export async function consultarEscalas(params: {
  data_inicio: string;
  data_fim?: string;
  status?: string;
  paciente_id?: string;
}): Promise<InternalApiResponse> {
  const startTime = Date.now();
  const dataInicioIso = normalizeDate(params.data_inicio, 'ISO');
  const dataInicioBr = normalizeDate(params.data_inicio, 'BR');
  const dataFimIso = normalizeDate(params.data_fim, 'ISO');
  const dataFimBr = normalizeDate(params.data_fim, 'BR');

  const normalizedParams = {
    data_inicio: dataInicioIso || params.data_inicio,
    data_inicio_br: dataInicioBr,
    data_fim: dataFimIso || params.data_fim,
    data_fim_br: dataFimBr,
    status: params.status?.toLowerCase().trim(),
    paciente_id: params.paciente_id?.trim()
  };

  auditLogger.addLog({
    channel: 'system',
    eventType: 'function_call',
    details: {
      functionName: 'consultar_escalas',
      params: normalizedParams,
      messageSummary: `Consulta de escalas para ${dataInicioBr || params.data_inicio}${dataFimBr ? ` até ${dataFimBr}` : ''}`
    }
  });

  // Se o modo mock estiver explicitamente ativado, usa dados do mock
  if (isMockModeActive) {
    const resultados = MOCK_ESCALAS.filter(item => {
      // Filtro de data
      if (normalizedParams.data_inicio && normalizedParams.data_fim) {
        if (item.data < normalizedParams.data_inicio || item.data > normalizedParams.data_fim) {
          return false;
        }
      } else if (normalizedParams.data_inicio) {
        if (item.data !== normalizedParams.data_inicio) {
          return false;
        }
      }

      // Filtro de status
      if (normalizedParams.status && item.status.toLowerCase() !== normalizedParams.status) {
        return false;
      }

      // Filtro de paciente
      if (normalizedParams.paciente_id) {
        const idMatch = item.paciente_id.toLowerCase().includes(normalizedParams.paciente_id.toLowerCase());
        const nomeMatch = item.paciente_nome.toLowerCase().includes(normalizedParams.paciente_id.toLowerCase());
        if (!idMatch && !nomeMatch) {
          return false;
        }
      }

      return true;
    });

    const latencyMs = Date.now() - startTime;
    auditLogger.addLog({
      channel: 'system',
      eventType: 'api_fetch',
      details: {
        functionName: 'consultar_escalas',
        apiUrl: 'simulador://rhgestaodomiciliar/escalas',
        httpStatus: 200,
        latencyMs,
        dataPreview: { total: resultados.length }
      }
    });

    return {
      sucesso: true,
      fonte: 'simulador_mock',
      endpoint: '/escalas',
      total_registros: resultados.length,
      dados: resultados
    };
  }

  // Modo API Real
  return executarChamadaApiReal('/escalas', normalizedParams, 'consultar_escalas', startTime);
}

/**
 * Consulta de Cadastros (Pacientes, Profissionais ou Convênios)
 */
export async function consultarCadastro(params: {
  tipo: 'paciente' | 'profissional' | 'convenio' | string;
  termo_busca: string;
}): Promise<InternalApiResponse> {
  const startTime = Date.now();
  const normalizedParams = {
    tipo: params.tipo?.toLowerCase().trim(),
    termo_busca: params.termo_busca?.trim() || ''
  };

  auditLogger.addLog({
    channel: 'system',
    eventType: 'function_call',
    details: {
      functionName: 'consultar_cadastro',
      params: normalizedParams,
      messageSummary: `Consulta de cadastro [${normalizedParams.tipo}] por "${normalizedParams.termo_busca}"`
    }
  });

  if (isMockModeActive) {
    const termo = normalizedParams.termo_busca.toLowerCase();
    const resultados = MOCK_CADASTROS.filter(item => {
      // Filtra por tipo caso especificado
      if (normalizedParams.tipo && item.tipo !== normalizedParams.tipo) {
        return false;
      }

      if (!termo) return true;

      const nomeMatch = item.nome.toLowerCase().includes(termo);
      const idMatch = item.id.toLowerCase().includes(termo);
      const docMatch = item.documento?.toLowerCase().includes(termo) ?? false;
      const detailsMatch = JSON.stringify(item.detalhes).toLowerCase().includes(termo);

      return nomeMatch || idMatch || docMatch || detailsMatch;
    });

    const latencyMs = Date.now() - startTime;
    auditLogger.addLog({
      channel: 'system',
      eventType: 'api_fetch',
      details: {
        functionName: 'consultar_cadastro',
        apiUrl: 'simulador://rhgestaodomiciliar/cadastros',
        httpStatus: 200,
        latencyMs,
        dataPreview: { total: resultados.length }
      }
    });

    return {
      sucesso: true,
      fonte: 'simulador_mock',
      endpoint: '/cadastros',
      total_registros: resultados.length,
      dados: resultados
    };
  }

  return executarChamadaApiReal('/cadastros', normalizedParams, 'consultar_cadastro', startTime);
}

/**
 * Consulta de Faturamento e Lotes de Guias
 */
export async function consultarFaturamento(params: {
  competencia: string;
  status_pagamento?: string;
}): Promise<InternalApiResponse> {
  const startTime = Date.now();
  const competenciaIso = normalizeDate(params.competencia, 'ISO'); // YYYY-MM
  const competenciaBr = normalizeDate(params.competencia, 'BR'); // MM/AAAA

  const normalizedParams = {
    competencia: competenciaIso || params.competencia,
    competencia_br: competenciaBr,
    status_pagamento: params.status_pagamento?.toLowerCase().trim()
  };

  auditLogger.addLog({
    channel: 'system',
    eventType: 'function_call',
    details: {
      functionName: 'consultar_faturamento',
      params: normalizedParams,
      messageSummary: `Consulta de faturamento para competência ${competenciaBr || params.competencia}`
    }
  });

  if (isMockModeActive) {
    const resultados = MOCK_FATURAMENTO.filter(item => {
      if (normalizedParams.competencia && item.competencia !== normalizedParams.competencia) {
        return false;
      }
      if (normalizedParams.status_pagamento && item.status_pagamento.toLowerCase() !== normalizedParams.status_pagamento) {
        return false;
      }
      return true;
    });

    const latencyMs = Date.now() - startTime;
    auditLogger.addLog({
      channel: 'system',
      eventType: 'api_fetch',
      details: {
        functionName: 'consultar_faturamento',
        apiUrl: 'simulador://rhgestaodomiciliar/faturamento',
        httpStatus: 200,
        latencyMs,
        dataPreview: { total: resultados.length }
      }
    });

    return {
      sucesso: true,
      fonte: 'simulador_mock',
      endpoint: '/faturamento',
      total_registros: resultados.length,
      dados: resultados
    };
  }

  return executarChamadaApiReal('/faturamento', normalizedParams, 'consultar_faturamento', startTime);
}

/**
 * Executa requisição HTTP real à API_BASE_URL interna com Bearer Token e captura de erros de VPN.
 */
async function executarChamadaApiReal(
  endpointPath: string,
  params: Record<string, string | undefined>,
  functionName: string,
  startTime: number
): Promise<InternalApiResponse> {
  const baseUrl = process.env.API_BASE_URL?.trim();
  const token = process.env.INTERNAL_BEARER_TOKEN?.trim();

  if (!baseUrl) {
    const msg = 'Variável de ambiente API_BASE_URL não está configurada no servidor.';
    auditLogger.addLog({
      channel: 'system',
      eventType: 'vpn_error',
      details: { functionName, error: msg }
    });
    return {
      sucesso: false,
      fonte: 'api_real',
      endpoint: endpointPath,
      erro: 'CONFIGURACAO_AUSENTE',
      mensagem: msg
    };
  }

  // Monta URL com query params limpando undefined
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, value);
    }
  }

  const urlString = `${baseUrl.replace(/\/+$/, '')}${endpointPath}?${query.toString()}`;

  // AbortController para timeout de 8 segundos (tempo adequado para VPN corporativa)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'TecoBot-RHGestaoDomiciliar/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(urlString, {
      method: 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      auditLogger.addLog({
        channel: 'system',
        eventType: 'api_fetch',
        details: {
          functionName,
          apiUrl: urlString,
          httpStatus: response.status,
          latencyMs,
          error: errorText.slice(0, 300)
        }
      });

      return {
        sucesso: false,
        fonte: 'api_real',
        endpoint: endpointPath,
        erro: `HTTP_${response.status}`,
        mensagem: `A API interna retornou status HTTP ${response.status}.`,
        detalhes_tecnicos: errorText.slice(0, 300)
      };
    }

    const data = await response.json();
    auditLogger.addLog({
      channel: 'system',
      eventType: 'api_fetch',
      details: {
        functionName,
        apiUrl: urlString,
        httpStatus: response.status,
        latencyMs,
        dataPreview: Array.isArray(data) ? { total: data.length } : { status: 'ok' }
      }
    });

    return {
      sucesso: true,
      fonte: 'api_real',
      endpoint: endpointPath,
      dados: data,
      total_registros: Array.isArray(data) ? data.length : undefined
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = err instanceof Error && err.name === 'AbortError';

    auditLogger.addLog({
      channel: 'system',
      eventType: 'vpn_error',
      details: {
        functionName,
        apiUrl: urlString,
        latencyMs,
        error: isTimeout ? 'Timeout de 8 segundos esgotado' : errorMsg
      }
    });

    return {
      sucesso: false,
      fonte: 'api_real',
      endpoint: endpointPath,
      erro: 'VPN_INDISPONIVEL',
      mensagem: isTimeout
        ? 'Tempo limite de resposta esgotado (8s). A VPN corporativa da RH Gestão Domiciliar pode estar lenta ou inacessível.'
        : 'A API interna da RH Gestão Domiciliar não pôde ser alcançada. Verifique se o túnel da VPN corporativa está conectado e operacional.',
      detalhes_tecnicos: errorMsg
    };
  }
}
