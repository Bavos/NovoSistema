export interface ServiceStatus {
  sucesso: boolean;
  timestamp: string;
  servicos: {
    telegram: {
      ativo: boolean;
      modo: 'long_polling';
      botUsername?: string;
      allowedChatId?: string | null;
      tokenConfigurado: boolean;
      totalMensagensProcessadas: number;
      mensagensBloqueadas: number;
      ultimoErro?: string;
      iniciadoEm?: string;
    };
    gemini: {
      modelo: string;
      apiKeyConfigurada: boolean;
      status: string;
    };
    apiInterna: {
      baseUrl: string | null;
      bearerTokenConfigurado: boolean;
      modoSimuladorAtivo: boolean;
      statusVPN: string;
    };
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'teco';
  text: string;
  timestamp: string;
  toolCalls?: Array<{
    name: string;
    params: Record<string, unknown>;
    result: {
      sucesso: boolean;
      fonte: string;
      endpoint: string;
      total_registros?: number;
      dados?: unknown;
      erro?: string;
      mensagem?: string;
    };
  }>;
  latencyMs?: number;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  timeFormatted: string;
  channel: 'telegram' | 'web_simulator' | 'system';
  chatId?: string;
  eventType: 'user_message' | 'function_call' | 'api_fetch' | 'vpn_error' | 'model_response' | 'security_block';
  details: {
    functionName?: string;
    params?: Record<string, unknown>;
    apiUrl?: string;
    httpStatus?: number;
    latencyMs?: number;
    error?: string;
    messageSummary?: string;
    dataPreview?: unknown;
  };
}
