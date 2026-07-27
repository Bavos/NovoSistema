import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Calendar,
  AlertTriangle,
  UserX,
  UserCheck,
  BarChart3,
  Filter,
  Printer,
  FileText,
  TrendingUp,
  Award,
  RefreshCw,
  Info,
  Download
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { sanitizeClonedDocForHtml2Canvas } from '../lib/html2canvasSanitizer';
import { toast } from 'react-hot-toast';

interface RelatorioCuringasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface CuringaOcorrencia {
  id: string;
  data: string; // YYYY-MM-DD
  dataFormatted: string; // DD/MM/YYYY
  pacienteId: string;
  pacienteNome: string;
  profissionalAusente: string;
  curingaSubstituto: string;
  motivo: string;
}

export const RelatorioCuringasModal: React.FC<RelatorioCuringasModalProps> = ({
  isOpen,
  onClose
}) => {
  const { pacientes, agendamentos, debitosProfissionais } = useFirebase();

  // Helper date parsing to YYYY-MM-DD
  const parseDateToYYYYMMDD = (dateVal: any): string => {
    if (!dateVal) return '';
    if (typeof dateVal === 'string') {
      if (dateVal.includes('T')) return dateVal.split('T')[0];
      if (dateVal.includes('-')) return dateVal;
      if (dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length === 3) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    } else if (dateVal instanceof Date) {
      return dateVal.toISOString().split('T')[0];
    } else if (dateVal?.toDate) {
      return dateVal.toDate().toISOString().split('T')[0];
    } else if (dateVal?.seconds) {
      return new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
    }
    return '';
  };

  // Set default initial dates (Current Month)
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split('T')[0];
  });

  const [isPrinting, setIsPrinting] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Active Patients Map
  const activePatientsMap = useMemo(() => {
    const map = new Map<string, string>(); // pacienteId -> pacienteNome
    (pacientes || []).forEach(p => {
      if (p.status === 'Ativo' || (p as any).status !== 'Desativado') {
        map.set(p.id, p.nome);
      }
    });
    return map;
  }, [pacientes]);

  // Derived Curinga Occurrences Logic
  const curingaOcorrencias = useMemo(() => {
    if (!startDate || !endDate) return [];

    const list: CuringaOcorrencia[] = [];
    const processedKeys = new Set<string>();

    // 1. Process Debitos where motivo is 'Curinga'
    (debitosProfissionais || []).forEach(deb => {
      const debDate = parseDateToYYYYMMDD(deb.data);
      if (!debDate) return;
      if (debDate < startDate || debDate > endDate) return;

      const pacId = deb.idPaciente || '';
      let activePacName = pacId ? activePatientsMap.get(pacId) : null;

      if (!activePacName && deb.nomePaciente) {
        const foundActive = Array.from(activePatientsMap.entries()).find(
          ([_, name]) => name.toLowerCase().trim() === deb.nomePaciente?.toLowerCase().trim()
        );
        if (foundActive) {
          activePacName = foundActive[1];
        }
      }

      // Skip if patient is not Active
      if (!activePacName) return;

      const motivoLower = (deb.motivo || '').toLowerCase();
      if (motivoLower.includes('curinga')) {
        const absentProf = deb.nomeProfissional || 'Profissional Ausente';

        // Find matching shift in agendamentos for Curinga substitute
        const matchingShift = (agendamentos || []).find(ag => {
          const agDate = parseDateToYYYYMMDD(ag.data);
          if (agDate !== debDate) return false;
          const pacMatch = ag.idPaciente === pacId || activePatientsMap.get(ag.idPaciente) === activePacName;
          const isCuringaShift = !!ag.isCuringa || ag.observacao?.toUpperCase().includes('CURINGA');
          return pacMatch && isCuringaShift;
        });

        const substituteProf = matchingShift?.nomeProfissional || 'Curinga Escalado';
        let reason = matchingShift?.motivoFalta || matchingShift?.observacao || deb.motivo || 'Substituição Curinga';
        if (reason.toUpperCase() === 'CURINGA') {
          reason = 'Falta / Substituição Curinga';
        }

        const key = `${debDate}_${activePacName}_${absentProf}_${substituteProf}`;
        if (!processedKeys.has(key)) {
          processedKeys.add(key);
          list.push({
            id: deb.id || `deb_${Math.random()}`,
            data: debDate,
            dataFormatted: debDate.split('-').reverse().join('/'),
            pacienteId: pacId,
            pacienteNome: activePacName,
            profissionalAusente: absentProf,
            curingaSubstituto: substituteProf,
            motivo: reason
          });
        }
      }
    });

    // 2. Process Agendamentos where isCuringa is true or observacao contains CURINGA
    (agendamentos || []).forEach(ag => {
      const agDate = parseDateToYYYYMMDD(ag.data);
      if (!agDate) return;
      if (agDate < startDate || agDate > endDate) return;

      const pacName = activePatientsMap.get(ag.idPaciente);
      if (!pacName) return; // Active patients only

      const isCuringa = !!ag.isCuringa || ag.observacao?.toUpperCase().includes('CURINGA');
      if (!isCuringa) return;

      const substituteProf = ag.nomeProfissional || 'Curinga Escalado';

      // Find matching debit for absent professional
      const matchingDebit = (debitosProfissionais || []).find(deb => {
        const debDate = parseDateToYYYYMMDD(deb.data);
        if (debDate !== agDate) return false;
        const pacMatch = deb.idPaciente === ag.idPaciente || activePatientsMap.get(deb.idPaciente) === pacName;
        return pacMatch && (deb.motivo || '').toLowerCase().includes('curinga');
      });

      let absentProf = matchingDebit?.nomeProfissional;
      if (!absentProf) {
        if (ag.motivoFalta && ag.motivoFalta !== 'Não Informado') {
          absentProf = `Falta (${ag.motivoFalta})`;
        } else if (ag.observacao && ag.observacao.includes('Substituindo')) {
          absentProf = ag.observacao.replace(/.*Substituindo\s*/i, '').trim();
        } else {
          absentProf = 'Profissional Não Especificado';
        }
      }

      let reason = ag.motivoFalta || matchingDebit?.motivo || ag.observacao || 'Substituição Curinga';
      if (reason.toUpperCase() === 'CURINGA') {
        reason = 'Falta / Substituição Curinga';
      }

      const key = `${agDate}_${pacName}_${absentProf}_${substituteProf}`;
      if (!processedKeys.has(key)) {
        processedKeys.add(key);
        list.push({
          id: ag.id || `ag_${Math.random()}`,
          data: agDate,
          dataFormatted: agDate.split('-').reverse().join('/'),
          pacienteId: ag.idPaciente,
          pacienteNome: pacName,
          profissionalAusente: absentProf,
          curingaSubstituto: substituteProf,
          motivo: reason
        });
      }
    });

    return list.sort((a, b) => b.data.localeCompare(a.data));
  }, [startDate, endDate, activePatientsMap, debitosProfissionais, agendamentos]);

  // Ranking de Ausências (Ranking dos profissionais com mais substituições)
  const rankingAusencias = useMemo(() => {
    const countsMap = new Map<string, number>();
    curingaOcorrencias.forEach(item => {
      const prof = item.profissionalAusente || 'Não Identificado';
      countsMap.set(prof, (countsMap.get(prof) || 0) + 1);
    });

    return Array.from(countsMap.entries())
      .map(([nome, count]) => ({
        nome,
        count,
        percent: curingaOcorrencias.length > 0 ? Math.round((count / curingaOcorrencias.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [curingaOcorrencias]);

  // Consolidação de Motivos
  const consolidacaoMotivos = useMemo(() => {
    const motivosMap = new Map<string, number>();
    curingaOcorrencias.forEach(item => {
      let m = (item.motivo || 'Não Informado').trim();
      motivosMap.set(m, (motivosMap.get(m) || 0) + 1);
    });

    return Array.from(motivosMap.entries())
      .map(([motivo, count]) => ({
        motivo,
        count,
        percent: curingaOcorrencias.length > 0 ? Math.round((count / curingaOcorrencias.length) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  }, [curingaOcorrencias]);

  // Quick Date Presets
  const handleSetCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  };

  const handleSetLast30Days = () => {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
    setEndDate(now.toISOString().split('T')[0]);
  };

  const handleSetCurrentYear = () => {
    const now = new Date();
    setStartDate(`${now.getFullYear()}-01-01`);
    setEndDate(`${now.getFullYear()}-12-31`);
  };

  const handlePrint = async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    try {
      const element = document.getElementById('absenteismo-print-area');
      if (!element) throw new Error('Área de impressão não encontrada no DOM.');

      const html2canvasModule = await import('html2canvas-pro');
      const html2canvas = html2canvasModule.default || html2canvasModule;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      const startPart = startDate ? startDate.split('-').reverse().join('-') : '';
      const endPart = endDate ? endDate.split('-').reverse().join('-') : '';
      const periodName = startPart && endPart ? `${startPart} a ${endPart}` : 'periodo-solicitado';

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Relatorio Curinga - ${periodName}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Relatório baixado em PNG com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar o relatório:', error);
      toast.error(error?.message || 'Erro ao exportar imagem do relatório.');
    } finally {
      setIsPrinting(false);
    }
  };

  if (!isOpen) return null;

  const startFormatted = startDate ? startDate.split('-').reverse().join('/') : '';
  const endFormatted = endDate ? endDate.split('-').reverse().join('/') : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-700 via-rose-700 to-red-800 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 backdrop-blur-sm shadow-inner">
              <UserX className="w-6 h-6 text-rose-200" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Relatório de Curingas
                <span className="text-[10px] uppercase font-extrabold bg-rose-500/40 text-rose-100 px-2 py-0.5 rounded-full border border-rose-300/30">
                  Pacientes Ativos
                </span>
              </h2>
              <p className="text-xs text-rose-100/90 font-medium">
                Análise de substituições e ranking de faltas dos profissionais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-rose-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Controls & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Filter size={16} className="text-red-600" />
                <span>Filtrar Período do Relatório</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium mr-1">Atalhos:</span>
                  <button
                    onClick={handleSetCurrentMonth}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Mês Atual
                  </button>
                  <button
                    onClick={handleSetLast30Days}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Últimos 30 Dias
                  </button>
                  <button
                    onClick={handleSetCurrentYear}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-md transition-colors cursor-pointer"
                  >
                    Este Ano
                  </button>
                </div>

                {/* Botão de Exportação no Topo próximo aos filtros */}
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting || curingaOcorrencias.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/40 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  title="Baixar Relatório em imagem PNG"
                >
                  <Download size={16} />
                  <span>{isPrinting ? 'Gerando PNG...' : 'Baixar Relatório'}</span>
                </button>
              </div>
            </div>

            {/* Inputs Data Inicial / Data Final */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Data Inicial
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Data Final
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <div className="w-full bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-900 font-medium flex items-center gap-2">
                  <Info size={16} className="text-red-600 shrink-0" />
                  <span>
                    Exibindo <strong>{curingaOcorrencias.length}</strong> ocorrência(s) de substituição para pacientes ativos.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Report Content Container (Captured in Print/PNG) */}
          <div
            id="absenteismo-print-area"
            ref={printAreaRef}
            className="space-y-6 bg-white p-5 rounded-xl border border-slate-200 shadow-sm"
          >
            
            {/* Report Header for Print */}
            <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="text-red-600" size={20} />
                  Consolidado de Substituições Curinga
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Período apurado: <strong className="text-slate-800">{startFormatted || '—'}</strong> até <strong className="text-slate-800">{endFormatted || '—'}</strong>
                </p>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 font-black text-xs rounded-full border border-red-200">
                  Total: {curingaOcorrencias.length} Curinga(s)
                </span>
              </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/80 rounded-xl">
                <div className="flex items-center justify-between text-red-700 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider leading-relaxed pb-0.5">Substituições Curinga</span>
                  <UserX size={18} />
                </div>
                <div className="text-2xl font-black text-red-900 leading-relaxed pb-1">{curingaOcorrencias.length}</div>
                <p className="text-[11px] text-red-700/80 mt-1 font-medium leading-relaxed pb-0.5">Turnos/plantões no período</p>
              </div>

              <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl">
                <div className="flex items-center justify-between text-amber-800 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider leading-relaxed pb-0.5">Mais Substituído</span>
                  <AlertTriangle size={18} />
                </div>
                <div className="text-base font-black text-amber-950 leading-relaxed pb-1" title={rankingAusencias[0]?.nome || 'Nenhum'}>
                  {rankingAusencias[0]?.nome || 'Nenhum'}
                </div>
                <p className="text-[11px] text-amber-800/80 mt-1 font-medium leading-relaxed pb-0.5">
                  {rankingAusencias[0] ? `${rankingAusencias[0].count} falta(s) / substituição(ões)` : 'Sem ocorrências'}
                </p>
              </div>

              <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200/80 rounded-xl">
                <div className="flex items-center justify-between text-indigo-800 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider leading-relaxed pb-0.5">Principal Motivo</span>
                  <TrendingUp size={18} />
                </div>
                <div className="text-base font-black text-indigo-950 leading-relaxed pb-1" title={consolidacaoMotivos[0]?.motivo || 'Nenhum'}>
                  {consolidacaoMotivos[0]?.motivo || 'Nenhum'}
                </div>
                <p className="text-[11px] text-indigo-800/80 mt-1 font-medium leading-relaxed pb-0.5">
                  {consolidacaoMotivos[0] ? `${consolidacaoMotivos[0].count} ocorrência(s) (${consolidacaoMotivos[0].percent}%)` : 'Sem dados'}
                </p>
              </div>
            </div>

            {/* Ranking dos Profissionais com Mais Ocorrências */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Award className="text-red-600" size={18} />
                <h4 className="text-sm font-black text-slate-800 leading-relaxed pb-1">
                  Ranking dos Profissionais com Mais Ocorrências (Ausências)
                </h4>
              </div>

              {rankingAusencias.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-medium leading-relaxed pb-2">
                  Nenhuma ausência ou substituição registrada para o período selecionado.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {rankingAusencias.map((item, idx) => (
                    <div
                      key={`rank-${idx}-${item.nome}`}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4 hover:border-red-300 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white shrink-0 shadow-xs ${
                          idx === 0 ? 'bg-red-600' : idx === 1 ? 'bg-orange-500' : idx === 2 ? 'bg-amber-500' : 'bg-slate-400'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0 pb-1">
                          <p className="text-xs font-bold text-slate-800 leading-relaxed pb-1" title={item.nome}>
                            {item.nome}
                          </p>
                          <div className="w-32 bg-slate-200 h-2 rounded-full mt-1.5">
                            <div
                              className="bg-red-600 h-full rounded-full transition-all"
                              style={{ width: `${Math.max(item.percent, 8)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pb-1">
                        <span className="text-sm font-black text-red-700 leading-relaxed block pb-0.5">
                          {item.count} {item.count === 1 ? 'falta' : 'faltas'}
                        </span>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed pb-0.5">
                          {item.percent}% do total
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Consolidação de Motivos */}
            {consolidacaoMotivos.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <FileText className="text-red-600" size={18} />
                  <h4 className="text-sm font-black text-slate-800 leading-relaxed pb-1">
                    Consolidação de Motivos de Substituição
                  </h4>
                </div>

                <div className="flex flex-wrap gap-2">
                  {consolidacaoMotivos.map((m, idx) => (
                    <div
                      key={`motivo-${idx}`}
                      className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-2 text-xs leading-relaxed"
                    >
                      <span className="font-bold text-slate-800 leading-relaxed pb-0.5">{m.motivo}:</span>
                      <span className="font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 leading-relaxed pb-0.5">
                        {m.count} ({m.percent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela Detalhada de Substituições */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="text-red-600" size={18} />
                  <h4 className="text-sm font-black text-slate-800 leading-relaxed pb-1">
                    Detalhamento dos Turnos com Curinga
                  </h4>
                </div>
                <span className="text-xs text-slate-500 font-medium leading-relaxed pb-1">
                  {curingaOcorrencias.length} registro(s) no período
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px] leading-relaxed">
                      <th className="p-3 pb-3.5">Data do Plantão</th>
                      <th className="p-3 pb-3.5">Paciente</th>
                      <th className="p-3 pb-3.5">Profissional Ausente</th>
                      <th className="p-3 pb-3.5">Curinga (Substituto)</th>
                      <th className="p-3 pb-3.5">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {curingaOcorrencias.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 italic leading-relaxed pb-3">
                          Nenhum plantão com Curinga localizado para pacientes ativos neste período.
                        </td>
                      </tr>
                    ) : (
                      curingaOcorrencias.map((row, idx) => (
                        <tr key={`row-${row.id}-${idx}`} className="hover:bg-rose-50/40 transition-colors">
                          <td className="p-3 font-bold text-slate-800 whitespace-nowrap leading-relaxed pb-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={14} className="text-red-600 shrink-0" />
                              <span className="leading-relaxed pb-0.5">{row.dataFormatted}</span>
                            </div>
                          </td>

                          <td className="p-3 font-semibold text-slate-800 leading-relaxed pb-3">
                            <span className="leading-relaxed pb-0.5">{row.pacienteNome}</span>
                          </td>

                          <td className="p-3 font-bold text-red-800 bg-red-50/50 rounded-md leading-relaxed pb-3">
                            <div className="flex items-center gap-2">
                              <UserX size={14} className="text-red-600 shrink-0" />
                              <span className="leading-relaxed pb-0.5">{row.profissionalAusente}</span>
                            </div>
                          </td>

                          <td className="p-3 font-bold text-emerald-800 bg-emerald-50/50 rounded-md leading-relaxed pb-3">
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} className="text-emerald-600 shrink-0" />
                              <span className="leading-relaxed pb-0.5">{row.curingaSubstituto}</span>
                            </div>
                          </td>

                          <td className="p-3 text-slate-700 font-medium leading-relaxed pb-3">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-800 rounded border border-slate-200 text-[11px] leading-relaxed pb-0.5">
                              {row.motivo}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500 font-medium">
            Relatório gerado em {new Date().toLocaleDateString('pt-BR')}
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
