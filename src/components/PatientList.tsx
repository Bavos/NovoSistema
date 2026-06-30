/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Paciente } from '../types';
import { Edit, Trash, Plus, Filter, Check, EyeOff, ShieldCheck, AlertCircle, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useFirebase } from '../context/FirebaseContext';
import { ConfirmModal } from './ConfirmModal';
import { CardSkeleton } from './ui/CardSkeleton';

interface PatientListProps {
  pacientes: Paciente[];
  onSelectPatient: (paciente: Paciente) => void;
  onNewPatient: () => void;
  onDeletePatient: (id: string) => void;
  onDeactivatePatient: (id: string, motivo: string) => void;
  globalSearchQuery: string;
  isLoading?: boolean;
}

export const PatientList: React.FC<PatientListProps> = ({
  pacientes,
  onSelectPatient,
  onNewPatient,
  onDeletePatient,
  onDeactivatePatient,
  globalSearchQuery,
  isLoading,
}) => {
  const { userRole } = useFirebase();
  const isColaborador = userRole?.toLowerCase() === 'colaborador';

  const [localSearch, setLocalSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterPacienteId, setFilterPacienteId] = useState<string>('todos');

  // Deactivation confirmation modal for list bulk actions
  const [bulkDeactivateOpen, setBulkDeactivateOpen] = useState(false);
  const [bulkDeactivateReason, setBulkDeactivateReason] = useState('Desligamento corporativo');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Sorted list of patients for filter dropdown: active alphabetically first, then inactive alphabetically
  const sortedPacientes = useMemo(() => {
    return [...pacientes].sort((a, b) => {
      const statusA = a.status === 'Ativo' ? 0 : 1;
      const statusB = b.status === 'Ativo' ? 0 : 1;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      const nameA = (a.nome || '').toLowerCase();
      const nameB = (b.nome || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });
  }, [pacientes]);

  // Combined Search and Filters
  const filteredPacientes = useMemo(() => {
    const query = (localSearch || globalSearchQuery || '').toLowerCase().trim();
    const cleanQuery = query.replace(/\D/g, '');

    const filtered = pacientes.filter((p) => {
      // Search logic (localSearch or globalSearchQuery)
      const cleanCpf = (p.cpf || '').replace(/\D/g, '');
      const cleanPhone = (p.telefoneResponsavel || '').replace(/\D/g, '');

      const matchSearch = !query ||
        (p.nome || '').toLowerCase().includes(query) ||
        (p.cpf || '').toLowerCase().includes(query) ||
        (p.bairro || '').toLowerCase().includes(query) ||
        (p.nomeResponsavel || '').toLowerCase().includes(query) ||
        (p.parentescoResponsavel || '').toLowerCase().includes(query) ||
        (cleanQuery && cleanCpf.includes(cleanQuery)) ||
        (cleanQuery && cleanPhone.includes(cleanQuery));

      // Filter logic
      const matchPaciente = filterPacienteId === 'todos' ? true : p.id === filterPacienteId;

      return matchSearch && matchPaciente;
    });

    // Sort strictly by status first (Ativos on top), then by name (case-insensitive A-Z)
    return filtered.sort((a, b) => {
      const statusA = a.status === 'Ativo' ? 0 : 1;
      const statusB = b.status === 'Ativo' ? 0 : 1;
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      const nameA = (a.nome || '').toLowerCase();
      const nameB = (b.nome || '').toLowerCase();
      return nameA.localeCompare(nameB, 'pt-BR');
    });
  }, [pacientes, localSearch, globalSearchQuery, filterPacienteId]);

  // Checkbox functions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPacientes.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    }
  };

  const isAllSelected =
    filteredPacientes.length > 0 && selectedIds.length === filteredPacientes.length;

  const handleBulkDeactivate = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map(async (id) => {
        await onDeactivatePatient(id, bulkDeactivateReason);
      }));
      toast.success(`${selectedIds.length} paciente(s) desativado(s) com sucesso.`, {
        icon: '✅',
      });
      setSelectedIds([]);
      setBulkDeactivateOpen(false);
    } catch (error: any) {
      console.error("Erro na desativação em lote:", error);
      toast.error("Erro ao desativar pacientes: " + (error.message || error));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await Promise.all(selectedIds.map((id) => onDeletePatient(id)));
      toast.success('Exclusão lógica realizada com sucesso! Registros desativados.');
      setSelectedIds([]);
      setBulkDeleteOpen(false);
      setDeleteConfirmText('');
    } catch (error: any) {
      console.error("Erro na exclusão em lote:", error);
      toast.error("Erro ao excluir pacientes: " + (error.message || error));
    }
  };

  // Helper for Status color
  const getStatusBadge = (status: 'Ativo' | 'Desativado') => {
    if (status === 'Ativo') {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-normal bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="italic uppercase font-bold tracking-wider">ATIVO</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-normal bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        <span className="italic uppercase font-bold tracking-wider">DESATIVADO</span>
      </span>
    );
  };

  // Helper for dependencia style
  const getDependenceBadge = (level: string) => {
    switch (level) {
      case 'Baixo':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Médio':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Alto':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Muito Alto':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4" id="patient-list-section">
      {/* Top action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Local search, filter dropdown trigger */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou telefone..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          <div className="relative max-w-xs w-full">
            <select
              value={filterPacienteId}
              onChange={(e) => setFilterPacienteId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner cursor-pointer"
            >
              <option value="todos">Todos os Pacientes</option>
              {sortedPacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} ({p.status === 'Ativo' ? 'Ativo' : 'Inativo'})
                </option>
              ))}
            </select>
          </div>

          {(filterPacienteId !== 'todos' || localSearch) && (
            <button
              onClick={() => {
                setLocalSearch('');
                setFilterPacienteId('todos');
              }}
              className="text-xs text-slate-400 hover:text-blue-600 underline font-semibold cursor-pointer"
            >
              Resetar Filtros
            </button>
          )}
        </div>

        {/* Right side primary action */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && !isColaborador && (
            <div className="flex items-center space-x-1.5 animate-in fade-in-30 slide-in-from-right-5">
              <span className="text-xs text-slate-500 mr-2 font-medium">
                {selectedIds.length} selecionado(s):
              </span>
              <button
                onClick={() => {
                  setDeactivateConfirmText('');
                  setBulkDeactivateOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors cursor-pointer shadow-xs"
                title="Desativar selecionados"
              >
                <EyeOff size={13} />
                <span>Desativar</span>
              </button>
              <button
                onClick={() => {
                  setDeleteConfirmText('');
                  setBulkDeleteOpen(true);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 rounded-md transition-colors cursor-pointer shadow-xs"
                title="Excluir selecionados"
              >
                <Trash size={13} />
                <span>Excluir</span>
              </button>
            </div>
          )}

          <button
            onClick={onNewPatient}
            className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-md transition-all shadow-sm cursor-pointer"
            id="btn-novo-paciente"
          >
            <Plus size={16} />
            <span>Novo Paciente</span>
          </button>
        </div>
      </div>

      {/* Selection Control Bar */}
      {filteredPacientes.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-100/60 rounded-xl border border-slate-200/60 text-xs text-slate-600 mb-3">
          <label className="flex items-center space-x-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
            />
            <span className="font-semibold text-slate-700">Selecionar Todos os {filteredPacientes.length} Pacientes</span>
          </label>
        </div>
      )}

      {/* Cards List Container */}
      <div className="space-y-3" id="patients-cards-container">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={`patient-skeleton-${i}`} />
          ))
        ) : filteredPacientes.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
            <div className="flex flex-col items-center justify-center space-y-2">
              <AlertCircle size={28} className="text-slate-300 animate-bounce" />
              <p className="font-medium text-slate-500">Nenhum paciente localizado</p>
              <p className="text-xs text-slate-400">Tente ajustar suas palavras-chave ou regras de filtros no painel.</p>
            </div>
          </div>
        ) : (
          filteredPacientes.map((p, index) => {
            const isSelected = selectedIds.includes(p.id);
            const cleanPhone = (p.telefoneResponsavel || '').trim();

            return (
              <div
                key={`pac-card-${p.id || index}`}
                className={`bg-white p-4 rounded-xl shadow-xs border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm hover:border-gray-200 ${
                  isSelected ? 'border-emerald-500 ring-1 ring-emerald-500/20 bg-emerald-50/5' : 'border-gray-100'
                }`}
              >
                {/* Left Section: Checkbox & Info */}
                <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                  <div className="pt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Header Info: Name & Status Badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectPatient(p)}
                        className="font-bold text-slate-800 text-base hover:text-emerald-600 transition-colors cursor-pointer text-left focus:outline-none"
                      >
                        {p.nome}
                      </button>
                      {getStatusBadge(p.status)}
                    </div>

                    {/* Meta Info Row: Phone, Dependence, Bairro */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
                      {cleanPhone && (
                        <span className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                          <strong>Telefone:</strong> {cleanPhone}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <strong>Grau de Dependência:</strong> 
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider ${getDependenceBadge(p.informacoesMedicas?.grauDependencia)}`}>
                          {p.informacoesMedicas?.grauDependencia || 'Não informado'}
                        </span>
                      </span>
                      {p.bairro && (
                        <span className="text-slate-500 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded">
                          <strong>Bairro:</strong> {p.bairro}
                        </span>
                      )}
                    </div>

                    {/* Escala Row */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded shadow-xs">
                        {p.planoAtendimento?.tipoEscala || 'Diurno 12h'} • {p.planoAtendimento?.horaInicioPadrao || '07:00'}
                      </span>
                      {p.planoAtendimento?.tiposPlantao && p.planoAtendimento.tiposPlantao.map((sub) => (
                        <span key={sub.id} className="text-[10px] font-medium text-slate-600 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded" title={`Valor: R$ ${sub.valorPlantao}`}>
                          {sub.tipoEscala} • {sub.horaInicio}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Section: Pencil Action Button */}
                <div className="flex items-center justify-end flex-shrink-0">
                  <button
                    onClick={() => onSelectPatient(p)}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all cursor-pointer border border-transparent hover:border-emerald-100"
                    title="Editar/Ver Prontuário"
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Footer stats container wrapper */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Dynamic Footer stats */}
        <div className="bg-slate-50/75 py-3 px-6 text-xs text-slate-500 flex justify-between items-center">
          <p>
            Exibindo <span className="font-semibold text-slate-700">{filteredPacientes.length}</span> de <span className="font-semibold text-slate-700">{pacientes.length}</span> pacientes cadastrados.
          </p>
          <div className="flex space-x-4">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span><strong>{pacientes.filter((p) => p.status === 'Ativo').length}</strong> Ativos</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span><strong>{pacientes.filter((p) => p.status === 'Desativado').length}</strong> Desativados</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bulk deactivation modal */}
      {bulkDeactivateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">Desativar Pacientes Selecionados</h3>
            <p className="text-xs text-slate-500 italic">
              Você selecionou {selectedIds.length} paciente(s) para desativação em lote. Descrever o motivo é necessário para manter o registro histórico de prontuários.
            </p>
            <div className="space-y-1.5">
              <label className="block text-xs font-normal text-slate-700">Justificativa para Desativação:</label>
              <textarea
                value={bulkDeactivateReason}
                onChange={(e) => setBulkDeactivateReason(e.target.value)}
                rows={3}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                placeholder="Exemplo: Fim do contrato de acompanhamento domiciliar..."
              />
            </div>

            {/* Confirmation textbox */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Para autorizar, digite <span className="font-extrabold text-red-650 font-mono select-all">'CONFIRMAR'</span> abaixo:
              </label>
              <input
                type="text"
                value={deactivateConfirmText}
                onChange={(e) => setDeactivateConfirmText(e.target.value)}
                placeholder="Digite CONFIRMAR"
                className="w-full text-xs font-mono font-bold tracking-widest px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white uppercase focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setBulkDeactivateOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer font-medium"
              >
                Voltar
              </button>
              <button
                onClick={handleBulkDeactivate}
                disabled={deactivateConfirmText !== 'CONFIRMAR'}
                className="px-3.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-45 disabled:cursor-not-allowed font-bold shadow-md shadow-red-100 transition-colors"
              >
                Confirmar Desativação Múltipla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete (logical deactivation, safety standards) modal */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-55 animate-in fade-in-40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4 font-sans">
            <div className="flex items-start space-x-3 text-red-600">
              <AlertCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Excluir Pacientes Selecionados</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Você selecionou <strong className="text-slate-800">{selectedIds.length}</strong> paciente(s) para exclusão.
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-650 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-150 font-sans">
              <strong>Diretrizes de Segurança de Dados:</strong> Conforme as regras de governança e prontuários médicos do sistema, os dados dos pacientes nunca são excluídos permanentemente de forma destrutiva. 
              <br /><br />
              Essa ação de exclusão realizará a <strong>desativação lógica</strong> do(s) registro(s), preservando o histórico legal de acompanhamentos domiciliares.
            </p>

            {/* Confirmation textbox */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Para confirmar a exclusão lógica, digite <span className="font-extrabold text-red-650 font-mono select-all">'CONFIRMAR'</span> abaixo:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Digite CONFIRMAR"
                className="w-full text-xs font-mono font-bold tracking-widest px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white uppercase focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setBulkDeleteOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'CONFIRMAR'}
                className="px-3.5 py-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg cursor-pointer font-bold shadow-md shadow-red-100 transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                Excluir permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
