/**
 * Motor de Inteligência Artificial do assistente Teco para a RH Gestão Domiciliar.
 * Integração server-side com Gemini 3.8 Flash (@google/genai) e Function Calling,
 * com tratamento defensivo para chaves inválidas, timeout e modo offline.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { FunctionDeclaration } from '@google/genai';
import { auditLogger } from './auditLogger.ts';
import {
  consultarCadastro,
  consultarEscalas,
  consultarFaturamento,
  InternalApiResponse
} from './internalApiGateway.ts';

// Definição das Function Declarations (Tools) do Gemini
const consultarEscalasDeclaration: FunctionDeclaration = {
  name: 'consultar_escalas',
  description: 'Consulta as escalas de plantão de profissionais (enfermeiros, técnicos, fisioterapeutas, cuidadores) na RH Gestão Domiciliar por período, status ou paciente.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      data_inicio: {
        type: Type.STRING,
        description: 'Data de início do plantão ou escala. Aceita formato ISO (YYYY-MM-DD) ou formato brasileiro (DD/MM/AAAA).'
      },
      data_fim: {
        type: Type.STRING,
        description: 'Data final do período (opcional). Aceita formato ISO (YYYY-MM-DD) ou brasileiro (DD/MM/AAAA).'
      },
      status: {
        type: Type.STRING,
        description: 'Status da escala (opcional). Valores comuns: "confirmado", "pendente", "cancelado".'
      },
      paciente_id: {
        type: Type.STRING,
        description: 'ID ou nome do paciente para filtrar a escala (opcional).'
      }
    },
    required: ['data_inicio']
  }
};

const consultarCadastroDeclaration: FunctionDeclaration = {
  name: 'consultar_cadastro',
  description: 'Consulta cadastros operacionais da RH Gestão Domiciliar: dados de pacientes atendidos, profissionais da equipe multidisciplinar ou convênios de saúde.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tipo: {
        type: Type.STRING,
        description: 'Tipo de cadastro a ser pesquisado: "paciente", "profissional" ou "convenio".'
      },
      termo_busca: {
        type: Type.STRING,
        description: 'Termo de busca como nome da pessoa, convênio, CPF, número do COREN/CREFITO ou ID.'
      }
    },
    required: ['tipo', 'termo_busca']
  }
};

const consultarFaturamentoDeclaration: FunctionDeclaration = {
  name: 'consultar_faturamento',
  description: 'Consulta o faturamento, lotes de guias, valores glosados e recebimentos por competência (mês/ano) e status na RH Gestão Domiciliar.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      competencia: {
        type: Type.STRING,
        description: 'Competência contábil no formato YYYY-MM (ex: "2026-10") ou MM/AAAA (ex: "10/2026").'
      },
      status_pagamento: {
        type: Type.STRING,
        description: 'Status do pagamento (opcional): "pago", "pendente", "em_auditoria", "glosado".'
      }
    },
    required: ['competencia']
  }
};

const SYSTEM_INSTRUCTION = `Você é o Teco, assistente da RH Gestão Domiciliar. Responda de forma profissional e direta. Sempre use as funções disponíveis para consultar escalas, cadastros e faturamento em vez de inventar informações.

Diretrizes obrigatórias de comunicação:
1. Ao responder, formate a mensagem de forma limpa, objetiva e executiva, ideal para leitura rápida no Telegram (use tópicos claros com marcadores como "•", negrito para nomes/datas/valores).
2. Não ultrapasse os limites do Telegram: traga dados essenciais e sintetizados. Se houver muitos registros, liste os principais e informe o total encontrado.
3. Se a consulta à API retornar erro de VPN ("VPN_INDISPONIVEL"), informe com clareza e polidez que a API corporativa interna da RH Gestão Domiciliar não pôde ser acessada no momento e oriente a verificação da conexão VPN.
4. Mantenha sempre o idioma em Português do Brasil com terminologia correta de Home Care (plantão diurno/noturno, escala multidisciplinar, competência contábil, glosa, convênio).`;

export interface TecoResponse {
  texto: string;
  toolCallsExecuted: Array<{
    name: string;
    params: Record<string, unknown>;
    result: InternalApiResponse;
  }>;
}

/**
 * Processa uma mensagem do usuário (seja vinda do Telegram ou do simulador web)
 * através do modelo Gemini com execução iterativa de ferramentas (Function Calling).
 */
