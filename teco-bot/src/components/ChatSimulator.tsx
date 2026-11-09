import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Wrench, ChevronDown, ChevronRight, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ChatMessage } from '../types.ts';

const PROMPT_SUGGESTIONS = [
  'Quem está de plantão hoje na escala?',
  'Consulte o cadastro da paciente Dona Helena Silveira',
  'Qual o faturamento da competência 10/2026?',
  'Quais são os plantões pendentes de confirmação?',
  'Consulte o cadastro do convênio Unimed Seguros'
];

export const ChatSimulator: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init',
      sender: 'teco',
      text: 'Olá! Sou o **Teco**, assistente administrativo da **RH Gestão Domiciliar**.\n\nPosso consultar em tempo real escalas de plantão, cadastros de pacientes e profissionais, além de dados contábeis de faturamento. Como posso ajudar agora?',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const toggleToolExpand = (key: string) => {
    setExpandedTools(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });

      const data = await response.json();

      if (data.sucesso) {
        const botMsg: ChatMessage = {
          id: `teco-${Date.now()}`,
          sender: 'teco',
          text: data.texto,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          toolCalls: data.toolCallsExecuted,
          latencyMs: data.latencyMs
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          sender: 'teco',
          text: `⚠️ Erro ao processar requisição: ${data.erro || 'Falha no servidor.'}`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'teco',
        text: `⚠️ Falha de comunicação com o backend: ${errMsg}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      {/* Coluna da Esquerda: Informações e Atalhos */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-sky-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Sugestões de Consulta</h3>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Clique em qualquer sugestão para testar o disparo das ferramentas e a resposta executiva:
          </p>
          <div className="space-y-1.5">
            {PROMPT_SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sug)}
                disabled={isLoading}
                className="w-full text-left p-2 rounded text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 transition-colors disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs text-slate-600 space-y-2">
          <h4 className="font-semibold text-slate-900">Como funciona o Teco:</h4>
          <p>
            1. Você envia uma pergunta em linguagem natural no Telegram ou neste simulador.
          </p>
          <p>
            2. O <strong>Gemini 3.8 Flash</strong> avalia a intenção e chama a função correspondente (<span className="font-mono-code text-[11px]">consultar_escalas</span>, <span className="font-mono-code text-[11px]">consultar_cadastro</span> ou <span className="font-mono-code text-[11px]">consultar_faturamento</span>).
          </p>
          <p>
            3. O gateway consulta a API interna com <strong>Bearer Token</strong> (ou o simulador local).
          </p>
          <p>
            4. Os dados retornam ao Gemini, que sintetiza a resposta direta e concisa.
          </p>
        </div>
      </div>

      {/* Coluna Central/Direita: Janela de Chat do Telegram */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg flex flex-col h-[650px] shadow-xs">
        {/* Cabeçalho do Chat */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs">
              T
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Teco</span>
                <span className="text-[11px] text-slate-500 font-mono-code">@teco_rh_bot</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Assistente Administrativo · RH Gestão Domiciliar
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500">Simulador de Chat</span>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3.5 text-xs leading-relaxed shadow-xs ${
                    isUser
                      ? 'bg-sky-700 text-white rounded-br-none'
                      : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1 text-[11px] opacity-75">
                    <span className="font-semibold">{isUser ? 'Você' : 'Teco'}</span>
                    <span className="font-mono-code">{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {/* Detalhes de Chamadas de Ferramentas (Function Calling) */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-sky-700" />
                        <span>Ferramentas Executadas ({msg.toolCalls.length})</span>
                        {msg.latencyMs && (
                          <span className="text-slate-400 font-mono-code">· {msg.latencyMs}ms</span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {msg.toolCalls.map((tc, idx) => {
                          const toolKey = `${msg.id}-${idx}`;
                          const isExpanded = !!expandedTools[toolKey];
                          const isSuccess = tc.result.sucesso;

                          return (
                            <div
                              key={idx}
                              className="bg-slate-50 rounded border border-slate-200 text-[11px]"
                            >
                              <button
                                onClick={() => toggleToolExpand(toolKey)}
                                className="w-full px-2.5 py-1.5 flex items-center justify-between text-left hover:bg-slate-100 transition-colors"
                              >
                                <div className="flex items-center gap-1.5 font-mono-code">
                                  {isSuccess ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  )}
                                  <span className="font-semibold text-slate-800">{tc.name}</span>
                                  <span className="text-slate-500">
                                    ({tc.result.fonte === 'simulador_mock' ? 'Simulador Local' : 'API Real'})
                                  </span>
                                </div>
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                )}
                              </button>

                              {isExpanded && (
                                <div className="p-2.5 border-t border-slate-200 bg-white font-mono-code text-[11px] space-y-2">
                                  <div>
                                    <span className="text-slate-500">Parâmetros Enviados:</span>
                                    <pre className="mt-1 p-1.5 bg-slate-50 rounded overflow-x-auto text-slate-800">
                                      {JSON.stringify(tc.params, null, 2)}
                                    </pre>
                                  </div>
                                  <div>
                                    <span className="text-slate-500">Resposta da API Interna:</span>
                                    <pre className="mt-1 p-1.5 bg-slate-50 rounded overflow-x-auto text-slate-800 max-h-48">
                                      {JSON.stringify(tc.result, null, 2)}
                                    </pre>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-2">
              <div className="bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-500 shadow-xs flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-700 animate-pulse" />
                <span>Teco está consultando escalas, cadastros e faturamento...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Campo de Entrada */}
        <div className="p-3 border-t border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma pergunta para o Teco (ex: 'Quem atende a Dona Helena hoje?')..."
              disabled={isLoading}
              className="flex-1 px-3.5 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-600 focus:border-sky-600 bg-slate-50/50"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !input.trim()}
              className="px-4 py-2 bg-sky-700 text-white rounded-md text-xs font-medium hover:bg-sky-800 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar</span>
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
            <span>Pressione Enter para enviar</span>
            <span>Mensagens no Telegram serão divididas automaticamente se excederem 4.096 caracteres</span>
          </div>
        </div>
      </div>
    </div>
  );
};
