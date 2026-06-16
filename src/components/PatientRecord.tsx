/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { Paciente, Plantao, CancelingReason, EscalacaoPlano, Agendamento } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { usePacienteData } from '../hooks/usePacienteData';
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
  Edit2,
  Calendar,
  Printer,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Crown,
  Info
} from 'lucide-react';

// Helper to compute calendar positions matching the layout provided
const getDaysInMonthGrid = (monthIndex: number, year: number) => {
  const labelHolidays: Record<string, string> = {
    "06-04": "Corpus Christi",
    "01-01": "Confrat. Universal",
    "04-21": "Tiradentes",
    "05-01": "Dia do Trabalho",
    "09-07": "Independência",
    "10-12": "Nossa Sra. Aparecida",
    "11-02": "Finados",
    "11-15": "Proclamação República",
    "12-25": "Natal",
  };

  const gridCells: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; holiday?: string }[] = [];
  
  // First day of target month
  const firstDay = new Date(year, monthIndex, 1);
  // Weekday of the first day (0 = Sunday, 1 = Monday, etc.)
  const startDayOfWeek = firstDay.getDay();
  
  // Total days in target month
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  
  // Padding from previous month
  const prevMonthYear = monthIndex === 0 ? year - 1 : year;
  const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1;
  const totalDaysPrevMonth = new Date(prevMonthYear, prevMonthIndex + 1, 0).getDate();
  
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dVal = totalDaysPrevMonth - i;
    const mStr = String(prevMonthIndex + 1).padStart(2, '0');
    const dStr = String(dVal).padStart(2, '0');
    const fullDateStr = `${prevMonthYear}-${mStr}-${dStr}`;
    const hKey = `${mStr}-${dStr}`;
    
    gridCells.push({
      dateStr: fullDateStr,
      dayNumber: dVal,
      isCurrentMonth: false,
      holiday: labelHolidays[hKey],
    });
  }
  
  // Target month days
  for (let dVal = 1; dVal <= totalDays; dVal++) {
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const dStr = String(dVal).padStart(2, '0');
    const fullDateStr = `${year}-${mStr}-${dStr}`;
    const hKey = `${mStr}-${dStr}`;
    
    gridCells.push({
      dateStr: fullDateStr,
      dayNumber: dVal,
      isCurrentMonth: true,
      holiday: labelHolidays[hKey],
    });
  }
  
  // Padding from next month to reach a standard 42-day calendar box
  const remainingCells = 42 - gridCells.length;
  const nextMonthYear = monthIndex === 11 ? year + 1 : year;
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  for (let dVal = 1; dVal <= remainingCells; dVal++) {
    const mStr = String(nextMonthIndex + 1).padStart(2, '0');
    const dStr = String(dVal).padStart(2, '0');
    const fullDateStr = `${nextMonthYear}-${mStr}-${dStr}`;
    const hKey = `${mStr}-${dStr}`;
    
    gridCells.push({
      dateStr: fullDateStr,
      dayNumber: dVal,
      isCurrentMonth: false,
      holiday: labelHolidays[hKey],
    });
  }
  
  return gridCells;
};

interface PatientRecordProps {
  paciente: Paciente | null; // null represents "Novo Paciente"
  onBack: () => void;
}

