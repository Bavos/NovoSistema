import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

export interface DadosAtalhoCuringa {
  profissional?: string; // nome do profissional
  profissionalId?: string; // ID do profissional
  paciente?: string; // nome do paciente
  pacienteId?: string; // ID do paciente
  data?: string; // data em formato YYYY-MM-DD
  motivo?: string;
}

interface ModalInserirDebitoProps {
  isOpen: boolean;
  onClose: () => void;
  editingDebitId?: string | null;
  dadosAtalhoCuringa?: DadosAtalhoCuringa | null;
}

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
  const [isInsertingDebit, setIsInsertingDebit] = useState(false);

  // Inicialização e reinicialização dos estados com base na prioridade exigida
  useEffect(() => {
    if (!isOpen) return;

    if (editingDebit) {
      // a) Se houver dados de Edição (lógica que já existe), use-os.
      setNewDebitProfId(editingDebit.idProfissional || '');
      setNewDebitPacienteId(editingDebit.idPaciente || '');
      setNewDebitValor(String(editingDebit.valor || ''));
      setNewDebitMotivo(editingDebit.motivo || 'Curinga');
      
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
        const found = activeProfissionais.find(
          p => p.nome.toLowerCase() === dadosAtalhoCuringa.profissional?.toLowerCase()
        );
        if (found) pId = found.id;
      }
      setNewDebitProfId(pId);

      // Procurar paciente pelo ID ou nome
      let pacId = dadosAtalhoCuringa.pacienteId || '';
      if (!pacId && dadosAtalhoCuringa.paciente) {
        const found = activePacientes.find(
          p => p.nome.toLowerCase() === dadosAtalhoCuringa.paciente?.toLowerCase()
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

      setNewDebitValor('');
      setNewDebitMotivo(dadosAtalhoCuringa.motivo || 'Curinga');
    } else {
      // c) Se nenhum dos dois existir, inicie os campos vazios.
      setNewDebitProfId('');
      setNewDebitPacienteId('');
      setNewDebitValor('');
      setNewDebitMotivo('Curinga');

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
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const valNumber = parseFloat(newDebitValor);
    if (isNaN(valNumber) || valNumber <= 0) {
      alert('O valor deve ser um número maior que zero.');
      return;
    }

    const profSelected = activeProfissionais.find(p => p.id === newDebitProfId);
    if (!profSelected) {
      alert('Profissional selecionado inválido ou inativo.');
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
        status: 'pendente'
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
      alert('Erro ao gravar débito.');
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

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Profissional *</label>
            <select
              value={newDebitProfId}
              onChange={(e) => setNewDebitProfId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
              required
            >
              <option value="">Selecione o profissional...</option>
              {activeProfissionais.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Paciente (Opcional)</label>
            <select
              value={newDebitPacienteId}
              onChange={(e) => setNewDebitPacienteId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="">Nenhum paciente selecionado</option>
              {activePacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>

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
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={newDebitValor}
                onChange={(e) => setNewDebitValor(e.target.value)}
                className="w-full pl-9 pr-3 p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-mono font-bold text-slate-800"
                required
              />
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

          <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end transition-all">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddDebit}
              disabled={isInsertingDebit}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {isInsertingDebit ? 'Gravando...' : (editingDebitId ? 'Salvar Alterações' : 'Confirmar Lançamento')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
