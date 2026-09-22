import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Cpu, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  Printer, 
  TrendingUp, 
  Users, 
  Calendar, 
  AlertTriangle,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useFirebase } from '../context/FirebaseContext';
import { gerarRelatorioInsightsOperacionais, ResultadoAnaliseOperacoes } from '../services/geminiOperacoesService';

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

  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoAnaliseOperacoes | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Cálculos prévios das métricas operacionais para o dashboard
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


  // Se não for administrador, não renderiza a seção
  if (!isAdmin) {
    return null;
  }

  const handleGerarAnalise = async () => {
    try {
      setLoading(true);
      setErro(null);
      setLoadingStep('Higienizando e anonimizando identificadores de saúde (LGPD)...');

      // Simulação rápida dos passos para feedback visual do usuário
      setTimeout(() => {
        setLoadingStep('Enviando dados consolidados ao Gemini 3.8 Flash no backend seguro...');
      }, 900);

      const dadosParaEnvio = {
        pacientes,
        profissionais,
        escalas: agendamentos,
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

      const res = await gerarRelatorioInsightsOperacionais(dadosParaEnvio);

      setResultado(res);
      setLoading(false);
    } catch (err: any) {
      console.error('[AnaliseInteligenteOperacoes] Erro ao gerar relatório:', err);
      setErro(err?.message || 'Ocorreu um erro ao comunicar com a inteligência operacional.');
      setLoading(false);
    }
  };

  const handleCopiarRelatorio = () => {
    if (!resultado?.relatorioMarkdown) return;
    navigator.clipboard.writeText(resultado.relatorioMarkdown);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" id="card-analise-inteligente-gemini">
      {/* Cabeçalho da Seção */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-indigo-50/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-lg shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800">
                  Análise Inteligente de Operações (Gemini)
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Restrito a Administradores
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Lock className="w-3.5 h-3.5" />
                  Anonimização LGPD Ativa
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  <Cpu className="w-3.5 h-3.5" />
                  Gemini 3.8 Flash
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                Diagnóstico executivo de escalas, gargalos assistenciais, riscos financeiros e recomendações prioritárias, gerado por inteligência artificial com total preservação do sigilo de dados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {resultado && (
              <>
                <button
                  type="button"
                  onClick={handleCopiarRelatorio}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  title="Copiar relatório em Markdown"
                >
                  {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  {copiado ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  type="button"
                  onClick={handleImprimir}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                  title="Imprimir relatório"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  Imprimir
                </button>
              </>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={handleGerarAnalise}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white shadow-sm transition-all ${
                loading 
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analisando Métricas...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{resultado ? 'Atualizar Relatório' : 'Gerar Relatório de Insights Operacionais'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Painel de Métricas Pré-Carregadas (Transparência do que é analisado) */}
      <div className="p-6 bg-slate-50/70 border-b border-slate-200">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Base de Dados Operacionais Carregada no Sistema
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <Users className="w-4 h-4 text-indigo-500" />
              Pacientes Cadastrados
            </div>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalPac}
            </div>
            <div className="text-xs text-emerald-600 mt-0.5">
              {metricasSumarizadas.pacAtivos} ativos no plano
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Profissionais Cadastrados
            </div>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalProf}
            </div>
            <div className="text-xs text-blue-600 mt-0.5">
              {metricasSumarizadas.profAtivos} disponíveis para escalas
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <Calendar className="w-4 h-4 text-emerald-500" />
              Escalas & Plantões
            </div>
            <div className="text-xl font-bold text-slate-800 mt-1">
              {metricasSumarizadas.totalEsc}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              agendamentos registrados
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
              <AlertTriangle className={`w-4 h-4 ${metricasSumarizadas.escalasSemAlocacao > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
              Gargalos de Escala
            </div>
            <div className={`text-xl font-bold mt-1 ${metricasSumarizadas.escalasSemAlocacao > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {metricasSumarizadas.escalasSemAlocacao}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              plantões sem cuidador alocado
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Garantia de Privacidade:</strong> Todos os nomes de pacientes e cuidadores são convertidos para códigos anônimos (ex: <code>Paciente [PAC-001]</code>, <code>Profissional [P-01]</code>). Telefones, CPFs e endereços são rigorosamente removidos antes do processamento pela IA.
          </span>
        </div>
      </div>

      {/* Alerta de Erro */}
      {erro && (
        <div className="m-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-rose-900">Falha na geração da análise</h4>
            <p className="text-xs text-rose-700 mt-1">{erro}</p>
            <button
              type="button"
              onClick={handleGerarAnalise}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Loading State com Animação e Passos Informativos */}
      {loading && (
        <div className="p-12 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-50 text-indigo-600 rounded-full mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 animate-spin" />
          </div>
          <h4 className="text-base font-bold text-slate-800">
            Processando Inteligência Operacional
          </h4>
          <p className="text-sm text-indigo-600 font-medium mt-1 animate-pulse">
            {loadingStep || 'Consolidando métricas e executando modelo Gemini...'}
          </p>
          <p className="text-xs text-slate-400 mt-3 max-w-md mx-auto">
            Aguarde alguns instantes enquanto o modelo analisa os desfalques de escala, distribuição de carga horária e eficiência dos plantões.
          </p>
        </div>
      )}

      {/* Exibição do Relatório em Markdown */}
      {!loading && resultado?.relatorioMarkdown && (
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-bold text-slate-700">Relatório de Insights Executivos</span>
            </div>
            <div className="text-xs text-slate-400">
              Gerado em: {new Date(resultado.timestamp).toLocaleString('pt-BR')}
            </div>
          </div>

          <div className="prose max-w-none text-slate-700 text-sm leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-2xl font-bold text-slate-900 border-b border-slate-200 pb-3 mb-6 mt-2">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-lg font-bold text-indigo-900 bg-indigo-50/60 px-4 py-2 rounded-lg border-l-4 border-indigo-600 mt-8 mb-4">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-base font-semibold text-slate-800 mt-5 mb-2">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="mb-3 leading-relaxed text-slate-700">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc list-outside pl-5 mb-4 space-y-1.5 text-slate-700">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal list-outside pl-5 mb-4 space-y-1.5 text-slate-700">
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
                  <blockquote className="border-l-4 border-slate-300 pl-4 py-1 italic bg-slate-50 text-slate-600 rounded-r my-4">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {resultado.relatorioMarkdown}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Estado Vazio (Antes de Gerar a Primeira Análise) */}
      {!loading && !resultado && !erro && (
        <div className="p-10 text-center bg-white">
          <div className="inline-flex items-center justify-center p-3.5 bg-slate-100 text-slate-500 rounded-full mb-3">
            <Cpu className="w-6 h-6 text-indigo-500" />
          </div>
          <h4 className="text-sm font-semibold text-slate-800">
            Nenhuma análise gerada nesta sessão
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-lg mx-auto">
            Clique no botão acima para compilar as escalas, analisar a alocação de profissionais e obter um parecer estratégico com sugestões de otimização operacional e financeira.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleGerarAnalise}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              Gerar Relatório Agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