export async function processTecoMessage(
  userPrompt: string,
  channel: 'telegram' | 'web_simulator' = 'telegram',
  chatId?: string
): Promise<TecoResponse> {
  const toolCallsExecuted: TecoResponse['toolCallsExecuted'] = [];

  auditLogger.addLog({
    channel,
    chatId,
    eventType: 'user_message',
    details: {
      messageSummary: userPrompt.slice(0, 150)
    }
  });

  const rawKey = process.env.GEMINI_API_KEY?.trim();
  const hasValidKey = Boolean(rawKey && rawKey !== 'MY_GEMINI_API_KEY' && rawKey.length > 20 && rawKey.startsWith('AIza'));

  if (!hasValidKey) {
    // Modo de contingência com execução direta de regras das tools para simulação perfeita
    return executarFallbackContingencia(userPrompt, channel, chatId, toolCallsExecuted, 'Chave GEMINI_API_KEY não configurada ou com placeholder.');
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: rawKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const tools = [{
      functionDeclarations: [
        consultarEscalasDeclaration,
        consultarCadastroDeclaration,
        consultarFaturamentoDeclaration
      ]
    }];

    // Turno inicial
    const response1 = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools
      }
    });

    const functionCalls = response1.functionCalls;

    // Se não houve chamadas de função, retorna o texto direto
    if (!functionCalls || functionCalls.length === 0) {
      const textoFinal = response1.text || 'Entendido. Em que mais posso ajudar na gestão domiciliar?';
      auditLogger.addLog({
        channel,
        chatId,
        eventType: 'model_response',
        details: {
          messageSummary: textoFinal.slice(0, 150)
        }
      });

      return {
        texto: textoFinal,
        toolCallsExecuted
      };
    }

    // Executa todas as funções solicitadas pelo Gemini
    const previousContent = response1.candidates?.[0]?.content;
    const functionResponseParts: Array<{
      functionResponse: {
        id?: string;
        name: string;
        response: Record<string, unknown>;
      };
    }> = [];

    for (const call of functionCalls) {
      const fnName = call.name || 'consultar_escalas';
      const fnArgs = (call.args || {}) as Record<string, unknown>;
      let apiResult: InternalApiResponse;

      if (fnName === 'consultar_escalas') {
        apiResult = await consultarEscalas({
          data_inicio: String(fnArgs.data_inicio || '2026-11-06'),
          data_fim: fnArgs.data_fim ? String(fnArgs.data_fim) : undefined,
          status: fnArgs.status ? String(fnArgs.status) : undefined,
          paciente_id: fnArgs.paciente_id ? String(fnArgs.paciente_id) : undefined
        });
      } else if (fnName === 'consultar_cadastro') {
        apiResult = await consultarCadastro({
          tipo: String(fnArgs.tipo || 'paciente'),
          termo_busca: String(fnArgs.termo_busca || '')
        });
      } else if (fnName === 'consultar_faturamento') {
        apiResult = await consultarFaturamento({
          competencia: String(fnArgs.competencia || '2026-10'),
          status_pagamento: fnArgs.status_pagamento ? String(fnArgs.status_pagamento) : undefined
        });
      } else {
        apiResult = {
          sucesso: false,
          fonte: 'simulador_mock',
          endpoint: '/desconhecido',
          erro: 'FUNCAO_NAO_IMPLEMENTADA',
          mensagem: `Função ${fnName} não reconhecida.`
        };
      }

      toolCallsExecuted.push({
        name: fnName,
        params: fnArgs,
        result: apiResult
      });

      functionResponseParts.push({
        functionResponse: {
          id: call.id,
          name: fnName,
          response: apiResult as unknown as Record<string, unknown>
        }
      });
    }

    // Envia os resultados das funções de volta ao Gemini para síntese final
    const response2 = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: userPrompt }] },
        ...(previousContent ? [previousContent] : []),
        {
          role: 'user',
          parts: functionResponseParts
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools
      }
    });

    const textoFinal = response2.text || 'Consulta concluída com sucesso.';

    auditLogger.addLog({
      channel,
      chatId,
      eventType: 'model_response',
      details: {
        messageSummary: textoFinal.slice(0, 150)
      }
    });

    return {
      texto: textoFinal,
      toolCallsExecuted
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn('[TecoAgent] Aviso ao chamar Gemini API:', errorMsg);

    // Se o erro for de chave de API inválida ou rede, ativa contingência inteligente
    return executarFallbackContingencia(userPrompt, channel, chatId, toolCallsExecuted, errorMsg);
  }
}

/**
 * Fallback de contingência: permite testar as ferramentas e a lógica do Teco
 * mesmo caso a chave GEMINI_API_KEY esteja pendente de configuração nos Secrets.
 */
