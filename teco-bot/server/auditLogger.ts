/**
 * Módulo de auditoria e logs estruturados em memória para o bot Teco.
 * Permite inspecionar em tempo real no painel administrativo as chamadas de ferramentas,
 * respostas da API interna, eventos do Telegram e erros de rede/VPN.
 */

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO
  timeFormatted: string; // HH:mm:ss
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

class AuditLogger {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 100;

  addLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'timeFormatted'>): AuditLogEntry {
    const now = new Date();
    const fullEntry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: now.toISOString(),
      timeFormatted: now.toLocaleTimeString('pt-BR', { hour12: false }),
      ...entry,
    };

    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    return fullEntry;
  }

  getLogs(): AuditLogEntry[] {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const auditLogger = new AuditLogger();
