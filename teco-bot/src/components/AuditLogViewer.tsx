import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, ShieldAlert, Cpu, Database, MessageSquare, Terminal } from 'lucide-react';
import { AuditLogItem } from '../types.ts';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.sucesso) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Erro ao buscar logs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (e) {
      console.error('Erro ao limpar logs:', e);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterType === 'all') return true;
    if (filterType === 'vpn') return log.eventType === 'vpn_error';
    if (filterType === 'tools') return log.eventType === 'function_call' || log.eventType === 'api_fetch';
    if (filterType === 'telegram') return log.channel === 'telegram';
    return true;
  });

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      {/* Barra de Ações e Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Auditoria de Chamadas e Eventos</h3>
          <p className="text-xs text-slate-500">
            Registro de execuções de ferramentas, requisições HTTP, tentativas de acesso e status de VPN.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Filter Control */}
          <div className="flex items-center p-1 bg-slate-100 rounded-md">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterType === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({logs.length})
            </button>
            <button
              onClick={() => setFilterType('tools')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterType === 'tools' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ferramentas
            </button>
            <button
              onClick={() => setFilterType('vpn')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterType === 'vpn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Erros VPN
            </button>
            <button
              onClick={() => setFilterType('telegram')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterType === 'telegram' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Telegram
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            title="Atualizar Logs"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={clearLogs}
            className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Limpar Histórico"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Lista de Logs */}
      <div className="mt-4 overflow-hidden border border-slate-200 rounded-lg">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            Nenhum evento registrado no filtro selecionado. Envie uma mensagem pelo Telegram ou pelo simulador web.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogId === log.id;
              const isVpnError = log.eventType === 'vpn_error';
              const isSecurity = log.eventType === 'security_block';

              return (
                <div
                  key={log.id}
                  className={`p-3 text-xs transition-colors hover:bg-slate-50/70 ${
                    isVpnError ? 'bg-rose-50/30' : isSecurity ? 'bg-amber-50/30' : ''
                  }`}
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono-code text-slate-500 text-[11px] shrink-0">
                        {log.timeFormatted}
                      </span>

                      {/* Ícone de Evento */}
                      <span className="shrink-0">
                        {log.eventType === 'function_call' && <Terminal className="w-3.5 h-3.5 text-sky-700" />}
                        {log.eventType === 'api_fetch' && <Database className="w-3.5 h-3.5 text-teal-700" />}
                        {log.eventType === 'vpn_error' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                        {log.eventType === 'user_message' && <MessageSquare className="w-3.5 h-3.5 text-indigo-700" />}
                        {log.eventType === 'model_response' && <Cpu className="w-3.5 h-3.5 text-emerald-700" />}
                        {log.eventType === 'security_block' && <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />}
                      </span>

                      {/* Descrição do Evento */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 font-mono-code">
                          {log.details.functionName || log.eventType}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600 truncate max-w-md">
                          {log.details.messageSummary || log.details.error || log.details.apiUrl || 'Evento registrado'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-[11px]">
                      {log.details.latencyMs !== undefined && (
                        <span className="font-mono-code text-slate-500">
                          {log.details.latencyMs}ms
                        </span>
                      )}
                      {log.details.httpStatus && (
                        <span className={`font-mono-code font-semibold px-1.5 py-0.5 rounded ${
                          log.details.httpStatus === 200 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          HTTP {log.details.httpStatus}
                        </span>
                      )}
                      <span className="text-slate-400 font-mono-code">
                        {log.channel === 'telegram' ? 'Telegram' : 'Web'}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes Técnicos Expandidos */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 font-mono-code text-[11px] bg-slate-900 text-slate-200 p-3 rounded">
                      <div className="text-slate-400 mb-1">// Dados completos do evento:</div>
                      <pre className="overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(log, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