async function executarFallbackContingencia(
  prompt: string,
  channel: 'telegram' | 'web_simulator',
  chatId: string | undefined,
  toolCallsExecuted: TecoResponse['toolCallsExecuted'],
  motivo: string
): Promise<TecoResponse> {
  const p = prompt.toLowerCase();

  auditLogger.addLog({
    channel,
    chatId,
    eventType: 'vpn_error',
    details: {
      messageSummary: `Modo de contingência ativado (${motivo})`
    }
  });

  // 1. Escalas
  if (p.includes('escala') || p.includes('plantão') || p.includes('plantao') || p.includes('quem está') || p.includes('quem atende') || p.includes('hoje')) {
    const res = await consultarEscalas({ data_inicio: '2026-11-06' });
    toolCallsExecuted.push({
      name: 'consultar_escalas',
      params: { data_inicio: '2026-11-06', status: 'confirmado' },
      result: res
    });

    const escalas = Array.isArray(res.dados) ? res.dados : [];
    let texto = `📅 **Escalas de Plantão da RH Gestão Domiciliar (06/11/2026):**\n\n`;

    if (escalas.length === 0) {
      texto += `Nenhum plantão agendado para o período selecionado.`;
    } else {
      for (const esc of escalas) {
        texto += `• **${esc.paciente_nome}** (${esc.turno})\n`;
        texto += `  Profissional: ${esc.profissional_nome} (${esc.categoria})\n`;
        texto += `  Status: **${esc.status.toUpperCase()}**\n`;
        if (esc.observacoes) texto += `  Obs: ${esc.observacoes}\n`;
        texto += `\n`;
      }
      texto += `Total de plantões encontrados: **${escalas.length}**.`;
    }

    return { texto, toolCallsExecuted };
  }

  // 2. Cadastros
  if (p.includes('cadastro') || p.includes('paciente') || p.includes('profissional') || p.includes('convênio') || p.includes('convenio') || p.includes('helena') || p.includes('carlos') || p.includes('juliana')) {
    let termo = 'Helena';
    if (p.includes('carlos')) termo = 'Carlos';
    if (p.includes('maria')) termo = 'Maria';
    if (p.includes('juliana')) termo = 'Juliana';
    if (p.includes('beatriz')) termo = 'Beatriz';
    if (p.includes('unimed')) termo = 'Unimed';
    if (p.includes('bradesco')) termo = 'Bradesco';

    const tipo = p.includes('convenio') || p.includes('convênio')
      ? 'convenio'
      : (p.includes('profissional') || p.includes('enfermeira') || p.includes('fisioterapeuta') ? 'profissional' : 'paciente');

    const res = await consultarCadastro({ tipo, termo_busca: termo });
    toolCallsExecuted.push({
      name: 'consultar_cadastro',
      params: { tipo, termo_busca: termo },
      result: res
    });

    const cads = Array.isArray(res.dados) ? res.dados : [];
    let texto = `👤 **Consulta de Cadastros — RH Gestão Domiciliar:**\n\n`;
    if (cads.length === 0) {
      texto += `Nenhum registro encontrado para a busca "${termo}".`;
    } else {
      for (const item of cads) {
        texto += `• **${item.nome}** (ID: ${item.id} · ${item.status.toUpperCase()})\n`;
        if (item.documento) texto += `  Documento: ${item.documento}\n`;
        if (item.detalhes) {
          for (const [k, v] of Object.entries(item.detalhes)) {
            texto += `  ${k.replace(/_/g, ' ')}: ${v}\n`;
          }
        }
        texto += `\n`;
      }
    }

    return { texto, toolCallsExecuted };
  }

  // 3. Faturamento
  if (p.includes('fatur') || p.includes('glosa') || p.includes('competência') || p.includes('competencia') || p.includes('pagamento')) {
    const res = await consultarFaturamento({ competencia: '2026-10' });
    toolCallsExecuted.push({
      name: 'consultar_faturamento',
      params: { competencia: '2026-10' },
      result: res
    });

    const faturas = Array.isArray(res.dados) ? res.dados : [];
    let texto = `💰 **Relatório de Faturamento — Competência 10/2026:**\n\n`;

    if (faturas.length === 0) {
      texto += `Nenhum lote faturado encontrado para esta competência.`;
    } else {
      let totalBruto = 0;
      let totalLiq = 0;
      let totalGlosas = 0;

      for (const fat of faturas) {
        totalBruto += fat.valor_total_bruto;
        totalLiq += fat.valor_liquido;
        totalGlosas += fat.valor_glosado;

        texto += `• **${fat.convenio}** (${fat.id})\n`;
        texto += `  Atendimentos: ${fat.quantidade_atendimentos} | Bruto: R$ ${fat.valor_total_bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        texto += `  Glosas: R$ ${fat.valor_glosado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Líquido: **R$ ${fat.valor_liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**\n`;
        texto += `  Status: **${fat.status_pagamento.toUpperCase()}** (Previsto: ${fat.data_prevista_pagamento})\n\n`;
      }

      texto += `📊 **Consolidado Competência:**\n`;
      texto += `Total Bruto: R$ ${totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      texto += `Total Glosas: R$ ${totalGlosas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      texto += `Total Líquido a Receber: **R$ ${totalLiq.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**`;
    }

    return { texto, toolCallsExecuted };
  }

  // Mensagem Geral
  return {
    texto: `Olá! Sou o **Teco**, assistente da **RH Gestão Domiciliar**.\n\n` +
      `Estou pronto para responder sobre:\n` +
      `• 📅 **Escalas**: "Quem está de plantão hoje?", "Escala da Dona Helena"\n` +
      `• 👤 **Cadastros**: "Consulte a paciente Dona Helena", "Dados do convênio Unimed"\n` +
      `• 💰 **Faturamento**: "Status do faturamento da competência 10/2026"\n\n` +
      `Como posso lhe auxiliar hoje?`,
    toolCallsExecuted
  };
}
