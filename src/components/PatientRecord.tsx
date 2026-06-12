/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Paciente, Plantao, CancelingReason, EscalacaoPlano } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { INITIAL_PROFESSIONALS } from '../mockData';
import {
  Save,
  Lock,
  Unlock,
  AlertOctagon,
  FileText,
  MapPin,
  Stethoscope,
  Clock,
  CalendarDays,
  User,
  Phone,
  ArrowLeft,
  X,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';

interface PatientRecordProps {
  paciente: Paciente | null; // null represents "Novo Paciente"
  onBack: () => void;
}

export const PatientRecord: React.FC<PatientRecordProps> = ({ paciente, onBack }) => {
  const {
    addPaciente,
    updatePaciente,
    deactivatePaciente,
    reactivatePaciente,
    plantoes,
    addPlantao,
    cancelPlantao,
    updatePlantao
  } = useFirebase();

  // Basic layout tab states
  const [activeTab, setActiveTab] = useState<'geral' | 'endereco' | 'medico' | 'plano' | 'agendamento'>('geral');
  const [alertDeactivateOpen, setAlertDeactivateOpen] = useState(false);
  const [deactivateReasonInput, setDeactivateReasonInput] = useState('');

  // Cancel shift modal state
  const [cancelShiftModalOpen, setCancelShiftModalOpen] = useState(false);
  const [selectedShiftForCancel, setSelectedShiftForCancel] = useState<string | null>(null);
  const [cancelReasonValue, setCancelReasonValue] = useState<CancelingReason>('Pediu para sair da escala');

  // Edit Shift/Professional Modal State
  const [editShiftModalOpen, setEditShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [editShiftProfName, setEditShiftProfName] = useState('');
  const [editShiftDate, setEditShiftDate] = useState('');
  const [editShiftDay, setEditShiftDay] = useState('Sex');

  // Add Shift inline inputs state
  const [newShiftProf, setNewShiftProf] = useState('');
  const [newShiftDate, setNewShiftDate] = useState('2026-06-12');
  const [newShiftDay, setNewShiftDay] = useState('Sex');
  const [newShiftTipoEscala, setNewShiftTipoEscala] = useState<number>(12);
  const [newShiftHoraInicio, setNewShiftHoraInicio] = useState('07:00');
  const [newShiftHoraTermino, setNewShiftHoraTermino] = useState('19:00');
  const [newShiftObservacao, setNewShiftObservacao] = useState('CURINGA');
  const [newShiftValor, setNewShiftValor] = useState<number>(150);
  const [newShiftRepasse, setNewShiftRepasse] = useState<number>(105);

  // Dropdown for professionals
  const [showProfDropdown, setShowProfDropdown] = useState(false);
  const [showEditProfDropdown, setShowEditProfDropdown] = useState(false);

  // States for multiple shift scheduling & holiday
  const [newShiftDatesList, setNewShiftDatesList] = useState<string[]>([]);
  const [newShiftFeriado, setNewShiftFeriado] = useState<'20%' | '50%' | null>(null);
  const [showBatchScheduling, setShowBatchScheduling] = useState(false);
  const [batchStartDate, setBatchStartDate] = useState('2026-06-12');
  const [batchEndDate, setBatchEndDate] = useState('2026-06-19');
  const [batchWeekdays, setBatchWeekdays] = useState<string[]>(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']);

  // Automatically calculate weekday from dates
  useEffect(() => {
    if (newShiftDate) {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dateStr = newShiftDate.includes('T') ? newShiftDate : `${newShiftDate}T12:00:00`;
      const dateObj = new Date(dateStr);
      setNewShiftDay(days[dateObj.getDay()] || 'Sex');
    }
  }, [newShiftDate]);

  useEffect(() => {
    if (editShiftDate) {
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      const dateStr = editShiftDate.includes('T') ? editShiftDate : `${editShiftDate}T12:00:00`;
      const dateObj = new Date(dateStr);
      setEditShiftDay(days[dateObj.getDay()] || 'Sex');
    }
  }, [editShiftDate]);

  // Shift Audit Inspector Modal state
  const [inspectedShiftJson, setInspectedShiftJson] = useState<any>(null);

  // Local state for Patient Forms
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [bairro, setBairro] = useState('');

  // Endereço block
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [logisticaChegada, setLogisticaChegada] = useState('');

  // Informações Médica
  const [diagnosticoPrincipal, setDiagnosticoPrincipal] = useState('');
  const [comorbidades, setComorbidades] = useState('');
  const [alergias, setAlergias] = useState('');
  const [grauDependencia, setGrauDependencia] = useState<'Baixo' | 'Médio' | 'Alto' | 'Muito Alto'>('Médio');
  const [observacoesClinicas, setObservacoesClinicas] = useState('');

  // Plano Atendimento
  const [tipoEscala, setTipoEscala] = useState<string>('Diurno 12h');
  const [horaInicioPadrao, setHoraInicioPadrao] = useState('07:00');
  const [valorSugeridoPlantao, setValorSugeridoPlantao] = useState<number>(150);
  const [ajudaCusto, setAjudaCusto] = useState<number>(0);
  const [taxaAdm, setTaxaAdm] = useState<number>(0);
  const [tiposPlantao, setTiposPlantao] = useState<EscalacaoPlano[]>([]);

  // States for adding a new plantão type inline to the list
  const [newSubTipoEscala, setNewSubTipoEscala] = useState<string>('Diurno 12h');
  const [newSubHoraInicio, setNewSubHoraInicio] = useState<string>('07:00');
  const [newSubValorPlantao, setNewSubValorPlantao] = useState<number>(150);
  const [newSubAjudaCusto, setNewSubAjudaCusto] = useState<number>(0);
  const [newSubTaxaAdm, setNewSubTaxaAdm] = useState<number>(0);

  // Status simulation
  const [isNew, setIsNew] = useState(true);
  const [pStatus, setPStatus] = useState<'Ativo' | 'Desativado'>('Ativo');
  const [pDeactDate, setPDeactDate] = useState<string | null>(null);
  const [pDeactReason, setPDeactReason] = useState<string | null>(null);

  // Load patient details into state
  useEffect(() => {
    if (paciente) {
      setIsNew(false);
      setNome(paciente.nome);
      setDataNascimento(paciente.dataNascimento);
      setCpf(paciente.cpf);
      setNomeResponsavel(paciente.nomeResponsavel);
      setTelefoneResponsavel(paciente.telefoneResponsavel);
      setEmail(paciente.email || '');
      setBairro(paciente.bairro || paciente.endereco.bairro);

      setRua(paciente.endereco.rua);
      setNumero(paciente.endereco.numero);
      setCep(paciente.endereco.cep);
      setCidade(paciente.endereco.cidade);
      setEstado(paciente.endereco.estado);
      setLogisticaChegada(paciente.endereco.logisticaChegada || '');

      setDiagnosticoPrincipal(paciente.informacoesMedicas.diagnosticoPrincipal || '');
      setComorbidades(paciente.informacoesMedicas.comorbidades || '');
      setAlergias(paciente.informacoesMedicas.alergias || '');
      setGrauDependencia(paciente.informacoesMedicas.grauDependencia || 'Médio');
      setObservacoesClinicas(paciente.informacoesMedicas.observacoesClinicas || '');

      setTipoEscala(paciente.planoAtendimento?.tipoEscala || 'Diurno 12h');
      setHoraInicioPadrao(paciente.planoAtendimento?.horaInicioPadrao || '07:00');
      setValorSugeridoPlantao(paciente.planoAtendimento?.valorSugeridoPlantao || 150);
      setAjudaCusto(paciente.planoAtendimento?.ajudaCusto || 0);
      setTaxaAdm(paciente.planoAtendimento?.taxaAdm || 0);
      setTiposPlantao(paciente.planoAtendimento?.tiposPlantao || []);
      
      const val = paciente.planoAtendimento?.valorSugeridoPlantao || 150;
      setNewShiftValor(val);
      setNewShiftRepasse(val * 0.70);

      setPStatus(paciente.status);
      setPDeactDate(paciente.desativadoEm || null);
      setPDeactReason(paciente.desativadoMotivo || null);
    } else {
      setIsNew(true);
      setNome('');
      setDataNascimento('1960-01-01');
      setCpf('');
      setNomeResponsavel('');
      setTelefoneResponsavel('');
      setEmail('');
      setBairro('');

      setRua('');
      setNumero('');
      setCep('');
      setCidade('Rio de Janeiro');
      setEstado('RJ');
      setLogisticaChegada('');

      setDiagnosticoPrincipal('');
      setComorbidades('');
      setAlergias('Sem alergias conhecidas');
      setGrauDependencia('Médio');
      setObservacoesClinicas('');

      setTipoEscala('Diurno 12h');
      setHoraInicioPadrao('07:00');
      setValorSugeridoPlantao(150);
      setAjudaCusto(0);
      setTaxaAdm(0);
      setTiposPlantao([]);

      setPStatus('Ativo');
      setPDeactDate(null);
      setPDeactReason(null);
    }
  }, [paciente]);

  // Is patient currently deactivated?
  const isCurrentlyDeactivated = pStatus === 'Desativado';

  // Get active shifts for this patient
  const filteredShiftsForPatient = plantoes.filter(
    (pl) => paciente && pl.pacienteId === paciente.id
  ).sort((a, b) => b.data.localeCompare(a.data));

  // Handle Form Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCurrentlyDeactivated) return;

    if (!nome || !cpf || !nomeResponsavel || !telefoneResponsavel) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, CPF, Nome Responsável e Telefone).');
      return;
    }

    const patientPayload = {
      nome,
      dataNascimento,
      cpf,
      nomeResponsavel,
      telefoneResponsavel,
      email,
      bairro: bairro || 'Copacabana',
      endereco: {
        rua,
        numero,
        cep,
        bairro: bairro || 'Copacabana',
        cidade,
        estado,
        logisticaChegada,
      },
      informacoesMedicas: {
        diagnosticoPrincipal,
        comorbidades,
        alergias,
        grauDependencia,
        observacoesClinicas,
      },
      planoAtendimento: {
        tipoEscala,
        horaInicioPadrao,
        valorSugeridoPlantao,
        ajudaCusto,
        taxaAdm,
        tiposPlantao,
      },
    };

    try {
      if (isNew) {
        const result = await addPaciente(patientPayload);
        alert(`Paciente ${result.nome} cadastrado com sucesso!`);
      } else if (paciente) {
        const updatedObj: Paciente = {
          ...paciente,
          ...patientPayload,
          status: pStatus,
          desativadoEm: pDeactDate,
          desativadoMotivo: pDeactReason,
        };
        await updatePaciente(updatedObj);
        alert('Alterações salvas com sucesso!');
      }
      onBack();
    } catch (err: any) {
      alert('Erro ao tentar salvar o prontuário: ' + err.message);
    }
  };

  // Turn off / Deactivate patient
  const handleDeactivateConfirm = async () => {
    if (!deactivateReasonInput.trim()) {
      alert('Obrigatório preencher a justificativa da desativação do paciente.');
      return;
    }
    if (paciente) {
      await deactivatePaciente(paciente.id, deactivateReasonInput);
      setPStatus('Desativado');
      const todayStr = new Date().toLocaleDateString('pt-BR');
      setPDeactDate(todayStr);
      setPDeactReason(deactivateReasonInput);
      setAlertDeactivateOpen(false);
      setDeactivateReasonInput('');
      alert('Paciente desativado no sistema.');
    }
  };

  // Reactivate Patient
  const handleReactivate = async () => {
    if (paciente) {
      await reactivatePaciente(paciente.id);
      setPStatus('Ativo');
      setPDeactDate(null);
      setPDeactReason(null);
      alert('Paciente reativado com sucesso! Os campos de edição estão desbloqueados.');
    }
  };

  // Add shift triggers
  const handleAddShiftInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCurrentlyDeactivated) return;
    if (!paciente) {
      alert('Você precisa primeiro salvar o cadastro do paciente para adicionar plantões na escala.');
      return;
    }
    if (!newShiftProf.trim()) {
      alert('Preencha o nome do profissional.');
      return;
    }

    try {
      const datesToSchedule = newShiftDatesList.length > 0 ? newShiftDatesList : [newShiftDate];
      const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

      for (const currentDt of datesToSchedule) {
        const dateStr = currentDt.includes('T') ? currentDt : `${currentDt}T12:00:00`;
        const dateObj = new Date(dateStr);
        const currentDayOfW = days[dateObj.getDay()] || 'Sex';

        await addPlantao({
          pacienteId: paciente.id,
          data: currentDt,
          diaSemana: currentDayOfW,
          profissional: newShiftProf,
          status: 'Confirmado',
          tipoEscala: newShiftTipoEscala,
          dataInicio: currentDt,
          horaInicio: newShiftHoraInicio,
          dataTermino: currentDt,
          horaTermino: newShiftHoraTermino,
          observacaoAgendamento: newShiftObservacao,
          valorPlantao: newShiftValor,
          valorRepasse: newShiftRepasse,
          feriado: newShiftFeriado,
          ajudaCusto: ajudaCusto || 0,
          taxaAdm: taxaAdm || 0,
          criadoEm: new Date().toISOString(),
          criadoPor: 'Gestor de Home Care S.A. (Coordenador)',
        });
      }

      setNewShiftProf('');
      setNewShiftDatesList([]);
      setNewShiftFeriado(null);
      alert(datesToSchedule.length > 1 ? `${datesToSchedule.length} plantões agendados na escala com sucesso!` : 'Plantão agendado para a escala com sucesso!');
    } catch (err: any) {
      alert('Erro ao agendar plantão.');
    }
  };

  // Cancel shift modal confirmation triggers
  const handleTriggerCancelClick = (shiftId: string) => {
    setSelectedShiftForCancel(shiftId);
    setCancelReasonValue('Pediu para sair da escala');
    setCancelShiftModalOpen(true);
  };

  const handleConfirmCancelShift = async () => {
    if (selectedShiftForCancel) {
      await cancelPlantao(selectedShiftForCancel, cancelReasonValue);
      setCancelShiftModalOpen(false);
      setSelectedShiftForCancel(null);
      alert('Plantão cancelado com sucesso.');
    }
  };

  // Shift Edit trigger
  const handleTriggerEditShift = (shift: Plantao) => {
    setEditingShiftId(shift.id);
    setEditShiftProfName(shift.profissional);
    setEditShiftDate(shift.data);
    setEditShiftDay(shift.diaSemana);
    setEditShiftModalOpen(true);
  };

  const handleSaveEditShift = async () => {
    if (!editShiftProfName.trim() || !editShiftDate) {
      alert('Preencha as informações obrigatórias.');
      return;
    }
    if (editingShiftId && paciente) {
      const originalShift = plantoes.find((pl) => pl.id === editingShiftId);
      await updatePlantao({
        ...originalShift,
        id: editingShiftId,
        pacienteId: paciente.id,
        profissional: editShiftProfName,
        data: editShiftDate,
        diaSemana: editShiftDay,
        status: 'Confirmado',
        motivoCancelamento: null,
      });
      setEditShiftModalOpen(false);
      setEditingShiftId(null);
      alert('Plantão updated successfully.');
    }
  };

  const lettersMonogram = (nome || 'Novo Paciente')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-6" id="patient-record-container">
      {/* Return       <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors flex items-center space-x-1"
          id="btn-voltar-listagem"
        >
          <ArrowLeft size={14} />
          <span>← Voltar</span>
        </button>
        <span className="text-xs text-slate-400 font-mono">
          ID: {isNew ? 'PROVISÓRIO' : paciente?.id}
        </span>
      </div>

      {/* Lock Warning Alert Frame */}
      {isCurrentlyDeactivated && (
        <div
          className="bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-r-xl shadow-sm text-xs flex items-start space-x-3"
          id="warning-deactivated"
        >
          <AlertOctagon className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
          <div className="space-y-1">
            <h4 className="font-bold uppercase tracking-wider text-[11px]">Paciente Desativado no Sistema</h4>
            <p className="leading-relaxed">
              Este prontuário foi desativado em <strong>{pDeactDate}</strong>.
            </p>
            <p className="leading-relaxed bg-red-100/50 p-2 rounded-md font-mono mt-2 text-red-900 border border-red-200/40">
              <strong>Motivo:</strong> {pDeactReason || 'Nenhuma justificativa fornecida.'}
            </p>
            <p className="text-[10px] text-red-600/90 font-semibold pt-1">
              *Todos os campos de entrada nas abas foram bloqueados para readonly/disabled de acordo com o protocolo institucional.
            </p>
          </div>
        </div>
      )}

      {/* Header of the Prontuário */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight" id="prontuario-title text-slate-800">
              {isNew ? 'Cadastrar Novo Paciente' : `Detalhes do Paciente: ${nome}`}
            </h1>
            <div className="flex-shrink-0">
              {pStatus === 'Ativo' ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 italic uppercase">
                  ● ATIVO
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 italic uppercase">
                  ● DESATIVADO
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400">
            {isNew
              ? 'Insira as diretrizes clínicas e de logística para formalização do início do plantão.'
              : `Prontuário clínico ativo em cooperação integrada. Criado em: ${
                  paciente ? new Date(paciente.createdAt).toLocaleDateString('pt-BR') : '-'
                }`}
          </p>
        </div>

        {/* Global Save and Deactivate triggers */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
            id="btn-voltar-topo-global"
          >
            <ArrowLeft size={15} />
            <span>Voltar</span>
          </button>
          {!isCurrentlyDeactivated ? (
            <>
              {!isNew && (
                <button
                  type="button"
                  onClick={() => setAlertDeactivateOpen(true)}
                  className="bg-red-50 text-red-650 text-rose-700 px-4 py-2 rounded-md text-xs font-semibold border border-red-200 hover:bg-red-100/50 transition-colors flex items-center space-x-1"
                  id="btn-desativar-paciente"
                >
                  <Lock size={15} />
                  <span>🔒 Desativar Paciente</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="bg-blue-600 text-white px-5 py-2 rounded-md text-xs font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
                id="btn-salvar-alteracoes"
              >
                <Save size={15} />
                <span>💾 Salvar Alterações</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleReactivate}
              className="bg-emerald-600 text-white px-5 py-2 rounded-md text-xs font-semibold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors flex items-center space-x-1.5"
              id="btn-reativar-paciente"
            >
              <Unlock size={15} className="animate-bounce" />
              <span>Reativar Paciente</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Form Body Split Layout - Left fixed Card & Right tab block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Card: Identificação Fixo */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 text-center relative overflow-hidden">
          {/* Cover decorative bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"></div>

          {/* Profile Circle Initial block */}
          <div className="flex justify-center pt-3">
            <div className="w-20 h-20 rounded-full bg-slate-50 border-2 border-slate-200/90 flex items-center justify-center font-extrabold text-slate-700 text-lg shadow-sm shadow-slate-100 relative">
              <span className="font-sans text-xl font-bold text-slate-600">{lettersMonogram}</span>
              <span
                className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                  isCurrentlyDeactivated ? 'bg-red-500' : 'bg-green-500'
                }`}
              ></span>
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">
              {nome || 'Nome em preenchimento'}
            </h3>
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider bg-slate-100 text-slate-500 font-medium">
              Bairro: {bairro || 'Não definido'}
            </span>
            <div className="flex flex-col items-center space-y-1.5 mt-2">
              <div className="text-[10px] text-indigo-700 bg-indigo-50/70 border border-indigo-150 rounded px-2 py-1 font-sans inline-flex items-center space-x-1.5 mx-auto justify-center shadow-sm">
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span>
                <span>{tipoEscala || 'Diurno 12h'} • {horaInicioPadrao || '07:00'}</span>
              </div>
              {tiposPlantao && tiposPlantao.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-center max-w-[220px]">
                  {tiposPlantao.map((sub) => (
                    <span key={sub.id} className="text-[9px] text-slate-500 bg-slate-50 border border-slate-200/80 px-1.5 py-0.5 rounded shadow-xs" title={`Valor: R$ ${sub.valorPlantao}`}>
                      {sub.tipoEscala} • {sub.horaInicio}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 my-2"></div>

          {/* Quick info list with nice typography */}
          <div className="space-y-4 text-left text-xs bg-slate-100 p-4.5 rounded-2xl border border-slate-300 shadow-sm">
            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200">
              <User size={14} className="text-slate-800 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-900 block text-[10px] uppercase font-mono font-black tracking-wider bg-slate-205">Data de Nascimento</span>
                <span className="text-slate-950 font-black text-sm block mt-0.5">{dataNascimento ? new Date(dataNascimento).toLocaleDateString('pt-BR') : 'Não informada'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200">
              <FileText size={14} className="text-slate-800 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-900 block text-[10px] uppercase font-mono font-black tracking-wider">CPF do Paciente</span>
                <span className="text-slate-950 font-black text-sm block mt-0.5">{cpf || 'Não preenchido'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-200">
              <User size={14} className="text-slate-800 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-900 block text-[10px] uppercase font-mono font-black tracking-wider">Responsável Familiar</span>
                <span className="text-slate-950 font-black text-sm block mt-0.5 truncate max-w-[200px]" title={nomeResponsavel}>
                  {nomeResponsavel || 'Não preenchido'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <Phone size={14} className="text-slate-800 flex-shrink-0" />
              <div className="truncate">
                <span className="text-slate-900 block text-[10px] uppercase font-mono font-black tracking-wider">Telefone do Responsável</span>
                <span className="text-blue-900 font-extrabold text-sm block mt-0.5">{telefoneResponsavel ? <b>{telefoneResponsavel}</b> : 'Não preenchido'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side form view containing horizontals sub tabs */}
        <div className="lg:col-span-8 space-y-4">
          {/* sub-tabs header block */}
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-2 rounded-xl border border-slate-200/80 shadow-sm gap-2 overflow-x-auto shrink-0 select-none">
            <button
              onClick={() => setActiveTab('geral')}
              className={`flex items-center space-x-1 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'geral'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
            >
              <User size={14} />
              <span>Geral & Contato</span>
            </button>
            <button
              onClick={() => setActiveTab('endereco')}
              className={`flex items-center space-x-1 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'endereco'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
            >
              <MapPin size={14} />
              <span>Endereço</span>
            </button>
            <button
              onClick={() => setActiveTab('medico')}
              className={`flex items-center space-x-1 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'medico'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
            >
              <Stethoscope size={14} />
              <span>Info Médica</span>
            </button>
            <button
              onClick={() => setActiveTab('plano')}
              className={`flex items-center space-x-1 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'plano'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={14} />
              <span>Plano de Atendimento</span>
            </button>
            <button
              onClick={() => setActiveTab('agendamento')}
              className={`flex items-center space-x-1 px-4 py-2 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === 'agendamento'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays size={14} />
              <span>Agendamento</span>
            </button>
          </div>

          {/* Form input sections */}
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm min-h-[380px]">
            {activeTab === 'geral' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">DADOS PRINCIPAIS DO PACIENTE</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      disabled={isCurrentlyDeactivated}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="Nome completo do paciente"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">CPF do Paciente *</label>
                    <input
                      type="text"
                      required
                      disabled={isCurrentlyDeactivated}
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                      placeholder="Ex: 000.000.000-00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">Data de Nascimento *</label>
                    <input
                      type="date"
                      required
                      disabled={isCurrentlyDeactivated}
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">E-mail de Contato (Opcional)</label>
                    <input
                      type="email"
                      disabled={isCurrentlyDeactivated}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-205 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2 pt-3 uppercase tracking-wider italic">CONTATO DO RESPONSÁVEL FAMILIAR</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">Representante Responsável *</label>
                    <input
                      type="text"
                      required
                      disabled={isCurrentlyDeactivated}
                      value={nomeResponsavel}
                      onChange={(e) => setNomeResponsavel(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                      placeholder="Nome do parente / responsável formal"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">Telefone do Responsável *</label>
                    <input
                      type="text"
                      required
                      disabled={isCurrentlyDeactivated}
                      value={telefoneResponsavel}
                      onChange={(e) => setTelefoneResponsavel(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                      placeholder="Ex: (21) 90000-0000"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'endereco' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">ENDEREÇO DE ATENDIMENTO</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Rua / Logradouro</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated}
                      value={rua}
                      onChange={(e) => setRua(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="Ex: Rua Visconde de Pirajá"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Número</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="Ex: 120"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">CEP</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated}
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="Ex: 22000-000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Bairro</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated}
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      placeholder="Ex: Copacabana"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Cidade / Estado</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated}
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                        placeholder="Cidade"
                      />
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated}
                        value={estado}
                        maxLength={2}
                        onChange={(e) => setEstado(e.target.value)}
                        className="w-16 text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 text-center disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                        placeholder="UF"
                      />
                    </div>
                  </div>
                </div>

                {/* Wide single field free text logic de chegada */}
                <div className="space-y-1 pt-2">
                  <label className="block text-xs font-normal text-slate-700">
                    Informações Gerais / Logística de Chegada (Acesso, Portaria, Referências de Localização):
                  </label>
                  <textarea
                    disabled={isCurrentlyDeactivated}
                    value={logisticaChegada}
                    onChange={(e) => setLogisticaChegada(e.target.value)}
                    rows={4}
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed font-sans leading-relaxed"
                    placeholder="Instruções completas para que os profissionais encontrem e acessem a residência sem percalços..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'medico' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">HISTÓRICO CLÍNICO & PRONTUÁRIO DOMICILIAR</h4>

                {/* Replicating the Visual Card/Grid format from the reference standard */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                      <span className="w-1.5 h-3 bg-blue-500 rounded-sm inline-block"></span>
                      <span>Diagnósticos & Comorbidades</span>
                    </h5>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] uppercase tracking-wider font-mono text-slate-900 font-black block">Diagnóstico Principal *</label>
                        <input
                          type="text"
                          required
                          disabled={isCurrentlyDeactivated}
                          value={diagnosticoPrincipal}
                          onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-950 font-extrabold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                          placeholder="Ex: Alzheimer Estágio Moderado"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] uppercase tracking-wider font-mono text-slate-900 font-black block">Comorbidades Associadas</label>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated}
                          value={comorbidades}
                          onChange={(e) => setComorbidades(e.target.value)}
                          className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-lg text-slate-950 font-extrabold focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                          placeholder="Ex: Hipertensão, Diabetes Tipo 2"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                      <span className="w-1.5 h-3 bg-red-500 rounded-sm inline-block"></span>
                      <span>Alergias & Crises</span>
                    </h5>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-normal block">Alergias Conhecidas</label>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated}
                          value={alergias}
                          onChange={(e) => setAlergias(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                          placeholder="Ex: Penicilina, Corantes Amarelos"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wider font-mono text-slate-400 font-normal block">Grau de Dependência *</label>
                        <select
                          disabled={isCurrentlyDeactivated}
                          value={grauDependencia}
                          onChange={(e) => setGrauDependencia(e.target.value as any)}
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                        >
                          <option value="Baixo">Baixo (Supervisão simples)</option>
                          <option value="Médio">Médio (Auxílio parcial)</option>
                          <option value="Alto">Alto (Dependência física/motora)</option>
                          <option value="Muito Alto">Muito Alto (Enfermagem complexa ou VNI)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-normal text-slate-700">Observações Clínicas Gerais:</label>
                  <textarea
                    disabled={isCurrentlyDeactivated}
                    value={observacoesClinicas}
                    onChange={(e) => setObservacoesClinicas(e.target.value)}
                    rows={3}
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed font-sans"
                    placeholder="Outros apontamentos cruciais sobre alimentação por sonda, mobilidade, uso de andadores, cadeira de rodas..."
                  />
                </div>
              </div>
            )}

            {activeTab === 'plano' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">CONFIGURAÇÃO DE ESCALA (PLANTÃO PRINCIPAL)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1 col-span-1 md:col-span-1">
                    <label className="block text-xs font-normal text-slate-700">Tipo de Escala Principal</label>
                    <select
                      disabled={isCurrentlyDeactivated}
                      value={tipoEscala}
                      onChange={(e) => setTipoEscala(e.target.value as any)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    >
                      <option value="Diurno 9h">Diurno 9h</option>
                      <option value="Noturno 9h">Noturno 9h</option>
                      <option value="Diurno 12h">Diurno 12h</option>
                      <option value="Noturno 12h">Noturno 12h</option>
                      <option value="Plantão 24h">Plantão 24h</option>
                      <option value="Plantão 48h">Plantão 48h</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Horário de Início</label>
                    <input
                      type="time"
                      disabled={isCurrentlyDeactivated}
                      value={horaInicioPadrao}
                      onChange={(e) => setHoraInicioPadrao(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Valor do Plantão (R$)</label>
                    <input
                      type="number"
                      disabled={isCurrentlyDeactivated}
                      value={valorSugeridoPlantao}
                      onChange={(e) => setValorSugeridoPlantao(Number(e.target.value))}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal text-slate-900"
                      placeholder="Valor plantão"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Aj. de Custo (R$)</label>
                    <input
                      type="number"
                      disabled={isCurrentlyDeactivated}
                      value={ajudaCusto}
                      onChange={(e) => setAjudaCusto(Number(e.target.value))}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-600"
                      placeholder="Ajuda de custo"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Tx Adm (R$)</label>
                    <input
                      type="number"
                      disabled={isCurrentlyDeactivated}
                      value={taxaAdm}
                      onChange={(e) => setTaxaAdm(Number(e.target.value))}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-600"
                      placeholder="Taxa adm"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-150 pt-4 mt-6">
                  <h4 className="text-xs font-bold text-slate-700 pb-2 uppercase tracking-wider flex items-center justify-between italic">
                    <span>🔬 TIPOS DE PLANTÃO ADICIONAIS / ALTERNATIVOS</span>
                    <span className="text-[10px] text-slate-400 capitalize font-normal font-sans not-italic">Cadastre múltiplos formatos se aplicável</span>
                  </h4>
                  
                  {/* Inline Form to Add shift configurations */}
                  <div className="bg-slate-50/75 p-4 rounded-xl border border-slate-200/80 mb-4">
                    <p className="text-[11px] text-slate-500 mb-3">
                      Caso o paciente use formatos de escalas complementares (ex: Plantão de 24 horas no fim de semana, ou Diurno 9h diferenciado), cadastre-os abaixo:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Tipo da Escala</label>
                        <select
                          disabled={isCurrentlyDeactivated}
                          value={newSubTipoEscala}
                          onChange={(e) => setNewSubTipoEscala(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        >
                          <option value="Diurno 9h">Diurno 9h</option>
                          <option value="Noturno 9h">Noturno 9h</option>
                          <option value="Diurno 12h">Diurno 12h</option>
                          <option value="Noturno 12h">Noturno 12h</option>
                          <option value="Plantão 24h">Plantão 24h</option>
                          <option value="Plantão 48h">Plantão 48h</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Horário de Início</label>
                        <input
                          type="time"
                          disabled={isCurrentlyDeactivated}
                          value={newSubHoraInicio}
                          onChange={(e) => setNewSubHoraInicio(e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Valor Plantão (R$)</label>
                        <input
                          type="number"
                          disabled={isCurrentlyDeactivated}
                          value={newSubValorPlantao}
                          onChange={(e) => setNewSubValorPlantao(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Aj. de Custo (R$)</label>
                        <input
                          type="number"
                          disabled={isCurrentlyDeactivated}
                          value={newSubAjudaCusto}
                          onChange={(e) => setNewSubAjudaCusto(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Tx Adm (R$)</label>
                        <input
                          type="number"
                          disabled={isCurrentlyDeactivated}
                          value={newSubTaxaAdm}
                          onChange={(e) => setNewSubTaxaAdm(Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={isCurrentlyDeactivated}
                        onClick={() => {
                          const newType: EscalacaoPlano = {
                            id: `tp-${Date.now()}`,
                            tipoEscala: newSubTipoEscala,
                            horaInicio: newSubHoraInicio,
                            valorPlantao: newSubValorPlantao,
                            ajudaCusto: newSubAjudaCusto,
                            taxaAdm: newSubTaxaAdm,
                          };
                          setTiposPlantao([...tiposPlantao, newType]);
                          // Reset inputs to default value suggested
                          setNewSubValorPlantao(150);
                          setNewSubAjudaCusto(0);
                          setNewSubTaxaAdm(0);
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-sm transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Adicionar Modo de Plantão</span>
                      </button>
                    </div>
                  </div>

                  {/* Table of configured shifts */}
                  {tiposPlantao.length > 0 ? (
                    <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm mb-4">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-normal">
                            <th className="p-3 font-normal">Tipo do Plantão</th>
                            <th className="p-3 text-center font-normal">Horário de Início</th>
                            <th className="p-3 text-right font-normal">Valor Plantão</th>
                            <th className="p-3 text-right font-normal">Aj. de Custo</th>
                            <th className="p-3 text-right font-normal">Taxa Adm</th>
                            <th className="p-3 text-center w-12 font-normal">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {tiposPlantao.map((tp) => (
                            <tr key={tp.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="p-3 font-normal text-slate-800">{tp.tipoEscala}</td>
                              <td className="p-3 text-center font-mono bg-slate-50/35">{tp.horaInicio}</td>
                              <td className="p-3 text-right font-normal text-slate-900">R$ {tp.valorPlantao.toFixed(2)}</td>
                              <td className="p-3 text-right text-slate-500">R$ {(tp.ajudaCusto || 0).toFixed(2)}</td>
                              <td className="p-3 text-right text-slate-500">R$ {(tp.taxaAdm || 0).toFixed(2)}</td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  disabled={isCurrentlyDeactivated}
                                  onClick={() => setTiposPlantao(tiposPlantao.filter(t => t.id !== tp.id))}
                                  className="p-1.5 text-slate-400 hover:text-red-650 rounded-md hover:bg-red-50 disabled:opacity-50 transition-all cursor-pointer"
                                  title="Remover formato"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50/25 border border-dashed border-slate-200 rounded-xl mb-4">
                      Nenhum formato de plantão complementar cadastrado.
                    </div>
                  )}
                </div>

                <div className="p-4 bg-blue-50 text-blue-850 border border-blue-100 rounded-xl space-y-1.5 text-xs">
                  <p className="font-bold">Regulamento dos Plantões Domiciliares:</p>
                  <p className="leading-relaxed">
                    O valor acordado orienta a sugestão nos faturamentos mensais da empresa. Cuidadores em atraso superior a 30 minutos devem emitir justificativas administrativas.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'agendamento' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                {/* Header for schedule area */}
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider italic">ESCALA</h4>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-normal px-2 py-0.5 rounded-full">
                    {filteredShiftsForPatient.length} Turnos Programados
                  </span>
                </div>
 
                 {/* Quick Add block for scales, ONLY displayed if patient exists and is Ativo */}
                {!isNew && !isCurrentlyDeactivated ? (
                  <div className="bg-slate-50 border border-slate-200/90 p-3.5 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Plus size={14} className="text-blue-600" />
                      <span>Agendar Plantão</span>
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                      <div className="sm:col-span-7 space-y-1 relative">
                        <label className="text-[10px] font-normal text-slate-600">Profissional Cuidador/Fisioterapeuta</label>
                        <input
                          type="text"
                          value={newShiftProf}
                          onFocus={() => setShowProfDropdown(true)}
                          onBlur={() => setShowProfDropdown(false)}
                          onChange={(e) => setNewShiftProf(e.target.value)}
                          placeholder="Clique para selecionar da aba de Profissionais cadastrados..."
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                        />
                        {showProfDropdown && (
                          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-20 divide-y divide-slate-100 font-sans">
                            <div className="p-1.5 text-[9px] uppercase font-mono tracking-wider text-slate-400 bg-slate-50/50">
                              Profissionais Cadastrados (Aba de Profissionais):
                            </div>
                            {INITIAL_PROFESSIONALS.filter(p => 
                              p.name.toLowerCase().includes(newShiftProf.toLowerCase()) ||
                              p.role.toLowerCase().includes(newShiftProf.toLowerCase())
                            ).map((prof) => (
                              <button
                                key={prof.id}
                                type="button"
                                onMouseDown={() => {
                                  setNewShiftProf(prof.name);
                                  setShowProfDropdown(false);
                                }}
                                className="w-full text-left p-2 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                    {prof.name.split(' ').slice(1).map(n => n[0]).join('') || prof.name[0]}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-800 leading-none">{prof.name}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{prof.role}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                                    prof.status === 'Ativo' ? 'bg-green-50 text-emerald-700' :
                                    prof.status === 'Em Plantão' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {prof.status}
                                  </span>
                                  <p className="text-[8px] text-slate-400 mt-0.5">{prof.area}</p>
                                </div>
                              </button>
                            ))}
                            {INITIAL_PROFESSIONALS.filter(p => 
                              p.name.toLowerCase().includes(newShiftProf.toLowerCase()) ||
                              p.role.toLowerCase().includes(newShiftProf.toLowerCase())
                            ).length === 0 && (
                              <div className="p-3 text-center text-xs text-slate-400 italic">
                                Nenhum profissional cadastrado com este nome.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <label className="text-[10px] font-normal text-slate-600">Data do Plantão ({newShiftDay})</label>
                        <div className="flex space-x-1">
                          <input
                            type="date"
                            value={newShiftDate}
                            onChange={(e) => setNewShiftDate(e.target.value)}
                            className="flex-1 text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (!newShiftDatesList.includes(newShiftDate)) {
                                setNewShiftDatesList([...newShiftDatesList, newShiftDate]);
                              } else {
                                alert('Esta data já foi incluída na lista.');
                              }
                            }}
                            title="Adicionar esta data na lista de múltiplos plantões"
                            className="px-2.5 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg border border-blue-250 transition-colors flex items-center justify-center cursor-pointer text-xs font-bold font-mono"
                          >
                            + Filar
                          </button>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddShiftInline}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{newShiftDatesList.length > 0 ? `Agendar (${newShiftDatesList.length})` : 'Agendar'}</span>
                        </button>
                      </div>

                      <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200/60 mt-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Acréscimo Feriado:</span>
                          <div className="inline-flex rounded-md shadow-sm" role="group">
                            <button
                              type="button"
                              onClick={() => setNewShiftFeriado(null)}
                              className={`px-3 py-1 text-[10px] font-bold rounded-l-md border ${
                                !newShiftFeriado
                                  ? 'bg-slate-200 text-slate-850 border-slate-300 font-semibold shadow-inner'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              Regular
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewShiftFeriado('20%')}
                              className={`px-3 py-1 text-[10px] font-bold border-t border-b border-r ${
                                newShiftFeriado === '20%'
                                  ? 'bg-amber-100 text-amber-800 border-amber-350 font-semibold shadow-inner'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              +20%
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewShiftFeriado('50%')}
                              className={`px-3 py-1 text-[10px] font-bold rounded-r-md border-t border-b border-r ${
                                newShiftFeriado === '50%'
                                  ? 'bg-rose-100 text-rose-800 border-rose-350 font-semibold shadow-inner'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              +50%
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowBatchScheduling(!showBatchScheduling)}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-semibold flex items-center space-x-1"
                        >
                          <span>📅 {showBatchScheduling ? 'Ocultar Agendamento em Lote' : 'Agendar por Período / Recorrência'}</span>
                        </button>
                      </div>

                      {showBatchScheduling && (
                        <div className="sm:col-span-12 p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 mt-1.5 shadow-sm text-xs">
                          <p className="text-[11px] font-bold text-slate-800">Definir Período de Plantões Recorrentes:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                            <div className="sm:col-span-4 space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-400">Data Inicial</label>
                              <input
                                type="date"
                                value={batchStartDate}
                                onChange={(e) => setBatchStartDate(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-705 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="sm:col-span-4 space-y-1">
                              <label className="text-[9px] font-bold uppercase text-slate-400">Data Final</label>
                              <input
                                type="date"
                                value={batchEndDate}
                                onChange={(e) => setBatchEndDate(e.target.value)}
                                className="w-full text-xs p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-705 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <button
                                type="button"
                                onClick={() => {
                                  if (!batchStartDate || !batchEndDate) {
                                    alert('Selecione as datas de início e fim.');
                                    return;
                                  }
                                  const start = new Date(batchStartDate + 'T12:00:00');
                                  const end = new Date(batchEndDate + 'T12:00:00');
                                  if (end < start) {
                                    alert('A data de término deve ser maior ou igual à data de início.');
                                    return;
                                  }
                                  const tempDates: string[] = [];
                                  const curr = new Date(start);
                                  const daysMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                  while (curr <= end) {
                                    const dStr = daysMap[curr.getDay()];
                                    if (batchWeekdays.includes(dStr)) {
                                      const y = curr.getFullYear();
                                      const m = String(curr.getMonth() + 1).padStart(2, '0');
                                      const d = String(curr.getDate()).padStart(2, '0');
                                      const formatted = `${y}-${m}-${d}`;
                                      if (!newShiftDatesList.includes(formatted) && !tempDates.includes(formatted)) {
                                        tempDates.push(formatted);
                                      }
                                    }
                                    curr.setDate(curr.getDate() + 1);
                                  }
                                  if (tempDates.length === 0) {
                                    alert('Nenhuma data encontrada correspondente aos dias marcados no período.');
                                  } else {
                                    setNewShiftDatesList([...newShiftDatesList, ...tempDates]);
                                  }
                                }}
                                className="w-full py-2 bg-indigo-650 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer text-center"
                              >
                                Gerar Datas no Período
                              </button>
                            </div>

                            <div className="sm:col-span-12 space-y-2.5 p-3.5 bg-slate-100 border border-slate-300 rounded-xl">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                                <label className="text-[10px] font-black uppercase text-slate-900 block tracking-wider">
                                  📅 Dias da Semana Permitidos para a Escala:
                                </label>
                                
                                {/* Dynamic preset selection buttons */}
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setBatchWeekdays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'])}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-50 text-[9px] font-bold text-slate-800 border border-slate-300 rounded-md shadow-xs transition-colors cursor-pointer"
                                  >
                                    ✨ Todos
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBatchWeekdays(['Seg', 'Ter', 'Qua', 'Qui', 'Sex'])}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-50 text-[9px] font-bold text-slate-800 border border-slate-300 rounded-md shadow-xs transition-colors cursor-pointer"
                                  >
                                    💼 Seg a Sex
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBatchWeekdays(['Sáb', 'Dom'])}
                                    className="px-2 py-0.5 bg-white hover:bg-slate-50 text-[9px] font-bold text-slate-800 border border-slate-300 rounded-md shadow-xs transition-colors cursor-pointer"
                                  >
                                    🏖️ Fim de Semana
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setBatchWeekdays([])}
                                    className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-[9px] font-bold text-red-700 border border-red-200 rounded-md shadow-xs transition-colors cursor-pointer"
                                  >
                                    🧹 Limpar
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 pt-1">
                                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => {
                                  const isSelected = batchWeekdays.includes(d);
                                  return (
                                    <button
                                      key={d}
                                      type="button"
                                      onClick={() => {
                                        if (isSelected) {
                                          setBatchWeekdays(batchWeekdays.filter((w) => w !== d));
                                        } else {
                                          setBatchWeekdays([...batchWeekdays, d]);
                                        }
                                      }}
                                      className={`flex-1 sm:flex-initial px-3.5 py-2 text-xs rounded-lg border font-black transition-all duration-150 flex items-center justify-center space-x-1 shadow-sm select-none cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-600 border-emerald-700 text-white font-black scale-[1.03] shadow-md'
                                          : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 font-bold'
                                      }`}
                                    >
                                      <span>{isSelected ? '✓ ' : ''}{d}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {newShiftDatesList.length > 0 && (
                        <div className="sm:col-span-12 p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2 mt-1.5 text-xs">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-blue-800 block">
                              Datas em Fila para Agendamento ({newShiftDatesList.length} total):
                            </span>
                            <button
                              type="button"
                              onClick={() => setNewShiftDatesList([])}
                              className="text-[10px] text-red-600 hover:underline font-bold"
                            >
                              Limpar Fila ×
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-white border border-slate-200/60 rounded-lg">
                            {newShiftDatesList
                              .slice()
                              .sort()
                              .map((dt) => {
                                const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                const dObj = new Date(dt + 'T12:00:00');
                                const dW = days[dObj.getDay()] || 'Sex';
                                return (
                                  <div
                                    key={dt}
                                    className="inline-flex items-center space-x-1.5 px-2 py-0.5 bg-blue-50 border border-blue-150 rounded text-[10px] text-blue-800 font-semibold"
                                  >
                                    <span>{dW}</span>
                                    <span className="text-blue-300">•</span>
                                    <span>{dt.split('-').reverse().slice(0, 2).join('/')}</span>
                                    <button
                                      type="button"
                                      onClick={() => setNewShiftDatesList(newShiftDatesList.filter((x) => x !== dt))}
                                      className="text-red-500 hover:text-red-750 font-bold font-sans text-xs ml-1"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : isNew ? (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-orange-850 text-xs italic">
                    Para agendar plantões, você deve primeiro preencher e salvar o prontuário deste novo paciente.
                  </div>
                ) : null}

                {/* Tabulation of scale list */}
                <div className="border border-slate-200 rounded-xl overflow-hidden mt-2 bg-slate-50/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-900 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Profissional Alocado</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isNew || filteredShiftsForPatient.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500 italic font-medium">
                            Nenhum plantão ativo programado para este paciente no sistema.
                          </td>
                        </tr>
                      ) : (
                        filteredShiftsForPatient.map((item) => {
                          const isCancelled = item.status === 'Cancelado';
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isCancelled ? 'bg-rose-50/10 text-slate-400 line-through' : 'bg-white'
                              }`}
                            >
                              {/* Date & Weekday */}
                              <td className="py-3 px-3">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                  <div className="flex items-center space-x-1 whitespace-nowrap">
                                    <span className="font-bold text-slate-800">{item.diaSemana}</span>
                                    <span className="text-slate-400">-</span>
                                    <span className="font-mono font-normal">{new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                                  </div>
                                  
                                  {/* Holiday toggle buttons next to the date */}
                                  <div className="inline-flex rounded-md shadow-sm shrink-0" role="group">
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await updatePlantao({
                                          ...item,
                                          feriado: null
                                        });
                                      }}
                                      className={`px-2 py-0.5 text-[8px] font-extrabold rounded-l-md border ${
                                        !item.feriado
                                          ? 'bg-slate-200 text-slate-800 border-slate-300'
                                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                      }`}
                                      title="Calculado sem acréscimo de feriado"
                                    >
                                      Normal
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await updatePlantao({
                                          ...item,
                                          feriado: '20%'
                                        });
                                      }}
                                      className={`px-2 py-0.5 text-[8px] font-extrabold border-t border-b border-r ${
                                        item.feriado === '20%'
                                          ? 'bg-amber-100 text-amber-805 border-amber-300'
                                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                      }`}
                                      title="Feriado com 20% acréscimo"
                                    >
                                      20%
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await updatePlantao({
                                          ...item,
                                          feriado: '50%'
                                        });
                                      }}
                                      className={`px-2 py-0.5 text-[8px] font-extrabold rounded-r-md border-t border-b border-r ${
                                        item.feriado === '50%'
                                          ? 'bg-rose-100 text-rose-805 border-rose-300'
                                          : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                      }`}
                                      title="Feriado com 50% acréscimo"
                                    >
                                      50%
                                    </button>
                                  </div>
                                </div>
                              </td>

                              {/* Prof Name */}
                              <td className="py-3 px-3 font-normal text-slate-700">
                                {item.profissional}
                              </td>

                              {/* Status indicators */}
                              <td className="py-3 px-3 text-center">
                                {item.status === 'Confirmado' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 italic uppercase">
                                    CONFIRMADO🟢
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-0.5">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100 italic uppercase">
                                      CANCELADO🔴
                                    </span>
                                    {item.motivoCancelamento && (
                                      <span className="text-[9px] text-rose-800 block italic font-mono bg-rose-50 p-1 border border-rose-100 rounded leading-none max-w-[150px] truncate" title={item.motivoCancelamento}>
                                        {item.motivoCancelamento}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Actions column */}
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerEditShift(item)}
                                    title="Editar Profissional ou Data deste plantão"
                                    className="px-2.5 py-1 text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-105 transition-colors cursor-pointer"
                                  >
                                    ✏️ Editar
                                  </button>
                                  {item.status === 'Confirmado' && (
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerCancelClick(item.id)}
                                      title="Cancelar / Excluir este plantão"
                                      className="px-2.5 py-1 text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-105 transition-colors cursor-pointer"
                                    >
                                      ❌ Excluir
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Modal Deactivate Patient (Sobreposto) */}
      {alertDeactivateOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-start space-x-3 text-rose-700">
              <AlertOctagon size={24} className="mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-sm text-slate-800">Confirmar Desativação do Paciente</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Atenção: A desativação fará com que o prontuário de <strong>{nome}</strong> fique bloqueado para qualquer nova edição, e todas as suas escalas ativas futuras serão sinalizadas como suspensas.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-normal text-slate-700">Motivo / Justificativa Obrigatória:</label>
              <textarea
                required
                value={deactivateReasonInput}
                onChange={(e) => setDeactivateReasonInput(e.target.value)}
                rows={3}
                placeholder="Exemplo: Internação hospitalar de emergência / Encerramento do contrato de cuidadores domiciliares solicitado pela família..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAlertDeactivateOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeactivateConfirm}
                className="px-4 py-2 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-md shadow-red-500/10 cursor-pointer"
              >
                Confirmar Suspensão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Shift Modal (OBRIGATÓRIO) */}
      {cancelShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4" id="cancel-shift-modal">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <X size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Cancelar Plantão Programado</h3>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  A linha da escala não será removida para audição histórica corporativa. O status mudará imediatamente para Cancelado🔴.
                </p>
              </div>
            </div>

            {/* Mandated cancellation reason select dropdown list */}
            <div className="space-y-1.5">
              <label className="block text-xs font-normal text-slate-700">Motivo de Cancelamento de Escala:</label>
              <select
                value={cancelReasonValue}
                onChange={(e) => setCancelReasonValue(e.target.value as CancelingReason)}
                className="w-full text-xs p-2.5 bg-slate-55 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                id="cancel-reason-select"
              >
                <option value="Pediu para sair da escala">Pediu para sair da escala</option>
                <option value="Família pediu substituição">Família pediu substituição</option>
                <option value="Doente">Doente</option>
                <option value="Parente doente">Parente doente</option>
                <option value="Tiro">Tiro</option>
                <option value="Sem condução">Sem condução</option>
                <option value="Cansaço">Cansaço</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setCancelShiftModalOpen(false);
                  setSelectedShiftForCancel(null);
                }}
                className="px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg font-medium"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelShift}
                className="px-4 py-2 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-md shadow-red-500/10"
                id="btn-confirm-cancel-shift"
              >
                Salvar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift/Professional Modal */}
      {editShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full mx-4 space-y-4 font-sans">
            <h3 className="font-bold text-sm text-slate-800">Editar Plantão</h3>
            <div className="space-y-4">
              <div className="space-y-1 relative">
                <label className="block text-xs font-normal text-slate-700">Profissional Cuidador:</label>
                <input
                  type="text"
                  value={editShiftProfName}
                  onFocus={() => setShowEditProfDropdown(true)}
                  onBlur={() => setShowEditProfDropdown(false)}
                  onChange={(e) => setEditShiftProfName(e.target.value)}
                  placeholder="Selecione das credenciais existentes..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                />
                {showEditProfDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 divide-y divide-slate-100 font-sans">
                    <div className="p-1.5 text-[9px] uppercase font-mono tracking-wider text-slate-400 bg-slate-50/50">
                      Profissionais Cadastrados (Aba de Profissionais):
                    </div>
                    {INITIAL_PROFESSIONALS.filter(p => 
                      p.name.toLowerCase().includes(editShiftProfName.toLowerCase()) ||
                      p.role.toLowerCase().includes(editShiftProfName.toLowerCase())
                    ).map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onMouseDown={() => {
                          setEditShiftProfName(prof.name);
                          setShowEditProfDropdown(false);
                        }}
                        className="w-full text-left p-2 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[9px]">
                            {prof.name.split(' ').slice(1).map(n => n[0]).join('') || prof.name[0]}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 leading-none">{prof.name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{prof.role}</p>
                          </div>
                        </div>
                        <div className="text-right text-[9px]">
                          <span className={`inline-block px-1 py-0 rounded font-bold ${
                            prof.status === 'Ativo' ? 'bg-green-50 text-emerald-700' :
                            prof.status === 'Em Plantão' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {prof.status}
                          </span>
                        </div>
                      </button>
                    ))}
                    {INITIAL_PROFESSIONALS.filter(p => 
                      p.name.toLowerCase().includes(editShiftProfName.toLowerCase()) ||
                      p.role.toLowerCase().includes(editShiftProfName.toLowerCase())
                    ).length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400 italic">
                        Nenhum profissional com este nome.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-normal text-slate-700">Data ({editShiftDay}):</label>
                <input
                  type="date"
                  value={editShiftDate}
                  onChange={(e) => setEditShiftDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditShiftModalOpen(false);
                  setEditingShiftId(null);
                }}
                className="px-3.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditShift}
                className="px-4 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
              >
                Salvar Mudança
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Scale Auditor Document Modal (OBRIGATÓRIO) */}
      {inspectedShiftJson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-55 animate-in fade-in-30">
          <div className="bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl p-6 max-w-lg w-full mx-4 space-y-4 font-mono text-left" id="json-scale-auditor-modal">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></span>
                Auditor de Escala S.A. • Documento de Escala JSON
              </span>
              <button
                type="button"
                onClick={() => setInspectedShiftJson(null)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X size={15} />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
              Estrutura de dados NoSQL/Firestore homologada para faturamento corporativo no portal CuidarHome S.A.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto max-h-80 text-[11px] text-violet-300 leading-relaxed scrollbar-thin">
              <pre>{JSON.stringify(inspectedShiftJson, null, 2)}</pre>
            </div>

            <div className="flex justify-between items-center pt-2 text-[10px] text-slate-500 font-sans">
              <span>Status: <strong className={inspectedShiftJson.detalhesPlantao.status === 'agendado' ? 'text-emerald-400' : 'text-rose-400 uppercase'}>{inspectedShiftJson.detalhesPlantao.status}</strong></span>
              <button
                type="button"
                onClick={() => setInspectedShiftJson(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white text-slate-300 rounded-lg text-xs font-semibold font-sans transition-colors cursor-pointer"
              >
                Fechar Auditor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
