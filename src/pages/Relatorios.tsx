import React, { useState, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Printer, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

interface RelatorioItem {
  id: string;
  titulo: string;
  descricao: string;
  ajuda: string;
}

interface GrupoRelatorio {
  id: string;
  nome: string;
  itens: RelatorioItem[];
}

const GRUPOS_INICIAIS: GrupoRelatorio[] = [
  {
    id: 'info_gerais',
    nome: 'Informações Gerais',
    itens: [
      {
        id: 'atend_paciente',
        titulo: 'Relação de Atendimentos por Paciente',
        descricao: 'Lista detalhada dos atendimentos realizados no período, agrupando por paciente. Mostra data, profissional, duração e valores.',
        ajuda: 'Exibe todos os plantões do período agrupados por paciente com detalhamento de datas, horários, profissionais e valores.'
      },
      {
        id: 'atend_paciente_sintetico',
        titulo: 'Relação de Atendimentos por Paciente Sintético',
        descricao: 'Versão resumida do relatório por paciente: apenas totalizadores (quantidade e valor), sem detalhar plantão a plantão.',
        ajuda: 'Exibe apenas os totais consolidados de plantões e valores por paciente no período selecionado.'
      },
      {
        id: 'atend_profissional',
        titulo: 'Relação de Atendimentos por Profissional',
        descricao: 'Lista detalhada dos atendimentos realizados no período, agrupando por profissional. Mostra paciente, data, duração e valores.',
        ajuda: 'Exibe todos os plantões realizados agrupados por profissional com detalhamento de paciente, data e valores de repasse.'
      },
      {
        id: 'atend_profissional_sintetico',
        titulo: 'Relação de Atendimentos por Profissional Sintético',
        descricao: 'Versão resumida do relatório por profissional: totalizadores de quantidade e valor sem detalhar atendimento a atendimento.',
        ajuda: 'Exibe apenas os totais consolidados de plantões e valores por profissional no período selecionado.'
      }
    ]
  }
];

export const Relatorios: React.FC = () => {
  const { pacientes, profissionais } = useFirebase();

  // Datas padrão: primeiro e último dia do mês atual
  const hoje = new Date();
  const primeiroDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const ultimoDiaNum = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const ultimoDiaMes = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaNum).padStart(2, '0')}`;

  const [dataInicial, setDataInicial] = useState<string>(primeiroDiaMes);
  const [dataFinal, setDataFinal] = useState<string>(ultimoDiaMes);
  const [pacienteId, setPacienteId] = useState<string>('');
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [buscaRelatorio, setBuscaRelatorio] = useState<string>('');
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({
    info_gerais: true,
  });

  const pacientesOrdenados = useMemo(() => {
    return [...(pacientes || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [pacientes]);

  const profissionaisOrdenados = useMemo(() => {
    return [...(profissionais || [])].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [profissionais]);

  const gruposFiltrados = useMemo(() => {
    const termo = buscaRelatorio.trim().toLowerCase();
    if (!termo) return GRUPOS_INICIAIS;
    return GRUPOS_INICIAIS.map(grupo => ({
      ...grupo,
      itens: grupo.itens.filter(
        item =>
          item.titulo.toLowerCase().includes(termo) ||
          item.descricao.toLowerCase().includes(termo)
      )
    })).filter(grupo => grupo.itens.length > 0);
  }, [buscaRelatorio]);

  const expandirTodos = () => {
    const novo: Record<string, boolean> = {};
    GRUPOS_INICIAIS.forEach(g => { novo[g.id] = true; });
    setGruposExpandidos(novo);
  };

  const recolherTodos = () => {
    const novo: Record<string, boolean> = {};
    GRUPOS_INICIAIS.forEach(g => { novo[g.id] = false; });
    setGruposExpandidos(novo);
  };

  const limparFiltros = () => {
    setDataInicial(primeiroDiaMes);
    setDataFinal(ultimoDiaMes);
    setPacienteId('');
    setProfissionalId('');
    setBuscaRelatorio('');
  };

  const toggleGrupo = (id: string) => {
    setGruposExpandidos(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAbrirRelatorio = (item: RelatorioItem) => {
    alert(`Relatório selecionado: ${item.titulo}\nPeríodo: ${dataInicial} até ${dataFinal}`);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-slate-800">Relatórios de Escalas e Atendimentos</h1>
        <p className="text-xs text-slate-500">
          Selecione os filtros desejados e clique em &quot;Abrir&quot; no relatório que deseja gerar. Os relatórios estão organizados por grupo — passe o mouse sobre o &quot;?&quot; para ver a descrição de cada um.
        </p>
      </div>

      {/* Card de Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data Inicial */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Data Inicial *</label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Data Final */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Data Final *</label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Paciente */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Paciente</label>
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Não Informado (Todos)</option>
              {pacientesOrdenados.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          {/* Profissional */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-slate-700">Profissional</label>
            <select
              value={profissionalId}
              onChange={(e) => setProfissionalId(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Não Informado (Todos)</option>
              {profissionaisOrdenados.map(prof => (
                <option key={prof.id} value={prof.id}>{prof.nome}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Busca de Relatório */}
        <div className="max-w-sm space-y-1">
          <label className="block text-xs font-medium text-slate-700">
            Buscar relatório (filtra a lista abaixo)
          </label>
          <input
            type="text"
            placeholder="Digite parte do nome..."
            value={buscaRelatorio}
            onChange={(e) => setBuscaRelatorio(e.target.value)}
            className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <hr className="border-slate-100" />

        {/* Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={expandirTodos}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={recolherTodos}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Recolher todos
          </button>
          <button
            type="button"
            onClick={limparFiltros}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Lista de Grupos de Relatórios */}
      <div className="space-y-4">
        {gruposFiltrados.map(grupo => {
          const isExpanded = !!gruposExpandidos[grupo.id];
          return (
            <div key={grupo.id} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
              {/* Cabeçalho do Grupo */}
              <button
                type="button"
                onClick={() => toggleGrupo(grupo.id)}
                className="w-full flex items-center gap-2 px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/80 transition-colors text-left border-b border-slate-200"
              >
                {isExpanded ? (
                  <ChevronDown size={15} className="text-slate-600" />
                ) : (
                  <ChevronRight size={15} className="text-slate-600" />
                )}
                <span className="text-xs font-bold text-slate-800">{grupo.nome}</span>
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold text-white bg-blue-600 rounded-full">
                  {grupo.itens.length}
                </span>
              </button>

              {/* Itens do Grupo */}
              {isExpanded && (
                <div className="divide-y divide-slate-100">
                  {grupo.itens.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-800">{item.titulo}</span>
                          <span
                            title={item.ajuda}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-50 text-blue-600 cursor-help"
                          >
                            <HelpCircle size={12} />
                          </span>
                        </div>
                        <p className="text-xs italic text-slate-500">{item.descricao}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAbrirRelatorio(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors flex-shrink-0"
                      >
                        <Printer size={13} />
                        <span>Abrir</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Relatorios;
