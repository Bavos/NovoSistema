import React, { useState } from 'react';
import { Bot, Cpu, Database, RefreshCw, Shield, KeyRound, Network, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { ServiceStatus } from '../types.ts';

interface StatusCardsProps {
  status: ServiceStatus | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const StatusCards: React.FC<StatusCardsProps> = ({ status, onRefresh, isLoading }) => {
  const [isRestartingBot, setIsRestartingBot] = useState(false);
  const [restartMessage, setRestartMessage] = useState<string | null>(null);

  const telegram = status?.servicos.telegram;
  const gemini = status?.servicos.gemini;
  const apiInterna = status?.servicos.apiInterna;

  const handleRestartBot = async () => {
    setIsRestartingBot(true);
    setRestartMessage(null);
    try {
      const res = await fetch('/api/bot/restart', { method: 'POST' });
      const data = await res.json();
      setRestartMessage(data.mensagem || (data.sucesso ? 'Bot reiniciado com sucesso.' : 'Falha ao reiniciar.'));
      onRefresh();
    } catch {
      setRestartMessage('Erro ao comunicar com o servidor.');
    } finally {
      setIsRestartingBot(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Resumo de Conectividade em 3 Colunas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Telegram Bot */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-sky-50 text-sky-700 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Bot Telegram (Telegraf)</h3>
                <span className="text-xs text-slate-500">Modo: Long Polling</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {telegram?.ativo ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  {telegram?.tokenConfigurado ? 'Reconectando' : 'Sem Token'}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Usuário do Bot:</span>
              <span className="font-mono-code font-medium text-slate-800">
                {telegram?.botUsername ? `@${telegram.botUsername}` : (telegram?.tokenConfigurado ? 'Carregando...' : 'Não configurado')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Chat ID Autorizado:</span>
              <span className="font-mono-code font-medium text-slate-800">
                {telegram?.allowedChatId ? telegram.allowedChatId : 'Filtro desativado (Qualquer ID)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Mensagens Processadas:</span>
              <span className="font-mono-code font-medium text-slate-800">
                {telegram?.totalMensagensProcessadas ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Acessos Bloqueados:</span>
              <span className="font-mono-code font-medium text-rose-600">
                {telegram?.mensagensBloqueadas ?? 0}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleRestartBot}
              disabled={isRestartingBot || !telegram?.tokenConfigurado}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRestartingBot ? 'animate-spin' : ''}`} />
              Reiniciar Polling
            </button>
            {telegram?.ultimoErro && (
              <span className="text-[11px] text-rose-600 truncate max-w-[160px]" title={telegram.ultimoErro}>
                {telegram.ultimoErro}
              </span>
            )}
          </div>
          {restartMessage && (
            <p className="mt-2 text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-200">
              {restartMessage}
            </p>
          )}
        </div>

        {/* Card 2: Gemini AI */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Motor Gemini AI</h3>
                <span className="text-xs text-slate-500 font-mono-code">gemini-3.8-flash</span>
              </div>
            </div>
            <div>
              {gemini?.apiKeyConfigurada ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Pronto
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Chave Ausente
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">SDK TypeScript:</span>
              <span className="font-mono-code font-medium text-slate-800">@google/genai</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">System Instruction:</span>
              <span className="text-slate-800 font-medium">RH Gestão Domiciliar</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Tools Declaradas:</span>
              <span className="font-mono-code text-slate-800 font-medium">3 funções ativas</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Telemetria User-Agent:</span>
              <span className="font-mono-code text-slate-800">aistudio-build</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <KeyRound className="w-3 h-3 text-slate-400" />
              <span>Chave injetada automaticamente pelo AI Studio Secrets</span>
            </div>
          </div>
        </div>

        {/* Card 3: API Interna & VPN */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">API Interna RH</h3>
                <span className="text-xs text-slate-500">Gateway com Bearer Token</span>
              </div>
            </div>
            <div>
              {apiInterna?.modoSimuladorAtivo ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Simulador Ativo
                </span>
              ) : apiInterna?.baseUrl ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-700">
                  <Network className="w-3.5 h-3.5 text-sky-600" />
                  Rede VPN
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  URL Não Definida
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Base URL:</span>
              <span className="font-mono-code font-medium text-slate-800 truncate max-w-[170px]" title={apiInterna?.baseUrl || 'Não configurada'}>
                {apiInterna?.baseUrl || 'simulador://rh-local'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Bearer Token:</span>
              <span className="font-mono-code font-medium text-slate-800">
                {apiInterna?.bearerTokenConfigurado ? 'Configurado (Oculto)' : 'Pendente no .env'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Timeout Protegido:</span>
              <span className="font-mono-code font-medium text-slate-800">8.000 ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Formato de Datas:</span>
              <span className="font-mono-code font-medium text-slate-800">ISO e Padrão BR (DD/MM)</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              {apiInterna?.modoSimuladorAtivo
                ? 'Sem VPN necessária no modo simulador'
                : 'Verifique se a VPN corporativa está ativa'}
            </span>
          </div>
        </div>
      </div>

      {/* Orientações Rápidas de Configuração de Ambiente (.env) */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-sky-700" />
          Guia de Variáveis de Ambiente (.env)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
            <div className="font-mono-code font-semibold text-slate-900 mb-1">TELEGRAM_BOT_TOKEN</div>
            <p className="text-slate-600 mb-2">Token obtido com @BotFather para autenticar o bot Teco no Telegram.</p>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              telegram?.tokenConfigurado ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {telegram?.tokenConfigurado ? 'Definido no ambiente' : 'Não definido (use simulador web)'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
            <div className="font-mono-code font-semibold text-slate-900 mb-1">ALLOWED_CHAT_ID</div>
            <p className="text-slate-600 mb-2">Filtro de segurança que restringe as respostas apenas ao seu usuário.</p>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              telegram?.allowedChatId ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {telegram?.allowedChatId ? `Restrito a: ${telegram.allowedChatId}` : 'Aberto (configure para restringir)'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
            <div className="font-mono-code font-semibold text-slate-900 mb-1">API_BASE_URL</div>
            <p className="text-slate-600 mb-2">Endereço HTTP da API interna da RH Gestão Domiciliar na rede VPN.</p>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              apiInterna?.baseUrl ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {apiInterna?.baseUrl ? 'Definida' : 'Opcional no modo simulador'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded border border-slate-200/80">
            <div className="font-mono-code font-semibold text-slate-900 mb-1">INTERNAL_BEARER_TOKEN</div>
            <p className="text-slate-600 mb-2">Token repassado no header Authorization: Bearer da API interna.</p>
            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
              apiInterna?.bearerTokenConfigurado ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {apiInterna?.bearerTokenConfigurado ? 'Configurado' : 'Opcional no modo simulador'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
