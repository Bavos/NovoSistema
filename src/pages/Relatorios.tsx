/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { VallidareIcon } from '../components/VallidareLogo';
import {
  FileText,
  Printer,
  X,
  Calendar,
  Users,
  Briefcase,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  FileSpreadsheet,
  Clock,
  RotateCcw
} from 'lucide-react';

interface ReportItem {
  id: string;
  title: string;
  description: string;
  category: string;
}

interface ReportCategory {
  id: string;
  title: string;
  items: ReportItem[];
}

export const Relatorios: React.FC = () => {
  const {
    agendamentos = [],
    plantoes = [],
    profissionais = [],
    pacientes = [],
    empresa
  } = useFirebase();

  // Helper date generators for default period (Current Month)
  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatYMD = (d: Date) => d.toISOString().split('T')[0];
    return {
      start: formatYMD(firstDay),
      end: formatYMD(lastDay)
    };
  };

  const defaults = getDefaultDates();
  const [dataInicial, setDataInicial] = useState<string>(defaults.start);
  const [dataFinal, setDataFinal] = useState<string>(defaults.end);
  const [profissionalSelecionado, setProfissionalSelecionado] = useState<string>('');
  const [pacienteSelecionado, setPacienteSelecionado] = useState<string>('');

  // Search filter and Accordion state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'info_gerais': true,
    'operacional': true
  });

  // Modals state
  const [modalRelatorioProfissionalAtivo, setModalRelatorioProfissionalAtivo] = useState<boolean>(false);
  const [modalRelatorioPacienteAtivo, setModalRelatorioPacienteAtivo] = useState<boolean>(false);

  // Combine agendamentos and plantoes
  const allShifts = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    agendamentos.forEach((ag) => {
      if (ag && ag.id && !seenIds.has(ag.id)) {
        seenIds.add(ag.id);
        list.push(ag);
      }
    });

    plantoes.forEach((pl) => {
      if (pl && pl.id && !seenIds.has(pl.id)) {
        seenIds.add(pl.id);
        list.push(pl);
      }
    });

    return list;
  }, [agendamentos, plantoes]);

  // Format YYYY-MM-DD to DD/MM/YYYY
  const formatDateBR = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Calculate shift end timestamp
  const calculateShiftEnd = (dateStr: string, timeStr: string = '07:00', durationHours: number = 12) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = (timeStr || '07:00').split(':').map(Number);

      const startDate = new Date(year, month - 1, day, hours || 0, minutes || 0);
      const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);

      const endD = String(endDate.getDate()).padStart(2, '0');
      const endM = String(endDate.getMonth() + 1).padStart(2, '0');
      const endY = endDate.getFullYear();
      const endH = String(endDate.getHours()).padStart(2, '0');
      const endMin = String(endDate.getMinutes()).padStart(2, '0');

      return `${endD}/${endM}/${endY} às ${endH}:${endMin}`;
    } catch {
      return `${formatDateBR(dateStr)} - Término Previsto`;
    }
  };

  // Group shifts by Professional for "Relação de Atendimentos por Profissional"
  const relatorioProfissionalData = useMemo(() => {
    const filtered = allShifts.filter((shift) => {
      if (!shift.data) return false;

      const isCanceled =
        shift.status?.toLowerCase() === 'cancelado' ||
        shift.status?.toLowerCase() === 'cancelada';

      if (isCanceled) return false;

      return shift.data >= dataInicial && shift.data <= dataFinal;
    });

    const matchedShifts = filtered.filter((shift) => {
      if (!profissionalSelecionado) return true;

      const profId = shift.idProfissional || shift.profissionalId;
      const profNome = shift.nomeProfissional || shift.profissionalNome || shift.profissional;

      return (
        profId === profissionalSelecionado ||
        profNome === profissionalSelecionado ||
        profNome?.toLowerCase().includes(profissionalSelecionado.toLowerCase())
      );
    });

    const groupsMap = new Map<string, {
      profInfo: {
        id: string;
        nome: string;
        especialidade: string;
        conselho: string;
      };
      items: Array<{
        id: string;
        inicio: string;
        pacienteNome: string;
        contratante: string;
        evento: string;
        observacao: string;
        termino: string;
        status: string;
      }>;
    }>();

    matchedShifts.forEach((shift) => {
      const profId = shift.idProfissional || shift.profissionalId || shift.nomeProfissional || 'nao_informado';
      const profNome = shift.nomeProfissional || shift.profissionalNome || shift.profissional || 'Profissional Não Informado';

      const foundProf = profissionais.find(
        (p) => p.id === profId || p.nome?.toLowerCase() === profNome.toLowerCase()
      );

      const especialidade =
        foundProf?.especialidade ||
        foundProf?.profissao ||
        'Enfermagem / Cuidados';

      const conselho =
        foundProf?.conselho ||
        (foundProf?.rg ? `RG: ${foundProf.rg}` : 'COREN/RJ: Não Informado');

      if (!groupsMap.has(profId)) {
        groupsMap.set(profId, {
          profInfo: {
            id: profId,
            nome: profNome,
            especialidade,
            conselho
          },
          items: []
        });
      }

      const pacId = shift.idPaciente || shift.pacienteId;
      const pacNome = shift.nomePaciente || shift.pacienteNome || shift.paciente || 'Paciente Não Informado';
      const foundPac = pacientes.find(
        (p) => p.id === pacId || p.nome?.toLowerCase() === pacNome.toLowerCase()
      );

      const contratante =
        foundPac?.contratante ||
        foundPac?.responsavel ||
        foundPac?.convenio ||
        shift.contratante ||
        'Não Informado';

      const horario = shift.horario || shift.horaInicio || '07:00';
      const duracao = shift.horario?.includes('24') || shift.tipoEscala?.includes('24') ? 24 : 12;

      groupsMap.get(profId)!.items.push({
        id: shift.id || Math.random().toString(),
        inicio: `${formatDateBR(shift.data)} às ${horario}`,
        pacienteNome: pacNome,
        contratante,
        evento: shift.tipoEscala || shift.evento || (duracao === 24 ? 'Plantão 24h' : 'Plantão 12x36'),
        observacao: shift.observacao || shift.obs || '-',
        termino: calculateShiftEnd(shift.data, horario, duracao),
        status: shift.status || 'Agendado'
      });
    });

    return Array.from(groupsMap.values()).sort((a, b) =>
      a.profInfo.nome.localeCompare(b.profInfo.nome)
    );
  }, [allShifts, dataInicial, dataFinal, profissionalSelecionado, profissionais, pacientes]);

  // Group shifts by Patient for "Relação de Atendimentos por Paciente"
  const relatorioPacienteData = useMemo(() => {
    const filtered = allShifts.filter((shift) => {
      if (!shift.data) return false;
      const isCanceled =
        shift.status?.toLowerCase() === 'cancelado' ||
        shift.status?.toLowerCase() === 'cancelada';
      if (isCanceled) return false;

      return shift.data >= dataInicial && shift.data <= dataFinal;
    });

    const matchedShifts = filtered.filter((shift) => {
      if (!pacienteSelecionado) return true;
      const pacId = shift.idPaciente || shift.pacienteId;
      const pacNome = shift.nomePaciente || shift.pacienteNome || shift.paciente;

      return (
        pacId === pacienteSelecionado ||
        pacNome === pacienteSelecionado ||
        pacNome?.toLowerCase().includes(pacienteSelecionado.toLowerCase())
      );
    });

    const groupsMap = new Map<string, {
      pacienteInfo: {
        id: string;
        nome: string;
        contratante: string;
      };
      items: Array<{
        id: string;
        inicio: string;
        profissionalNome: string;
        evento: string;
        observacao: string;
        termino: string;
        status: string;
      }>;
    }>();

    matchedShifts.forEach((shift) => {
      const pacId = shift.idPaciente || shift.pacienteId || shift.nomePaciente || 'nao_informado';
      const pacNome = shift.nomePaciente || shift.pacienteNome || shift.paciente || 'Paciente Não Informado';

      const foundPac = pacientes.find(
        (p) => p.id === pacId || p.nome?.toLowerCase() === pacNome.toLowerCase()
      );

      const contratante =
        foundPac?.contratante ||
        foundPac?.responsavel ||
        foundPac?.convenio ||
        'Não Informado';

      if (!groupsMap.has(pacId)) {
        groupsMap.set(pacId, {
          pacienteInfo: {
            id: pacId,
            nome: pacNome,
            contratante
          },
          items: []
        });
      }

      const profNome = shift.nomeProfissional || shift.profissionalNome || shift.profissional || 'Profissional Não Alocado';
      const horario = shift.horario || shift.horaInicio || '07:00';
      const duracao = shift.horario?.includes('24') || shift.tipoEscala?.includes('24') ? 24 : 12;

      groupsMap.get(pacId)!.items.push({
        id: shift.id || Math.random().toString(),
        inicio: `${formatDateBR(shift.data)} às ${horario}`,
        profissionalNome: profNome,
        evento: shift.tipoEscala || shift.evento || 'Plantão 12x36',
        observacao: shift.observacao || shift.obs || '-',
        termino: calculateShiftEnd(shift.data, horario, duracao),
        status: shift.status || 'Agendado'
      });
    });

    return Array.from(groupsMap.values()).sort((a, b) =>
      a.pacienteInfo.nome.localeCompare(b.pacienteInfo.nome)
    );
  }, [allShifts, dataInicial, dataFinal, pacienteSelecionado, pacientes]);

  // Report Categories Structure matching exact UI
  const categories: ReportCategory[] = [
    {
      id: 'info_gerais',
      title: 'Informações Gerais',
      items: [
        {
          id: 'atend_paciente',
          title: 'Relação de Atendimentos por Paciente',
          description: 'Lista detalhada dos atendimentos realizados no período, agrupando por paciente. Mostra data, profissional, duração e valores.',
          category: 'Informações Gerais'
        },
        {
          id: 'atend_paciente_sintetico',
          title: 'Relação de Atendimentos por Paciente Sintético',
          description: 'Versão resumida do relatório por paciente: apenas totalizadores (quantidade e valor), sem detalhar plantão a plantão.',
          category: 'Informações Gerais'
        },
        {
          id: 'atend_profissional',
          title: 'Relação de Atendimentos por Profissional',
          description: 'Lista detalhada dos atendimentos realizados no período, agrupando por profissional. Mostra paciente, data, duração e valores.',
          category: 'Informações Gerais'
        },
        {
          id: 'atend_profissional_sintetico',
          title: 'Relação de Atendimentos por Profissional Sintético',
          description: 'Versão resumida do relatório por profissional: totalizadores de quantidade e valor sem detalhar atendimento a atendimento.',
          category: 'Informações Gerais'
        }
      ]
    },
    {
      id: 'operacional',
      title: 'Escalas e Operacional',
      items: [
        {
          id: 'atend_escala_diaria',
          title: 'Relatório de Escala Diária de Plantões',
          description: 'Visão consolidada da escala de plantões por dia com horários e equipes alocadas.',
          category: 'Escalas e Operacional'
        },
        {
          id: 'atend_curingas',
          title: 'Relatório de Plantões Curinga',
          description: 'Relatório de cobertura especial e alocação de profissionais curinga por período.',
          category: 'Escalas e Operacional'
        }
      ]
    }
  ];

  // Filter categories and items based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const query = searchQuery.toLowerCase().trim();
    return categories
      .map((cat) => {
        const matchingItems = cat.items.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        );
        return {
          ...cat,
          items: matchingItems
        };
      })
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

  // Open report handler
  const handleOpenReport = (item: ReportItem) => {
    const idLower = item.id.toLowerCase();
    const titleLower = item.title.toLowerCase();

    if (idLower.includes('profissional') || titleLower.includes('profissional')) {
      setModalRelatorioProfissionalAtivo(true);
    } else if (idLower.includes('paciente') || titleLower.includes('paciente')) {
      setModalRelatorioPacienteAtivo(true);
    } else {
      setModalRelatorioProfissionalAtivo(true);
    }
  };

  // Toggle category expand/collapse
  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    categories.forEach((c) => {
      all[c.id] = true;
    });
    setExpandedCategories(all);
  };

  const collapseAll = () => {
    const all: Record<string, boolean> = {};
    categories.forEach((c) => {
      all[c.id] = false;
    });
    setExpandedCategories(all);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setProfissionalSelecionado('');
    setPacienteSelecionado('');
    const defaults = getDefaultDates();
    setDataInicial(defaults.start);
    setDataFinal(defaults.end);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 font-sans pb-12 max-w-7xl mx-auto px-2 sm:px-4">
      {/* CSS Print Rules */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #modal-relatorio-profissional-printable,
          #modal-relatorio-profissional-printable *,
          #modal-relatorio-paciente-printable,
          #modal-relatorio-paciente-printable * {
            visibility: visible;
          }
          #modal-relatorio-profissional-printable,
          #modal-relatorio-paciente-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Top Filter and Search Bar Container */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
        {/* Date and Entity Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data Inicial</label>
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data Final</label>
            <input
              type="date"
              value={dataFinal}
              onChange={(e) => setDataFinal(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Filtro Profissional</label>
            <select
              value={profissionalSelecionado}
              onChange={(e) => setProfissionalSelecionado(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
            >
              <option value="">Todos os Profissionais</option>
              {profissionais.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome} {p.especialidade ? `(${p.especialidade})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Filtro Paciente</label>
            <select
              value={pacienteSelecionado}
              onChange={(e) => setPacienteSelecionado(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-blue-500 font-sans cursor-pointer"
            >
              <option value="">Todos os Pacientes</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-600">
            Buscar relatório (filtra a lista abaixo)
          </label>
          <div className="relative max-w-xl">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite parte do nome..."
              className="w-full text-xs p-3 pr-10 border border-slate-200 rounded-xl text-slate-700 bg-white focus:outline-none focus:border-blue-500 shadow-2xs font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={expandAll}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Expandir todos
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Recolher todos
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Accordion Categories List */}
      <div className="space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <Search size={32} className="mx-auto text-slate-400" />
            <p className="text-xs font-bold text-slate-700">Nenhum relatório encontrado para a busca "{searchQuery}".</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Limpar busca
            </button>
          </div>
        ) : (
          filteredCategories.map((category) => {
            const isExpanded = expandedCategories[category.id] !== false;

            return (
              <div
                key={category.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-5 py-3.5 bg-slate-50/80 hover:bg-slate-100/80 border-b border-slate-200 flex items-center justify-between text-left transition-colors cursor-pointer select-none"
                >
                  <div className="flex items-center space-x-2.5">
                    {isExpanded ? (
                      <ChevronDown size={18} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={18} className="text-slate-500" />
                    )}
                    <span className="text-xs font-extrabold text-slate-800 tracking-wide">
                      {category.title}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-black bg-blue-600 text-white rounded-full">
                      {category.items.length}
                    </span>
                  </div>
                </button>

                {/* Category Items List */}
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="space-y-1 max-w-3xl">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{item.title}</span>
                              <HelpCircle size={13} className="text-slate-400 hover:text-slate-600 cursor-pointer" />
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-500 italic leading-relaxed">
                            {item.description}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenReport(item)}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Abrir</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer copyright line matching screenshot */}
      <div className="pt-8 text-center text-[10px] text-slate-400 font-mono tracking-wider">
        © 2026 VALLIDARE GESTAO MEDICA E AUDITORIA EIRELI • Todos os direitos reservados
      </div>

      {/* ========================================================================= */}
      {/* MODAL: RELAÇÃO DE ATENDIMENTOS POR PROFISSIONAL                          */}
      {/* ========================================================================= */}
      {modalRelatorioProfissionalAtivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm overflow-y-auto p-3 sm:p-6 flex justify-center items-start animate-in fade-in duration-200">
          <div className="bg-slate-100 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-4">
            
            {/* Modal Control Action Bar Top */}
            <div className="no-print bg-slate-800 text-white p-4 flex items-center justify-between border-b border-slate-700 font-sans">
              <div className="flex items-center space-x-2">
                <FileText size={18} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Visualização e Impressão do Relatório por Profissional
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-[#1b4332] hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Printer size={15} />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalRelatorioProfissionalAtivo(false)}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-700"
                  title="Fechar Modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable A4 Content Area */}
            <div
              id="modal-relatorio-profissional-printable"
              className="bg-white p-8 sm:p-10 space-y-6 text-slate-800 font-sans"
            >
              {/* Institutional Header */}
              <div className="border-b-2 border-slate-800 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-xs p-1">
                      {empresa?.logoUrl ? (
                        <img
                          src={empresa.logoUrl}
                          alt="Logo Vallidare"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <VallidareIcon className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div>
                      <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">
                        Vallidare - Gestão e Consultoria em Saúde
                      </h1>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Sistema Integrado de Escalas, Auditoria e Prontuários
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-600 font-medium">
                    <div>
                      <strong className="text-slate-800">Data de Emissão:</strong>{' '}
                      {new Date().toLocaleDateString('pt-BR')} às{' '}
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="text-[10px] text-slate-400">Documento Interno de Auditoria</div>
                  </div>
                </div>

                {/* Banner / Report Title */}
                <div className="bg-[#1b4332] text-white p-3 rounded-lg text-center font-sans space-y-0.5 shadow-xs">
                  <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Relação de Atendimentos por Profissional
                  </h2>
                  <p className="text-xs font-semibold text-slate-100">
                    Período: {formatDateBR(dataInicial)} a {formatDateBR(dataFinal)}
                  </p>
                </div>
              </div>

              {/* Grouped Professional Data Content */}
              {relatorioProfissionalData.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <AlertCircle size={32} className="mx-auto text-amber-500" />
                  <p className="text-xs font-bold text-slate-700">Nenhum atendimento registrado no período selecionado.</p>
                  <p className="text-[11px] text-slate-400">Tente ajustar o intervalo de datas ou selecione outro profissional no cabeçalho.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {relatorioProfissionalData.map((group) => {
                    const { profInfo, items } = group;

                    const contratanteHeader =
                      items.find((i) => i.contratante && i.contratante !== 'Não Informado')?.contratante ||
                      'Não Informado';

                    return (
                      <div
                        key={profInfo.id}
                        className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs space-y-0 page-break-inside-avoid"
                      >
                        {/* Group Header Bar */}
                        <div className="bg-slate-100 border-b border-slate-300 p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-sans gap-1">
                          <div className="font-extrabold text-slate-900">
                            <span>Profissional: </span>
                            <span className="text-[#1b4332] font-black">{profInfo.nome}</span>{' '}
                            <span className="font-semibold text-slate-600">({profInfo.especialidade})</span>
                            <span className="ml-2 font-mono text-[11px] font-bold text-slate-700">
                              - {profInfo.conselho}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold">
                            <span>Contratante / Convênio: </span>
                            <span className="font-bold text-slate-800">{contratanteHeader}</span>
                          </div>
                        </div>

                        {/* Detailed Shifts Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse font-sans">
                            <thead>
                              <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider font-extrabold border-b border-slate-900">
                                <th className="p-2.5 min-w-[120px]">Início</th>
                                <th className="p-2.5 min-w-[140px]">Paciente</th>
                                <th className="p-2.5 min-w-[130px]">Contratante</th>
                                <th className="p-2.5 min-w-[110px]">Evento</th>
                                <th className="p-2.5 min-w-[150px]">Observação</th>
                                <th className="p-2.5 min-w-[130px]">Término</th>
                                <th className="p-2.5 text-center min-w-[90px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {items.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                                >
                                  <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                                    {item.inicio}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-900">
                                    {item.pacienteNome}
                                  </td>
                                  <td className="p-2.5 text-slate-700 font-medium">
                                    {item.contratante}
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-800">
                                    {item.evento}
                                  </td>
                                  <td className="p-2.5 text-slate-600 italic">
                                    {item.observacao}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                                    {item.termino}
                                  </td>
                                  <td className="p-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                        item.status?.toLowerCase().includes('concluido') ||
                                        item.status?.toLowerCase().includes('realizado') ||
                                        item.status?.toLowerCase().includes('confirmado')
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : 'bg-blue-100 text-blue-900 border-blue-300'
                                      }`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Group Footer Summary */}
                        <div className="bg-slate-100 border-t border-slate-300 p-2.5 text-center font-extrabold text-xs text-slate-900 font-sans">
                          Total de Registros do Profissional {profInfo.nome} : {items.length}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Document Signoff Footer */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-mono">
                <div>Vallidare Gestão Médica - Relatórios Automatizados</div>
                <div>Página Emitida em {new Date().toLocaleDateString('pt-BR')}</div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RELAÇÃO DE ATENDIMENTOS POR PACIENTE                              */}
      {/* ========================================================================= */}
      {modalRelatorioPacienteAtivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm overflow-y-auto p-3 sm:p-6 flex justify-center items-start animate-in fade-in duration-200">
          <div className="bg-slate-100 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-4">
            
            {/* Modal Control Action Bar Top */}
            <div className="no-print bg-slate-800 text-white p-4 flex items-center justify-between border-b border-slate-700 font-sans">
              <div className="flex items-center space-x-2">
                <FileText size={18} className="text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Visualização e Impressão do Relatório por Paciente
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-[#1b4332] hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Printer size={15} />
                  <span>Imprimir / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalRelatorioPacienteAtivo(false)}
                  className="p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg hover:bg-slate-700"
                  title="Fechar Modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div
              id="modal-relatorio-paciente-printable"
              className="bg-white p-8 sm:p-10 space-y-6 text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="border-b-2 border-slate-800 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center border border-slate-200 shadow-xs p-1">
                      {empresa?.logoUrl ? (
                        <img
                          src={empresa.logoUrl}
                          alt="Logo Vallidare"
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <VallidareIcon className="w-full h-full object-contain" />
                      )}
                    </div>
                    <div>
                      <h1 className="text-base font-black text-slate-900 uppercase tracking-wide">
                        Vallidare - Gestão e Consultoria em Saúde
                      </h1>
                      <p className="text-[11px] font-semibold text-slate-500">
                        Sistema Integrado de Escalas e Prontuários
                      </p>
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-slate-600 font-medium">
                    <div>
                      <strong className="text-slate-800">Data de Emissão:</strong>{' '}
                      {new Date().toLocaleDateString('pt-BR')} às{' '}
                      {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="bg-[#1b4332] text-white p-3 rounded-lg text-center font-sans space-y-0.5 shadow-xs">
                  <h2 className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Relação de Atendimentos por Paciente
                  </h2>
                  <p className="text-xs font-semibold text-slate-100">
                    Período: {formatDateBR(dataInicial)} a {formatDateBR(dataFinal)}
                  </p>
                </div>
              </div>

              {relatorioPacienteData.length === 0 ? (
                <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-2">
                  <AlertCircle size={32} className="mx-auto text-amber-500" />
                  <p className="text-xs font-bold text-slate-700">Nenhum atendimento encontrado para o paciente ou período.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {relatorioPacienteData.map((group) => {
                    const { pacienteInfo, items } = group;

                    return (
                      <div
                        key={pacienteInfo.id}
                        className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs space-y-0 page-break-inside-avoid"
                      >
                        <div className="bg-slate-100 border-b border-slate-300 p-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-sans gap-1">
                          <div className="font-extrabold text-slate-900">
                            <span>Paciente: </span>
                            <span className="text-[#1b4332] font-black">{pacienteInfo.nome}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-semibold">
                            <span>Contratante / Convênio: </span>
                            <span className="font-bold text-slate-800">{pacienteInfo.contratante}</span>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border-collapse font-sans">
                            <thead>
                              <tr className="bg-slate-800 text-white text-[10px] uppercase tracking-wider font-extrabold border-b border-slate-900">
                                <th className="p-2.5 min-w-[120px]">Início</th>
                                <th className="p-2.5 min-w-[140px]">Profissional</th>
                                <th className="p-2.5 min-w-[110px]">Evento</th>
                                <th className="p-2.5 min-w-[150px]">Observação</th>
                                <th className="p-2.5 min-w-[130px]">Término</th>
                                <th className="p-2.5 text-center min-w-[90px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {items.map((item, idx) => (
                                <tr
                                  key={item.id}
                                  className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                                >
                                  <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                                    {item.inicio}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-900">
                                    {item.profissionalNome}
                                  </td>
                                  <td className="p-2.5 font-semibold text-slate-800">
                                    {item.evento}
                                  </td>
                                  <td className="p-2.5 text-slate-600 italic">
                                    {item.observacao}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-800 whitespace-nowrap">
                                    {item.termino}
                                  </td>
                                  <td className="p-2.5 text-center whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                        item.status?.toLowerCase().includes('concluido') ||
                                        item.status?.toLowerCase().includes('realizado') ||
                                        item.status?.toLowerCase().includes('confirmado')
                                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                          : 'bg-blue-100 text-blue-900 border-blue-300'
                                      }`}
                                    >
                                      {item.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="bg-slate-100 border-t border-slate-300 p-2.5 text-center font-extrabold text-xs text-slate-900 font-sans">
                          Total de Registros do Paciente {pacienteInfo.nome} : {items.length}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 font-mono">
                <div>Vallidare Gestão Médica - Relatórios Automatizados</div>
                <div>Página Emitida em {new Date().toLocaleDateString('pt-BR')}</div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Relatorios;
