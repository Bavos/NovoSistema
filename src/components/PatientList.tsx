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

interface PatientListProps {
  pacientes: Paciente[];
  onSelectPatient: (paciente: Paciente) => void;
  onNewPatient: () => void;
  onDeletePatient: (id: string) => void;
  onDeactivatePatient: (id: string, motivo: string) => void;
  globalSearchQuery: string;
}

export const PatientList: React.FC<PatientListProps> = ({
  pacientes,
  onSelectPatient,
  onNewPatient,
  onDeletePatient,
  onDeactivatePatient,
  globalSearchQuery,
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
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });
  }, [pacientes]);

  // Combined Search and Filters
  const filteredPacientes = useMemo(() => {
    return pacientes.filter((p) => {
      // Search logic (localSearch or globalSearchQuery)
      const query = (localSearch || globalSearchQuery || '').toLowerCase();
      const matchSearch =
        (p.nome || '').toLowerCase().includes(query) ||
        (p.cpf || '').toLowerCase().includes(query) ||
        (p.bairro || '').toLowerCase().includes(query) ||
        (p.nomeResponsavel || '').toLowerCase().includes(query);

      // Filter logic
      const matchPaciente = filterPacienteId === 'todos' ? true : p.id === filterPacienteId;

      return matchSearch && matchPaciente;
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
              placeholder="Buscar nesta lista..."
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
                className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
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
                className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
                title="Excluir selecionados"
              >
                <Trash size={13} />
                <span>Excluir</span>
              </button>
            </div>
          )}

          <button
            onClick={onNewPatient}
            className="flex items-center space-x-1.5 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-all shadow-lg shadow-blue-200 cursor-pointer"
            id="btn-novo-paciente"
          >
            <Plus size={16} />
            <span>Novo Paciente</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" id="patients-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-gray-800 tracking-wider">
                <th className="py-4 px-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="py-4 px-4 text-left font-semibold text-gray-800">Nome Completo</th>
                <th className="p-4 text-left font-semibold text-gray-800">Bairro</th>
                <th className="p-4 text-left font-semibold text-gray-800">Grau Dependência</th>
                <th className="p-4 text-center font-semibold text-gray-800">Plano de Escala</th>
                <th className="p-4 text-center font-semibold text-gray-800">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 text-base divide-y divide-slate-100">
              {filteredPacientes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle size={28} className="text-slate-300" />
                      <p className="font-medium text-slate-500">Nenhum paciente localizado</p>
                      <p className="text-xs text-slate-400">Tente ajustar suas palavras-chave ou regras de filtros no painel.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPacientes.map((p, index) => {
                  const isSelected = selectedIds.includes(p.id);
                  const letters = p.nome
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase();

                  return (
                    <tr
                      key={`pac-${p.id || index}-${index}`}
                      className={`hover:bg-slate-50/70 transition-colors group ${
                        isSelected ? 'bg-blue-50/40 hover:bg-blue-50/60' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                      }`}
                    >
                      {/* Checkbox wrapper */}
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectOne(p.id, e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Full Name */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => onSelectPatient(p)}
                            className="font-normal text-gray-900 hover:text-blue-600 text-left transition-colors cursor-pointer text-base"
                          >
                            {p.nome}
                          </button>
                          <span className="text-sm text-gray-500 mt-0.5 font-mono">CPF: {p.cpf}</span>
                        </div>
                      </td>

                      {/* Bairro */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col space-y-1.5">
                          <span className="font-normal text-gray-900 text-base">{p.bairro}</span>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-xs font-normal text-indigo-700 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded shadow-sm">
                              {p.planoAtendimento?.tipoEscala || 'Diurno 12h'} • {p.planoAtendimento?.horaInicioPadrao || '07:00'}
                            </span>
                            {p.planoAtendimento?.tiposPlantao && p.planoAtendimento.tiposPlantao.map((sub) => (
                              <span key={sub.id} className="text-xs font-normal text-gray-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded" title={`Valor: R$ ${sub.valorPlantao}`}>
                                {sub.tipoEscala} • {sub.horaInicio}
                              </span>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Grau Dependencia */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getDependenceBadge(
                            p.informacoesMedicas?.grauDependencia
                          )}`}
                        >
                          {p.informacoesMedicas?.grauDependencia || 'Não informado'}
                        </span>
                      </td>

                      {/* Plano de Escala */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-mono text-sm font-normal border border-slate-200">
                          {p.planoAtendimento?.tipoEscala || 'Diurno 12h'}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="py-4 px-4">{getStatusBadge(p.status)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Footer stats */}
        <div className="bg-slate-50/75 py-3 px-6 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
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
