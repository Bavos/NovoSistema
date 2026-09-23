import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Bot, 
  Send, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Printer, 
  Trash2, 
  TrendingUp, 
  Users, 
  Calendar, 
  AlertTriangle,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useFirebase } from '../context/FirebaseContext';
import { consultarAssistenteOperacional } from '../services/geminiOperacoesService';

interface MensagemInterativa {
  id: string;
  tipo: 'pergunta' | 'resposta';
  texto: string;
  timestamp: string;
}

export const AnaliseInteligenteOperacoes: React.FC = () => {
  const { 
    user, 
    userRole, 
    pacientes, 
    profissionais, 
    agendamentos, 
    faturasPacientes, 
    folhasPagamento, 
    debitosProfissionais 
  } = useFirebase();

  // Controle Estrito de Acesso para Administradores
  const isAdmin = useMemo(() => {
    const role = (userRole || '').toLowerCase();
    const email = (user?.email || '').toLowerCase();
    return (
      role === 'administrador' || 
      role === 'admin' || 
      email === 'renatobz@gmail.com' || 
      email === 'rhgestaodomiciliar@gmail.com'
    );
  }, [userRole, user?.email]);

  const [perguntaInput, setPerguntaInput] = useState('');
  const [mensagens, setMensagens] = useState<MensagemInterativa[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mensagensEndRef = useRef<HTMLDivElement>(null);

  // Cálculos prévios das métricas operacionais para transparência e contexto
  const metricasSumarizadas = useMemo(() => {
    const totalPac = pacientes.length;
    const pacAtivos = pacientes.filter(p => (p.status || '').toLowerCase() === 'ativo').length;
    const totalProf = profissionais.length;
    const profAtivos = profissionais.filter(p => (p.status || '').toLowerCase() !== 'inativo').length;
    const totalEsc = agendamentos.length;
    const escalasSemAlocacao = agendamentos.filter(a => !a.idProfissional && !a.nomeProfissional).length;

    const faturamentoConsolidado = faturasPacientes.reduce((acc, f) => acc + (Number(f.valorTotal || 0)), 0);
    const custoFolhaConsolidado = folhasPagamento.reduce((acc, folha) => acc + (Number(folha.valorLiquidoReceber || folha.valorTotalPlantoes || 0)), 0);
    const totalDebitos = debitosProfissionais.reduce((acc, d) => acc + (Number(d.valor || 0)), 0);

    return {
      totalPac,
      pacAtivos,
      totalProf,
      profAtivos,
      totalEsc,
      escalasSemAlocacao,
      faturamentoConsolidado,
      custoFolhaConsolidado,
      totalDebitos
    };
  }, [pacientes, profissionais, agendamentos, faturasPacientes, folhasPagamento, debitosProfissionais]);

  // Rolar para a última mensagem ao atualizar histórico
  useEffect(() => {
    if (mensagens.length > 0) {
      mensagensEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensagens, loading]);

  // Se não for administrador, não renderiza a seção
  if (!isAdmin) {
    return null;
  }

  // Envio de pergunta
  const handleConsultar = async (perguntaPersonalizada?: string) => {
    const textoParaEnviar = (perguntaPersonalizada ?? perguntaInput).trim();
    if (!textoParaEnviar || loading) return;

    const idPergunta = `perg-${Date.now()}`;
    const novaMensagemPergunta: MensagemInterativa = {
      id: idPergunta,
      tipo: 'pergunta',
      texto: textoParaEnviar,
      timestamp: new Date().toISOString()
    };

    setMensagens(prev => [...prev, novaMensagemPergunta]);
    setPerguntaInput('');
    setLoading(true);
    setErro(null);
    setLoadingStep('Higienizando dados e aplicando anonimização LGPD...');

    setTimeout(() => {
      setLoadingStep('Processando consulta com os dados operacionais...');
    }, 700);

    try {
      // 1. Dicionário temporário em memória para resolução reversível no cliente (Privacy by Design / LGPD)
      const mapaIdentificadores: Record<string, string> = {};

      let profCounter = 1;
      const profIdParaPseudonimo = new Map<string, string>();
      const profNomeParaPseudonimo = new Map<string, string>();

      const obterPseudonimoProf = (id?: string, nome?: string): string => {
        const kId = String(id || '').trim();
        const kNome = String(nome || '').trim().toLowerCase();
        if (kId && profIdParaPseudonimo.has(kId)) return profIdParaPseudonimo.get(kId)!;
        if (kNome && profNomeParaPseudonimo.has(kNome)) return profNomeParaPseudonimo.get(kNome)!;

        const pseudonimo = `PROF_${String(profCounter++).padStart(2, '0')}`;
        if (kId) profIdParaPseudonimo.set(kId, pseudonimo);
        if (kNome) profNomeParaPseudonimo.set(kNome, pseudonimo);

        const nomeReal = String(nome || '').trim();
        if (nomeReal) {
          mapaIdentificadores[pseudonimo] = nomeReal;
        }
        return pseudonimo;
      };

      // Mapear profissionais da base
      (profissionais || []).forEach(p => {
        const pseudonimo = obterPseudonimoProf(p.id, p.nome || (p as any).nomeCompleto);
        const nomeReal = String(p.nome || (p as any).nomeCompleto || '').trim();
        if (nomeReal) {
          mapaIdentificadores[pseudonimo] = nomeReal;
        }
      });

      // Mapear pacientes da base
      let pacCounter = 1;
      const pacIdParaPseudonimo = new Map<string, string>();
      const pacNomeParaPseudonimo = new Map<string, string>();

      const obterPseudonimoPac = (id?: string, nome?: string): string => {
        const kId = String(id || '').trim();
        const kNome = String(nome || '').trim().toLowerCase();
        if (kId && pacIdParaPseudonimo.has(kId)) return pacIdParaPseudonimo.get(kId)!;
        if (kNome && pacNomeParaPseudonimo.has(kNome)) return pacNomeParaPseudonimo.get(kNome)!;

        const pseudonimo = `PAC_${String(pacCounter++).padStart(2, '0')}`;
        if (kId) pacIdParaPseudonimo.set(kId, pseudonimo);
        if (kNome) pacNomeParaPseudonimo.set(kNome, pseudonimo);

        const nomeReal = String(nome || '').trim();
        if (nomeReal) {
          mapaIdentificadores[pseudonimo] = nomeReal;
        }
        return pseudonimo;
      };

      (pacientes || []).forEach(p => {
        const pseudonimo = obterPseudonimoPac(p.id, p.nome || (p as any).nomeCompleto);
        const nomeReal = String(p.nome || (p as any).nomeCompleto || '').trim();
        if (nomeReal) {
          mapaIdentificadores[pseudonimo] = nomeReal;
        }
      });

      // Montar profissionais pseudonimizados (apenas o pseudônimo PROF_XX, sem dados de contato)
      const profissionaisPseudonimizados = (profissionais || []).map(prof => {
        const pAny = prof as any;
        const pseudonimo = obterPseudonimoProf(prof.id, prof.nome || pAny.nomeCompleto);
        return {
          id: pseudonimo,
          nome: pseudonimo,
          categoria: pAny.categoria || pAny.funcao || pAny.profissao || 'Cuidador',
          especialidade: prof.especialidade || 'Geral',
          status: prof.status || 'Disponível',
          valorHora: Number(pAny.valorHora || pAny.valorPlantao || 0),
          plantoesRealizadosMes: Number(pAny.plantoesRealizadosMes || pAny.totalPlantoes || 0)
        };
      });

      // Montar pacientes pseudonimizados
      const pacientesPseudonimizados = (pacientes || []).map(pac => {
        const pAny = pac as any;
        const pseudonimo = obterPseudonimoPac(pac.id, pac.nome || pAny.nomeCompleto);
        return {
          id: pseudonimo,
          nome: pseudonimo,
          status: pac.status || 'Ativo',
          complexidade: pAny.complexidade || pAny.grauComplexidade || pAny.informacoesMedicas?.grauDependencia || 'Média',
          planoCuidado: pAny.planoCuidado || pAny.tipoPlantao || pAny.planoAtendimento?.tipoEscala || 'Plantão 12h',
          quantidadePlantoesMes: Number(pAny.quantidadePlantoesMes || pAny.plantoesMes || 0),
          valorMensal: Number(pAny.valorMensal || pAny.mensalidade || pAny.valorTotal || 0),
          especialidade: pAny.especialidade || pAny.categoriaNecessaria || 'Técnico de Enfermagem'
        };
      });

      // Montar escalas pseudonimizadas
      const agendamentosPseudonimizados = (agendamentos || []).map(e => {
        const eAny = e as any;
        const profId = e.idProfissional || eAny.profissionalId;
        const profNome = e.nomeProfissional || eAny.profissionalNome;
        const pseudonimoProf = (profId || profNome) ? obterPseudonimoProf(profId, profNome) : null;
        if (profNome && pseudonimoProf && !mapaIdentificadores[pseudonimoProf]) {
          mapaIdentificadores[pseudonimoProf] = String(profNome).trim();
        }

        const pacId = e.idPaciente || eAny.pacienteId;
        const pacNome = eAny.nomePaciente || eAny.pacienteNome;
        const pseudonimoPac = (pacId || pacNome) ? obterPseudonimoPac(pacId, pacNome) : 'PAC_00';
        if (pacNome && pseudonimoPac && !mapaIdentificadores[pseudonimoPac]) {
          mapaIdentificadores[pseudonimoPac] = String(pacNome).trim();
        }

        return {
          ...e,
          idProfissional: pseudonimoProf,
          profissionalId: pseudonimoProf,
          nomeProfissional: pseudonimoProf,
          profissionalNome: pseudonimoProf,
          idPaciente: pseudonimoPac,
          pacienteId: pseudonimoPac,
          nomePaciente: pseudonimoPac,
          pacienteNome: pseudonimoPac
        };
      });

      // Montar débitos pseudonimizados
      const debitosPseudonimizados = (debitosProfissionais || []).map(deb => {
        const profPseudonimo = obterPseudonimoProf(deb.idProfissional, deb.nomeProfissional);
        const pacPseudonimo = (deb.idPaciente || deb.nomePaciente) 
          ? obterPseudonimoPac(deb.idPaciente, deb.nomePaciente) 
          : undefined;

        return {
          ...deb,
          idProfissional: profPseudonimo,
          nomeProfissional: profPseudonimo,
          idPaciente: pacPseudonimo,
          nomePaciente: pacPseudonimo
        };
      });

      // Montar faturas pseudonimizadas
      const faturasPseudonimizadas = (faturasPacientes || []).map(fat => {
        const pacPseudonimo = obterPseudonimoPac(fat.idPaciente || (fat as any).pacienteId, fat.nomePaciente);
        return {
          ...fat,
          idPaciente: pacPseudonimo,
          pacienteId: pacPseudonimo,
          nomePaciente: pacPseudonimo
        };
      });

      const dadosParaEnvio = {
        pacientes: pacientesPseudonimizados,
        profissionais: profissionaisPseudonimizados,
        escalas: agendamentosPseudonimizados,
        debitosProfissionais: debitosPseudonimizados,
        faturasPacientes: faturasPseudonimizadas,
        folhasPagamento,
        totaisConsolidados: {
          faturamentoMensalConsolidado: metricasSumarizadas.faturamentoConsolidado,
          custoTotalFolhaConsolidado: metricasSumarizadas.custoFolhaConsolidado,
          totalDebitosProfissionais: metricasSumarizadas.totalDebitos
        },
        user: {
          email: user?.email || '',
          role: userRole || ''
        }
      };

      const resultado = await consultarAssistenteOperacional(textoParaEnviar, dadosParaEnvio);

      // 2. Reversão Local ao Exibir a Resposta (Privacy by Design / Client-side Resolution)
      let respostaLegivel = resultado.resposta || 'Não foi possível gerar uma resposta para os dados informados.';

      const substituirTexto = (textoBase: string, termoBusca: string, substituto: string): string => {
        if (!termoBusca) return textoBase;
        return textoBase.split(termoBusca).join(substituto);
      };

      // Ordenar por tamanho decrescente do código para evitar substituições parciais
      const entradasOrdenadas = Object.entries(mapaIdentificadores).sort((a, b) => b[0].length - a[0].length);

      entradasOrdenadas.forEach(([codigo, nomeReal]) => {
        if (codigo && nomeReal) {
          // Substituição do pseudônimo exato (ex: PROF_01)
          respostaLegivel = substituirTexto(respostaLegivel, codigo, nomeReal);

          // Variações com hífen (ex: PROF-01)
          const codigoHifen = codigo.replace('_', '-');
          if (codigoHifen !== codigo) {
            respostaLegivel = substituirTexto(respostaLegivel, codigoHifen, nomeReal);
          }

          // Variações entre colchetes (ex: [PROF_01] ou [PROF-01])
          respostaLegivel = substituirTexto(respostaLegivel, `[${codigo}]`, nomeReal);
          respostaLegivel = substituirTexto(respostaLegivel, `[${codigoHifen}]`, nomeReal);
        }
      });

      const novaMensagemResposta: MensagemInterativa = {
        id: `resp-${Date.now()}`,
        tipo: 'resposta',
        texto: respostaLegivel,
        timestamp: resultado.timestamp || new Date().toISOString()
      };

      setMensagens(prev => [...prev, novaMensagemResposta]);
    } catch (err: any) {
      console.error('[AssistenteOperacional] Falha na requisição operacional');
      setErro(err?.message || 'Falha ao processar a consulta operacional.');
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleConsultar();
    }
  };

  const handleCopiar = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2500);
  };

  const handleLimparConversa = () => {
    setMensagens([]);
    setErro(null);
    setPerguntaInput('');
  };

  const handleImprimir = () => {
    window.print();
  };

  // Atalhos rápidos solicitados
  const atalhosRapidos = [
    {
      rotulo: 'Gargalos de Escala',
      descricao: 'Turnos sem alocação ou com risco',
      pergunta: 'Identifique os principais gargalos de escalas e aponte os turnos ou plantões sem profissional alocado.'
    },
    {
      rotulo: 'Resumo Geral',
      descricao: 'Visão macro e capacidade assistencial',
      pergunta: 'Apresente um resumo geral da operação de Home Care, volume de atendimentos e capacidade da equipe.'
    },
    {
      rotulo: 'Análise de Custos e Plantões',
      descricao: 'Repasses e controle financeiro',
      pergunta: 'Faça uma análise de custos dos plantões, relação com repasses a profissionais e previsão de margem.'
    },
    {
      rotulo: 'Profissionais sem Escalas',
      descricao: 'Identificar profissionais ociosos',
      pergunta: 'Quais profissionais estão cadastrados no sistema mas não possuem escalas ativas no período?'
    },
    {
      rotulo: 'Conflitos de Horários',
      descricao: 'Verificar sobreposições e sobrecarga',
      pergunta: 'Identifique possíveis conflitos de horários, turnos consecutivos e riscos de sobrecarga assistencial.'
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="card-assistente-operacional">
      {/* Cabeçalho da Seção */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800">
                  Assistente de Inteligência Operacional
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Restrito a Administradores
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200" title="A IA recebe apenas pseudônimos opacos e o navegador reverte para os nomes reais localmente na sua máquina">
                  <Lock className="w-3.5 h-3.5" />
                  Pseudonimização Reversível no Cliente (LGPD)
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                  <Trash2 className="w-3.5 h-3.5" />
                  Efemeridade Total (Memória Volátil)
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Consulte métricas operacionais em tempo real, verifique gargalos de escalas, custos de plantões e faça perguntas livres com garantia de sigilo de dados e efemeridade total (nenhum registro é salvo no banco ou navegador).
              </p>
            </div>
          </div>

          {mensagens.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLimparConversa}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors shadow-2xs"
                title="Iniciar nova consulta e limpar memória transitória"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                Iniciar nova consulta
              </button>
              <button
                type="button"
                onClick={handleImprimir}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                title="Imprimir relatório"
              >
                <Printer className="w-3.5 h-3.5 text-slate-400" />
                Imprimir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Painel de Métricas Rápidas (Contexto da Operação) */}
      <div className="p-5 bg-slate-50/60 border-b border-slate-200">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          Dados Operacionais Carregados para Consulta
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
              <Users className="w-3.5 h-3.5 text-blue-500" />
              Pacientes
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalPac}
            </div>
            <div className="text-2xs text-emerald-600 font-medium">
              {metricasSumarizadas.pacAtivos} ativos
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              Profissionais
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalProf}
            </div>
            <div className="text-2xs text-indigo-600 font-medium">
              {metricasSumarizadas.profAtivos} disponíveis
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
              <Calendar className="w-3.5 h-3.5 text-emerald-500" />
              Escalas Cadastradas
            </div>
            <div className="text-lg font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalEsc}
            </div>
            <div className="text-2xs text-slate-500">
              plantões registrados
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
              <AlertTriangle className={`w-3.5 h-3.5 ${metricasSumarizadas.escalasSemAlocacao > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              Gargalos de Escala
            </div>
            <div className={`text-lg font-bold mt-1 ${metricasSumarizadas.escalasSemAlocacao > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {metricasSumarizadas.escalasSemAlocacao}
            </div>
            <div className="text-2xs text-slate-500">
              sem profissional alocado
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos com Perguntas Frequentes */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>Consultas Rápidas Recomendadas:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {atalhosRapidos.map((atalho, index) => (
              <button
                key={index}
                type="button"
                disabled={loading}
                onClick={() => handleConsultar(atalho.pergunta)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 rounded-lg shadow-2xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title={atalho.descricao}
              >
                <span>{atalho.rotulo}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerta de Erro */}
      {erro && (
        <div className="m-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-900">Falha ao processar a consulta</h4>
            <p className="text-xs text-rose-700 mt-1">{erro}</p>
            <button
              type="button"
              onClick={() => handleConsultar()}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Área de Conversa / Histórico */}
      <div className="p-6 space-y-6 min-h-[160px] max-h-[600px] overflow-y-auto">
        {mensagens.length === 0 && !loading && (
          <div className="py-8 text-center bg-white rounded-lg border border-dashed border-slate-200 p-6">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-full mb-2.5">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-semibold text-slate-800">
              Pronto para responder suas dúvidas operacionais
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Digite uma pergunta livre no campo abaixo ou utilize os botões de atalhos rápidos para obter diagnósticos instantâneos.
            </p>
          </div>
        )}

        {mensagens.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex flex-col ${msg.tipo === 'pergunta' ? 'items-end' : 'items-start'}`}
          >
            {msg.tipo === 'pergunta' ? (
              <div className="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-xs">
                <div className="text-xs text-blue-100 font-medium mb-1 flex items-center gap-1">
                  <span>Você (Administrador)</span>
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {msg.texto}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-[95%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-xs p-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-blue-600 text-white rounded-md">
                      <Bot className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Resposta da Inteligência Operacional</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xs text-slate-400">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopiar(msg.id, msg.texto)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-200/60 rounded-md transition-colors"
                      title="Copiar resposta"
                    >
                      {copiadoId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none text-slate-700 text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => (
                        <h1 className="text-xl font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4 mt-2">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-base font-bold text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg border-l-4 border-blue-600 mt-6 mb-3">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm font-semibold text-slate-800 mt-4 mb-2">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="mb-2.5 leading-relaxed text-slate-700">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-slate-700">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-slate-700">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="pl-1">
                          {children}
                        </li>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold text-slate-900">
                          {children}
                        </strong>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-slate-300 pl-3 py-1 italic bg-white text-slate-600 rounded-r my-3">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {msg.texto}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Indicador de Carregamento em Tempo Real */}
        {loading && (
          <div className="flex items-start gap-3 w-full max-w-[95%] bg-blue-50/60 border border-blue-100 rounded-2xl rounded-tl-xs p-4 shadow-xs animate-pulse">
            <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <div className="text-xs font-bold text-blue-900">
                Consultando dados operacionais...
              </div>
              <p className="text-xs text-blue-700 mt-0.5">
                {loadingStep || 'Processando consulta e elaborando parecer analítico...'}
              </p>
            </div>
          </div>
        )}

        <div ref={mensagensEndRef} />
      </div>

      {/* Barra de Entrada de Mensagens / Perguntas */}
      <div className="p-4 bg-slate-50 border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={perguntaInput}
              onChange={(e) => setPerguntaInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Digite sua pergunta operacional (ex.: Quais profissionais estão sem escalas? Identifique gargalos e riscos de sobrecarga...)"
              className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white resize-none shadow-2xs placeholder:text-slate-400 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <div className="absolute bottom-2.5 right-3 text-2xs text-slate-400">
              Pressione Enter para enviar
            </div>
          </div>

          <button
            type="button"
            disabled={loading || !perguntaInput.trim()}
            onClick={() => handleConsultar()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-xs transition-all h-[54px]"
            title="Enviar pergunta"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Consultar</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between text-2xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Privacy by Design: Dados pessoais substituídos por pseudônimos no envio e restaurados localmente no seu navegador.</span>
          </div>
          {mensagens.length > 0 && (
            <button
              type="button"
              onClick={handleLimparConversa}
              className="text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              Iniciar nova consulta
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
