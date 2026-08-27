import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useFirebase } from '../context/FirebaseContext';
import { mascaraFinanceira, formatarMoeda, converterMascaraParaNumero } from '../lib/masks';

export interface DadosAtalhoCuringa {
  profissional?: string; // nome do profissional
  profissionalId?: string; // ID do profissional
  paciente?: string; // nome do paciente
  pacienteId?: string; // ID do paciente
  data?: string; // data em formato YYYY-MM-DD
  motivo?: string;
  valor?: number | string;
}

interface ModalInserirDebitoProps {
  isOpen: boolean;
  onClose: () => void;
  editingDebitId?: string | null;
  dadosAtalhoCuringa?: DadosAtalhoCuringa | null;
}

interface SearchableOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyOptionLabel?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Digite o nome para buscar...",
  emptyOptionLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    if (selectedOption) {
      setSearchTerm(selectedOption.label);
    } else {
      setSearchTerm('');
    }
  }, [value, selectedOption?.label]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedOption) {
          setSearchTerm(selectedOption.label);
        } else {
          setSearchTerm('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedOption]);

  const normalizeStr = (str: string) =>
    (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredOptions = options.filter(o => {
    if (!searchTerm || (selectedOption && searchTerm === selectedOption.label)) {
      return true;
    }
    const normSearch = normalizeStr(searchTerm);
    const normLabel = normalizeStr(o.label);
    const normSublabel = normalizeStr(o.sublabel || '');
    return normLabel.includes(normSearch) || normSublabel.includes(normSearch);
  });

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={searchTerm}
          onFocus={(e) => {
            setIsOpen(true);
            e.target.select();
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (e.target.value.trim() === '') {
              onChange('');
            } else {
              const inputNorm = normalizeStr(e.target.value.trim());
              const exactMatch = options.find(
                o => normalizeStr(o.label) === inputNorm
              );
              if (exactMatch) {
                onChange(exactMatch.id);
              }
            }
          }}
          onClick={() => setIsOpen(true)}
          className="w-full p-2.5 pr-8 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans cursor-pointer"
        />
        {searchTerm ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setSearchTerm('');
              setIsOpen(true);
            }}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
            title="Limpar seleção"
          >
            <X size={14} />
          </button>
        ) : (
          <div className="absolute right-2.5 text-slate-400 pointer-events-none">
            <ChevronDown size={16} />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[110] left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-sm font-sans animate-in fade-in duration-100">
          {emptyOptionLabel && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSearchTerm('');
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-400 italic hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100"
            >
              {emptyOptionLabel}
            </button>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400 text-center">
              Nenhum resultado encontrado para "{searchTerm}"
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(opt.id);
                  setSearchTerm(opt.label);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-emerald-50 hover:text-emerald-900 transition-colors cursor-pointer ${
                  opt.id === value ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-slate-700'
                }`}
              >
                <div className="flex flex-col">
                  <span>{opt.label}</span>
                  {opt.sublabel && <span className="text-[10px] text-slate-400 font-normal">{opt.sublabel}</span>}
                </div>
                {opt.id === value && <Check size={14} className="text-emerald-600" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const ModalInserirDebito: React.FC<ModalInserirDebitoProps> = ({
  isOpen,
  onClose,
  editingDebitId,
  dadosAtalhoCuringa
}) => {
  const {
    pacientes,
    profissionais,
    debitosProfissionais,
    addDebitoProfissional,
    updateDebitoProfissional,
  } = useFirebase();

  const activePacientes = pacientes.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  const activeProfissionais = profissionais.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');

  // Encontra o débito no caso de edição
  const editingDebit = editingDebitId ? debitosProfissionais.find(d => d.id === editingDebitId) : null;

  // Estados locais do formulário
  const [newDebitProfId, setNewDebitProfId] = useState('');
  const [newDebitPacienteId, setNewDebitPacienteId] = useState('');
  const [newDebitDate, setNewDebitDate] = useState('');
  const [newDebitValor, setNewDebitValor] = useState('');
  const [newDebitMotivo, setNewDebitMotivo] = useState('Curinga');
  const [newDebitObservacao, setNewDebitObservacao] = useState('');
  const [isInsertingDebit, setIsInsertingDebit] = useState(false);

  // Inicialização e reinicialização dos estados com base na prioridade exigida
  useEffect(() => {
    if (!isOpen) return;

    if (editingDebit) {
      // a) Se houver dados de Edição (lógica que já existe), use-os.
      setNewDebitProfId(editingDebit.idProfissional || '');
      setNewDebitPacienteId(editingDebit.idPaciente || '');
      setNewDebitValor(editingDebit.valor !== undefined && editingDebit.valor !== null ? formatarMoeda(editingDebit.valor) : '');
      setNewDebitMotivo(editingDebit.motivo || 'Curinga');
      setNewDebitObservacao(editingDebit.observacao || editingDebit.observacoes || '');
      
      if (editingDebit.data) {
        let dObj: Date;
        if (typeof editingDebit.data.toDate === 'function') {
          dObj = editingDebit.data.toDate();
        } else if (editingDebit.data.seconds) {
          dObj = new Date(editingDebit.data.seconds * 1000);
        } else {
          dObj = new Date(editingDebit.data);
        }
        const yr = dObj.getFullYear();
        const mo = String(dObj.getMonth() + 1).padStart(2, '0');
        const dy = String(dObj.getDate()).padStart(2, '0');
        setNewDebitDate(`${yr}-${mo}-${dy}`);
      } else {
        setNewDebitDate('');
      }
    } else if (dadosAtalhoCuringa) {
      // b) Se houver dadosAtalhoCuringa, preencha os campos para um NOVO cadastro usando esses dados.
      // Procurar profissional pelo ID ou nome caso o ID não venha preenchido diretamente
      let pId = dadosAtalhoCuringa.profissionalId || '';
      if (!pId && dadosAtalhoCuringa.profissional) {
        const normSearchProf = dadosAtalhoCuringa.profissional.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const found = activeProfissionais.find(
          p => p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normSearchProf
        );
        if (found) pId = found.id;
      }
      setNewDebitProfId(pId);

      // Procurar paciente pelo ID ou nome
      let pacId = dadosAtalhoCuringa.pacienteId || '';
      if (!pacId && dadosAtalhoCuringa.paciente) {
        const normSearchPac = dadosAtalhoCuringa.paciente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const found = activePacientes.find(
          p => p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normSearchPac
        );
        if (found) pacId = found.id;
      }
      setNewDebitPacienteId(pacId);

      // Setar data do atalho ou usar a data de hoje como fallback
      setNewDebitDate(dadosAtalhoCuringa.data || (() => {
        const today = new Date();
        const yr = today.getFullYear();
        const mo = String(today.getMonth() + 1).padStart(2, '0');
        const dy = String(today.getDate()).padStart(2, '0');
        return `${yr}-${mo}-${dy}`;
      })());

      setNewDebitValor(dadosAtalhoCuringa.valor !== undefined && dadosAtalhoCuringa.valor !== null && dadosAtalhoCuringa.valor !== '' ? formatarMoeda(dadosAtalhoCuringa.valor) : '');
      setNewDebitMotivo(dadosAtalhoCuringa.motivo || 'Curinga');
      setNewDebitObservacao('');
    } else {
      // c) Se nenhum dos dois existir, inicie os campos vazios.
      setNewDebitProfId('');
      setNewDebitPacienteId('');
      setNewDebitValor('');
      setNewDebitMotivo('Curinga');
      setNewDebitObservacao('');

      const today = new Date();
      const yr = today.getFullYear();
      const mo = String(today.getMonth() + 1).padStart(2, '0');
      const dy = String(today.getDate()).padStart(2, '0');
      setNewDebitDate(`${yr}-${mo}-${dy}`);
    }
  }, [isOpen, editingDebitId, dadosAtalhoCuringa, editingDebit]);

  if (!isOpen) return null;

  const handleAddDebit = async () => {
    if (!newDebitProfId || !newDebitDate || !newDebitValor || !newDebitMotivo) {
      toast.error('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const valNumber = converterMascaraParaNumero(newDebitValor);
    if (isNaN(valNumber) || valNumber <= 0) {
      toast.error('O valor deve ser um número maior que zero.');
      return;
    }

    const profSelected = activeProfissionais.find(p => p.id === newDebitProfId);
    if (!profSelected) {
      toast.error('Profissional selecionado inválido ou inativo.');
      return;
    }

    const patientSelected = activePacientes.find(p => p.id === newDebitPacienteId);
    const idPaciente = patientSelected ? patientSelected.id : '';
    const nomePaciente = patientSelected ? patientSelected.nome : '';

    setIsInsertingDebit(true);
    try {
      const [year, month, day] = newDebitDate.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);

      const debitData: any = {
        idProfissional: newDebitProfId,
        nomeProfissional: profSelected.nome,
        data: dateObj,
        valor: valNumber,
        motivo: newDebitMotivo,
        observacao: newDebitObservacao.trim(),
        status: editingDebit?.status || 'pendente'
      };

      if (idPaciente) {
        debitData.idPaciente = idPaciente;
        debitData.nomePaciente = nomePaciente;
      }

      if (editingDebitId) {
        debitData.id = editingDebitId;
        await updateDebitoProfissional(debitData);
      } else {
        await addDebitoProfissional(debitData);
      }

      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gravar débito.');
    } finally {
      setIsInsertingDebit(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
        >
          <X size={18} />
        </button>

        <div className="mb-4">
          <h2 className="text-base font-black text-slate-900">
            {editingDebitId ? 'Editar Débito de Profissional' : 'Inserir Débito de Profissional'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {editingDebitId ? 'Atualize as informações do lançamento de débito do perfil do cuidador.' : 'Lançamento de desconto pontual para abatimento automático na folha apurada.'}
          </p>
        </div>

        <div className="space-y-3 max-h-[75vh] overflow-y-auto px-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Profissional *</label>
            <SearchableSelect
              options={activeProfissionais.map(p => ({
                id: p.id,
                label: p.nome,
                sublabel: p.especialidade || p.profissao || undefined
              }))}
              value={newDebitProfId}
              onChange={(val) => setNewDebitProfId(val)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Paciente (Opcional)</label>
            <SearchableSelect
              options={activePacientes.map(p => ({
                id: p.id,
                label: p.nome
              }))}
              value={newDebitPacienteId}
              onChange={(val) => setNewDebitPacienteId(val)}
              emptyOptionLabel="Nenhum paciente selecionado"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Data do Débito *</label>
              <input
                type="date"
                value={newDebitDate}
                onChange={(e) => setNewDebitDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Valor do Débito *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-slate-400 font-bold font-mono">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newDebitValor}
                  onChange={(e) => setNewDebitValor(mascaraFinanceira(e.target.value))}
                  className="w-full pl-9 pr-3 p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-mono font-bold text-slate-800"
                  required
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Débito *</label>
            <select
              value={newDebitMotivo}
              onChange={(e) => setNewDebitMotivo(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
              required
            >
              <option value="Curinga">Curinga</option>
              <option value="Passagem">Passagem</option>
              <option value="MEI">MEI</option>
              <option value="Outros">Outros</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Observação (Opcional)</label>
            <textarea
              rows={2}
              value={newDebitObservacao}
              onChange={(e) => setNewDebitObservacao(e.target.value)}
              placeholder="Digite observações ou detalhes adicionais..."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans resize-none"
            />
          </div>

          <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end transition-all">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddDebit}
              disabled={isInsertingDebit}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/40 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInsertingDebit ? 'Gravando...' : (editingDebitId ? 'Salvar Alterações' : 'Confirmar Lançamento')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