export const PatientRecord: React.FC<PatientRecordProps> = ({ paciente, onBack }) => {
  const {
    pacientes,
    addPaciente,
    updatePaciente,
    deactivatePaciente,
    reactivatePaciente,
    plantoes,
    addPlantao,
    cancelPlantao,
    updatePlantao,
    deletePlantao,
    deletePlantoes,
    profissionais,
    agendamentos,
    addAgendamento,
    updateAgendamento,
    deleteAgendamento
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
  const [newShiftDate, setNewShiftDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
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
  const [batchStartDate, setBatchStartDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
  const [batchEndDate, setBatchEndDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 7);
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });
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

  // Single date state and curinga for Novo Agendamento
  const [avulsoSingleDate, setAvulsoSingleDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // Detailed Shift Details / Edit / Delete Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<any>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleteRecordDialog, setDeleteRecordDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  // Editable details form fields (synchronized when we enter edit mode):
  const [detailsProfName, setDetailsProfName] = useState('');
  const [detailsDate, setDetailsDate] = useState('');
  const [detailsPlantaoOptionId, setDetailsPlantaoOptionId] = useState<string>('principal');
  const [detailsCuringa, setDetailsCuringa] = useState(false);
  const [detailsTipoDia, setDetailsTipoDia] = useState<'Normal' | 'Feriado 20%' | 'Feriado 50%'>('Normal');
  const [showDetailsProfDropdown, setShowDetailsProfDropdown] = useState(false);

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

  // Dados de Faturamento e Pagamento
  const [responsavelPagamento, setResponsavelPagamento] = useState<'O próprio Paciente' | 'Outro Responsável'>('O próprio Paciente');
  const [nomePagador, setNomePagador] = useState('');
  const [cpfPagador, setCpfPagador] = useState('');
  const [opcaoEnvio, setOpcaoEnvio] = useState<'WhatsApp' | 'E-mail' | 'Ambos'>('WhatsApp');
  const [whatsappFaturamento, setWhatsappFaturamento] = useState('');
  const [emailFaturamento, setEmailFaturamento] = useState('');

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

  // Plano Atendimento (Sincronizado com o Firebase de forma global via custom hook)
  const {
    tipoEscala,
    setTipoEscala,
    horaInicioPadrao,
    setHoraInicioPadrao,
    valorSugeridoPlantao,
    setValorSugeridoPlantao,
    ajudaCusto,
    setAjudaCusto,
    taxaAdm,
    setTaxaAdm,
    tiposPlantao,
    setTiposPlantao,
    savePlanoAtendimento,
  } = usePacienteData(paciente?.id);

  // New States for attached Calendar Layout & Buttons
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<'lista' | 'calendario'>('calendario'); // default to visual calendar view
  
  // Modals
  const [avulsoModalOpen, setAvulsoModalOpen] = useState(false);
  const [concluirModalOpen, setConcluirModalOpen] = useState(false);
  const [reabrirModalOpen, setReabrirModalOpen] = useState(false);
  const [excluirModalOpen, setExcluirModalOpen] = useState(false);
  const [imprimirModalOpen, setImprimirModalOpen] = useState(false);
  const [imprimirProntuarioModalOpen, setImprimirProntuarioModalOpen] = useState(false);

  // Modal Fields - Avulso
  const [avulsoAtendimento, setAvulsoAtendimento] = useState('Plantão');
  const [avulsoServico, setAvulsoServico] = useState('00000006 - Plantão 12 x 36');
  const [avulsoTipoTurno, setAvulsoTipoTurno] = useState<'Diurno' | 'Noturno'>('Diurno');
  const [avulsoHoraInicio, setAvulsoHoraInicio] = useState('08:00');
  const [avulsoDuracao, setAvulsoDuracao] = useState('12h');
  const [avulsoExecucao, setAvulsoExecucao] = useState<'Empresa' | 'Profissionais'>('Profissionais');
  const [avulsoProf, setAvulsoProf] = useState('');
  const [avulsoCuringa, setAvulsoCuringa] = useState(false);
  const [avulsoValorBase, setAvulsoValorBase] = useState<number>(120);
  const [avulsoVHrProf, setAvulsoVHrProf] = useState<number>(0);
  const [avulsoAjudaCusto, setAvulsoAjudaCusto] = useState<number>(0);
  const [avulsoSomarFatura, setAvulsoSomarFatura] = useState(true);
  const [avulsoTaxaType, setAvulsoTaxaType] = useState<'Percentual' | 'Fixa'>('Fixa');
  const [avulsoTaxaAdm, setAvulsoTaxaAdm] = useState<number>(60);
  const [avulsoObs, setAvulsoObs] = useState('');
  const [avulsoSelectedDates, setAvulsoSelectedDates] = useState<string[]>([]);
  const [showAvulsoProfDropdown, setShowAvulsoProfDropdown] = useState(false);
  const [avulsoPlantaoOptionId, setAvulsoPlantaoOptionId] = useState<string>('principal');
  const [avulsoTipoDia, setAvulsoTipoDia] = useState<'Normal' | 'Feriado 20%' | 'Feriado 50%'>('Normal');

  // Modal Fields - Concluir (Dar Baixa no Período)
  const [concluirStartDate, setConcluirStartDate] = useState('2026-06-01');
  const [concluirEndDate, setConcluirEndDate] = useState('2026-06-30');
  const [concluirConfirmarPor, setConcluirConfirmarPor] = useState('Coordenador');

  // Modal Fields - Reabrir (Desfazer Baixa do Período)
  const [reabrirStartDate, setReabrirStartDate] = useState('2026-06-01');
  const [reabrirEndDate, setReabrirEndDate] = useState('2026-06-30');
  const [reabrirDesconfirmarPor, setReabrirDesconfirmarPor] = useState('Coordenador');

  // Modal Fields - Excluir (Remover Período)
  const [excluirStartDate, setExcluirStartDate] = useState('2026-06-01');
  const [excluirEndDate, setExcluirEndDate] = useState('2026-06-30');
  const [excluirPorType, setExcluirPorType] = useState<'datas' | 'profissional' | 'periodo'>('periodo');
  const [excluirProfName, setExcluirProfName] = useState('');
  const [showExcluirProfDropdown, setShowExcluirProfDropdown] = useState(false);

  // States for adding a new plantão type inline to the list
  const [newSubTipoEscala, setNewSubTipoEscala] = useState<string>('Diurno 12h');
  const [newSubHoraInicio, setNewSubHoraInicio] = useState<string>('07:00');
  const [newSubValorPlantao, setNewSubValorPlantao] = useState<number | ''>(150);
  const [newSubAjudaCusto, setNewSubAjudaCusto] = useState<number | ''>(0);
  const [newSubTaxaAdm, setNewSubTaxaAdm] = useState<number | ''>(0);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);

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

      // Dados de Faturamento e Pagamento
      setResponsavelPagamento(paciente.dadosPagamento?.responsavelPagamento || 'O próprio Paciente');
      setNomePagador(paciente.dadosPagamento?.nomePagador || '');
      setCpfPagador(paciente.dadosPagamento?.cpfPagador || '');
      setOpcaoEnvio(paciente.dadosPagamento?.opcaoEnvio || 'WhatsApp');
      setWhatsappFaturamento(paciente.dadosPagamento?.whatsappFaturamento || '');
      setEmailFaturamento(paciente.dadosPagamento?.emailFaturamento || '');

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
      console.log("[PatientRecord] isNew set to true");
      setIsNew(true);
      setNome('');
      setDataNascimento('1960-01-01');
      setCpf('');
      setNomeResponsavel('');
      setTelefoneResponsavel('');
      setEmail('');
      setBairro('');

      // Clean Dados de Faturamento e Pagamento
      setResponsavelPagamento('O próprio Paciente');
      setNomePagador('');
      setCpfPagador('');
      setOpcaoEnvio('WhatsApp');
      setWhatsappFaturamento('');
      setEmailFaturamento('');

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

  // Carregamento Inicial (useEffect) do Firestore na montagem da sub-aba 'Plano de Atendimento'
  useEffect(() => {
    if (activeTab === 'plano' && paciente) {
      const found = pacientes.find(p => p.id === paciente.id);
      if (found && found.planoAtendimento) {
        setTipoEscala(found.planoAtendimento.tipoEscala || 'Diurno 12h');
        setHoraInicioPadrao(found.planoAtendimento.horaInicioPadrao || '07:00');
        setValorSugeridoPlantao(found.planoAtendimento.valorSugeridoPlantao ?? 150);
        setAjudaCusto(found.planoAtendimento.ajudaCusto ?? 0);
        setTaxaAdm(found.planoAtendimento.taxaAdm ?? 0);
        setTiposPlantao(found.planoAtendimento.tiposPlantao || []);
      }
    }
  }, [activeTab, paciente, pacientes, setTipoEscala, setHoraInicioPadrao, setValorSugeridoPlantao, setAjudaCusto, setTaxaAdm, setTiposPlantao]);

  // Is patient currently deactivated?
  const isCurrentlyDeactivated = pStatus === 'Desativado';

  // Get active shifts for this patient
  const filteredShiftsForPatient = plantoes.filter(
    (pl) => paciente && pl.pacienteId === paciente.id
  ).sort((a, b) => b.data.localeCompare(a.data));

  // Compiled rows representing the default Principal scale plus any additional formats configured
  const allRows = [
    {
      id: 'principal',
      tipoEscala: tipoEscala,
      horaInicio: horaInicioPadrao,
      valorPlantao: Number(valorSugeridoPlantao || 0),
      ajudaCusto: Number(ajudaCusto || 0),
      taxaAdm: Number(taxaAdm || 0),
      isPrincipal: true,
    },
    ...tiposPlantao.map((tp) => ({
      ...tp,
      isPrincipal: false,
    })),
  ];

  // Handle Form Save
  const handleSave = async (e: React.FormEvent) => {
    console.log("handleSave chamado");
    e.preventDefault();
    if (isCurrentlyDeactivated) return;

    if (!nome || !cpf || !nomeResponsavel || !telefoneResponsavel) {
      alert('Por favor, preencha todos os campos obrigatórios (Nome, CPF, Nome Responsável e Telefone).');
      return;
    }

    // Validation for Billing Details
    if (responsavelPagamento === 'Outro Responsável') {
      if (!nomePagador.trim() || !cpfPagador.trim()) {
        alert('Por favor, preencha os dados obrigatórios do Responsável pelo Pagamento (Nome Completo e CPF do Pagador).');
        return;
      }
    }

    if (opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') {
      if (!whatsappFaturamento.trim()) {
        alert('Por favor, preencha o WhatsApp para Faturamento.');
        return;
      }
    }

    if (opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') {
      if (!emailFaturamento.trim()) {
        alert('Por favor, preencha o E-mail para Faturamento.');
        return;
      }
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
      dadosPagamento: {
        responsavelPagamento,
        nomePagador: responsavelPagamento === 'Outro Responsável' ? nomePagador : '',
        cpfPagador: responsavelPagamento === 'Outro Responsável' ? cpfPagador : '',
        opcaoEnvio,
        whatsappFaturamento: (opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') ? whatsappFaturamento : '',
        emailFaturamento: (opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') ? emailFaturamento : '',
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

  // Local handler to compile and save Plano de Atendimento reference values to Firestore as base rates
  const handleSavePlanoAtendimento = async () => {
    if (isCurrentlyDeactivated) return;
    if (!paciente?.id) {
      alert('Erro: ID do paciente não fornecido. Por favor, salve primeiro o formulário geral do paciente.');
      return;
    }

    if (valorSugeridoPlantao === '' || ajudaCusto === '' || taxaAdm === '') {
      alert('Erro de Validação: Ajuste os valores do Plano de Atendimento. Os campos "Valor do Plantão", "Ajuda de Custo" e "Taxa Adm" não podem ficar vazios / em branco.');
      return;
    }

    try {
      const current = pacientes.find(p => p.id === paciente.id);
      if (!current) {
        throw new Error('Paciente não encontrado no Firestore.');
      }

      const updatedObj: Paciente = {
        ...current,
        planoAtendimento: {
          tipoEscala,
          horaInicioPadrao,
          valorSugeridoPlantao: Number(valorSugeridoPlantao),
          ajudaCusto: Number(ajudaCusto),
          taxaAdm: Number(taxaAdm),
          tiposPlantao,
        },
      };

      await updatePaciente(updatedObj);
      alert('Plano de Atendimento e referências base salvas com sucesso no Firestore!');
    } catch (error: any) {
      alert('Erro ao persistir plano de Atendimento: ' + error.message);
    }
  };

  // New Handler for deleting a single shift
  const handleDeleteAgendamento = (id: string) => {
    setDeleteRecordDialog({
      isOpen: true,
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir permanentemente este agendamento? Esta ação removerá o plantão de forma definitiva.',
      confirmText: 'Confirmar e Excluir',
      cancelText: 'Voltar',
      onConfirm: async () => {
        try {
          await deletePlantao(id);
          alert('Agendamento excluído com sucesso!');
        } catch (error) {
          console.error("Erro ao deletar agendamento:", error);
          alert('Erro ao excluir agendamento. Verifique o console.');
        }
      }
    });
  };

  // Function to delete or clear a configuration/mode of shift (either Principal or Additional) from Plano de Atendimento
  const handleDeletePlantao = (id: string, isPrincipal: boolean) => {
    if (!paciente?.id) {
      alert('Erro: ID do paciente não localizado. Por favor, salve primeiro os dados gerais do paciente.');
      return;
    }

    setDeleteRecordDialog({
      isOpen: true,
      title: 'Remover Configuração de Plantão',
      message: 'Tem certeza que deseja excluir as configurações deste tipo de plantão? Esta ação também salvará as alterações no banco de dados.',
      confirmText: 'Confirmar e Remover',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          const current = pacientes.find(p => p.id === paciente.id);
          if (!current) {
            throw new Error('Paciente não encontrado no Firestore.');
          }

          let updatedPlano;

          if (isPrincipal) {
            // Clear base fields in React local state immediately
            setTipoEscala('');
            setHoraInicioPadrao('');
            setValorSugeridoPlantao('');
            setAjudaCusto('');
            setTaxaAdm('');

            // Prepare updated planoAtendimento replacing base keys with cleared/default empty values
            updatedPlano = {
              ...current.planoAtendimento,
              tipoEscala: '',
              horaInicioPadrao: '',
              valorSugeridoPlantao: 0,
              ajudaCusto: 0,
              taxaAdm: 0,
              tiposPlantao: tiposPlantao,
            };
          } else {
            // Additional format - remove from the array immediately
            const remaining = tiposPlantao.filter(t => t.id !== id);
            setTiposPlantao(remaining);

            // Prepare updated planoAtendimento array
            updatedPlano = {
              ...current.planoAtendimento,
              tiposPlantao: remaining,
            };
          }

          // 4. Persistencia no Firebase (Firestore) com updateDoc
          const docRef = doc(db, 'pacientes', paciente.id);
          try {
            await updateDoc(docRef, {
              planoAtendimento: updatedPlano
            });
          } catch (firestoreErr) {
            handleFirestoreError(firestoreErr, OperationType.UPDATE, `pacientes/${paciente.id}`);
          }
          
          // Also reset editing state if the deleted additional shift was being edited
          if (!isPrincipal && editingSubId === id) {
            setEditingSubId(null);
            setNewSubValorPlantao(150);
            setNewSubAjudaCusto(0);
            setNewSubTaxaAdm(0);
          }
        } catch (error: any) {
          console.error("Erro ao deletar configuracao:", error);
          alert('Erro ao excluir: ' + error.message);
        }
      }
    });
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

  // Helper for strict financial calculations
  const calculateShiftValues = (basePlantao: number, baseTaxa: number, baseAjuda: number, feriado: '20%' | '50%' | null) => {
    // Return base values. Acréscimo percent will be applied dynamically in reports and displays.
    return {
      plantaoFinal: basePlantao,
      taxaAdmFinal: baseTaxa,
      ajudaCusto: baseAjuda
    };
  };

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
      
      const { plantaoFinal, taxaAdmFinal, ajudaCusto: finalAjuda } = calculateShiftValues(
        newShiftValor,
        taxaAdm || 0,
        ajudaCusto || 0,
        newShiftFeriado
      );

      for (const currentDt of datesToSchedule) {
        // Check for conflicts
        const conflict = agendamentos.find(p => p.data === currentDt && p.nomeProfissional === newShiftProf && p.status === 'Confirmado');
        if (conflict) {
          if (!window.confirm(`⚠️ Atenção: ${newShiftProf} já está escalado em outro plantão nesta data (${currentDt}). Tem certeza que deseja confirmar este agendamento simultâneo?`)) {
            continue; // Skip this date if not confirmed
          }
        }

        const pickedProf = profissionais.find(p => p.nome === newShiftProf);
        await addAgendamento({
          idPaciente: paciente.id,
          idProfissional: pickedProf ? pickedProf.id : 'n/a', 
          nomeProfissional: newShiftProf,
          data: currentDt,
          horario: `${newShiftHoraInicio}-${newShiftHoraTermino}`,
          valorPlantao: plantaoFinal,
          valorRepasse: plantaoFinal,
          ajudaCusto: finalAjuda,
          taxaAdm: taxaAdmFinal,
          status: 'Confirmado',
          observacao: newShiftObservacao,
          tipoDia: newShiftFeriado ? (`Feriado ${newShiftFeriado}` as any) : 'Normal'
        });
      }

      setNewShiftProf('');
      setNewShiftDatesList([]);
      setNewShiftFeriado(null);
      alert(datesToSchedule.length > 1 ? `${datesToSchedule.length} plantões agendados com sucesso!` : 'Plantão agendado com sucesso!');
    } catch (err: any) {
      alert('Erro ao agendar plantão.');
      console.error(err);
    }
  };

  // Cancel shift modal confirmation triggers
  const handleTriggerCancelClick = (shiftId: string) => {
    const originalShift = agendamentos.find((pl) => pl.id === shiftId);
    if (originalShift && originalShift.status === 'Concluido') {
      alert('Atenção: Este agendamento está CONCLUÍDO (congelado) e não pode ser cancelado ou alterado. Reabra a escala primeiro!');
      return;
    }
    setSelectedShiftForCancel(shiftId);
    setCancelReasonValue('Pediu para sair da escala');
    setCancelShiftModalOpen(true);
  };

  const handleConfirmCancelShift = async () => {
    if (selectedShiftForCancel) {
      const targetAg = agendamentos.find(a => a.id === selectedShiftForCancel);
      if (targetAg) {
        await updateAgendamento({
          ...targetAg,
          status: 'Cancelado',
          observacao: (targetAg.observacao ? targetAg.observacao + '\n' : '') + `Motivo: ${cancelReasonValue}`
        });
      }
      setCancelShiftModalOpen(false);
      setSelectedShiftForCancel(null);
      alert('Agendamento cancelado com sucesso.');
    }
  };

  // NEW HANDLERS FOR ADVANCED SCHEDULER: Avulso, Concluir, Reabrir, Exclusão

  const handleConfirmAvulso = async () => {
    if (!paciente) return;
    if (!avulsoSingleDate) {
      alert('Selecione uma data para o agendamento.');
      return;
    }
    if (!avulsoProf.trim()) {
      alert('Por favor, indique o profissional responsável.');
      return;
    }

    try {
      const shiftsList = [
        {
          id: 'principal',
          tipoEscala: tipoEscala || 'Diurno 12h',
          horaInicio: horaInicioPadrao || '07:00',
          valorPlantao: Number(valorSugeridoPlantao || 0),
          ajudaCusto: Number(ajudaCusto || 0),
          taxaAdm: Number(taxaAdm || 0),
        },
        ...tiposPlantao.map((tp) => ({
          id: tp.id,
          tipoEscala: tp.tipoEscala,
          horaInicio: tp.horaInicio,
          valorPlantao: Number(tp.valorPlantao || 0),
          ajudaCusto: Number(tp.ajudaCusto || 0),
          taxaAdm: Number(tp.taxaAdm || 0),
        })),
      ];

      const chosenOpt = shiftsList.find((s) => s.id === avulsoPlantaoOptionId) || shiftsList[0];

      const baseRepasseValue = chosenOpt.valorPlantao;
      const baseAjudaValue = chosenOpt.ajudaCusto;
      const baseTaxaValue = chosenOpt.taxaAdm;
      const chosenHoraInicio = chosenOpt.horaInicio;
      const chosenTipoEscalaStr = chosenOpt.tipoEscala;

      // Parse duration in hours
      let durationHrs = 12;
      const parsedMatch = chosenTipoEscalaStr.match(/(\d+)\s*h/i);
      if (parsedMatch) {
        durationHrs = parseInt(parsedMatch[1], 10);
      } else if (chosenTipoEscalaStr.includes('24')) {
        durationHrs = 24;
      } else if (chosenTipoEscalaStr.includes('6')) {
        durationHrs = 6;
      }

      // Holiday factor
      let isFeriado: '20%' | '50%' | null = null;
      if (avulsoTipoDia === 'Feriado 20%') {
        isFeriado = '20%';
      } else if (avulsoTipoDia === 'Feriado 50%') {
        isFeriado = '50%';
      }

      const { plantaoFinal, taxaAdmFinal, ajudaCusto: finalAjuda } = calculateShiftValues(
        baseRepasseValue,
        baseTaxaValue,
        baseAjudaValue,
        isFeriado
      );

      // Helper to calculate endTime
      const getTerminoTime = (startTime: string, duration: number): string => {
        try {
          const [h, m] = startTime.split(':').map(Number);
          const endH = (h + duration) % 24;
          return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        } catch (e) {
          return '19:00';
        }
      };

      const pickedProf = profissionais.find(p => p.nome === avulsoProf);
      await addAgendamento({
        idPaciente: paciente.id,
        idProfissional: pickedProf ? pickedProf.id : 'n/a',
        nomeProfissional: avulsoProf,
        data: avulsoSingleDate,
        horario: `${chosenHoraInicio}-${getTerminoTime(chosenHoraInicio, durationHrs)}`,
        valorPlantao: plantaoFinal,
        valorRepasse: plantaoFinal,
        ajudaCusto: finalAjuda,
        taxaAdm: taxaAdmFinal,
        status: 'Confirmado',
        observacao: avulsoObs || (avulsoCuringa ? 'CURINGA' : ''),
        tipoDia: avulsoTipoDia as 'Normal' | 'Feriado 20%' | 'Feriado 50%',
        isCuringa: avulsoCuringa
      });

      setAvulsoProf('');
      setAvulsoPlantaoOptionId('principal');
      setAvulsoTipoDia('Normal');
      setAvulsoObs('');
      setAvulsoCuringa(false);
      setAvulsoModalOpen(false);
      alert('Novo agendamento criado com sucesso!');
    } catch (err) {
      alert('Erro ao criar novo agendamento.');
    }
  };

  const handleConfirmConcluir = async () => {
    if (!paciente) return;
    if (!concluirStartDate || !concluirEndDate) {
      alert('Defina o início e o fim do período.');
      return;
    }

    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === paciente.id);
    const matches = agendamentosPaciente.filter(
      (s) => s.data >= concluirStartDate && s.data <= concluirEndDate && s.status !== 'Concluido' && s.status !== 'Cancelado'
    );

    if (matches.length === 0) {
      alert('Nenhum agendamento ativo foi encontrado neste período para ser concluído.');
      return;
    }

    try {
      for (const s of matches) {
        await updateAgendamento({
          ...s,
          status: 'Concluido',
          escalaCongelada: true,
        });
      }
      setConcluirModalOpen(false);
      alert(`Escala concluída (congelada) com sucesso de ${concluirStartDate.split('-').reverse().join('/')} a ${concluirEndDate.split('-').reverse().join('/')}. ${matches.length} turnos foram afetados.`);
    } catch (err) {
      alert('Erro ao congelar escala.');
    }
  };

  const handleConfirmReabrir = async () => {
    if (!paciente) return;
    if (!reabrirStartDate || !reabrirEndDate) {
      alert('Defina o início e o fim do período.');
      return;
    }

    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === paciente.id);
    const matches = agendamentosPaciente.filter(
      (s) => s.data >= reabrirStartDate && s.data <= reabrirEndDate && s.status === 'Concluido'
    );

    if (matches.length === 0) {
      alert('Nenhum agendamento concluído foi encontrado neste período para ser reaberto.');
      return;
    }

    try {
      for (const s of matches) {
        await updateAgendamento({
          ...s,
          status: 'Aberta',
          escalaCongelada: false,
        });
      }
      setReabrirModalOpen(false);
      alert(`Escala reaberta com sucesso de ${reabrirStartDate.split('-').reverse().join('/')} a ${reabrirEndDate.split('-').reverse().join('/')}. Os turnos estão disponíveis para edição.`);
    } catch (err) {
      alert('Erro ao reabrir escala.');
    }
  };

  const handleConfirmExcluir = async () => {
    if (!paciente) return;
    
    let matches: Agendamento[] = [];
    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === paciente.id);

    if (excluirPorType === 'datas') {
      matches = agendamentosPaciente.filter((s) => s.data === excluirStartDate);
    } else if (excluirPorType === 'profissional') {
      if (!excluirProfName) {
        alert('Selecione o profissional para remover.');
        return;
      }
      matches = agendamentosPaciente.filter(
        (s) => s.data >= excluirStartDate && s.data <= excluirEndDate && (s.nomeProfissional || '').toLowerCase().includes((excluirProfName || '').toLowerCase())
      );
    } else {
      matches = agendamentosPaciente.filter(
        (s) => s.data >= excluirStartDate && s.data <= excluirEndDate
      );
    }

    if (matches.length === 0) {
      alert('Nenhum agendamento correspondente aos filtros foi encontrado para exclusão.');
      return;
    }

    const frozenCount = matches.filter((s) => s.status === 'Concluido').length;

    if (frozenCount > 0) {
      alert('Não é possível realizar a exclusão pois existem plantões CONCLUÍDOS no período selecionado. Por favor, reabra a escala para realizar alterações ou ajuste o período de exclusão.');
      return;
    }

    setDeleteRecordDialog({
      isOpen: true,
      title: 'Confirmar Exclusão em Lote',
      message: `Você realmente deseja excluir permanentemente ${matches.length} agendamento(s) selecionados? Esta ação não pode ser desfeita.`,
      confirmText: 'Confirmar e Excluir',
      cancelText: 'Voltar',
      onConfirm: async () => {
        try {
          for (const m of matches) {
            await deleteAgendamento(m.id);
          }
          setExcluirModalOpen(false);
          alert(`${matches.length} agendamento(s) excluído(s) com sucesso.`);
        } catch (err: any) {
          alert('Erro ao excluir agendamento: ' + (err.message || String(err)));
        }
      }
    });
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
      if (originalShift && originalShift.escalaCongelada) {
        alert('Atenção: Este plantão está CONGELADO e não pode ser editado. Reabra a escala primeiro!');
        return;
      }
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

  // Compiled options representing all configured shifts (Principal + Additionals)
  const availableShifts = [
    {
      id: 'principal',
      tipoEscala: tipoEscala || 'Diurno 12h',
      horaInicio: horaInicioPadrao || '07:00',
      valorPlantao: Number(valorSugeridoPlantao || 0),
      ajudaCusto: Number(ajudaCusto || 0),
      taxaAdm: Number(taxaAdm || 0),
      label: `${tipoEscala || 'Diurno 12h'} (Principal)`
    },
    ...tiposPlantao.map(tp => ({
      id: tp.id,
      tipoEscala: tp.tipoEscala,
      horaInicio: tp.horaInicio,
      valorPlantao: Number(tp.valorPlantao || 0),
      ajudaCusto: Number(tp.ajudaCusto || 0),
      taxaAdm: Number(tp.taxaAdm || 0),
      label: `${tp.tipoEscala} (Adicional)`
    }))
  ];

  const selectedAvulsoOpt = availableShifts.find(s => s.id === avulsoPlantaoOptionId) || availableShifts[0];

  const baseRepasseValue = selectedAvulsoOpt?.valorPlantao || 0;
  const baseAjudaValue = selectedAvulsoOpt?.ajudaCusto || 0;
  const baseTaxaValue = selectedAvulsoOpt?.taxaAdm || 0;

  let multiplier = 1.0;
  if (avulsoTipoDia === 'Feriado 20%') {
    multiplier = 1.2;
  } else if (avulsoTipoDia === 'Feriado 50%') {
    multiplier = 1.5;
  }

  const computedRepasse = baseRepasseValue * multiplier;
  const computedTaxa = baseTaxaValue * multiplier;
  const computedAjuda = baseAjudaValue;

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
          {!isNew && (
            <button
              type="button"
              onClick={() => setImprimirProntuarioModalOpen(true)}
              className="bg-teal-600 hover:bg-teal-700 text-white border border-teal-700 px-4 py-2 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
              id="btn-imprimir-prontuario-global"
            >
              <Printer size={15} />
              <span>📄 Exportar Prontuário (PDF)</span>
            </button>
          )}
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

                <h4 className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-2 pt-3 uppercase tracking-wider italic">DADOS DE FATURAMENTO E PAGAMENTO</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">Responsável pelo Pagamento? *</label>
                    <select
                      disabled={isCurrentlyDeactivated}
                      value={responsavelPagamento}
                      onChange={(e) => setResponsavelPagamento(e.target.value as any)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    >
                      <option value="O próprio Paciente">O próprio Paciente</option>
                      <option value="Outro Responsável">Outro Responsável</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-900">Canal de Envio da Fatura/Boleto *</label>
                    <select
                      disabled={isCurrentlyDeactivated}
                      value={opcaoEnvio}
                      onChange={(e) => setOpcaoEnvio(e.target.value as any)}
                      className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    >
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="E-mail">E-mail</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>

                  {responsavelPagamento === 'Outro Responsável' && (
                    <>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-900">Nome Completo do Pagador *</label>
                        <input
                          type="text"
                          required
                          disabled={isCurrentlyDeactivated}
                          value={nomePagador}
                          onChange={(e) => setNomePagador(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                          placeholder="Nome completo do portador da conta"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-black text-slate-900">CPF do Pagador *</label>
                        <input
                          type="text"
                          required
                          disabled={isCurrentlyDeactivated}
                          value={cpfPagador}
                          onChange={(e) => setCpfPagador(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                          placeholder="Ex: 000.000.000-00"
                        />
                      </div>
                    </>
                  )}

                  {(opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900">WhatsApp para Faturamento *</label>
                      <input
                        type="text"
                        required
                        disabled={isCurrentlyDeactivated}
                        value={whatsappFaturamento}
                        onChange={(e) => setWhatsappFaturamento(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                        placeholder="Ex: (21) 90000-0000"
                      />
                    </div>
                  )}

                  {(opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-black text-slate-900">E-mail para Faturamento *</label>
                      <input
                        type="email"
                        required
                        disabled={isCurrentlyDeactivated}
                        value={emailFaturamento}
                        onChange={(e) => setEmailFaturamento(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-350 rounded-lg text-slate-950 font-extrabold bg-white focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                        placeholder="faturamento@exemplo.com"
                      />
                    </div>
                  )}
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
                      onChange={(e) => setValorSugeridoPlantao(e.target.value === '' ? '' : Number(e.target.value))}
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
                      onChange={(e) => setAjudaCusto(e.target.value === '' ? '' : Number(e.target.value))}
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
                      onChange={(e) => setTaxaAdm(e.target.value === '' ? '' : Number(e.target.value))}
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
                          onChange={(e) => setNewSubValorPlantao(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Aj. de Custo (R$)</label>
                        <input
                          type="number"
                          disabled={isCurrentlyDeactivated}
                          value={newSubAjudaCusto}
                          onChange={(e) => setNewSubAjudaCusto(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-normal text-slate-600">Tx Adm (R$)</label>
                        <input
                          type="number"
                          disabled={isCurrentlyDeactivated}
                          value={newSubTaxaAdm}
                          onChange={(e) => setNewSubTaxaAdm(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end items-center">
                      {editingSubId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubId(null);
                            setNewSubTipoEscala('Diurno 12h');
                            setNewSubHoraInicio('07:00');
                            setNewSubValorPlantao(150);
                            setNewSubAjudaCusto(0);
                            setNewSubTaxaAdm(0);
                          }}
                          className="mr-2 px-3 py-1.5 text-xs font-semibold text-slate-750 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Cancelar Edição
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isCurrentlyDeactivated}
                        onClick={() => {
                          if (editingSubId) {
                            setTiposPlantao(tiposPlantao.map(t => t.id === editingSubId ? {
                              ...t,
                              tipoEscala: newSubTipoEscala,
                              horaInicio: newSubHoraInicio,
                              valorPlantao: Number(newSubValorPlantao || 0),
                              ajudaCusto: Number(newSubAjudaCusto || 0),
                              taxaAdm: Number(newSubTaxaAdm || 0)
                            } : t));
                            setEditingSubId(null);
                          } else {
                            const newType: EscalacaoPlano = {
                              id: `tp-${Date.now()}`,
                              tipoEscala: newSubTipoEscala,
                              horaInicio: newSubHoraInicio,
                              valorPlantao: Number(newSubValorPlantao || 0),
                              ajudaCusto: Number(newSubAjudaCusto || 0),
                              taxaAdm: Number(newSubTaxaAdm || 0),
                            };
                            setTiposPlantao([...tiposPlantao, newType]);
                          }
                          // Reset inputs to default values
                          setNewSubValorPlantao(150);
                          setNewSubAjudaCusto(0);
                          setNewSubTaxaAdm(0);
                        }}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>{editingSubId ? 'Salvar Edição' : 'Adicionar Modo de Plantão'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Table of configured shifts, containing complete list (Principal + Additionals) */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs mb-4">
                    <table className="min-w-[700px] w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-normal">
                          <th className="p-3 font-normal">Tipo do Plantão</th>
                          <th className="p-3 text-center font-normal">Horário de Início</th>
                          <th className="p-3 text-right font-normal">Valor Plantão</th>
                          <th className="p-3 text-right font-normal">Aj. de Custo</th>
                          <th className="p-3 text-right font-normal">Taxa Adm</th>
                          <th className="p-3 text-center w-44 font-normal">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {allRows.map((tp) => (
                          <tr key={tp.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-normal text-slate-800 flex items-center space-x-2">
                              <span>{tp.tipoEscala}</span>
                              {tp.isPrincipal && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                  ⭐ Principal
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-mono bg-slate-50/35">{tp.horaInicio}</td>
                            <td className="p-3 text-right font-normal text-slate-900">R$ {tp.valorPlantao.toFixed(2)}</td>
                            <td className="p-3 text-right text-slate-500">R$ {(tp.ajudaCusto || 0).toFixed(2)}</td>
                            <td className="p-3 text-right text-slate-500">R$ {(tp.taxaAdm || 0).toFixed(2)}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                {tp.isPrincipal ? (
                                  <>
                                    <span className="text-[10px] text-slate-400 italic mr-1">Padrão</span>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated}
                                      onClick={() => handleDeletePlantao(tp.id, true)}
                                      className="p-1 px-1.5 border border-red-200 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-md disabled:opacity-50 transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-[11px]"
                                      title="Limpar plantão principal"
                                    >
                                      <Trash2 size={11} />
                                      <span>Excluir</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated}
                                      onClick={() => {
                                        setEditingSubId(tp.id);
                                        setNewSubTipoEscala(tp.tipoEscala);
                                        setNewSubHoraInicio(tp.horaInicio);
                                        setNewSubValorPlantao(tp.valorPlantao);
                                        setNewSubAjudaCusto(tp.ajudaCusto);
                                        setNewSubTaxaAdm(tp.taxaAdm);
                                      }}
                                      className="p-1 px-1.5 border border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-md disabled:opacity-50 transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-[11px]"
                                      title="Editar formato"
                                    >
                                      <Edit2 size={11} />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated}
                                      onClick={() => handleDeletePlantao(tp.id, false)}
                                      className="p-1 px-1.5 border border-red-200 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-md disabled:opacity-50 transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-[11px]"
                                      title="Excluir plantão adicional"
                                    >
                                      <Trash2 size={11} />
                                      <span>Excluir</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isCurrentlyDeactivated}
                    onClick={handleSavePlanoAtendimento}
                    className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
                    id="save-plano-atendimento"
                  >
                    <span>💾 Salvar Plano de Atendimento</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'agendamento' && (
              <div className="space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                {/* Operations Header Buttons Deck - RH Cuidado Domiciliar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">🛠️ Controles de Escala Operacional</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendarView('calendario')}
                      className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer ${
                        calendarView === 'calendario'
                          ? 'bg-blue-600 text-white font-extrabold ring-2 ring-blue-300'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Calendar size={13.5} />
                      <span>📅 Programação (Mensal)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalendarView('lista')}
                      className={`flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer ${
                        calendarView === 'lista'
                          ? 'bg-blue-600 text-white font-extrabold ring-2 ring-blue-300'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>📋 Lista de Turnos</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        const today = new Date();
                        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        setAvulsoSingleDate(todayStr);
                        setAvulsoProf('');
                        setAvulsoPlantaoOptionId('principal');
                        setAvulsoTipoDia('Normal');
                        setAvulsoObs('');
                        setAvulsoCuringa(false);
                        setAvulsoModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                    >
                      <Plus size={13.5} />
                      <span>➕ Agendar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        setConcluirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setConcluirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-30`);
                        setConcluirModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-950 hover:bg-indigo-900 text-white rounded-lg transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                    >
                      <Check size={13.5} />
                      <span>✔ Concluir</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        setReabrirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setReabrirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-30`);
                        setReabrirModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                    >
                      <RotateCcw size={13.5} />
                      <span>🔄 Reabrir</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        setExcluirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setExcluirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-30`);
                        setExcluirModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-red-600 hover:bg-red-750 text-white rounded-lg transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-sans"
                    >
                      <X size={13.5} />
                      <span>✖ Exclusão</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setImprimirModalOpen(true);
                      }}
                      className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-all shadow-xs cursor-pointer font-sans"
                    >
                      <Printer size={13.5} />
                      <span>🖨️ Imprimir</span>
                    </button>
                    
                  </div>
                </div>


                {calendarView === 'calendario' && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 animate-in fade-in-30">
                    {/* Navigation control */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center space-x-3">
                        <div className="flex bg-slate-100 p-1 border border-slate-200/80 rounded-lg">
                          <button
                            type="button"
                            onClick={() => {
                              if (calendarMonth === 0) {
                                setCalendarMonth(11);
                                setCalendarYear(calendarYear - 1);
                              } else {
                                setCalendarMonth(calendarMonth - 1);
                              }
                            }}
                            className="p-1 hover:bg-white text-slate-700 rounded transition-colors cursor-pointer"
                          >
                            <ChevronLeft size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (calendarMonth === 11) {
                                setCalendarMonth(0);
                                setCalendarYear(calendarYear + 1);
                              } else {
                                setCalendarMonth(calendarMonth + 1);
                              }
                            }}
                            className="p-1 hover:bg-white text-slate-700 rounded transition-colors cursor-pointer"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCalendarMonth(5); // June
                            setCalendarYear(2026);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                          Hoje
                        </button>

                        <h2 className="text-sm font-black text-slate-800 tracking-tight font-sans">
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} {calendarYear}
                        </h2>
                      </div>

                      {/* Segments matching style */}
                      <div className="flex rounded-md shadow-xs bg-slate-100 p-0.5" role="group">
                        <button
                          type="button"
                          className="px-3.5 py-1 text-[11px] font-bold text-blue-700 bg-white rounded-md shadow-xs border border-slate-200"
                        >
                          Mês
                        </button>
                        <button
                          type="button"
                          onClick={() => alert('Modo Semana em desenvolvimento de UX.')}
                          className="px-3.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Semana
                        </button>
                        <button
                          type="button"
                          onClick={() => alert('Modo Dia em desenvolvimento de UX.')}
                          className="px-3.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          Dia
                        </button>
                      </div>
                    </div>

                    {/* Monthly grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                        <div key={day} className="py-2 text-center text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                          {day}
                        </div>
                      ))}

                       {(() => {
                        const gridDays = getDaysInMonthGrid(calendarMonth, calendarYear);
                        return gridDays.map((cell, idx) => {
                          const today = new Date();
                          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          const isToday = cell.dateStr === todayStr;
                          const isSpecialHoliday = cell.holiday !== undefined;
                          
                          // Filter agendamentos matching date
                          const dailyAgendamentos = agendamentos.filter(
                            (s) => s.data === cell.dateStr && s.idPaciente === (paciente?.id || '')
                          );
                          // console.log(`Date: ${cell.dateStr}, Agendamentos:`, agendamentos);

                          return (
                            <div
                              key={idx}
                              className={`min-h-[102px] border p-1 rounded-lg flex flex-col transition-all duration-150 ${
                                isToday 
                                  ? 'bg-[#fefcf4] border-amber-300 ring-1 ring-amber-100 shadow-xs' 
                                  : cell.isCurrentMonth
                                    ? 'bg-white border-slate-200/60'
                                    : 'bg-slate-50/40 opacity-40 border-slate-200/30'
                              } ${
                                isSpecialHoliday && !isToday ? 'bg-rose-50/50 border-rose-100' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between p-0.5">
                                <span className={`text-[9px] font-bold select-none px-1.5 py-0.5 rounded-full ${
                                  isToday
                                    ? 'bg-amber-600 text-white font-extrabold flex items-center justify-center'
                                    : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-300'
                                }`}>
                                  {cell.dayNumber} {isToday && 'Hoje'}
                                </span>
                              </div>

                              <div className="space-y-1 mt-1 flex-1 w-full">
                                {dailyAgendamentos.map((ag) => {
                                  
                                  return (
                                    <div
                                      key={ag.id}
                                      onClick={() => {
                                        setSelectedShiftForDetails(ag);
                                        setDetailsPlantaoOptionId('principal');
                                        setDetailsTipoDia(ag.tipoDia || 'Normal');
                                        setDetailsCuringa(!!ag.isCuringa || ag.observacao === 'CURINGA');
                                        setDetailsProfName(ag.nomeProfissional);
                                        setDetailsDate(ag.data);
                                        setIsEditingDetails(false);
                                        setIsConfirmingDelete(false);
                                        setDetailsModalOpen(true);
                                      }}
                                      className={`text-[9.5px] p-1.5 border rounded-lg cursor-pointer flex flex-col text-left w-full transition-all duration-150 relative space-y-0.5 hover:-translate-y-0.5 hover:shadow-xs ${
                                        ag.status === 'Cancelado'
                                          ? 'bg-slate-100 border-slate-300 text-slate-500 line-through'
                                          : ag.status === 'Concluido'
                                            ? 'bg-indigo-55 bg-indigo-100 border-indigo-200 text-indigo-900 font-bold'
                                            : 'bg-emerald-55 bg-emerald-50 border-emerald-250 text-emerald-900 font-extrabold hover:bg-emerald-100 hover:border-emerald-300'
                                      }`}
                                      title={ag.observacao || 'Inspecionar Plantão'}
                                    >
                                        <div className="flex justify-between items-center w-full gap-1">
                                          <span className="font-extrabold text-slate-800 shrink-0">
                                            {ag.horario}
                                            {ag.status === 'Concluido' && ' 🔒'}
                                          </span>
                                          {(ag.isCuringa || ag.observacao?.includes('CURINGA')) && (
                                            <span className="px-1 py-[1px] text-[7px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 rounded-sm">Curinga</span>
                                          )}
                                        </div>
                                        <span className="truncate block font-medium opacity-90">{ag.nomeProfissional}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 bg-slate-50 p-3 rounded-xl gap-2 font-mono">
                      <span>💡 <strong>Metadados Auditores:</strong> Clique em qualquer plantão no calendário para inspecionar criadores, horas fiscais e logs de modificação.</span>
                      <div className="flex items-center space-x-2.5 shrink-0 font-bold">
                        <span className="flex items-center"><span className="w-2 h-2 bg-emerald-400 rounded-full mr-1"></span> Ativo</span>
                        <span className="flex items-center"><span className="w-2 h-2 bg-indigo-400 rounded-full mr-1"></span> Fechado 🔒</span>
                        <span className="flex items-center"><span className="w-2 h-2 bg-red-405 bg-red-400 rounded-full mr-1"></span> Cancelado 🔴</span>
                      </div>
                    </div>
                  </div>
                )}
 
                 {/* Quick Add block for scales, ONLY displayed if patient exists and is Ativo */}
                {false && !isNew && !isCurrentlyDeactivated ? (
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
                            {profissionais.filter(p =>
                              ((p.nome || '').toLowerCase().includes((newShiftProf || '').toLowerCase()) ||
                              (p.especialidade || '').toLowerCase().includes((newShiftProf || '').toLowerCase())) &&
                              p.status === 'Ativo'
                            ).map((prof) => (
                              <button
                                key={prof.id}
                                type="button"
                                onMouseDown={() => {
                                  setNewShiftProf(prof.nome);
                                  setShowProfDropdown(false);
                                }}
                                className="w-full text-left p-2 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px]">
                                    {prof.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-slate-800 leading-none">{prof.nome}</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{prof.especialidade}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-[8px] font-bold ${
                                    prof.status === 'Ativo' ? 'bg-green-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {prof.status}
                                  </span>
                                </div>
                              </button>
                            ))}
                            {profissionais.filter(p => 
                              (p.nome || '').toLowerCase().includes((newShiftProf || '').toLowerCase()) ||
                              (p.especialidade || '').toLowerCase().includes((newShiftProf || '').toLowerCase())
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
                          <input 
                            type="checkbox" 
                            checked={newShiftProf === 'CURINGA'} 
                            onChange={(e) => setNewShiftProf(e.target.checked ? 'CURINGA' : '')}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                          <span className="text-[10px] font-bold text-slate-700">MARCAR COMO CURINGA</span>
                        </div>
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
                ) : false && isNew ? (
                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl text-orange-850 text-xs italic">
                    Para agendar plantões, você deve primeiro preencher e salvar o prontuário deste novo paciente.
                  </div>
                ) : null}

                {/* Tabulation of scale list */}
                {calendarView === 'lista' && (
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
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAgendamento(item.id)}
                                    title="Excluir permanentemente"
                                    className="px-2.5 py-1 text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors cursor-pointer"
                                  >
                                    🗑️ Excluir
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
                )}
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
                    {profissionais.filter(p =>
                      ((p.nome || '').toLowerCase().includes((editShiftProfName || '').toLowerCase()) ||
                      (p.especialidade || '').toLowerCase().includes((editShiftProfName || '').toLowerCase())) &&
                      p.status === 'Ativo'
                    ).map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onMouseDown={() => {
                          setEditShiftProfName(prof.nome);
                          setShowEditProfDropdown(false);
                        }}
                        className="w-full text-left p-2 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[9px]">
                            {prof.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800 leading-none">{prof.nome}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 leading-none">{prof.especialidade}</p>
                          </div>
                        </div>
                        <div className="text-right text-[9px]">
                          <span className={`inline-block px-1 py-0 rounded font-bold ${
                            prof.status === 'Ativo' ? 'bg-green-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {prof.status}
                          </span>
                        </div>
                      </button>
                    ))}
                    {profissionais.filter(p =>
                      (p.nome || '').toLowerCase().includes((editShiftProfName || '').toLowerCase()) ||
                      (p.especialidade || '').toLowerCase().includes((editShiftProfName || '').toLowerCase())
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
              <span>Status: <strong className={inspectedShiftJson?.status === 'Confirmado' ? 'text-emerald-400' : 'text-rose-400 uppercase'}>{inspectedShiftJson?.status || 'Não Informado'}</strong></span>
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

      {/* 1. MODELO / MODAL: NOVO AGENDAMENTO */}
      {avulsoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full flex flex-col p-6 space-y-4 font-sans">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={15} className="text-sky-600" />
                <span>Novo Agendamento</span>
              </h3>
              <button
                type="button"
                onClick={() => setAvulsoModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* Professional Autocomplete Search Field */}
              <div className="space-y-1 relative">
                <label className="block text-xs font-bold text-slate-700">Alocar Profissional</label>
                <input
                  type="text"
                  value={avulsoProf}
                  onFocus={() => setShowAvulsoProfDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAvulsoProfDropdown(false), 200)}
                  onChange={(e) => setAvulsoProf(e.target.value)}
                  placeholder="Pesquise o nome do profissional..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50 focus:outline-none focus:border-blue-500 font-sans"
                />
                {showAvulsoProfDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-55 divide-y divide-slate-100">
                    {profissionais
                      .filter(p =>
                        (p.nome || '').toLowerCase().includes((avulsoProf || '').toLowerCase()) &&
                        p.status === 'Ativo'
                      )
                      .map((prof) => (
                        <button
                          key={prof.id}
                          type="button"
                          onMouseDown={() => {
                            setAvulsoProf(prof.nome);
                            setShowAvulsoProfDropdown(false);
                          }}
                          className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-850"
                        >
                          {prof.nome} ({prof.especialidade})
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Single Date Picker Input */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Data do Plantão </label>
                <input
                  type="date"
                  value={avulsoSingleDate}
                  onChange={(e) => setAvulsoSingleDate(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              {/* Horário / Plantão Option Select Dropdown */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Horário / Turno</label>
                <select
                  value={avulsoPlantaoOptionId}
                  onChange={(e) => setAvulsoPlantaoOptionId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 font-sans"
                >
                  {availableShifts.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} — {opt.horaInicio}
                    </option>
                  ))}
                </select>
              </div>

              {/* Financial modifier with 20% and 50% */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Acréscimo Feriado (Faturamento/Repasse)</label>
                <select
                  value={avulsoTipoDia}
                  onChange={(e) => setAvulsoTipoDia(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 font-sans"
                >
                  <option value="Normal">Dia Regular (Sem Acréscimo)</option>
                  <option value="Feriado 20%">Feriado (+20%)</option>
                  <option value="Feriado 50%">Feriado (+50%)</option>
                </select>
              </div>

              {/* Curinga toggle checkbox */}
              <div className="flex items-center space-x-2.5 py-1">
                <input
                  type="checkbox"
                  id="avulso-curinga-chk"
                  checked={avulsoCuringa}
                  onChange={(e) => setAvulsoCuringa(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="avulso-curinga-chk" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                  MARCAR ESSE PLANTÃO COMO CURINGA
                </label>
              </div>

              {/* Financial preview card box */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2 mt-1">
                <div className="text-[10px] font-black text-slate-450 uppercase tracking-wider block border-b border-slate-100 pb-1">
                  Resumo Financeiro Estimado
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs text-slate-650 font-sans">
                  <span>Valor Líquido Repasse:</span>
                  <span className="font-semibold text-slate-800 text-right font-mono">R$ {computedRepasse.toFixed(2)}</span>
                  <span>Ajuda de Custo:</span>
                  <span className="font-semibold text-slate-800 text-right font-mono">R$ {computedAjuda.toFixed(2)}</span>
                  <span>Taxa Adm / Faturamento:</span>
                  <span className="font-semibold text-slate-800 text-right font-mono">R$ {computedTaxa.toFixed(2)}</span>
                  <div className="col-span-2 border-t border-slate-150 pt-1 flex justify-between font-bold text-sky-700">
                    <span>Faturamento Total Paciente:</span>
                    <span>R$ {(computedRepasse + computedTaxa + computedAjuda).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Observações adicionais</label>
                <input
                  type="text"
                  value={avulsoObs}
                  onChange={(e) => setAvulsoObs(e.target.value)}
                  placeholder="Ex: Conduta específica ou substituição..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAvulsoModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-550 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleConfirmAvulso();
                  setAvulsoModalOpen(false);
                }}
                className="px-4.5 py-2 text-xs font-extrabold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Confirmar e Agendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODELO / MODAL: DETALHES DO PLANTÃO */}
      {detailsModalOpen && selectedShiftForDetails && (() => {
        const dChosenOpt = availableShifts.find((s) => s.id === detailsPlantaoOptionId) || availableShifts[0];
        const dBaseRepasseValue = dChosenOpt?.valorPlantao || 0;
        const dBaseAjudaValue = dChosenOpt?.ajudaCusto || 0;
        const dBaseTaxaValue = dChosenOpt?.taxaAdm || 0;

        let dMultiplier = 1.0;
        if (detailsTipoDia === 'Feriado 20%') {
          dMultiplier = 1.2;
        } else if (detailsTipoDia === 'Feriado 50%') {
          dMultiplier = 1.5;
        }

        const dComputedRepasseValue = dBaseRepasseValue * dMultiplier;
        const dComputedTaxaValue = dBaseTaxaValue * dMultiplier;
        const dComputedAjudaValue = dBaseAjudaValue;

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full flex flex-col p-6 space-y-4 font-sans">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={15} className="text-blue-600" />
                  <span>{isEditingDetails ? '✏️ Editar Plantão' : '📋 Detalhes do Plantão'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>

              {!isEditingDetails ? (
                // View Mode
                (() => {
                  let viewMultiplier = 1.0;
                  if (selectedShiftForDetails.tipoDia === 'Feriado 20%') {
                    viewMultiplier = 1.2;
                  } else if (selectedShiftForDetails.tipoDia === 'Feriado 50%') {
                    viewMultiplier = 1.5;
                  }

                  const viewRepasseValue = (selectedShiftForDetails.valorRepasse || 0) * viewMultiplier;
                  const viewTaxaValue = (selectedShiftForDetails.taxaAdm || 0) * viewMultiplier;
                  const viewAjudaValue = selectedShiftForDetails.ajudaCusto || 0;
                  const viewTotalValue = viewRepasseValue + viewTaxaValue + viewAjudaValue;

                  return (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Profissional Cuidador</span>
                        <p className="text-sm font-bold text-slate-850 flex items-center gap-1.5">
                          <span>{selectedShiftForDetails.nomeProfissional}</span>
                          {(selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao?.includes('CURINGA')) && (
                            <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-200 rounded">Curinga</span>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pb-1 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Data</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedShiftForDetails.data.split('-').reverse().join('/')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Horário</span>
                          <span className="text-xs font-semibold text-slate-700">{selectedShiftForDetails.horario}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Tipo de Dia</span>
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${
                          selectedShiftForDetails.tipoDia === 'Feriado 50%'
                            ? 'bg-rose-50 text-rose-700 border border-rose-100'
                            : selectedShiftForDetails.tipoDia === 'Feriado 20%'
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-slate-50 text-slate-600 border border-slate-100'
                        }`}>
                          {selectedShiftForDetails.tipoDia || 'Dia Normal (Sem Adicional)'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-xl space-y-1.5">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Detalhamento Financeiro</span>
                        <div className="grid grid-cols-2 text-xs text-slate-600 space-y-1 font-sans">
                          <span className="pt-1">Valor do Repasse:</span>
                          <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewRepasseValue.toFixed(2)}</span>
                          <span>Ajuda de Custo:</span>
                          <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewAjudaValue.toFixed(2)}</span>
                          <span>Taxa faturamento:</span>
                          <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewTaxaValue.toFixed(2)}</span>
                          <div className="col-span-2 border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between font-bold text-sky-850">
                            <span>Faturamento total:</span>
                            <span className="font-mono">R$ {viewTotalValue.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {selectedShiftForDetails.observacao && (
                        <div className="p-3 bg-slate-50 rounded-lg text-xs leading-relaxed text-slate-600">
                          <strong>Observações:</strong> {selectedShiftForDetails.observacao}
                        </div>
                      )}

                      {isConfirmingDelete ? (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-3 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <p className="text-xs text-rose-850 font-black leading-relaxed text-center">
                            Tem certeza de que deseja CANCELAR e EXCLUIR permanentemente este plantão?
                          </p>
                          <p className="text-[10px] text-rose-600 leading-normal text-center font-medium">
                            O plantão será removido da escala e excluído de forma definitiva do banco de dados.
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setIsConfirmingDelete(false)}
                              className="flex-1 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all text-center cursor-pointer"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await deleteAgendamento(selectedShiftForDetails.id);
                                  setDetailsModalOpen(false);
                                  setSelectedShiftForDetails(null);
                                  setIsConfirmingDelete(false);
                                } catch (err) {
                                  alert("Erro ao excluir o plantão.");
                                }
                              }}
                              className="flex-1 py-1.5 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all text-center shadow-sm cursor-pointer"
                            >
                              Confirmar e Excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-3 border-t border-slate-100 font-sans">
                          <button
                            type="button"
                            onClick={() => {
                              // Initialize edit forms
                              setDetailsProfName(selectedShiftForDetails.nomeProfissional);
                              setDetailsDate(selectedShiftForDetails.data);
                              setDetailsCuringa(!!selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao === 'CURINGA');
                              setDetailsTipoDia(selectedShiftForDetails.tipoDia || 'Normal');
                              
                              // Infer the best shift template matching first hour block or default
                              const matchOpt = availableShifts.find(opt => selectedShiftForDetails.horario?.startsWith(opt.horaInicio)) || availableShifts[0];
                              setDetailsPlantaoOptionId(matchOpt.id);
                              
                              setIsEditingDetails(true);
                            }}
                            className="flex-1 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>✏️ Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsConfirmingDelete(true);
                            }}
                            className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>🗑️ Cancelar Plantão</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                // Edit Mode (interactive Form)
                <div className="space-y-3.5">
                  <div className="space-y-1 relative">
                    <label className="block text-xs font-bold text-slate-700">Profissional Cuidador</label>
                    <input
                      type="text"
                      value={detailsProfName}
                      onFocus={() => setShowDetailsProfDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDetailsProfDropdown(false), 200)}
                      onChange={(e) => setDetailsProfName(e.target.value)}
                      placeholder="Pesquise o nome do profissional..."
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-705 text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 font-sans font-medium"
                    />
                    {showDetailsProfDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-25 divide-y divide-slate-100">
                        {profissionais
                          .filter(p =>
                            (p.nome || '').toLowerCase().includes((detailsProfName || '').toLowerCase()) &&
                            p.status === 'Ativo'
                          )
                          .map((prof) => (
                            <button
                              key={prof.id}
                              type="button"
                              onMouseDown={() => {
                                setDetailsProfName(prof.nome);
                                setShowDetailsProfDropdown(false);
                              }}
                              className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-800"
                            >
                              {prof.nome} ({prof.especialidade})
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Data do Plantão </label>
                    <input
                      type="date"
                      value={detailsDate}
                      onChange={(e) => setDetailsDate(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 font-sans"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Horário / Turno</label>
                    <select
                      value={detailsPlantaoOptionId}
                      onChange={(e) => setDetailsPlantaoOptionId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                    >
                      {availableShifts.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} — {opt.horaInicio}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Acréscimo Feriado (Faturamento/Repasse)</label>
                    <select
                      value={detailsTipoDia}
                      onChange={(e) => setDetailsTipoDia(e.target.value as any)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none"
                    >
                      <option value="Normal">Dia Regular (Sem Acréscimo)</option>
                      <option value="Feriado 20%">Feriado (+20%)</option>
                      <option value="Feriado 50%">Feriado (+50%)</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id="details-curinga-chk"
                      checked={detailsCuringa}
                      onChange={(e) => setDetailsCuringa(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    />
                    <label htmlFor="details-curinga-chk" className="text-xs font-bold text-slate-700 select-none cursor-pointer">
                      MARCAR ESSE PLANTÃO COMO CURINGA
                    </label>
                  </div>

                  {/* Financial update preview box */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-1.5">
                    <div className="text-[9px] font-black text-slate-450 uppercase tracking-widest block border-b border-slate-100 pb-0.5">
                      Atualização de Custos (Novos Valores)
                    </div>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-slate-650 font-sans">
                      <span>Novo Repasse:</span>
                      <span className="font-semibold text-slate-800 text-right font-mono">R$ {dComputedRepasseValue.toFixed(2)}</span>
                      <span>Nova Ajuda:</span>
                      <span className="font-semibold text-slate-800 text-right font-mono">R$ {dComputedAjudaValue.toFixed(2)}</span>
                      <span>Nova Taxa Adm:</span>
                      <span className="font-semibold text-slate-800 text-right font-mono">R$ {dComputedTaxaValue.toFixed(2)}</span>
                      <div className="col-span-2 border-t border-slate-150 pt-1 flex justify-between font-bold text-emerald-700">
                        <span>Nova Fatura Paciente:</span>
                        <span className="font-mono">R$ {(dComputedRepasseValue + dComputedTaxaValue + dComputedAjudaValue).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      className="flex-1 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!detailsProfName.trim()) {
                          alert('Por favor, informe um profissional.');
                          return;
                        }
                        
                        try {
                          const chosenOpt = availableShifts.find((s) => s.id === detailsPlantaoOptionId) || availableShifts[0];
                          const baseRepasseValue = chosenOpt.valorPlantao;
                          const baseAjudaValue = chosenOpt.ajudaCusto;
                          const baseTaxaValue = chosenOpt.taxaAdm;
                          const chosenHoraInicio = chosenOpt.horaInicio;
                          const chosenTipoEscalaStr = chosenOpt.tipoEscala;

                          let durationHrs = 12;
                          const parsedMatch = chosenTipoEscalaStr.match(/(\d+)\s*h/i);
                          if (parsedMatch) {
                            durationHrs = parseInt(parsedMatch[1], 10);
                          } else if (chosenTipoEscalaStr.includes('24')) {
                            durationHrs = 24;
                          } else if (chosenTipoEscalaStr.includes('6')) {
                            durationHrs = 6;
                          }

                          let isFeriado: '20%' | '50%' | null = null;
                          if (detailsTipoDia === 'Feriado 20%') {
                            isFeriado = '20%';
                          } else if (detailsTipoDia === 'Feriado 50%') {
                            isFeriado = '50%';
                          }

                          const { plantaoFinal, taxaAdmFinal, ajudaCusto: finalAjuda } = calculateShiftValues(
                            baseRepasseValue,
                            baseTaxaValue,
                            baseAjudaValue,
                            isFeriado
                          );

                          const getTerminoTime = (startTime: string, duration: number): string => {
                            try {
                              const [h, m] = startTime.split(':').map(Number);
                              const endH = (h + duration) % 24;
                              return `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            } catch (e) {
                              return '19:00';
                            }
                          };

                          const pickedProf = profissionais.find(p => p.nome === detailsProfName);

                          const updatedAg: any = {
                            ...selectedShiftForDetails,
                            idProfissional: pickedProf ? pickedProf.id : 'n/a',
                            nomeProfissional: detailsProfName,
                            data: detailsDate,
                            horario: `${chosenHoraInicio}-${getTerminoTime(chosenHoraInicio, durationHrs)}`,
                            valorPlantao: plantaoFinal,
                            valorRepasse: plantaoFinal,
                            ajudaCusto: finalAjuda,
                            taxaAdm: taxaAdmFinal,
                            tipoDia: detailsTipoDia,
                            isCuringa: detailsCuringa,
                            observacao: detailsCuringa ? 'CURINGA' : (selectedShiftForDetails.observacao === 'CURINGA' ? '' : selectedShiftForDetails.observacao)
                          };

                          await updateAgendamento(updatedAg);
                          setSelectedShiftForDetails(updatedAg);
                          setIsEditingDetails(false);
                          alert('Plantão atualizado com sucesso!');
                        } catch (err) {
                          alert('Erro ao atualizar plantão.');
                        }
                      }}
                      className="flex-1 py-1.5 text-xs font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-all"
                    >
                      Salvar Mudanças
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Bypass logic for previous modal elements */}
      {false && avulsoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-150 overflow-hidden max-h-[90vh]">
            {/* Lados Esquerdo: Calendário Inline de Seleção */}
            <div className="p-4 md:w-1/2 flex flex-col justify-between bg-slate-50/50">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-sky-600" />
                    <span>Selecione os dias (Junho 2026)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAvulsoSelectedDates([])}
                    className="text-[10px] text-red-600 hover:underline font-bold"
                  >
                    Limpar Seleções ×
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Clique para marcar/desmarcar individualmente os dias avulsos que deseja programar na mesma escala:
                </p>

                {/* Sub grid de Junho 2026 */}
                <div className="grid grid-cols-7 gap-1 bg-white p-2 border border-slate-200 rounded-xl shadow-xs">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dw, i) => (
                    <div key={i} className="text-center font-extrabold text-[9px] text-slate-400 py-1">{dw}</div>
                  ))}
                  {/* Padding de Maio - Junho começa numa segunda-feira (1 dia de padding) */}
                  <div className="text-center text-[10px] text-slate-200 py-2 select-none font-mono">31</div>
                  
                  {Array.from({ length: 30 }).map((_, dVal) => {
                    const dayNum = dVal + 1;
                    const dateStr = `2026-06-${String(dayNum).padStart(2, '0')}`;
                    const isSelected = avulsoSelectedDates.includes(dateStr);
                    return (
                      <button
                        key={dayNum}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setAvulsoSelectedDates(avulsoSelectedDates.filter(x => x !== dateStr));
                          } else {
                            setAvulsoSelectedDates([...avulsoSelectedDates, dateStr]);
                          }
                        }}
                        className={`py-2 text-xs font-semibold rounded-lg font-mono transition-all border flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 text-white font-extrabold border-sky-700 shadow-sm scale-105'
                            : 'bg-white hover:bg-slate-50 text-slate-705 text-slate-800 border-slate-150'
                        }`}
                      >
                        {dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-sans">Turnos Selecionados ({avulsoSelectedDates.length})</span>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-1 bg-slate-100/50 rounded-lg">
                  {avulsoSelectedDates.length === 0 ? (
                    <span className="text-[10px] text-slate-400 italic font-sans p-1">Nenhum dia selecionado no grid.</span>
                  ) : (
                    avulsoSelectedDates.slice().sort().map(dt => (
                      <span key={dt} className="inline-flex items-center space-x-1 px-1.5 py-0.5 bg-sky-50 text-sky-850 text-[10px] font-bold border border-sky-150 rounded">
                        <span>{dt.split('-').reverse().slice(0, 2).join('/')}</span>
                        <button
                          type="button"
                          onClick={() => setAvulsoSelectedDates(avulsoSelectedDates.filter(x => x !== dt))}
                          className="text-red-500 font-extrabold ml-1 hover:text-red-750 font-sans cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Lados Direito: Configurações de Faturamento & Repasse */}
            <div className="p-5 md:w-1/2 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-black text-slate-850 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    <span>⚙️ Configuração do Plantão Avulso</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-none mt-1">Defina os parâmetros financeiros e o profissional.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 relative col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600">Alocar Profissional</label>
                    <input
                      type="text"
                      value={avulsoProf}
                      onFocus={() => setShowAvulsoProfDropdown(true)}
                      onBlur={() => setTimeout(() => setShowAvulsoProfDropdown(false), 200)}
                      onChange={(e) => setAvulsoProf(e.target.value)}
                      placeholder="Pesquisar..."
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 font-medium font-sans"
                    />
                    {showAvulsoProfDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-25 divide-y divide-slate-100 font-sans">
                        {profissionais.filter(p =>
                          (p.nome || '').toLowerCase().includes((avulsoProf || '').toLowerCase()) &&
                          p.status === 'Ativo'
                        ).map((prof) => (
                          <button
                            key={prof.id}
                            type="button"
                            onMouseDown={() => {
                              setAvulsoProf(prof.nome);
                              setShowAvulsoProfDropdown(false);
                            }}
                            className="w-full text-left p-2 hover:bg-slate-50 transition-colors text-xs font-bold text-slate-805"
                          >
                            {prof.nome} ({prof.especialidade})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600">Tipo de Escala / Plantão (Do Plano de Atendimento)</label>
                    <select
                      value={avulsoPlantaoOptionId}
                      onChange={(e) => setAvulsoPlantaoOptionId(e.target.value)}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 font-sans font-bold"
                    >
                      {availableShifts.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} — R$ {opt.valorPlantao.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="block text-[10px] font-bold text-sky-800">Tipo de Dia (Modificador de Feriado)</label>
                    <select
                      value={avulsoTipoDia}
                      onChange={(e) => setAvulsoTipoDia(e.target.value as any)}
                      className="w-full text-xs p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-sky-900 focus:outline-none focus:border-sky-500 font-sans font-bold"
                    >
                      <option value="Normal">Dia Normal (Sem Adicional)</option>
                      <option value="Feriado 20%">Feriado (+20% em Repasse e Faturamento)</option>
                      <option value="Feriado 50%">Feriado (+50% em Repasse e Faturamento)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">Horário de Início (Bloqueado)</label>
                    <input
                      type="text"
                      value={selectedAvulsoOpt?.horaInicio}
                      readOnly
                      disabled
                      className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 focus:outline-none font-sans cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">Configuração Escala (Bloqueado)</label>
                    <input
                      type="text"
                      value={selectedAvulsoOpt?.tipoEscala}
                      readOnly
                      disabled
                      className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 focus:outline-none font-sans cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">Repasse / Valor Plantão (Bloqueado)</label>
                    <input
                      type="text"
                      value={`R$ ${computedRepasse.toFixed(2)}${multiplier > 1.0 ? ` (+${Math.round((multiplier - 1) * 100)}%)` : ''}`}
                      readOnly
                      disabled
                      className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono font-bold cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500">Ajuda de Custo (Bloqueado)</label>
                    <input
                      type="text"
                      value={`R$ ${computedAjuda.toFixed(2)}`}
                      readOnly
                      disabled
                      className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-mono font-bold cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="block text-[10px] font-bold text-slate-500">Taxa Administrativa (Bloqueado)</label>
                    <input
                      type="text"
                      value={`R$ ${computedTaxa.toFixed(2)}${multiplier > 1.0 ? ` (+${Math.round((multiplier - 1) * 100)}%)` : ''}`}
                      readOnly
                      disabled
                      className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-705 text-slate-700 font-mono font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-600">Notas / Apontamentos Adicionais</label>
                  <textarea
                    value={avulsoObs}
                    onChange={(e) => setAvulsoObs(e.target.value)}
                    rows={2}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-sans focus:outline-none focus:border-sky-500"
                    placeholder="Quaisquer observações específicas sobre o plantão ou alocação do profissional..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-150 mt-4">
                <button
                  type="button"
                  onClick={() => setAvulsoModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleConfirmAvulso();
                    setAvulsoModalOpen(false);
                  }}
                  className="px-4.5 py-2 text-xs font-extrabold bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-color shadow-sm cursor-pointer"
                >
                  Salvar Avulso(s)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. MODELO / MODAL: DAR BAIXA (CONCLUIR PERÍODO) */}
      {concluirModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-xs font-black text-blue-900 bg-blue-50 px-3 py-1.5 border border-blue-200 rounded-lg uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Check size={14} className="text-blue-805" />
              <span>Dar Baixa no Período (Concluir Escala)</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Selecione o limite do período operacional para realizar o fechamento e congelamento de faturas e repasses:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Início:</label>
                <input
                  type="date"
                  value={concluirStartDate}
                  onChange={(e) => setConcluirStartDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Término:</label>
                <input
                  type="date"
                  value={concluirEndDate}
                  onChange={(e) => setConcluirEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl space-y-1.5">
              <p className="text-[10px] font-black uppercase text-indigo-900 flex items-center gap-1">
                <Lock size={12} />
                <span>Bloqueio de Integridade Fiscal:</span>
              </p>
              <p className="text-[10px] text-indigo-950 font-medium leading-relaxed font-sans">
                Ao completar, todos os plantões confirmados inseridos no período passam ao status <strong>fechado/congelado (🔒)</strong>. Qualquer tentativa posterior de edição operacional, sem prévia autorização da coordenadoria, será bloqueada de forma nativa.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">Confirmar com Assinatura Eletrônica de:</label>
              <select
                value={concluirConfirmarPor}
                onChange={(e) => setConcluirConfirmarPor(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-semibold"
              >
                <option value="Coordenador">Coordenador Geral Operacional</option>
                <option value="Diretor">Diretor Operacional Corporativo</option>
                <option value="Admin">Administrador Geral do Sistema</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConcluirModalOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-505 font-medium text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleConfirmConcluir();
                  setConcluirModalOpen(false);
                }}
                className="px-4.5 py-2 text-xs font-black bg-[#1E3A8A] hover:bg-blue-900 text-white rounded-lg transition-colors cursor-pointer"
              >
                Confirmar Conclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODELO / MODAL: REABRIR (DESFAZER BAIXA DO PERÍODO) */}
      {reabrirModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-xs font-black text-amber-900 bg-amber-50 px-3 py-1.5 border border-amber-200 rounded-lg uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <RotateCcw size={14} className="text-amber-805" />
              <span>Descongelar Escala (Reabrir Período)</span>
            </h3>

            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Libere a escala para correções financeiras, ajustes de plantão e inserções de atestados médicos retroativos:
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Início:</label>
                <input
                  type="date"
                  value={reabrirStartDate}
                  onChange={(e) => setReabrirStartDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-850 font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Data de Término:</label>
                <input
                  type="date"
                  value={reabrirEndDate}
                  onChange={(e) => setReabrirEndDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-850 font-mono"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl">
              <p className="text-[10px] font-bold text-amber-900 flex items-center gap-1 font-sans">
                <Unlock size={12} />
                <span>Auditoria de Reabertura Operacional:</span>
              </p>
              <p className="text-[10px] text-amber-950 font-medium leading-relaxed font-sans mt-1">
                Ao reabrir, todos os plantões contidos no período serão desbloqueados, permitindo edições. Um log com o responsável pelo desbloqueio será registrado permanentemente.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-705 text-slate-800">Responsável pelo Desbloqueio:</label>
              <select
                value={reabrirDesconfirmarPor}
                onChange={(e) => setReabrirDesconfirmarPor(e.target.value)}
                className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-semibold"
              >
                <option value="Coordenador">Coordenador Geral Operacional</option>
                <option value="Diretor">Diretor Operacional Corporativo</option>
                <option value="Admin">Administrador Geral de TI</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReabrirModalOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleConfirmReabrir();
                  setReabrirModalOpen(false);
                }}
                className="px-4.5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors cursor-pointer"
              >
                🔄 Reabrir Escala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODELO / MODAL: EXCLUSÃO DE ESCALA */}
      {excluirModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-xs font-black text-rose-900 bg-rose-50 px-3 py-1.5 border border-rose-250 rounded-lg uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <X size={14} className="text-rose-805" />
              <span>Remover Escala (Processamento de Exclusão)</span>
            </h3>

            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase">Filtrar Exclusão por Modelo:</label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 border rounded-lg font-sans">
                <button
                  type="button"
                  onClick={() => setExcluirPorType('periodo')}
                  className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    excluirPorType === 'periodo' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Período Completo
                </button>
                <button
                  type="button"
                  onClick={() => setExcluirPorType('datas')}
                  className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    excluirPorType === 'datas' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Única Data
                </button>
                <button
                  type="button"
                  onClick={() => setExcluirPorType('profissional')}
                  className={`py-1 text-[10px] font-bold rounded-md cursor-pointer transition-colors ${
                    excluirPorType === 'profissional' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Profissional
                </button>
              </div>
            </div>

            {(excluirPorType === 'periodo' || excluirPorType === 'profissional') && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in-15">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Data Início:</label>
                  <input
                    type="date"
                    value={excluirStartDate}
                    onChange={(e) => setExcluirStartDate(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">Data Término:</label>
                  <input
                    type="date"
                    value={excluirEndDate}
                    onChange={(e) => setExcluirEndDate(e.target.value)}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800"
                  />
                </div>
              </div>
            )}

            {excluirPorType === 'datas' && (
              <div className="space-y-1 animate-in fade-in-15">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Selecione uma Data Específica:</label>
                <input
                  type="date"
                  value={excluirStartDate}
                  onChange={(e) => {
                    setExcluirStartDate(e.target.value);
                    setExcluirEndDate(e.target.value);
                  }}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-mono text-slate-800"
                />
              </div>
            )}

            {excluirPorType === 'profissional' && (
              <div className="space-y-1 relative animate-in fade-in-15">
                <label className="block text-[10px] font-bold text-slate-505 text-slate-605 text-slate-500">Selecione o Profissional:</label>
                <input
                  type="text"
                  value={excluirProfName}
                  onFocus={() => setShowExcluirProfDropdown(true)}
                  onBlur={() => setTimeout(() => setShowExcluirProfDropdown(false), 200)}
                  onChange={(e) => setExcluirProfName(e.target.value)}
                  placeholder="Pesquisar por profissional..."
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-bold"
                />
                {showExcluirProfDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-205 border-slate-200 rounded-lg shadow-xl z-25 divide-y divide-slate-100 font-sans">
                    {profissionais.filter(p =>
                      (p.nome || '').toLowerCase().includes((excluirProfName || '').toLowerCase()) &&
                      p.status === 'Ativo'
                    ).map((prof) => (
                      <button
                        key={prof.id}
                        type="button"
                        onMouseDown={() => {
                          setExcluirProfName(prof.nome);
                          setShowExcluirProfDropdown(false);
                        }}
                        className="w-full text-left p-2 hover:bg-slate-50 transition-colors text-xs font-semibold text-slate-800"
                      >
                        {prof.nome}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl">
              <p className="text-[10px] text-rose-850 font-bold leading-relaxed font-sans">
                ⚠️ Apenas os plantões correspondentes que NÃO estão sob proteção (fechados/congelados 🔒) do faturamento fiscal serão removidos.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setExcluirModalOpen(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer font-sans"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmExcluir}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-750 text-white rounded-lg transition-colors cursor-pointer"
              >
                Apagar Escala(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODELO / MODAL: RELATÓRIO DO COORDENADOR & DA FAMÍLIA (IMPRIMIR) */}
      {imprimirModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-[92vh]">
            
            {/* Header com botões do Modal */}
            <div className="bg-slate-100 p-4 border-b border-slate-205 border-slate-200 flex items-center justify-between font-sans shadow-sm">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-teal-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Visualização de Relatório de Escala de {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} / {calendarYear}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <Printer size={13} className="mr-1" />
                  <span>Disparar Impressão Fisiológica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImprimirModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* O Papel Simulado para Assinatura (Imprimível) */}
            <div className="p-8 bg-white overflow-y-auto flex-1 font-sans " id="printable-area">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #printable-area, #printable-area * {
                    visibility: visible !important;
                  }
                  #printable-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    font-size: 11px !important;
                  }
                }
              `}</style>
              
              <div className="border-[3px] border-double border-slate-350 p-6 space-y-6">
                {/* Cabeçalho da Empresa */}
                <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                  <div>
                    <h1 className="text-lg font-black text-slate-905 text-slate-900 tracking-tight uppercase leading-none">RH CUIDADO DOMICILIAR LTDA.</h1>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">EMPRESA GESTORA DE SERVIÇOS DE ENFERMAGEM & HOME CARE</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Rua do Acolhimento, 1000 - Belo Horizonte, MG | Contato: (31) 3333-3333</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono block text-slate-500 font-bold uppercase">FECHAMENTO DE ESCALA MENSAL</span>
                    <span className="text-xs bg-slate-100 text-slate-800 border font-extrabold px-3 py-1 rounded-md mt-1 inline-block uppercase">
                      REF: {String(calendarMonth + 1).padStart(2, '0')} / {calendarYear}
                    </span>
                  </div>
                </div>

                {/* Bloco de Faturamento / Resumo Financeiro */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-450 text-slate-400 uppercase">Paciente Assistido:</span>
                    <p className="text-xs font-black text-slate-805 text-slate-800 truncate">{nome || paciente?.nome}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-450 text-slate-400 uppercase">CPF do Responsável:</span>
                    <p className="text-xs font-mono font-bold text-slate-805 text-slate-800">{cpf || '---'}</p>
                  </div>
                  <div className="space-y-0.5 col-span-1">
                    <span className="text-[9px] font-bold text-slate-450 text-slate-400 uppercase block">Logistica de Chegada:</span>
                    <p className="text-[10px] font-semibold text-slate-700 leading-none truncate">{logisticaChegada || 'Não explicitado'}</p>
                  </div>
                  <div className="space-y-0.5 text-right bg-slate-100/85 p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] font-black text-blue-700 uppercase leading-none block">Total de Turnos:</span>
                    <p className="text-sm font-black text-blue-900 font-mono mt-0.5">
                      {filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').length} Ativos
                    </p>
                  </div>
                </div>

                {/* Resumo Consolidado de Custos (Conforme regra Arquiteto) */}
                <div className="p-4 border border-blue-200 rounded-2xl bg-blue-50/20 text-left">
                  <span className="text-[9px] font-extrabold text-blue-800 uppercase tracking-widest block font-sans mb-2">📊 Demonstrativo Financeiro de Repasses & Taxas</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                      <span className="text-[8.5px] font-bold text-slate-400 block uppercase leading-none">Total Repasse Profissionais:</span>
                      <p className="text-sm font-bold text-slate-800 font-mono mt-1">
                        R$ {(() => {
                          let sum = 0;
                          filteredShiftsForPatient.forEach(s => {
                            if (s.status !== 'Cancelado') {
                              // Valor base + ajuda custo
                              let base = s.valorPlantao ?? paciente?.planoAtendimento?.valorSugeridoPlantao ?? 150;
                              let extra = s.ajudaCusto ?? paciente?.planoAtendimento?.ajudaCusto ?? 0;
                              if (s.feriado === '20%') {
                                sum += (base * 1.20) + extra;
                              } else if (s.feriado === '50%') {
                                sum += (base * 1.50) + extra;
                              } else {
                                sum += base + extra;
                              }
                            }
                          });
                          return sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </p>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-205 border-slate-200 rounded-xl shadow-xs">
                      <span className="text-[8.5px] font-bold text-slate-400 block uppercase leading-none">Total Faturamento Tx Adm:</span>
                      <p className="text-sm font-bold text-slate-800 font-mono mt-1">
                        R$ {(() => {
                          let sum = 0;
                          filteredShiftsForPatient.forEach(s => {
                            if (s.status !== 'Cancelado') {
                              let baseTaxa = s.taxaAdm ?? paciente?.planoAtendimento?.taxaAdm ?? 0;
                              if (s.feriado === '20%') {
                                sum += baseTaxa * 1.20;
                              } else if (s.feriado === '50%') {
                                sum += baseTaxa * 1.50;
                              } else {
                                sum += baseTaxa;
                              }
                            }
                          });
                          return sum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </p>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-xs sm:col-span-2 bg-gradient-to-br from-emerald-50/50 to-emerald-100 flex flex-col justify-center border-emerald-200">
                      <span className="text-[9px] font-black text-emerald-800 block uppercase leading-none">Valor Consolidado Líquido Estimado da Fatura (R$):</span>
                      <p className="text-base font-black text-emerald-900 font-mono mt-1">
                        R$ {(() => {
                          let sumRepasse = 0;
                          let sumTaxa = 0;
                          filteredShiftsForPatient.forEach(s => {
                            if (s.status !== 'Cancelado') {
                              let base = s.valorPlantao ?? paciente?.planoAtendimento?.valorSugeridoPlantao ?? 150;
                              let extra = s.ajudaCusto ?? paciente?.planoAtendimento?.ajudaCusto ?? 0;
                              let baseTaxa = s.taxaAdm ?? paciente?.planoAtendimento?.taxaAdm ?? 0;
                              if (s.feriado === '20%') {
                                sumRepasse += (base * 1.20) + extra;
                                sumTaxa += baseTaxa * 1.20;
                              } else if (s.feriado === '50%') {
                                sumRepasse += (base * 1.50) + extra;
                                sumTaxa += baseTaxa * 1.50;
                              } else {
                                sumRepasse += base + extra;
                                sumTaxa += baseTaxa;
                              }
                            }
                          });
                          const total = sumRepasse + sumTaxa;
                          return total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tabela de Plantões Completas */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest text-left">Turnos Auditados Realizados:</h3>
                  <table className="w-full text-left text-[10px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-400 text-slate-900 font-black uppercase text-[8.5px]">
                        <th className="py-2 px-2 border-r border-slate-300">Data & Semana</th>
                        <th className="py-2 px-2 border-r border-slate-300">Horário</th>
                        <th className="py-2 px-2 border-r border-slate-300">Profissional Cuidador Credenciado</th>
                        <th className="py-2 px-2 border-r border-slate-300">Feriado / Encargo</th>
                        <th className="py-2 px-2 border-r border-slate-300 text-right">Repasse Líquido</th>
                        <th className="py-2 px-2 text-right">Taxa Adm</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">Nenhum plantão ativo no período fechado.</td>
                        </tr>
                      ) : (
                        filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').map((item) => {
                          const base = item.valorPlantao ?? paciente?.planoAtendimento?.valorSugeridoPlantao ?? 150;
                          const extra = item.ajudaCusto ?? paciente?.planoAtendimento?.ajudaCusto ?? 0;
                          const baseTaxa = item.taxaAdm ?? paciente?.planoAtendimento?.taxaAdm ?? 0;
                          let repasseCalculado = base + extra;
                          let taxaCalculada = baseTaxa;
                          if (item.feriado === '20%') {
                            repasseCalculado = (base * 1.20) + extra;
                            taxaCalculada = baseTaxa * 1.20;
                          } else if (item.feriado === '50%') {
                            repasseCalculado = (base * 1.50) + extra;
                            taxaCalculada = baseTaxa * 1.50;
                          }
                          return (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors font-mono">
                              <td className="py-2 px-2 border-r border-slate-200 font-sans font-bold">
                                {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')} ({item.diaSemana})
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200">
                                {item.horaInicio || '08:00'} - {item.horaTermino || '20:00'}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200 font-sans font-semibold">
                                {item.profissional}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200 font-sans font-extrabold text-slate-500">
                                {item.feriado ? `Feriado (+${item.feriado})` : 'Normal (Sem Adicional)'}
                              </td>
                              <td className="py-2 px-2 border-r border-slate-200 text-right font-bold text-slate-800">
                                R$ {repasseCalculado.toFixed(2)}
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-slate-700">
                                R$ {taxaCalculada.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Disclaimer legal sobre a veracidade do relatório */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[9px] text-slate-504 leading-relaxed font-sans text-left">
                  Este relatório de escala mensal funciona como documento oficial de comprovação de serviço de cuidados de home care para repasses financeiros e prestação de contas fiscais. Atividades extras e ocorrências clínicas devem ser declaradas no diário de evolução impresso em conformidade com as exigências.
                </div>

                {/* Assinaturas */}
                <div className="grid grid-cols-2 gap-8 pt-8 text-[11px]">
                  <div className="space-y-4 text-center">
                    <p className="border-t border-slate-400 pt-1.5 font-bold uppercase font-sans text-slate-800">
                      Coordenadoria de RH Cuidado Domiciliar S.A.
                    </p>
                    <p className="text-[9px] text-slate-450 text-slate-400 leading-none">Representante Geral Legal Corporativo</p>
                  </div>
                  <div className="space-y-4 text-center">
                    <p className="border-t border-slate-400 pt-1.5 font-bold uppercase font-sans text-slate-850 text-slate-800">
                      Responsável / Família do Paciente:
                    </p>
                    <p className="text-[10px] font-semibold text-slate-650 truncate text-slate-700 leading-none">
                      {nomeResponsavel || '---'} (CPF: {cpf || '---'})
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer do dialog */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 text-right">
              <button
                type="button"
                onClick={() => setImprimirModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer font-sans"
              >
                Retornar ao Prontuário
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: EXPORTAR/IMPRIMIR PRONTUÁRIO CLÍNICO (PDF) */}
      {imprimirProntuarioModalOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4 overflow-y-auto print:absolute print:inset-0 print:p-0 print:h-auto print:overflow-visible print:bg-white print:z-[999999]">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden max-h-[92vh] print:p-0 print:max-h-none print:max-w-none print:w-full print:bg-white print:static print:shadow-none print:rounded-none print:overflow-visible">
            
            {/* Header com botões do Modal */}
            <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between font-sans shadow-sm print:hidden">
              <div className="flex items-center space-x-2">
                <Printer size={16} className="text-teal-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Exportar / Imprimir Prontuário Clínico Integrado
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center space-x-1 transition-all cursor-pointer"
                >
                  <Printer size={13} className="mr-1" />
                  <span>Imprimir PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImprimirProntuarioModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* O Papel Simulado para Assinatura (Imprimível) */}
            <div className="p-8 bg-white overflow-y-auto flex-1 font-sans print:p-0 print:overflow-visible" id="print-prontuario-area">
              <style>{`
                @media print {
                  * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                  }
                  body * {
                    visibility: hidden !important;
                  }
                  #print-prontuario-area, #print-prontuario-area * {
                    visibility: visible !important;
                  }
                  #print-prontuario-area {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 210mm !important;
                    max-width: 210mm !important;
                    min-height: 297mm !important;
                    margin: 0 !important;
                    padding: 15mm 15mm !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: white !important;
                    color: black !important;
                    z-index: 9999999 !important;
                    box-sizing: border-box !important;
                  }
                  .print\\:hidden {
                    display: none !important;
                  }
                }
              `}</style>
              
              <div className="border-[3px] border-double border-[#b8860b]/60 p-6 space-y-6 text-slate-800 text-left">
                {/* Cabeçalho de Identidade Visual da Empresa */}
                <div className="flex justify-between items-start border-b-2 border-[#b8860b] pb-4">
                  <div>
                    <h1 className="text-xl font-black text-[#1a3c2e] tracking-tight uppercase leading-none">RH CUIDADO DOMICILIAR</h1>
                    <p className="text-[10px] text-slate-500 font-mono mt-1">SISTEMA INTEGRADO DE GESTÃO DE SAÚDE & HOME CARE</p>
                    <p className="text-[9px] text-slate-400 mt-0.5">Gestão de Escalas, Prontuários Médicos e Repasses Financeiros</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono block text-slate-500 font-bold uppercase">PRONTUÁRIO INTEGRADO</span>
                    <span className="text-xs bg-[#1a3c2e] text-white font-extrabold px-3 py-1 rounded-md mt-1 inline-block uppercase tracking-wider">
                      CÓD: {paciente?.id ? paciente.id.substring(0, 8).toUpperCase() : 'NOVO'}
                    </span>
                  </div>
                </div>

                {/* Status do Paciente */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                  <div>
                    <span className="text-[9px] font-bold text-slate-450 uppercase block">Status do Prontuário:</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${pStatus === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <p className="text-xs font-black uppercase text-slate-800">
                        {pStatus === 'Ativo' ? 'ATIVADO - EM OPERAÇÃO' : 'INATIVO / DESATIVADO'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold text-slate-450 block uppercase">Impresso em:</span>
                    <span className="text-xs font-mono font-bold text-slate-750">{new Date().toLocaleString('pt-BR')}</span>
                  </div>
                </div>

                {/* Se inativo, exibir a justificativa do cancelamento de forma isolada e bem explicada */}
                {pStatus !== 'Ativo' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-left">
                    <h4 className="text-xs font-black text-red-900 uppercase">MOTIVO DA DESATIVAÇÃO DO PRONTUÁRIO</h4>
                    <p className="text-xs mt-1 text-red-800 font-mono">
                      <strong>Data de Desativação:</strong> {pDeactDate || 'Não disponível'}
                    </p>
                    <p className="text-xs mt-0.5 text-red-850 text-red-800">
                      <strong>Justificativa:</strong> {pDeactReason || 'Nenhuma justificativa formal e de segurança fornecida no sistema.'}
                    </p>
                  </div>
                )}

                {/* 1. DADOS DE IDENTIFICAÇÃO DO PACIENTE */}
                <div className="text-left">
                  <h3 className="text-xs font-black text-[#1a3c2e] uppercase border-b border-[#b8860b]/35 pb-1 mb-2 tracking-wider">1. Dados do Paciente e Identificação</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Nome Completo:</span>
                      <p className="font-extrabold text-slate-850 text-slate-800 mt-1">{nome || paciente?.nome || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">CPF:</span>
                      <p className="font-mono font-bold text-slate-750 mt-1">{cpf || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Data de Nascimento (Idade):</span>
                      <p className="font-semibold text-slate-750 mt-1">
                        {dataNascimento ? new Date(dataNascimento + 'T12:00:00').toLocaleDateString('pt-BR') : '---'} (
                        {(() => {
                          if (!dataNascimento) return '---';
                          try {
                            const today = new Date();
                            const birth = new Date(dataNascimento);
                            let age = today.getFullYear() - birth.getFullYear();
                            const m = today.getMonth() - birth.getMonth();
                            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
                              age--;
                            }
                            return age + ' anos';
                          } catch (e) {
                            return '---';
                          }
                        })()})
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">E-mail de Contato:</span>
                      <p className="font-medium text-slate-750 mt-1 truncate">{email || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Logística de Chegada ao Domicílio:</span>
                      <p className="font-medium text-slate-705 mt-1 leading-tight">{logisticaChegada || 'Nenhuma informada'}</p>
                    </div>
                  </div>
                </div>

                {/* 2. DADOS DO RESPONSÁVEL & FATURAMENTO */}
                <div className="text-left">
                  <h3 className="text-xs font-black text-[#1a3c2e] uppercase border-b border-[#b8860b]/35 pb-1 mb-2 tracking-wider">2. Responsável e Dados de Faturamento</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Nome do Representante Responsável:</span>
                      <p className="font-bold text-slate-800 mt-1">{nomeResponsavel || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Telefone de Contato do Representante:</span>
                      <p className="font-mono text-slate-756 text-slate-700 mt-1">{telefoneResponsavel || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none text-blue-700 font-extrabold">Responsável pelo Pagamento / Faturas:</span>
                      <p className="font-semibold text-slate-750 text-slate-800 mt-1">{responsavelPagamento}</p>
                    </div>
                    {responsavelPagamento === 'Outro Responsável' && (
                      <>
                        <div>
                          <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Nome Completo do Pagante:</span>
                          <p className="font-bold text-slate-800 mt-1">{nomePagador || '---'}</p>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">CPF do Pagante:</span>
                          <p className="font-mono text-slate-750 mt-1">{cpfPagador || '---'}</p>
                        </div>
                      </>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Via para Recebimento de Cobranças:</span>
                      <p className="font-semibold text-slate-750 mt-1">{opcaoEnvio}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">WhatsApp p/ Faturamento:</span>
                      <p className="font-mono text-slate-750 mt-1">{whatsappFaturamento || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">E-mail p/ Faturamento:</span>
                      <p className="font-medium text-slate-750 mt-1 truncate">{emailFaturamento || '---'}</p>
                    </div>
                  </div>
                </div>

                {/* 3. ENDEREÇO RESIDENCIAL */}
                <div className="text-left">
                  <h3 className="text-xs font-black text-[#1a3c2e] uppercase border-b border-[#b8860b]/35 pb-1 mb-2 tracking-wider">3. Endereço Residencial do Paciente</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-3 gap-x-4 text-xs">
                    <div className="col-span-2">
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Logradouro / Número / Complemento:</span>
                      <p className="font-bold text-slate-850 text-slate-800 mt-1">
                        {rua || '---'}{numero ? `, Nº ${numero}` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">CEP:</span>
                      <p className="font-mono font-bold text-slate-750 mt-1">{cep || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Bairro:</span>
                      <p className="font-black text-slate-750 mt-1">{bairro || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Cidade / Estado:</span>
                      <p className="font-bold text-slate-750 mt-1">
                        {cidade || '---'}{estado ? ` / ${estado}` : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. DADOS MÉDICOS & PRONTUÁRIO CLÍNICO */}
                <div className="text-left">
                  <h3 className="text-xs font-black text-[#1a3c2e] uppercase border-b border-[#b8860b]/35 pb-1 mb-2 tracking-wider">4. Prontuário Clínico & Informações de Saúde</h3>
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Grau de Dependência Informada:</span>
                        <p className="font-black text-slate-800 mt-1 bg-slate-100 px-2.5 py-1 border border-slate-200 rounded inline-block">
                          {grauDependencia || 'Médio'}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-red-600 block uppercase leading-none font-black">🚨 Alergias Relatadas:</span>
                        <p className={`font-black mt-1 px-2.5 py-1 rounded border inline-block ${alergias ? 'bg-red-50 text-red-700 border-red-200/60' : 'bg-green-50 text-green-800 border-green-200/60'}`}>
                          {alergias ? alergias.toUpperCase() : 'NENHUMA ALERGIA GRAVADA OU DETECTADA'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Anamnese / Diagnóstico Principal:</span>
                      <p className="font-semibold text-slate-800 mt-1 whitespace-pre-wrap rounded-lg bg-slate-50/50 p-2.5 border border-slate-200/60 leading-relaxed font-sans min-h-[35px]">
                        {diagnosticoPrincipal || 'Nenhum diagnóstico principal inserido.'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Comorbidades Associadas:</span>
                      <p className="font-medium text-slate-700 mt-1 whitespace-pre-wrap rounded-lg bg-slate-50/50 p-2.5 border border-slate-200/60 leading-relaxed min-h-[35px]">
                        {comorbidades || 'Nenhuma comorbidade relatada no sistema.'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Diretrizes / Cuidados Especiais:</span>
                      <p className="font-medium text-slate-700 mt-1 whitespace-pre-wrap rounded-lg bg-slate-50/50 p-2.5 border border-slate-200/60 leading-relaxed min-h-[35px]">
                        {observacoesClinicas || 'Nenhum cuidado especial extra relatado.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 5. PLANO EXTRA DE ATENDIMENTO (ADMINISTRATIVO E HOME CARE) */}
                <div className="text-left">
                  <h3 className="text-xs font-black text-[#1a3c2e] uppercase border-b border-[#b8860b]/35 pb-1 mb-2 tracking-wider">5. Plano de Atendimento & Parâmetros Financeiros</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-3 gap-x-4 text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Convênio Médico / Operadora:</span>
                      <p className="font-bold text-slate-800 mt-1">{paciente?.planoAtendimento?.convenio || 'Particular / Parceria Direta'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Matrícula do Beneficiário:</span>
                      <p className="font-mono font-bold text-slate-700 mt-1">{paciente?.planoAtendimento?.matricula || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Tipo da Escala Contratada:</span>
                      <p className="font-black text-slate-805 text-slate-800 mt-1">{tipoEscala || 12} Horas</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Hora de Início Padrão do Plantão:</span>
                      <p className="font-mono font-bold text-slate-705 text-slate-700 mt-1">{horaInicioPadrao || '07:00'}</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8.5px] font-bold text-slate-450 block uppercase leading-none">Valor Negociado p/ Plantão:</span>
                      <p className="font-bold text-slate-800 font-mono mt-0.5">R$ {valorSugeridoPlantao.toFixed(2)}</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8.5px] font-bold text-slate-450 block uppercase leading-none">Ajuda de Custo Profissional:</span>
                      <p className="font-bold text-slate-800 font-mono mt-0.5">R$ {ajudaCusto.toFixed(2)}</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8.5px] font-bold text-slate-450 block uppercase leading-none">Taxa Adm do Fechamento:</span>
                      <p className="font-bold text-[#1a3c2e] font-mono mt-0.5">R$ {taxaAdm.toFixed(2)}</p>
                    </div>
                    <div className="p-2 border border-emerald-200 rounded-lg bg-emerald-50/20">
                      <span className="text-[8.5px] font-black text-[#1a3c2e] block uppercase leading-none">Consolidado Total por Turno:</span>
                      <p className="font-extrabold text-[#1a3c2e] font-mono mt-0.5">R$ {(valorSugeridoPlantao + taxaAdm + ajudaCusto).toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Termo de Veracidade / Encerramento */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[9px] text-slate-400 leading-relaxed font-sans text-left mt-4">
                  O prontuário acima compreende dados confidenciais e de uso clínico estrito da coordenadoria do RH Cuidado Domiciliar Ltda. em conformidade com as diretivas do CFM (Conselho Federal de Medicina), COFEN e a Lei Geral de Proteção de Dados (LGPD). É de inteira obrigação das partes a confidencialidade e zelo no arquivamento deste registro impresso.
                </div>

                {/* Bloco de Assinaturas */}
                <div className="grid grid-cols-2 gap-8 pt-6 text-[10px]">
                  <div className="space-y-4 text-center">
                    <p className="border-t border-slate-400 pt-1.5 font-bold uppercase font-sans text-slate-800">
                      Responsável Clínico / Direção Médica
                    </p>
                    <p className="text-[8.5px] text-slate-400 leading-none font-mono">Conselho Profissional Ativo Autorizado</p>
                  </div>
                  <div className="space-y-4 text-center">
                    <p className="border-t border-slate-400 pt-1.5 font-bold uppercase font-sans text-slate-800">
                      Responsável pelo Paciente / Família
                    </p>
                    <p className="text-[9px] text-slate-500 leading-none">
                      {nomeResponsavel || '---'} (CPF: {cpf || '---'})
                    </p>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer do dialog */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 text-right print:hidden">
              <button
                type="button"
                onClick={() => setImprimirProntuarioModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-705 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer font-sans"
              >
                Retornar ao Prontuário
              </button>
            </div>

          </div>
        </div>
      )}

      {deleteRecordDialog?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-[#F8F5F0] w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 border border-red-100">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#1A3626] font-serif tracking-tight">
                {deleteRecordDialog.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {deleteRecordDialog.message}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteRecordDialog(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-full transition-all text-center cursor-pointer shadow-xs"
              >
                {deleteRecordDialog.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteRecordDialog.onConfirm();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setDeleteRecordDialog(null);
                  }
                }}
                className="flex-1 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-full transition-all text-center cursor-pointer shadow-md"
              >
                {deleteRecordDialog.confirmText || 'Confirmar e Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
