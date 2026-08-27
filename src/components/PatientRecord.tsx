/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { updateDoc, doc, getDoc, addDoc, collection, serverTimestamp, getDocs, query, where, deleteDoc, limit, writeBatch } from 'firebase/firestore';
import { fetchCep, fetchBanks, getHolidays } from '../lib/brasilApi';
import { Paciente, Plantao, CancelingReason, EscalacaoPlano, Agendamento } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { usePacienteData } from '../hooks/usePacienteData';
import { sanitizeClonedDocForHtml2Canvas, exportCanvasToA4PDF } from '../lib/html2canvasSanitizer';
import { ModalInserirDebito, DadosAtalhoCuringa } from './ModalInserirDebito';
import { CardBase, DataGrid, DataField, SoftBadge } from './ui/DesignSystem';
import { Logo } from './Logo';
import { pacienteSchema } from '../schemas/validationSchemas';
import { mascaraCPF, mascaraTelefone, mascaraCEP, mascaraMesAno, validarCPF, mascaraAltura, mascaraPeso, mascaraFinanceira, formatarMoeda, converterMascaraParaNumero } from '../lib/masks';
import {
  Save,
  Lock,
  Unlock,
  AlertOctagon,
  MapPin,
  Stethoscope,
  Clock,
  CalendarDays,
  User,
  ArrowLeft,
  X,
  Plus,
  PlusCircle,
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
  Info,
  History,
  Receipt,
  Copy,
  MessageSquare,
  Phone,
  Download,
  Calculator,
  DollarSign,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toast } from 'react-hot-toast';
import { showSuccessToast } from './CustomToast';
import { GlossyButton } from './GlossyButton';
import ExcelJS from 'exceljs';
import * as docx from 'docx';


// Helper to remove accents and lower case for better searching
const removerAcentos = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

// Helper to compute calendar positions matching the layout provided
const getDaysInMonthGrid = (monthIndex: number, year: number, customHolidays?: Record<string, string>) => {
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
      holiday: (customHolidays && customHolidays[fullDateStr]) ? customHolidays[fullDateStr] : labelHolidays[hKey],
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
      holiday: (customHolidays && customHolidays[fullDateStr]) ? customHolidays[fullDateStr] : labelHolidays[hKey],
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
      holiday: (customHolidays && customHolidays[fullDateStr]) ? customHolidays[fullDateStr] : labelHolidays[hKey],
    });
  }
  
  return gridCells;
};

export const getPlantaoCargaHoraria = (s: any): string => {
  if (!s) return '12h';
  const explicit = s.tipoEscala || s.cargaHoraria || s.duracao;
  if (explicit && typeof explicit === 'string') {
    if (explicit.includes('24h') || explicit.includes('24')) return '24h';
    if (explicit.includes('12h') || explicit.includes('12')) return '12h';
    if (explicit.includes('48h') || explicit.includes('48')) return '48h';
    if (explicit.includes('6h') || explicit.includes('6')) return '6h';
  }

  const horarioStr = s.horario || '';
  if (horarioStr.includes('24h')) return '24h';
  if (horarioStr.includes('12h')) return '12h';
  if (horarioStr.includes('48h')) return '48h';
  if (horarioStr.includes('6h')) return '6h';

  const timeMatch = horarioStr.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const startH = parseInt(timeMatch[1], 10);
    const startM = parseInt(timeMatch[2], 10);
    const endH = parseInt(timeMatch[3], 10);
    const endM = parseInt(timeMatch[4], 10);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes <= 0) {
      diffMinutes += 24 * 60;
    }

    const hours = Math.round(diffMinutes / 60);
    return `${hours}h`;
  }

  return '12h';
};

export const formatNomeComEspacos = (nome: any): string => {
  if (!nome || typeof nome !== 'string') return 'A Definir';
  return nome
    .replace(/([a-zà-ú0-9])([A-ZÀ-Ú])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim() || 'A Definir';
};

interface PatientRecordProps {
  paciente: Paciente | null; // null represents "Novo Paciente"
  onBack: () => void;
  onSelectPatient?: (paciente: Paciente) => void;
}

export const PatientRecord: React.FC<PatientRecordProps> = ({ paciente, onBack, onSelectPatient }) => {
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
    addAgendamentosBatch,
    updateAgendamento,
    updateAgendamentosBatch,
    deleteAgendamento,
    deleteAgendamentosBatch,
    userRole,
    logsAuditoria,
    faturasPacientes,
    servicosExtras,
    addAuditLog,
    addFaturaPaciente,
    addServicoExtra,
    deleteServicoExtra,
    isQuotaExceeded,
    isTestMode
  } = useFirebase();

  const lastLoadedPatientIdRef = useRef<string | null>(null);
  const hasInitializedPlanoTabRef = useRef<string | null>(null);

  const handleCopyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar para a área de transferência', err);
    }
  };

  const handleCopyShift = (ag: Agendamento, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCopiedShift(ag);
    setCopiedDayShifts(null);
    setCopiedSourceDate(ag.data);
    toast.success(`Plantão de ${ag.nomeProfissional} copiado!`);
  };

  const handlePasteClipboardToDate = async (targetDateStr: string) => {
    if (!clipboardAgendamento) {
      toast.error('Nenhum agendamento copiado para colar.');
      return;
    }

    const isTargetConcluded = isMesConcluido(targetDateStr);

    if (isTargetConcluded) {
      const [yr, mo] = targetDateStr.split('-');
      toast.error(`Esta escala de ${mo}/${yr} já está concluída.`);
      return;
    }

    try {
      const { id, data, ...rest } = clipboardAgendamento;

      // Check for conflicts: is the professional already assigned on this day for this patient?
      const conflict = agendamentos.find(
        (p) =>
          p.data === targetDateStr &&
          p.idProfissional === clipboardAgendamento.idProfissional &&
          p.status === 'Confirmado'
      );

      if (conflict) {
        toast.error(
          `Conflito: ${clipboardAgendamento.nomeProfissional} já tem plantão confirmado em ${targetDateStr.split('-').reverse().join('/')}`
        );
        return;
      }

      const payload: any = {
        ...rest,
        data: targetDateStr,
        status: clipboardAgendamento.status || 'Aberta',
        idPaciente: paciente?.id || rest.idPaciente
      };
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });
      await addAgendamentosBatch([payload]);

      toast.success('Agendamento colado com sucesso');
    } catch (error) {
      console.error('Erro ao colar agendamento:', error);
      toast.error('Erro ao colar agendamento');
    }
  };

  const handleCopyDay = (dateStr: string, dailyShifts: Agendamento[], e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (dailyShifts.length === 0) {
      toast.error('Nenhum plantão neste dia para copiar.');
      return;
    }
    setCopiedDayShifts(dailyShifts);
    setCopiedShift(null);
    setCopiedSourceDate(dateStr);
    toast.success(`${dailyShifts.length} plantão(ões) do dia ${dateStr.split('-').reverse().join('/')} copiado(s)!`);
  };

  const handlePasteToDate = async (targetDateStr: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (copiedSourceDate === targetDateStr) {
      toast.error('Não é possível colar no mesmo dia de origem.');
      return;
    }

    const isTargetConcluded = isMesConcluido(targetDateStr);

    if (isTargetConcluded) {
      const [yr, mo] = targetDateStr.split('-');
      toast.error(`Esta escala de ${mo}/${yr} já está concluída.`);
      return;
    }

    try {
      const payloads: any[] = [];

      if (copiedShift) {
        const { id, data, ...rest } = copiedShift;
        const payload: any = {
          ...rest,
          data: targetDateStr,
          status: 'Aberta',
          idPaciente: paciente?.id || rest.idPaciente
        };
        Object.keys(payload).forEach(key => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });
        payloads.push(payload);
      } else if (copiedDayShifts && copiedDayShifts.length > 0) {
        for (const shift of copiedDayShifts) {
          const { id, data, ...rest } = shift;
          const payload: any = {
            ...rest,
            data: targetDateStr,
            status: 'Aberta',
            idPaciente: paciente?.id || rest.idPaciente
          };
          Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
              delete payload[key];
            }
          });
          payloads.push(payload);
        }
      } else {
        toast.error('Nenhum plantão copiado.');
        return;
      }

      if (payloads.length > 0) {
        await addAgendamentosBatch(payloads);
        toast.success(`${payloads.length} plantão(ões) colado(s) com sucesso no dia ${targetDateStr.split('-').reverse().join('/')}!`);
      }
    } catch (err) {
      console.error('Erro ao colar plantão:', err);
      toast.error('Erro ao colar plantão');
    }
  };

  const isBlockedBidirectional = (prof: any) => {
    if (!paciente) return false;
    const patientId = paciente.id;
    if (prof.pacientesBloqueados && prof.pacientesBloqueados.includes(patientId)) {
      return true;
    }
    const profId = prof.id;
    if (paciente.profissionaisBloqueados && paciente.profissionaisBloqueados.includes(profId)) {
      return true;
    }
    return false;
  };

  // Basic layout tab states
  const [faturaParaBaixar, setFaturaParaBaixar] = useState<any | null>(null);
  const [empresaInfo, setEmpresaInfo] = useState<any>(null);
  const tempFaturaRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'geral' | 'endereco' | 'medico' | 'plano' | 'agendamento' | 'ocorrencias' | 'auditoria'>('geral');
  const [alertDeactivateOpen, setAlertDeactivateOpen] = useState(false);
  const [deactivateReasonInput, setDeactivateReasonInput] = useState('');
  const [deactivateConfirmInput, setDeactivateConfirmInput] = useState('');

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

  // Multi-date selection state for Novo Agendamento
  const [selectedDates, setSelectedDates] = useState<{ date: string; cycle: number }[]>([]);

  const handleDateClick = (formattedDate: string) => {
    if (isMesConcluido(formattedDate)) {
      const [yr, mo] = formattedDate.split('-');
      const formattedMonthYear = `${mo}/${yr}`;
      toast.error(`Esta escala de ${formattedMonthYear} já está concluída.`);
      return;
    }

    // Escuta do Tipo de Turno selecionado no formulário
    const selectedOpt = avulsoPlantaoOptionId === 'principal'
      ? { tipoEscala: tipoEscala || 'Diurno 12h' }
      : tiposPlantao.find(tp => tp.id === avulsoPlantaoOptionId);
    const is48h = selectedOpt?.tipoEscala?.includes('48h');

    if (is48h) {
      // Calcular o dia seguinte de forma segura usando JS nativo
      const d1 = new Date(formattedDate + 'T12:00:00');
      const d2 = new Date(d1);
      d2.setDate(d1.getDate() + 1);
      const formattedDate2 = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, '0')}-${String(d2.getDate()).padStart(2, '0')}`;

      if (isMesConcluido(formattedDate2)) {
        const [yr, mo] = formattedDate2.split('-');
        const formattedMonthYear = `${mo}/${yr}`;
        toast.error(`Esta escala de ${formattedMonthYear} já está concluída.`);
        return;
      }

      const isD1Selected = selectedDates.some(d => d.date === formattedDate);

      if (isD1Selected) {
        // Se já está selecionado, remove o par completo
        setSelectedDates(prev => prev.filter(d => d.date !== formattedDate && d.date !== formattedDate2));
      } else {
        // Se não está selecionado, adiciona ambas as datas (Dia 1 e Dia 2)
        setSelectedDates(prev => {
          const filtered = prev.filter(d => d.date !== formattedDate && d.date !== formattedDate2);
          return [
            ...filtered,
            { date: formattedDate, cycle: 1 },
            { date: formattedDate2, cycle: 2 }
          ];
        });
      }
    } else {
      // Turno normal (24h ou outro padrão): toggle padrão com cycle: 1
      const isSelected = selectedDates.some(d => d.date === formattedDate);
      if (isSelected) {
        setSelectedDates(prev => prev.filter(d => d.date !== formattedDate));
      } else {
        setSelectedDates(prev => [...prev, { date: formattedDate, cycle: 1 }]);
      }
    }
  };
  const [tempDate, setTempDate] = useState("");
  const [openedFrom, setOpenedFrom] = useState<'button' | 'calendar_cell'>('button');
  const [agnCalendarYear, setAgnCalendarYear] = useState(new Date().getFullYear());
  const [agnCalendarMonth, setAgnCalendarMonth] = useState(new Date().getMonth());

  // Detailed Shift Details / Edit / Delete Modal State
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<any>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Curinga shortcut modal state
  const [isCuringaShortcutModalOpen, setIsCuringaShortcutModalOpen] = useState(false);
  const [curingaShortcutData, setCuringaShortcutData] = useState<DadosAtalhoCuringa | null>(null);

  // Clipboard state for copying/pasting shifts
  const [copiedShift, setCopiedShift] = useState<Agendamento | null>(null);
  const [copiedDayShifts, setCopiedDayShifts] = useState<Agendamento[] | null>(null);
  const [copiedSourceDate, setCopiedSourceDate] = useState<string | null>(null);
  const [clipboardAgendamento, setClipboardAgendamento] = useState<Agendamento | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: 'day' | 'shift';
    targetDate?: string;
    targetShift?: Agendamento;
  } | null>(null);

  // Context Menu Global Click listener for closing on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [contextMenu]);
  const [deleteRecordDialog, setDeleteRecordDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);
  const [deleteRecordConfirmInput, setDeleteRecordConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Editable details form fields (synchronized when we enter edit mode):
  const [detailsProfName, setDetailsProfName] = useState('');
  const [detailsDate, setDetailsDate] = useState('');
  const [detailsPlantaoOptionId, setDetailsPlantaoOptionId] = useState<string>('principal');
  const [detailsCuringa, setDetailsCuringa] = useState(false);
  const [detailsTipoDia, setDetailsTipoDia] = useState<'Normal' | 'Feriado 20%' | 'Feriado 50%'>('Normal');
  const [showDetailsProfDropdown, setShowDetailsProfDropdown] = useState(false);
  const [considerarFalta, setConsiderarFalta] = useState<boolean>(false);
  const [motivoFalta, setMotivoFalta] = useState<string>('Não Informado');
  const [atendimentoRealizado, setAtendimentoRealizado] = useState<string>('Sim');
  const [detailsObservacao, setDetailsObservacao] = useState<string>('');

  // Shift Audit Inspector Modal state
  const [inspectedShiftJson, setInspectedShiftJson] = useState<any>(null);

  // States for patient occurrences (Ocorrências)
  const [ocData, setOcData] = useState(() => new Date().toISOString().split('T')[0]);
  const [ocProfId, setOcProfId] = useState('');
  const [ocDescricao, setOcDescricao] = useState('');
  const [ocBloquear, setOcBloquear] = useState(false);
  const [editingOcorrenciaId, setEditingOcorrenciaId] = useState<string | null>(null);
  const [savingOcorrencia, setSavingOcorrencia] = useState(false);
  const [deleteConfirmOc, setDeleteConfirmOc] = useState<any | null>(null);

  // Handlers for occurrences (Ocorrências)
  const handleSaveOcorrencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paciente) {
      toast.error('Salve o paciente antes de cadastrar uma ocorrência.');
      return;
    }
    const targetPatient = pacientes.find(p => p.id === paciente.id) || paciente;
    if (!targetPatient) {
      toast.error('Paciente correspondente não foi encontrado.');
      return;
    }

    if (!ocData) {
      toast.error('Selecione uma data para a ocorrência.');
      return;
    }
    if (!ocDescricao.trim()) {
      toast.error('Informe a descrição do motivo da ocorrência.');
      return;
    }

    const matchedProf = ocProfId ? profissionais.find(p => p.id === ocProfId) : null;
    const profName = matchedProf ? matchedProf.nome : 'Administrativa / Geral';

    setSavingOcorrencia(true);
    try {
      let currentOcs = [...(targetPatient.ocorrencias || [])];
      let updatedOcs = [];

      if (editingOcorrenciaId) {
        // Edit existing
        updatedOcs = currentOcs.map(oc => {
          if (oc.id === editingOcorrenciaId) {
            return {
              ...oc,
              data: ocData,
              profissionalId: ocProfId || '',
              profissionalNome: profName,
              descricao: ocDescricao,
              bloquearProfissional: ocProfId ? ocBloquear : false
            };
          }
          return oc;
        });
      } else {
        // Add new
        const newOc = {
          id: 'oc-' + Date.now().toString(),
          data: ocData,
          profissionalId: ocProfId || '',
          profissionalNome: profName,
          descricao: ocDescricao,
          bloquearProfissional: ocProfId ? ocBloquear : false
        };
        updatedOcs = [...currentOcs, newOc];
      }

      // Handle block array (profissionaisBloqueados)
      let blockedProfs = [...(targetPatient.profissionaisBloqueados || [])];
      if (ocProfId) {
        if (ocBloquear) {
          if (!blockedProfs.includes(ocProfId)) {
            blockedProfs.push(ocProfId);
          }
        } else {
          const otherBlocksCount = updatedOcs.filter(oc => oc.profissionalId === ocProfId && oc.bloquearProfissional).length;
          if (otherBlocksCount === 0) {
            blockedProfs = blockedProfs.filter(id => id !== ocProfId);
          }
        }
      }

      const updatedObj: Paciente = {
        ...targetPatient,
        ocorrencias: updatedOcs,
        profissionaisBloqueados: blockedProfs
      };

      await updatePaciente(updatedObj, true);
      if (onSelectPatient) {
        onSelectPatient(updatedObj);
      }
      if (userRole === 'Administrador' && paciente) {
        await addAuditLog(
          'UPDATE',
          'pacientes',
          paciente.id,
          editingOcorrenciaId
            ? `Administrador atualizou ocorrência para o paciente ${paciente.nome}`
            : `Administrador cadastrou nova ocorrência para o paciente ${paciente.nome}`
        );
      }
      
      // Clean up fields
      setOcData(new Date().toISOString().split('T')[0]);
      setOcProfId('');
      setOcDescricao('');
      setOcBloquear(false);
      setEditingOcorrenciaId(null);
      toast.success('Ocorrência salva com sucesso!', {
        icon: '✅',
      });
    } catch (err: any) {
      toast.error('Erro ao salvar ocorrência: ' + err.message);
    } finally {
      setSavingOcorrencia(false);
    }
  };

  const handleEditOcorrenciaClick = (oc: any) => {
    setEditingOcorrenciaId(oc.id);
    setOcData(oc.data);
    setOcProfId(oc.profissionalId);
    setOcDescricao(oc.descricao);
    setOcBloquear(oc.bloquearProfissional || false);
  };

  const handleDeleteOcorrencia = (oc: any) => {
    setDeleteConfirmOc(oc);
  };

  const handleConfirmDeleteOcorrencia = async () => {
    if (!paciente || !deleteConfirmOc || !deleteConfirmOc.id) return;
    const targetPatient = pacientes.find(p => p.id === paciente.id) || paciente;
    if (!targetPatient) return;

    try {
      let currentOcs = [...(targetPatient.ocorrencias || [])];
      const targetOc = currentOcs.find(oc => oc.id === deleteConfirmOc.id);
      if (!targetOc) return;

      const updatedOcs = currentOcs.filter(oc => oc.id !== deleteConfirmOc.id);

      // Handle block array (profissionaisBloqueados)
      let blockedProfs = [...(targetPatient.profissionaisBloqueados || [])];
      const otherBlocksCount = updatedOcs.filter(oc => oc.profissionalId === targetOc.profissionalId && oc.bloquearProfissional).length;
      if (otherBlocksCount === 0) {
        blockedProfs = blockedProfs.filter(id => id !== targetOc.profissionalId);
      }

      const updatedObj: Paciente = {
        ...targetPatient,
        ocorrencias: updatedOcs,
        profissionaisBloqueados: blockedProfs
      };

      await updatePaciente(updatedObj, true);
      if (onSelectPatient) {
        onSelectPatient(updatedObj);
      }
      if (userRole === 'Administrador' && paciente) {
        await addAuditLog('UPDATE', 'pacientes', paciente.id, `Administrador excluiu ocorrência do paciente ${paciente.nome}`);
      }
      toast.success('Ocorrência excluída com sucesso!', {
        icon: '✅',
      });
    } catch (err: any) {
      toast.error('Erro ao excluir ocorrência: ' + err.message);
    } finally {
      setDeleteConfirmOc(null);
    }
  };

  const handleBaixarOcorrenciasExcel = async () => {
    if (!paciente) {
      toast.error('Paciente não selecionado.');
      return;
    }
    const targetPatient = pacientes.find(p => p.id === paciente.id) || paciente;
    const targetOcs = targetPatient?.ocorrencias || [];

    if (targetOcs.length === 0) {
      toast.error('Nenhuma ocorrência registrada para este paciente para exportar.');
      return;
    }

    let empresaNome = 'RH Gestão Domiciliar';
    let empresaCnpj = '12.345.678/0001-99';
    let empresaEndereco = 'Rua Martins Ferreira, 71';
    try {
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.razaoSocial) empresaNome = data.razaoSocial;
        if (data.cnpj) empresaCnpj = data.cnpj;
        if (data.endereco) empresaEndereco = data.endereco;
      }
    } catch (err) {
      console.warn("Erro ao buscar dados da empresa para exportação, usando fallbacks:", err);
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ocorrências', {
        views: [{ showGridLines: true }]
      });

      worksheet.columns = [
        { key: 'A', width: 15 },
        { key: 'B', width: 25 },
        { key: 'C', width: 20 },
        { key: 'D', width: 50 }
      ];

      // Logo block: "RH"
      worksheet.mergeCells('A2:A4');
      const logoCell = worksheet.getCell('A2');
      logoCell.value = 'RH';
      logoCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      logoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A4231' }
      };

      // Company info
      const nameCell = worksheet.getCell('B2');
      nameCell.value = empresaNome;
      nameCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1A4231' } };

      const cnpjCell = worksheet.getCell('B3');
      cnpjCell.value = `CNPJ: ${empresaCnpj}`;
      cnpjCell.font = { name: 'Arial', size: 10, color: { argb: 'FF4B5563' } };

      const addressCell = worksheet.getCell('B4');
      addressCell.value = `Endereço: ${empresaEndereco}`;
      addressCell.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };

      // Report header on the right
      const titleCell = worksheet.getCell('D2');
      titleCell.value = 'RELATÓRIO DE OCORRÊNCIAS';
      titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF1A4231' } };
      titleCell.alignment = { horizontal: 'right' };

      const profInfoSub = worksheet.getCell('D3');
      profInfoSub.value = `Paciente: ${targetPatient.nome}`;
      profInfoSub.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } };
      profInfoSub.alignment = { horizontal: 'right' };

      const extraCell = worksheet.getCell('D4');
      extraCell.value = `CPF: ${targetPatient.cpf || '---'} | Cidade: ${targetPatient.endereco?.cidade || '---'}`;
      extraCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };
      extraCell.alignment = { horizontal: 'right' };

      // Separator line
      worksheet.getRow(5).height = 10;
      for (let c = 1; c <= 4; c++) {
        worksheet.getCell(5, c).border = {
          bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } }
        };
      }

      worksheet.getCell('A7').value = 'Total de Registros:';
      worksheet.getCell('B7').value = targetOcs.length;
      worksheet.getCell('A7').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF374151' } };
      worksheet.getCell('B7').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } };

      worksheet.getRow(8).height = 15;

      // Table Header (Row 10)
      const tableHeaderRow = worksheet.getRow(10);
      tableHeaderRow.height = 24;
      ['A10', 'B10', 'C10', 'D10'].forEach((cellRef, idx) => {
        const hCell = worksheet.getCell(cellRef);
        hCell.value = ['Data', 'Profissional', 'Status', 'Descrição do Motivo'][idx];
        hCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        hCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A4231' }
        };
        hCell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      let currentRow = 11;
      targetOcs.forEach((oc: any) => {
        worksheet.getCell(`A${currentRow}`).value = oc.data ? oc.data.split('-').reverse().join('/') : '-';
        worksheet.getCell(`B${currentRow}`).value = oc.profissionalNome || 'Administrativa / Geral';
        worksheet.getCell(`C${currentRow}`).value = oc.bloquearProfissional ? 'BLOQUEADO' : 'Registrado';
        worksheet.getCell(`D${currentRow}`).value = oc.descricao || '';

        ['A', 'B', 'C', 'D'].forEach(col => {
          const c = worksheet.getCell(`${col}${currentRow}`);
          c.font = { name: 'Arial', size: 10 };
          c.border = {
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        });
        currentRow++;
      });

      // Adjust column styles
      worksheet.columns.forEach(column => {
        let maxLen = 12;
        column?.eachCell?.({ includeEmpty: true }, cell => {
          const valStr = cell.value ? String(cell.value) : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        if (column) column.width = Math.min(maxLen + 4, 60);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = targetPatient.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `ocorrencias_paciente_${safeName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Histórico de Ocorrências exportado em Excel (.xlsx)!`);
    } catch (err) {
      console.error('Erro ao baixar excel:', err);
      toast.error('Erro ao gerar o arquivo Excel.');
    }
  };

  const handleBaixarOcorrenciasWord = async () => {
    if (!paciente) {
      toast.error('Paciente não selecionado.');
      return;
    }
    const targetPatient = pacientes.find(p => p.id === paciente.id) || paciente;
    const targetOcs = targetPatient?.ocorrencias || [];

    if (targetOcs.length === 0) {
      toast.error('Nenhuma ocorrência registrada para este paciente para exportar.');
      return;
    }

    let empresaNome = 'RH Gestão Domiciliar';
    let empresaCnpj = '12.345.678/0001-99';
    let empresaEndereco = 'Rua Martins Ferreira, 71';
    try {
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.razaoSocial) empresaNome = data.razaoSocial;
        if (data.cnpj) empresaCnpj = data.cnpj;
        if (data.endereco) empresaEndereco = data.endereco;
      }
    } catch (err) {
      console.warn("Erro ao buscar dados da empresa para exportação, usando fallbacks:", err);
    }

    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        AlignmentType,
        WidthType,
        BorderStyle
      } = docx;

      const formatarDataBR = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
          return dateStr.split('-').reverse().join('/');
        }
        return dateStr;
      };

      // Header Table of company
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 55, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: empresaNome, bold: true, size: 28, color: "1A4231", font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `CNPJ: ${empresaCnpj}`, size: 18, color: "555555", font: "Arial" })
                    ],
                    spacing: { before: 80 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Endereço: ${empresaEndereco}`, size: 18, color: "777777", font: "Arial" })
                    ],
                    spacing: { before: 80 }
                  })
                ]
              }),
              new TableCell({
                width: { size: 45, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "OCORRÊNCIAS", bold: true, size: 32, color: "1A4231", font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Paciente: ${targetPatient.nome}`, bold: true, size: 18, color: "111111", font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 80 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `CPF: ${targetPatient.cpf || '---'} | Cidade: ${targetPatient.endereco?.cidade || '---'}`, size: 16, color: "555555", font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 40 }
                  })
                ]
              })
            ]
          })
        ]
      });

      // Horizontal divider
      const separator = new Paragraph({
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: "D1D5DB" }
        }
      });

      // Stats block
      const statsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "F3F4F6" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "F3F4F6" }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { fill: "FAFAFA" },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Total de Registros Encontrados: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: String(targetOcs.length), size: 18, font: "Arial" })
                    ]
                  })
                ]
              })
            ]
          })
        ]
      });

      // Occurrences Header Table
      const listHeader = new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Data", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Profissional", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Descrição do Motivo", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          })
        ]
      });

      // Occurrences lists
      const tableBodyRows = targetOcs.map((oc: any) => {
        let statusText = oc.bloquearProfissional ? 'BLOQUEADO' : 'Registrado';

        return new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: formatarDataBR(oc.data || ''), size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: oc.profissionalNome || 'Administrativa / Geral', size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 20, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: statusText, size: 16, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: oc.descricao || '', size: 16, font: "Arial" })] })]
            })
          ]
        });
      });

      const listTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "1A4231" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "1A4231" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" }
        },
        rows: [listHeader, ...tableBodyRows]
      });

      // Build Document
      const docObj = new Document({
        sections: [{
          properties: {},
          children: [
            headerTable,
            separator,
            new Paragraph({ children: [new TextRun({ text: "ESTATÍSTICAS DA GESTÃO DE OCORRÊNCIAS", bold: true, size: 20, color: "1A4231", font: "Arial" })], spacing: { after: 120 } }),
            statsTable,
            new Paragraph({ text: "", spacing: { before: 180, after: 180 } }),
            new Paragraph({ children: [new TextRun({ text: "HISTÓRICO DETALHADO DE REGISTROS", bold: true, size: 20, color: "1A4231", font: "Arial" })], spacing: { after: 120 } }),
            listTable
          ]
        }]
      });

      const packerBlob = await Packer.toBlob(docObj);
      const url = URL.createObjectURL(packerBlob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = targetPatient.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `ocorrencias_paciente_${safeName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Histórico de Ocorrências exportado em Word (.docx)!`);
    } catch (err) {
      console.error('Erro ao baixar docx:', err);
      toast.error('Erro ao gerar o arquivo Word.');
    }
  };

  // Estado para Feriados e busca
  const [feriados, setFeriados] = useState<any[]>([]);
  useEffect(() => {
    getHolidays(new Date().getFullYear()).then(setFeriados);
  }, []);

  // Local state for Patient Forms
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [cpf, setCpf] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [telefoneResponsavel, setTelefoneResponsavel] = useState('');
  const [telefoneResponsavel2, setTelefoneResponsavel2] = useState('');
  const [showSecondPhone, setShowSecondPhone] = useState(false);
  const [parentescoResponsavel, setParentescoResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [telefonePaciente, setTelefonePaciente] = useState('');
  const [showPacientePhone, setShowPacientePhone] = useState(false);
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');
  const [bairro, setBairro] = useState('');

  // Dados de Faturamento e Pagamento
  const [responsavelPagamento, setResponsavelPagamento] = useState<'O próprio Paciente' | 'Outro Responsável'>('O próprio Paciente');
  const [nomePagador, setNomePagador] = useState('');
  const [cpfPagador, setCpfPagador] = useState('');
  const [opcaoEnvio, setOpcaoEnvio] = useState<'WhatsApp' | 'E-mail' | 'Ambos' | 'Somente fatura'>('WhatsApp');
  const [whatsappFaturamento, setWhatsappFaturamento] = useState('');
  const [dataReajuste, setDataReajuste] = useState('');

  // Endereço block
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [cep, setCep] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [logisticaChegada, setLogisticaChegada] = useState('');

  const handleCepBlur = async (cepValue: string) => {
    const rawCep = cepValue.replace(/\D/g, '');
    if (rawCep.length === 8) {
      try {
        const data = await fetchCep(rawCep);
        if (data && !data.errors) {
          setRua(data.street || rua);
          setBairro(data.neighborhood || bairro);
          setCidade(data.city || cidade);
          setEstado(data.state || estado);
        } else {
            toast.error("CEP não encontrado.");
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
      }
    }
  };

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
    valorTransporte,
    setValorTransporte,
    valorAlimentacao,
    setValorAlimentacao,
    taxaAdm,
    setTaxaAdm,
    tiposPlantao,
    setTiposPlantao,
    savePlanoAtendimento,
  } = usePacienteData(paciente?.id, paciente);

  // New States for attached Calendar Layout & Buttons
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<'lista' | 'calendario'>('calendario'); // default to visual calendar view
  const [isFaturaModalOpen, setIsFaturaModalOpen] = useState(false);
  const [isPreviaFinanceiraModalOpen, setIsPreviaFinanceiraModalOpen] = useState(false);
  const [isServicoExtraModalOpen, setIsServicoExtraModalOpen] = useState(false);
  const [servicoExtraDesc, setServicoExtraDesc] = useState('Visita de Enfermeira');
  const [servicoExtraCustomDesc, setServicoExtraCustomDesc] = useState('');
  const [servicoExtraData, setServicoExtraData] = useState(() => new Date().toISOString().slice(0, 10));
  const [servicoExtraValor, setServicoExtraValor] = useState('');
  const [isSavingServicoExtra, setIsSavingServicoExtra] = useState(false);

  const isMesConcluido = useCallback((dateStr?: string, targetPaciente?: Paciente | null): boolean => {
    const baseP = targetPaciente || paciente;
    if (!baseP || !dateStr) return false;
    const p = pacientes.find(item => item.id === baseP.id) || baseP;
    const parts = dateStr.split('-');
    if (parts.length < 2) return false;
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const keyMMSlashYYYY = `${month}/${year}`;
    const keyMMYYYY = `${month}-${year}`;
    const keyYYYYMM = `${year}-${month}`;

    if (p.mesesConcluidos && Array.isArray(p.mesesConcluidos)) {
      return (
        p.mesesConcluidos.includes(keyMMSlashYYYY) ||
        p.mesesConcluidos.includes(keyMMYYYY) ||
        p.mesesConcluidos.includes(keyYYYYMM)
      );
    }

    return false;
  }, [paciente, pacientes]);

  const isCurrentMonthConcluded = useMemo(() => {
    if (!paciente) return false;
    const monthStr = String(calendarMonth + 1).padStart(2, '0');
    const yearStr = String(calendarYear);
    return isMesConcluido(`${yearStr}-${monthStr}-01`, paciente);
  }, [paciente, calendarYear, calendarMonth, isMesConcluido]);

  // Local Audit Logs on-demand loader to avoid downloading the entire collection in real-time
  const [localAuditLogs, setLocalAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'auditoria' && paciente?.id) {
      setLoadingAuditLogs(true);
      if (isQuotaExceeded || isTestMode) {
        const list = logsAuditoria.filter(log => log.documentId === paciente.id);
        const sorted = [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLocalAuditLogs(sorted);
        setLoadingAuditLogs(false);
      } else {
        const q = query(
          collection(db, 'LogsAuditoria'),
          where('documentId', '==', paciente.id),
          limit(100)
        );
        getDocs(q).then((snap) => {
          if (!isMounted) return;
          const list: any[] = [];
          snap.forEach((d) => list.push({ ...d.data(), id: d.id }));
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setLocalAuditLogs(list);
        }).catch((err) => {
          console.error("Error loading patient audit logs on-demand:", err);
        }).finally(() => {
          if (isMounted) setLoadingAuditLogs(false);
        });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, paciente?.id, isQuotaExceeded, logsAuditoria]);

  // Dynamic holidays fetched from BrasilAPI + custom RJ municipal/state holidays
  const [brasilApiHolidays, setBrasilApiHolidays] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchHolidays = async () => {
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/feriados/v1/${calendarYear}`);
        if (!resp.ok) throw new Error("Erro ao carregar feriados");
        const data = await resp.json() as { date: string; name: string }[];
        
        const holidayMap: Record<string, string> = {};
        data.forEach((item) => {
          holidayMap[item.date] = item.name;
        });

        // Add Rio de Janeiro municipal and state holidays
        holidayMap[`${calendarYear}-01-20`] = "São Sebastião (Municipal RJ)";
        holidayMap[`${calendarYear}-04-23`] = "São Jorge (Estadual RJ)";

        if (isMounted) {
          setBrasilApiHolidays(holidayMap);
        }
      } catch (err) {
        console.error("Erro carregando BrasilAPI feriados:", err);
        // Fallback
        const holidayMap: Record<string, string> = {
          [`${calendarYear}-01-01`]: "Confraternização Universal",
          [`${calendarYear}-01-20`]: "São Sebastião (Municipal RJ)",
          [`${calendarYear}-04-21`]: "Tiradentes",
          [`${calendarYear}-04-23`]: "São Jorge (Estadual RJ)",
          [`${calendarYear}-05-01`]: "Dia do Trabalho",
          [`${calendarYear}-09-07`]: "Independência do Brasil",
          [`${calendarYear}-10-12`]: "Nossa Senhora Aparecida",
          [`${calendarYear}-11-02`]: "Finados",
          [`${calendarYear}-11-15`]: "Proclamação da República",
          [`${calendarYear}-11-20`]: "Dia Nacional de Zumbi e da Consciência Negra",
          [`${calendarYear}-12-25`]: "Natal",
        };
        if (isMounted) {
          setBrasilApiHolidays(holidayMap);
        }
      }
    };
    fetchHolidays();
    return () => {
      isMounted = false;
    };
  }, [calendarYear]);
  
  // Modals
  const [avulsoModalOpen, setAvulsoModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [concluirModalOpen, setConcluirModalOpen] = useState(false);
  const [reabrirModalOpen, setReabrirModalOpen] = useState(false);
  const [excluirModalOpen, setExcluirModalOpen] = useState(false);
  const [imprimirModalOpen, setImprimirModalOpen] = useState(false);
  const [imprimirProntuarioModalOpen, setImprimirProntuarioModalOpen] = useState(false);
  const [isGeneratingProntuarioPNG, setIsGeneratingProntuarioPNG] = useState(false);

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

  const getFirstDayCurrentMonth = () => {
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    return `${yr}-${mo}-01`;
  };

  const getLastDayCurrentMonth = () => {
    const today = new Date();
    const yr = today.getFullYear();
    const lastDay = new Date(yr, today.getMonth() + 1, 0).getDate();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const dy = String(lastDay).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  // Modal Fields - Concluir (Dar Baixa no Período)
  const [concluirStartDate, setConcluirStartDate] = useState(getFirstDayCurrentMonth);
  const [concluirEndDate, setConcluirEndDate] = useState(getLastDayCurrentMonth);
  const [concluirConfirmarPor, setConcluirConfirmarPor] = useState('Coordenador');

  // Modal Fields - Reabrir (Desfazer Baixa do Período)
  const [reabrirStartDate, setReabrirStartDate] = useState(getFirstDayCurrentMonth);
  const [reabrirEndDate, setReabrirEndDate] = useState(getLastDayCurrentMonth);
  const [reabrirDesconfirmarPor, setReabrirDesconfirmarPor] = useState('Coordenador');

  // Modal Fields - Excluir (Remover Período)
  const [excluirStartDate, setExcluirStartDate] = useState(getFirstDayCurrentMonth);
  const [excluirEndDate, setExcluirEndDate] = useState(getLastDayCurrentMonth);
  const [excluirPorType, setExcluirPorType] = useState<'datas' | 'profissional' | 'periodo'>('periodo');
  const [excluirProfName, setExcluirProfName] = useState('');
  const [selectedExcluirProfs, setSelectedExcluirProfs] = useState<string[]>([]);
  const [showExcluirProfDropdown, setShowExcluirProfDropdown] = useState(false);

  // Profissionais agendados no período selecionado para a exclusão
  const profsAgendadosNoPeriodo = useMemo(() => {
    if (!paciente) return [];
    const ags = agendamentos.filter(
      (a) => a.idPaciente === paciente.id && a.data >= excluirStartDate && a.data <= excluirEndDate
    );
    const countMap = new Map<string, number>();
    ags.forEach((a) => {
      const name = (a.nomeProfissional || '').trim();
      if (name) {
        countMap.set(name, (countMap.get(name) || 0) + 1);
      }
    });
    return Array.from(countMap.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [agendamentos, paciente, excluirStartDate, excluirEndDate]);

  // States for adding a new plantão type inline to the list
  const [newSubTipoEscala, setNewSubTipoEscala] = useState<string>('Diurno 12h');
  const [newSubHoraInicio, setNewSubHoraInicio] = useState<string>('07:00');
  const [newSubValorPlantao, setNewSubValorPlantao] = useState<string>('150,00');
  const [newSubAjudaCusto, setNewSubAjudaCusto] = useState<string>('0,00');
  const [newSubValorTransporte, setNewSubValorTransporte] = useState<string>('0,00');
  const [newSubValorAlimentacao, setNewSubValorAlimentacao] = useState<string>('0,00');
  const [newSubTaxaAdm, setNewSubTaxaAdm] = useState<string>('0,00');
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [showExtraForm, setShowExtraForm] = useState<boolean>(false);

  // Status simulation
  const [isNew, setIsNew] = useState(true);
  const [pStatus, setPStatus] = useState<'Ativo' | 'Desativado'>('Ativo');
  const [pDeactDate, setPDeactDate] = useState<string | null>(null);
  const [pDeactReason, setPDeactReason] = useState<string | null>(null);

  // Load patient details into state
  useEffect(() => {
    if (paciente) {
      if (lastLoadedPatientIdRef.current === paciente.id) {
        return;
      }
      lastLoadedPatientIdRef.current = paciente.id;
      setIsNew(false);
      setNome(paciente.nome);
      setDataNascimento(paciente.dataNascimento);
      setCpf(paciente.cpf);
      setNomeResponsavel(paciente.nomeResponsavel);
      setTelefoneResponsavel(paciente.telefoneResponsavel);
      setTelefoneResponsavel2(paciente.telefoneResponsavel2 || '');
      setShowSecondPhone(!!paciente.telefoneResponsavel2);
      setParentescoResponsavel(paciente.parentescoResponsavel || '');
      setEmail(paciente.email || '');
      setTelefonePaciente(paciente.telefone || '');
      setShowPacientePhone(!!paciente.telefone);
      setAltura(paciente.altura || '');
      setPeso(paciente.peso || '');
      setBairro(paciente.bairro || paciente.endereco.bairro);

      // Dados de Faturamento e Pagamento
      setResponsavelPagamento(paciente.dadosPagamento?.responsavelPagamento || 'O próprio Paciente');
      setNomePagador(paciente.dadosPagamento?.nomePagador || '');
      setCpfPagador(paciente.dadosPagamento?.cpfPagador || '');
      setOpcaoEnvio(paciente.dadosPagamento?.opcaoEnvio || 'WhatsApp');
      setWhatsappFaturamento(mascaraTelefone(paciente.dadosPagamento?.whatsappFaturamento || ''));
      setDataReajuste(paciente.dadosPagamento?.dataReajuste || '');

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
      setValorSugeridoPlantao(formatarMoeda(paciente.planoAtendimento?.valorSugeridoPlantao || 150));
      setAjudaCusto(formatarMoeda(paciente.planoAtendimento?.ajudaCusto || 0));
      setValorTransporte(formatarMoeda(paciente.planoAtendimento?.valorTransporte ?? paciente.planoAtendimento?.ajudaCusto ?? 0));
      setValorAlimentacao(formatarMoeda(paciente.planoAtendimento?.valorAlimentacao ?? 0));
      setTaxaAdm(formatarMoeda(paciente.planoAtendimento?.taxaAdm || 0));
      setTiposPlantao(paciente.planoAtendimento?.tiposPlantao || []);
      
      const val = paciente.planoAtendimento?.valorSugeridoPlantao || 150;
      setNewShiftValor(val);
      setNewShiftRepasse(val * 0.70);

      setPStatus(paciente.status);
      setPDeactDate(paciente.desativadoEm || null);
      setPDeactReason(paciente.desativadoMotivo || null);
    } else {
      if (lastLoadedPatientIdRef.current === null) {
        return;
      }
      lastLoadedPatientIdRef.current = null;
      console.log("[PatientRecord] isNew set to true");
      setIsNew(true);
      setNome('');
      setDataNascimento('1960-01-01');
      setCpf('');
      setNomeResponsavel('');
      setTelefoneResponsavel('');
      setEmail('');
      setAltura('');
      setPeso('');
      setBairro('');

      // Clean Dados de Faturamento e Pagamento
      setResponsavelPagamento('O próprio Paciente');
      setNomePagador('');
      setCpfPagador('');
      setOpcaoEnvio('WhatsApp');
      setWhatsappFaturamento('');

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
      setValorSugeridoPlantao(formatarMoeda(150));
      setAjudaCusto(formatarMoeda(0));
      setValorTransporte(formatarMoeda(0));
      setValorAlimentacao(formatarMoeda(0));
      setTaxaAdm(formatarMoeda(0));
      setTiposPlantao([]);

      setPStatus('Ativo');
      setPDeactDate(null);
      setPDeactReason(null);
    }
  }, [paciente]);

  // Carregamento Inicial (useEffect) do Firestore na montagem da sub-aba 'Plano de Atendimento'
  useEffect(() => {
    if (activeTab === 'plano' && paciente) {
      if (hasInitializedPlanoTabRef.current === paciente.id) {
        return;
      }
      const found = pacientes.find(p => p.id === paciente.id) || paciente;
      if (found && found.planoAtendimento) {
        hasInitializedPlanoTabRef.current = paciente.id;
        setTipoEscala(found.planoAtendimento.tipoEscala || 'Diurno 12h');
        setHoraInicioPadrao(found.planoAtendimento.horaInicioPadrao || '07:00');
        setValorSugeridoPlantao(formatarMoeda(found.planoAtendimento.valorSugeridoPlantao ?? 150));
        setAjudaCusto(formatarMoeda(found.planoAtendimento.ajudaCusto ?? 0));
        setValorTransporte(formatarMoeda(found.planoAtendimento.valorTransporte ?? found.planoAtendimento.ajudaCusto ?? 0));
        setValorAlimentacao(formatarMoeda(found.planoAtendimento.valorAlimentacao ?? 0));
        setTaxaAdm(formatarMoeda(found.planoAtendimento.taxaAdm ?? 0));
        setTiposPlantao(found.planoAtendimento.tiposPlantao || []);
      }
    } else if (activeTab !== 'plano') {
      hasInitializedPlanoTabRef.current = null;
    }
  }, [activeTab, paciente, pacientes, setTipoEscala, setHoraInicioPadrao, setValorSugeridoPlantao, setAjudaCusto, setTaxaAdm, setTiposPlantao]);

  // Is patient currently deactivated?
  const isCurrentlyDeactivated = pStatus === 'Desativado';
  const isColaborador = userRole?.toLowerCase() === 'colaborador';

  // Guard for 'plano' tab - redirect and show alert/error if a colaborador tries to access it
  useEffect(() => {
    if (activeTab === 'plano' && isColaborador) {
      toast.error('Acesso Negado: Usuários com perfil Colaborador não possuem permissão para acessar o Plano de Atendimento.');
      setActiveTab('geral');
    }
  }, [activeTab, isColaborador]);

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
      valorPlantao: converterMascaraParaNumero(valorSugeridoPlantao),
      ajudaCusto: converterMascaraParaNumero(ajudaCusto),
      taxaAdm: converterMascaraParaNumero(taxaAdm),
      isPrincipal: true,
    },
    ...tiposPlantao.map((tp) => ({
      ...tp,
      isPrincipal: false,
    })),
  ];

  // Handle Form Save
  const handleSave = async (e: React.FormEvent) => {
    console.log("handleSave chamado", { isNew, paciente });
    e.preventDefault();
    if (isCurrentlyDeactivated) {
      console.log("isCurrentlyDeactivated é verdadeiro, retornando");
      return;
    }

    const cleanCpfVal = (cpf || '').replace(/\D/g, '');
    const validation = pacienteSchema.safeParse({
      nome,
      cpf: cleanCpfVal,
      nomeResponsavel,
      telefoneResponsavel,
      telefoneResponsavel2: showSecondPhone ? telefoneResponsavel2 : undefined,
      parentescoResponsavel,
      telefone: showPacientePhone ? telefonePaciente : undefined
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    if (!validarCPF(cleanCpfVal)) {
      toast.error('O CPF do paciente é inválido. Por favor, verifique os dígitos verificadores.');
      return;
    }

    // Trava de Duplicidade Cruzada de CPF (Anti-Duplicação)
    const formattedCpfVal = mascaraCPF(cleanCpfVal);
    const cpfOptions = [cleanCpfVal, formattedCpfVal].filter(Boolean);

    try {
      const duplicatePac = pacientes.find(p => p.cpf && cpfOptions.includes(p.cpf) && (isNew || p.id !== paciente?.id));
      if (duplicatePac) {
        toast.error('Falha no cadastro: Este CPF já se encontra registrado em nosso sistema.');
        return;
      }

      const duplicateProf = profissionais.find(p => p.cpf && cpfOptions.includes(p.cpf));
      if (duplicateProf) {
        toast.error('Falha no cadastro: Este CPF já se encontra registrado em nosso sistema.');
        return;
      }
    } catch (dbErr: any) {
      console.error("Erro ao verificar duplicidade de CPF:", dbErr);
    }

    // Validation for Billing Details
    if (responsavelPagamento === 'Outro Responsável') {
      if (!nomePagador.trim() || !cpfPagador.trim()) {
        toast.error('Por favor, preencha os dados obrigatórios do Responsável pelo Pagamento (Nome Completo e CPF do Pagador).');
        return;
      }
      const cleanCpfPagVal = (cpfPagador || '').replace(/\D/g, '');
      if (!validarCPF(cleanCpfPagVal)) {
        toast.error('O CPF do pagador é inválido. Por favor, verifique os dígitos verificadores.');
        return;
      }
    }

    if (opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') {
      if (!whatsappFaturamento.trim()) {
        toast.error('Por favor, preencha o WhatsApp para Faturamento.');
        return;
      }
    }

    if (opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') {
      if (!email.trim()) {
        toast.error('Por favor, preencha o E-mail para Envio.');
        return;
      }
    }

    const patientPayload: Omit<Paciente, 'id' | 'createdAt' | 'status'> = {
      nome,
      dataNascimento,
      cpf,
      nomeResponsavel,
      telefoneResponsavel,
      telefoneResponsavel2: showSecondPhone ? telefoneResponsavel2 : '',
      parentescoResponsavel,
      email,
      telefone: showPacientePhone ? telefonePaciente : '',
      altura,
      peso,
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
        ...(paciente?.planoAtendimento || {}),
        tipoEscala,
        horaInicioPadrao,
        valorSugeridoPlantao: valorSugeridoPlantao === '' ? '' : converterMascaraParaNumero(valorSugeridoPlantao),
        ajudaCusto: ajudaCusto === '' ? '' : converterMascaraParaNumero(ajudaCusto),
        valorTransporte: valorTransporte === '' ? '' : converterMascaraParaNumero(valorTransporte),
        valorAlimentacao: valorAlimentacao === '' ? '' : converterMascaraParaNumero(valorAlimentacao),
        taxaAdm: taxaAdm === '' ? '' : converterMascaraParaNumero(taxaAdm),
        tiposPlantao,
      },
      dadosPagamento: {
        responsavelPagamento,
        nomePagador: responsavelPagamento === 'Outro Responsável' ? nomePagador : '',
        cpfPagador: responsavelPagamento === 'Outro Responsável' ? cpfPagador : '',
        opcaoEnvio,
        whatsappFaturamento: (opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') ? whatsappFaturamento : '',
        emailFaturamento: (opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') ? email : '',
        dataReajuste,
      },
    };

    try {
      console.log("Tentando salvar paciente", { isNew, patientPayload });
      if (isNew) {
        console.log("Chamando addPaciente");
        const result = await addPaciente(patientPayload, true);
        if (userRole === 'Administrador') {
          await addAuditLog('CREATE', 'pacientes', result.id, `Administrador cadastrou o prontuário do paciente ${result.nome}`);
        }
        showSuccessToast(`Paciente ${result.nome} cadastrado com sucesso!`, 'Cadastro de Paciente');
        if (onSelectPatient) {
          onSelectPatient(result);
        }
      } else if (paciente) {
        console.log("Chamando updatePaciente", paciente.id);
        const updatedObj: Paciente = {
          ...paciente,
          ...patientPayload,
          status: pStatus,
          desativadoEm: pDeactDate,
          desativadoMotivo: pDeactReason,
        };
        await updatePaciente(updatedObj, true);
        if (userRole === 'Administrador') {
          await addAuditLog('UPDATE', 'pacientes', paciente.id, `Administrador atualizou o prontuário do paciente ${updatedObj.nome}`);
        }
        showSuccessToast(`Prontuário do paciente ${updatedObj.nome} atualizado com sucesso!`, 'Cadastro Atualizado');
        if (onSelectPatient) {
          onSelectPatient(updatedObj);
        }
      } else {
        console.warn("Nem novo nem paciente existente?");
      }
    } catch (err: any) {
      console.error('Erro ao tentar salvar o prontuário:', err);
      toast.error('Erro ao tentar salvar o prontuário: ' + err.message);
    }
  };

  // Local handler to compile and save Plano de Atendimento reference values to Firestore as base rates
  const handleSavePlanoAtendimento = async () => {
    if (isCurrentlyDeactivated) return;
    if (userRole?.toLowerCase() === 'colaborador') {
      toast.error('Acesso Negado: Usuários com perfil Colaborador não possuem permissão para alterar o Plano de Atendimento.');
      return;
    }
    if (!paciente?.id) {
      toast.error('Erro: ID do paciente não fornecido. Por favor, salve primeiro o formulário geral do paciente.');
      return;
    }

    if (valorSugeridoPlantao === '' || valorTransporte === '' || valorAlimentacao === '' || taxaAdm === '') {
      toast.error('Erro de Validação: Ajuste os valores do Plano de Atendimento. Os campos "Valor do Plantão", "Transporte", "Alimentação" e "Taxa Adm" não podem ficar vazios / em branco.');
      return;
    }

    try {
      const current = pacientes.find(p => p.id === paciente.id) || paciente;
      if (!current) {
        throw new Error('Paciente não encontrado no Firestore.');
      }

      const updatedObj: Paciente = {
        ...current,
        planoAtendimento: {
          tipoEscala,
          horaInicioPadrao,
          valorSugeridoPlantao: converterMascaraParaNumero(valorSugeridoPlantao),
          ajudaCusto: converterMascaraParaNumero(valorTransporte) + converterMascaraParaNumero(valorAlimentacao),
          valorTransporte: converterMascaraParaNumero(valorTransporte),
          valorAlimentacao: converterMascaraParaNumero(valorAlimentacao),
          taxaAdm: converterMascaraParaNumero(taxaAdm),
          tiposPlantao,
        },
      };

      await updatePaciente(updatedObj, true);
      if (onSelectPatient) {
        onSelectPatient(updatedObj);
      }
      if (userRole === 'Administrador') {
        await addAuditLog('UPDATE', 'pacientes', paciente.id, `Administrador atualizou o Plano de Atendimento do paciente ${paciente.nome}`);
      }
      toast.success('Plano de Atendimento e referências base salvas com sucesso!', {
        icon: '✅',
      });
    } catch (error: any) {
      toast.error('Erro ao persistir plano de Atendimento: ' + error.message);
    }
  };

  // New Handler for deleting a single shift
  const handleDeleteAgendamento = (id: string) => {
    setDeleteRecordConfirmInput('');
    setDeleteRecordDialog({
      isOpen: true,
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir permanentemente este agendamento? Esta ação removerá o plantão de forma definitiva.',
      confirmText: 'Confirmar e Excluir',
      cancelText: 'Voltar',
      onConfirm: async () => {
        try {
          await deleteAgendamento(id);
          toast.success('Agendamento excluído com sucesso!', {
            icon: '✅',
          });
        } catch (error) {
          console.error("Erro ao deletar agendamento:", error);
          toast.error('Erro ao excluir agendamento. Verifique o console.');
        }
      }
    });
  };

  // Function to delete or clear a configuration/mode of shift (either Principal or Additional) from Plano de Atendimento
  const handleDeletePlantao = (id: string, isPrincipal: boolean) => {
    if (userRole?.toLowerCase() === 'colaborador') {
      toast.error('Acesso Negado: Usuários com perfil Colaborador não possuem permissão para realizar alterações no Plano de Atendimento.');
      return;
    }
    if (!paciente?.id) {
      toast.error('Erro: ID do paciente não localizado. Por favor, salve primeiro os dados gerais do paciente.');
      return;
    }

    setDeleteRecordConfirmInput('');
    setDeleteRecordDialog({
      isOpen: true,
      title: 'Remover Configuração de Plantão',
      message: 'Tem certeza que deseja excluir as configurações deste tipo de plantão? Esta ação também salvará as alterações no banco de dados.',
      confirmText: 'Confirmar e Remover',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          const current = pacientes.find(p => p.id === paciente.id) || paciente;
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

          // 4. Persistencia no Firebase (Firestore) com updatePaciente
          const updatedObj = {
            ...current,
            planoAtendimento: updatedPlano,
          };
          try {
            await updatePaciente(updatedObj, true);
            if (onSelectPatient) {
              onSelectPatient(updatedObj);
            }
          } catch (firestoreErr) {
            handleFirestoreError(firestoreErr, OperationType.UPDATE, `pacientes/${paciente.id}`);
          }
          
          // Also reset editing state if the deleted additional shift was being edited
          if (!isPrincipal && editingSubId === id) {
            setEditingSubId(null);
            setNewSubValorPlantao('150,00');
            setNewSubAjudaCusto('0,00');
            setNewSubTaxaAdm('0,00');
          }
        } catch (error: any) {
          console.error("Erro ao deletar configuracao:", error);
          toast.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  // Turn off / Deactivate patient
  const handleDeactivateConfirm = async () => {
    if (!deactivateReasonInput.trim()) {
      toast.error('Obrigatório preencher a justificativa da desativação do paciente.');
      return;
    }
    if (deactivateConfirmInput.trim().toUpperCase() !== 'CONFIRMAR') {
      toast.error("Por favor, digite 'CONFIRMAR' para confirmar a ação.");
      return;
    }
    if (paciente) {
      try {
        await deactivatePaciente(paciente.id, deactivateReasonInput.trim());
        setPStatus('Desativado');
        const todayStr = new Date().toLocaleDateString('pt-BR');
        setPDeactDate(todayStr);
        setPDeactReason(deactivateReasonInput.trim());
        setAlertDeactivateOpen(false);
        setDeactivateReasonInput('');
        setDeactivateConfirmInput('');
        toast.success('Paciente desativado no sistema.', {
          icon: '✅',
        });
      } catch (err: any) {
        console.error("Erro ao desativar paciente:", err);
        toast.error("Erro ao desativar paciente: " + (err?.message || 'Falha ao salvar.'));
      }
    }
  };

  // Reactivate Patient
  const handleReactivate = async () => {
    if (paciente) {
      await reactivatePaciente(paciente.id);
      setPStatus('Ativo');
      setPDeactDate(null);
      setPDeactReason(null);
      toast.success('Paciente reativado com sucesso!', {
        icon: '✅',
      });
    }
  };

  // Helper for parsing currency strings or numbers safely
  const parseNum = (val: any, fallback = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const num = converterMascaraParaNumero(val);
    return isNaN(num) ? fallback : num;
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
      toast.error('Você precisa primeiro salvar o cadastro do paciente para adicionar plantões na escala.');
      return;
    }
    if (!newShiftProf || newShiftProf.trim() === '') {
      toast.error('Por favor, selecione um profissional para o agendamento.');
      return;
    }

    const pickedProf = profissionais.find(p => p.nome === newShiftProf);
    if (pickedProf && isBlockedBidirectional(pickedProf)) {
      toast.error('Atenção: Este profissional possui uma restrição de atendimento (bloqueio) para este paciente devido a uma ocorrência passada.');
      return;
    }

    try {
      const datesToSchedule = newShiftDatesList.length > 0 ? newShiftDatesList : [newShiftDate];
      
      const { plantaoFinal, taxaAdmFinal, ajudaCusto: finalAjuda } = calculateShiftValues(
        newShiftValor,
        converterMascaraParaNumero(taxaAdm),
        converterMascaraParaNumero(ajudaCusto),
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
      toast.success(datesToSchedule.length > 1 ? `${datesToSchedule.length} plantões agendados com sucesso!` : 'Plantão agendado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao agendar plantão.');
      console.error(err);
    }
  };

  // Cancel shift modal confirmation triggers
  const handleTriggerCancelClick = (shiftId: string) => {
    const originalShift = agendamentos.find((pl) => pl.id === shiftId);
    if (originalShift && originalShift.status === 'Concluido') {
      toast.error('Atenção: Este agendamento está CONCLUÍDO (congelado) e não pode ser cancelado ou alterado. Reabra a escala primeiro!');
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
      toast.success('Agendamento cancelado com sucesso.');
    }
  };

  // NEW HANDLERS FOR ADVANCED SCHEDULER: Avulso, Concluir, Reabrir, Exclusão

  const handleSalvarAgendamento = async () => {
    setIsSaving(true);
    try {
      if (!paciente) {
        toast.error('Erro: Paciente não identificado.');
        setIsSaving(false);
        return false;
      }

      if (!selectedDates || selectedDates.length === 0) {
        toast.error('Por favor, preencha o campo obrigatório: Datas no calendário.');
        setIsSaving(false);
        return false;
      }

      // Action 3: Validação Inteligente no Agendamento por mês/ano das datas escolhidas
      for (const item of selectedDates) {
        if (isMesConcluido(item.date)) {
          const [yr, mo] = item.date.split('-');
          const formattedMonthYear = `${mo}/${yr}`;
          toast.error(`Esta escala de ${formattedMonthYear} já está concluída.`);
          setIsSaving(false);
          return false;
        }
      }

      if (!avulsoProf || avulsoProf.trim() === '') {
        toast.error('Por favor, preencha o campo obrigatório: Profissional.');
        return false;
      }

      if (!selectedDates || selectedDates.length === 0) {
        toast.error('Por favor, preencha o campo obrigatório: Datas no calendário.');
        return false;
      }

      if (!avulsoPlantaoOptionId || avulsoPlantaoOptionId.trim() === '') {
        toast.error('Por favor, preencha o campo obrigatório: Horário / Turno.');
        return false;
      }

      const pickedProf = profissionais.find(p => p.nome === avulsoProf);
      if (pickedProf && isBlockedBidirectional(pickedProf)) {
        toast.error('Atenção: Este profissional possui uma restrição de atendimento (bloqueio) para este paciente devido a uma ocorrência passada.');
        return false;
      }

      const shiftsList = [
        {
          id: 'principal',
          tipoEscala: tipoEscala || 'Diurno 12h',
          horaInicio: horaInicioPadrao || '07:00',
          valorPlantao: parseNum(valorSugeridoPlantao, 150),
          ajudaCusto: parseNum(ajudaCusto, 0),
          valorTransporte: parseNum(valorTransporte, 0),
          valorAlimentacao: parseNum(valorAlimentacao, 0),
          taxaAdm: parseNum(taxaAdm, 0),
        },
        ...tiposPlantao.map((tp) => ({
          id: tp.id,
          tipoEscala: tp.tipoEscala,
          horaInicio: tp.horaInicio,
          valorPlantao: parseNum(tp.valorPlantao, 150),
          ajudaCusto: parseNum(tp.ajudaCusto, 0),
          valorTransporte: parseNum(tp.valorTransporte ?? tp.ajudaCusto, 0),
          valorAlimentacao: parseNum(tp.valorAlimentacao, 0),
          taxaAdm: parseNum(tp.taxaAdm, 0),
        })),
      ];

      const chosenOpt = shiftsList.find((s) => s.id === avulsoPlantaoOptionId) || shiftsList[0];

      const baseRepasseValue = chosenOpt.valorPlantao;
      const baseTransporte = chosenOpt.valorTransporte || 0;
      const baseAlimentacao = chosenOpt.valorAlimentacao || 0;
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

      // Criar agendamento individual para cada data selecionada
      const payloads: any[] = [];
      let activeParentId = '';

      for (const curItem of selectedDates) {
        const curData = curItem.date;
        const curCycle = curItem.cycle || 1;

        const is48h = chosenTipoEscalaStr.toLowerCase().includes('48h');
        if (is48h) {
          if (curCycle === 1) {
            activeParentId = `pai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          }
        } else {
          activeParentId = '';
        }

        // Apply our dynamic business logic for 48h and Normal shifts
        let dayTransporte = baseTransporte;
        let dayAlimentacao = baseAlimentacao;

        if (is48h && curCycle === 2) {
          dayTransporte = 0; // O valor de transporte é rigorosamente ignorado/zerado no Dia 2
        }

        const dayAjudaCusto = dayTransporte + dayAlimentacao;

        const { plantaoFinal, taxaAdmFinal, ajudaCusto: finalAjuda } = calculateShiftValues(
          baseRepasseValue,
          baseTaxaValue,
          dayAjudaCusto,
          isFeriado
        );

        // Check for conflicts
        const conflict = agendamentos.find(p => p.data === curData && p.nomeProfissional === avulsoProf && p.status === 'Confirmado');
        if (conflict) {
          if (!window.confirm(`⚠️ Atenção: ${avulsoProf} já está escalado em outro plantão nesta data (${curData}). Tem certeza que deseja confirmar este agendamento simultâneo para essa data?`)) {
            continue; // Pula essa data se o usuário não confirmar
          }
        }

        payloads.push({
          idPaciente: paciente.id,
          idProfissional: pickedProf ? pickedProf.id : 'n/a',
          nomeProfissional: avulsoProf,
          data: curData,
          horario: `${chosenHoraInicio}-${getTerminoTime(chosenHoraInicio, durationHrs)}`,
          valorPlantao: plantaoFinal,
          valorRepasse: plantaoFinal,
          ajudaCusto: finalAjuda,
          valorTransporte: dayTransporte,
          valorAlimentacao: dayAlimentacao,
          taxaAdm: taxaAdmFinal,
          status: 'Confirmado',
          observacao: avulsoObs || (avulsoCuringa ? 'CURINGA' : ''),
          tipoDia: avulsoTipoDia as 'Normal' | 'Feriado 20%' | 'Feriado 50%',
          isCuringa: avulsoCuringa,
          ciclo: curCycle,
          idAgendamentoPai: activeParentId || null
        });
      }

      if (payloads.length > 0) {
        await addAgendamentosBatch(payloads);
      }

      const totalQuantity = payloads.length;
      setAvulsoProf('');
      setAvulsoPlantaoOptionId('principal');
      setAvulsoTipoDia('Normal');
      setAvulsoObs('');
      setAvulsoCuringa(false);
      
      // 3. Atualização de Estado (UX) - limpar selectedDates e fechar modal
      setSelectedDates([]);
      setAvulsoModalOpen(false);

      // Real-time Firebase listener handles calendar update automatically, but we also log it for clarity.
      console.log("Sucesso: Real-time listener do Firebase atualiza os dados do calendário automaticamente.");

      // 2. Feedback Visual (Toasts) - Sucesso
      showSuccessToast(
        totalQuantity > 1 ? `${totalQuantity} plantões agendados em lote com sucesso!` : 'Agendamento de plantão salvo com sucesso!',
        'Agendamento Realizado'
      );
      return true;
    } catch (err: any) {
      // 2. Feedback Visual (Toasts) - Erro
      const errorMessage = err?.message || String(err);
      console.error('Erro ao salvar agendamento:', err);
      toast.error(`Erro ao salvar: ${errorMessage}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmConcluir = async () => {
    const currentP = pacientes.find(p => p.id === paciente?.id) || paciente;
    if (!currentP) return;
    if (!concluirStartDate || !concluirEndDate) {
      toast.error('Defina o início e o fim do período.');
      return;
    }

    const [yr, mo] = concluirStartDate.split('-');
    const formattedMo = mo.padStart(2, '0');
    const mesAnoKey = `${formattedMo}/${yr}`; // Formato estrito e padronizado MM/YYYY (ex: '08/2026')

    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === currentP.id);
    const matches = agendamentosPaciente.filter(
      (s) => s.data >= concluirStartDate && s.data <= concluirEndDate && s.status !== 'Concluido' && s.status !== 'Cancelado'
    );

    console.log(`Tentando concluir agendamentos do paciente ${currentP.id} de ${concluirStartDate} a ${concluirEndDate}.`);
    console.log(`Total de agendamentos no período: ${agendamentosPaciente.filter(s => s.data >= concluirStartDate && s.data <= concluirEndDate).length}`);
    console.log(`Agendamentos filtrados (ativos): ${matches.length}`);

    const toastId = toast.loading('Processando conclusão...');

    try {
      if (matches.length > 0) {
        await updateAgendamentosBatch(
          matches.map(s => ({
            id: s.id,
            status: 'Concluido',
            escalaCongelada: true
          }))
        );
      }

      // Adiciona o mês/ano padronizado (MM/YYYY) ao array mesesConcluidos do paciente
      const currentMeses = currentP.mesesConcluidos || [];
      if (!currentMeses.includes(mesAnoKey)) {
        const updatedMeses = [...currentMeses, mesAnoKey];
        await updatePaciente({
          ...currentP,
          mesesConcluidos: updatedMeses
        }, true);
      }

      setConcluirModalOpen(false);
      toast.success(`Escala de ${mesAnoKey} Concluída com sucesso!`, { id: toastId });
    } catch (err: any) {
      console.error("Erro ao processar batch de conclusão:", err);
      toast.error('Erro ao congelar escala: ' + (err.message || String(err)), { id: toastId });
    }
  };

  const handleGerarFatura = async () => {
    if (!paciente) return;

    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const agendamentosPacienteMes = agendamentos.filter(
      (a) => a.idPaciente === paciente?.id && a.data && a.data.startsWith(monthPrefix)
    );

    if (agendamentosPacienteMes.length === 0) {
      toast.error('Não há plantões agendados para este paciente no mês selecionado.');
      return;
    }

    // 1. Trava de Segurança desativada para permitir geração direta de fatura
    const temAtivosNaoConcluidos = false;

    const mesDaEscalaAtual = monthPrefix;

    try {
      // 2. Verificação Real de Duplicidade (Estado + Firestore)
      const faturaExistenteLocal = faturasPacientes.some(
        (f) => (f.pacienteId === paciente.id || (f as any).idPaciente === paciente.id) && f.mesReferencia === mesDaEscalaAtual
      );

      if (faturaExistenteLocal) {
        toast.error('Emissão bloqueada: A fatura de ' + mesDaEscalaAtual + ' para este paciente já foi emitida.');
        return;
      }

      if (!isQuotaExceeded && !isTestMode) {
        try {
          const faturasColl = collection(db, 'faturas_pacientes');
          const qDuplicidade1 = query(faturasColl, where('pacienteId', '==', paciente.id), where('mesReferencia', '==', mesDaEscalaAtual));
          const qDuplicidade2 = query(faturasColl, where('idPaciente', '==', paciente.id), where('mesReferencia', '==', mesDaEscalaAtual));
          const [snap1, snap2] = await Promise.all([getDocs(qDuplicidade1), getDocs(qDuplicidade2)]);
          if (!snap1.empty || !snap2.empty) {
            toast.error('Emissão bloqueada: A fatura de ' + mesDaEscalaAtual + ' para este paciente já foi emitida.');
            return;
          }
        } catch (e: any) {
          if (e?.code === 'resource-exhausted' || (e?.message && e.message.includes('Quota'))) {
            console.warn("Quota excedida na verificação de duplicidade de fatura. Prosseguindo com checagem local.");
          }
        }
      }

      // 3. Consolidação e Integração com "Histórico Financeiro" (Firestore)
      const plantoesValidos = agendamentosPacienteMes.filter((s: any) => {
        if (s.considerarFalta || s.status === 'falta' || s.status === 'Falta' || s.status === 'Cancelado' || s.status === 'cancelado') {
          return false;
        }
        let base = parseNum(s.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
        let extra = parseNum(s.ajudaCusto) || parseNum(paciente?.planoAtendimento?.ajudaCusto, 0);
        let baseTaxa = parseNum(s.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
        let mult = 1.0;
        if (s.tipoDia === 'Feriado 20%') mult = 1.2;
        else if (s.tipoDia === 'Feriado 50%') mult = 1.5;
        const val = (base * mult) + (baseTaxa * mult) + extra;
        return val > 0;
      });

      const valorTotalPlantoes = plantoesValidos.reduce((acc: number, s: any) => {
        let base = parseNum(s.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
        let extra = parseNum(s.ajudaCusto) || parseNum(paciente?.planoAtendimento?.ajudaCusto, 0);
        let baseTaxa = parseNum(s.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
        let mult = 1.0;
        if (s.tipoDia === 'Feriado 20%') mult = 1.2;
        else if (s.tipoDia === 'Feriado 50%') mult = 1.5;
        return acc + (base * mult) + (baseTaxa * mult) + extra;
      }, 0);

      const servicosExtrasDoMes = (servicosExtras || []).filter(
        (s) => (s.idPaciente === paciente.id || (s as any).pacienteId === paciente.id) &&
               (s.data?.startsWith(mesDaEscalaAtual) || s.mesReferencia === mesDaEscalaAtual)
      );
      const somaServicosExtras = servicosExtrasDoMes.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
      const valorTotalFatura = valorTotalPlantoes + somaServicosExtras;

      const nomePaciente = nome || paciente?.nome || 'Não definido';
      const numFatSuffix = Math.floor(1000 + Math.random() * 9000);
      const numeroFatura = `FAT-${calendarYear}${String(calendarMonth + 1).padStart(2, '0')}-${numFatSuffix}`;

      await addFaturaPaciente({
        idPaciente: paciente.id,
        pacienteId: paciente.id,
        pacienteNome: nomePaciente,
        nomePaciente: nomePaciente,
        numeroFatura: numeroFatura,
        mesReferencia: mesDaEscalaAtual,
        valorTotalFatura: valorTotalFatura,
        valorTotal: valorTotalFatura,
        dataEmissao: new Date().toISOString(),
        dataEmissaoTimestamp: isQuotaExceeded ? new Date().toISOString() : serverTimestamp(),
        statusPagamento: 'Pendente',
        status: 'Aberta',
        periodoApurado: { 
          inicio: `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`, 
          fim: `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(new Date(calendarYear, calendarMonth + 1, 0).getDate()).padStart(2, '0')}` 
        },
        servicosExtras: servicosExtrasDoMes.map(s => ({
          id: s.id,
          idPaciente: s.idPaciente,
          descricao: s.descricao,
          data: s.data,
          valor: Number(s.valor)
        })),
        plantoesCongelados: agendamentosPacienteMes.map(a => ({
          id: a.id,
          data: a.data || '',
          horario: a.horario || '',
          valorPlantao: a.valorPlantao || 0,
          valorRepasse: a.valorRepasse || 0,
          status: a.status || '',
          profissional: formatNomeComEspacos(a.nomeProfissional),
          nomeProfissional: formatNomeComEspacos(a.nomeProfissional),
          taxaAdm: a.taxaAdm || 0,
          ajudaCusto: a.ajudaCusto || 0,
          tipoDia: a.tipoDia || ''
        }))
      } as any);

      // Atualizar status dos agendamentos para 'Faturada'
      await updateAgendamentosBatch(
        agendamentosPacienteMes.map(a => ({
          id: a.id,
          status: 'Faturada'
        }))
      );

      // 4. Feedback Real para o Usuário
      showSuccessToast('Fatura gerada com sucesso e integrada ao Histórico Financeiro!', 'Fatura Gerada');
      setIsFaturaModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao gerar fatura:', error);
      if (error?.message?.includes('Quota') || error?.code === 'resource-exhausted') {
        toast.error('Limite de cota excedido. A fatura foi salva localmente no modo de contingência.');
        setIsFaturaModalOpen(false);
      } else {
        toast.error('Erro ao gerar a fatura. Tente novamente.');
      }
    }
  };

  const handleSaveServicoExtra = async () => {
    const desc = servicoExtraDesc === 'Outros' ? servicoExtraCustomDesc.trim() : servicoExtraDesc.trim();
    const val = parseFloat(String(servicoExtraValor).replace(',', '.'));
    if (!desc) {
      toast.error('Informe a descrição do serviço extra.');
      return;
    }
    if (!servicoExtraData) {
      toast.error('Informe a data do serviço extra.');
      return;
    }
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    if (!paciente?.id) {
      toast.error('Paciente não selecionado.');
      return;
    }

    setIsSavingServicoExtra(true);
    try {
      const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
      await addServicoExtra({
        idPaciente: paciente.id,
        descricao: desc,
        data: servicoExtraData,
        valor: val,
        mesReferencia: monthPrefix,
      });
      toast.success('Serviço extra lançado com sucesso!');
      setServicoExtraDesc('Visita de Enfermeira');
      setServicoExtraCustomDesc('');
      setServicoExtraValor('');
      setIsServicoExtraModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar serviço extra:', err);
      toast.error('Erro ao salvar serviço extra.');
    } finally {
      setIsSavingServicoExtra(false);
    }
  };

  const handleConfirmReabrir = async () => {
    const currentP = pacientes.find(p => p.id === paciente?.id) || paciente;
    if (!currentP) return;
    if (!reabrirStartDate || !reabrirEndDate) {
      toast.error('Defina o início e o fim do período.');
      return;
    }

    const [yr, mo] = reabrirStartDate.split('-');
    const formattedMo = mo.padStart(2, '0');
    const keyMMSlashYYYY = `${formattedMo}/${yr}`; // MM/YYYY (ex: '08/2026')
    const keyMMYYYY = `${formattedMo}-${yr}`;     // MM-YYYY (ex: '08-2026')
    const keyYYYYMM = `${yr}-${formattedMo}`;     // YYYY-MM (ex: '2026-08')

    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === currentP.id);
    const matches = agendamentosPaciente.filter(
      (s) => s.data >= reabrirStartDate && s.data <= reabrirEndDate && (s.status === 'Concluido' || s.escalaCongelada)
    );

    console.log(`Tentando reabrir agendamentos do paciente ${currentP.id} de ${reabrirStartDate} a ${reabrirEndDate}.`);
    console.log(`Agendamentos filtrados (concluídos/congelados): ${matches.length}`);

    const toastId = toast.loading('Processando reabertura da escala...');

    try {
      if (matches.length > 0) {
        await updateAgendamentosBatch(
          matches.map(s => ({
            id: s.id,
            status: 'Aberta',
            escalaCongelada: false
          }))
        );
      }

      // Remove todas as variações da chave do mês de dentro do array mesesConcluidos no banco de dados
      const currentMeses = currentP.mesesConcluidos || [];
      const updatedMeses = currentMeses.filter(m => m !== keyMMSlashYYYY && m !== keyMMYYYY && m !== keyYYYYMM);
      
      await updatePaciente({
        ...currentP,
        mesesConcluidos: updatedMeses
      }, true);

      setReabrirModalOpen(false);
      toast.success(`Escala de ${keyMMSlashYYYY} reaberta com sucesso!`, { id: toastId });
    } catch (err: any) {
      console.error("Erro ao processar batch de reabertura:", err);
      toast.error('Erro ao reabrir escala: ' + (err.message || String(err)), { id: toastId });
    }
  };

  const handleBaixarFaturaExcel = async () => {
    if (!paciente || !paciente.id) {
      toast.error('Paciente não identificado.');
      return;
    }

    const faturasDoPaciente = (faturasPacientes || []).filter(
      (f: any) => f.idPaciente === paciente.id || f.pacienteId === paciente.id
    );

    if (faturasDoPaciente.length === 0) {
      toast.error('Nenhuma fatura encontrada no histórico para este paciente.');
      return;
    }

    // Ordenar por dataEmissao descendente para pegar a mais recente
    const faturaMaisRecenteRaw = [...faturasDoPaciente].sort((a, b) => {
      const dateA = a.dataEmissao ? new Date(a.dataEmissao).getTime() : 0;
      const dateB = b.dataEmissao ? new Date(b.dataEmissao).getTime() : 0;
      return dateB - dateA;
    })[0];

    const faturaMaisRecente = faturaMaisRecenteRaw as any;

    let empresaNome = 'RH Gestão Domiciliar';
    let empresaCnpj = '12.345.678/0001-99';
    let empresaEndereco = 'Rua Martins Ferreira, 71';
    try {
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.razaoSocial) empresaNome = data.razaoSocial;
        if (data.cnpj) empresaCnpj = data.cnpj;
        if (data.endereco) empresaEndereco = data.endereco;
      }
    } catch (err) {
      console.warn("Erro ao buscar dados da empresa para exportação, usando fallbacks:", err);
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Fatura', {
        views: [{ showGridLines: true }]
      });

      worksheet.columns = [
        { key: 'A', width: 15 },
        { key: 'B', width: 30 },
        { key: 'C', width: 30 },
        { key: 'D', width: 18 }
      ];

      // Logo block: "RH"
      worksheet.mergeCells('A2:A4');
      const logoCell = worksheet.getCell('A2');
      logoCell.value = 'RH';
      logoCell.font = { name: 'Arial', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
      logoCell.alignment = { vertical: 'middle', horizontal: 'center' };
      logoCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A4231' }
      };

      // Company info
      const nameCell = worksheet.getCell('B2');
      nameCell.value = empresaNome;
      nameCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1A4231' } };

      const cnpjCell = worksheet.getCell('B3');
      cnpjCell.value = `CNPJ: ${empresaCnpj}`;
      cnpjCell.font = { name: 'Arial', size: 10, color: { argb: 'FF4B5563' } };

      const addressCell = worksheet.getCell('B4');
      addressCell.value = `Endereço: ${empresaEndereco}`;
      addressCell.font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' } };

      // Invoice header on the right
      const titleCell = worksheet.getCell('D2');
      titleCell.value = 'FATURA';
      titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1A4231' } };
      titleCell.alignment = { horizontal: 'right' };

      const numCell = worksheet.getCell('D3');
      const invoiceNumber = faturaMaisRecente.numeroFatura || 'FAT-' + Number(faturaMaisRecente.id).toString().substring(0, 6);
      numCell.value = `Nº: ${invoiceNumber}`;
      numCell.font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF1F2937' } };
      numCell.alignment = { horizontal: 'right' };

      // Separator line
      worksheet.getRow(5).height = 10;
      for (let c = 1; c <= 4; c++) {
        worksheet.getCell(5, c).border = {
          bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } }
        };
      }

      // Format Date
      const formatDateBR = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
          return dateStr.split('-').reverse().join('/');
        }
        return dateStr;
      };

      // Patient/Invoice details in Grid
      // Row 7
      worksheet.getCell('A7').value = 'Emissão:';
      worksheet.getCell('B7').value = formatDateBR(faturaMaisRecente.dataEmissao || '');
      worksheet.getCell('C7').value = 'Status:';
      worksheet.getCell('D7').value = faturaMaisRecente.status || 'Aberta';

      // Row 8
      worksheet.getCell('A8').value = 'Paciente:';
      worksheet.getCell('B8').value = faturaMaisRecente.nomePaciente || '---';
      worksheet.getCell('C8').value = 'Valor Total:';
      
      const valTotalCell = worksheet.getCell('D8');
      valTotalCell.value = faturaMaisRecente.valorTotal || faturaMaisRecente.valorTotalFatura || 0;
      valTotalCell.numFmt = '"R$ "#,##0.00';

      const detailRefs = ['A7', 'A8', 'B7', 'B8', 'C7', 'C8', 'D7', 'D8'];
      detailRefs.forEach(ref => {
        const c = worksheet.getCell(ref);
        c.font = { name: 'Arial', size: 10 };
      });

      ['A7', 'A8', 'C7', 'C8'].forEach(ref => {
        worksheet.getCell(ref).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF374151' } };
      });

      worksheet.getCell('D7').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } };
      valTotalCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1A4231' } };

      // Space
      worksheet.getRow(9).height = 15;

      // Service Table Header (Row 11)
      const tableHeaderRow = worksheet.getRow(11);
      tableHeaderRow.height = 24;
      ['A11', 'B11', 'C11', 'D11', 'E11'].forEach((cellRef, idx) => {
        const hCell = worksheet.getCell(cellRef);
        hCell.value = ['Data', 'Profissional', 'Carga Horária', 'Serviço', 'Valor'][idx];
        hCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        hCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A4231' } // Dark Green
        };
        hCell.alignment = { vertical: 'middle', horizontal: idx === 4 ? 'right' : 'left' };
      });

      // Calculate shift total
      const calculateRowValue = (p: any) => {
        const base = p.valorPlantao || 0;
        const adm = p.taxaAdm || 0;
        const ajuda = p.ajudaCusto || 0;
        let mult = 1.0;
        if (p.tipoDia === 'Feriado 20%') mult = 1.2;
        else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
        return (base * mult) + (adm * mult) + ajuda;
      };

      const plantoesValidos = (faturaMaisRecente.plantoesCongelados || []).filter((p: any) => {
        if (p.considerarFalta || p.status === 'falta' || p.status === 'Falta' || p.status === 'Cancelado' || p.status === 'cancelado') {
          return false;
        }
        return calculateRowValue(p) > 0;
      });

      let currentRow = 12;

      plantoesValidos.forEach((p: any) => {
        worksheet.getCell(`A${currentRow}`).value = formatDateBR(p.data || '');
        worksheet.getCell(`B${currentRow}`).value = formatNomeComEspacos(p.nomeProfissional || p.profissional);
        worksheet.getCell(`C${currentRow}`).value = getPlantaoCargaHoraria(p);
        worksheet.getCell(`D${currentRow}`).value = p.tipoDia || 'Plantão Normal';

        const valCell = worksheet.getCell(`E${currentRow}`);
        valCell.value = calculateRowValue(p);
        valCell.numFmt = '"R$ "#,##0.00';
        valCell.alignment = { horizontal: 'right' };

        ['A', 'B', 'C', 'D', 'E'].forEach(col => {
          const c = worksheet.getCell(`${col}${currentRow}`);
          c.font = { name: 'Arial', size: 10 };
          c.border = {
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        });
        currentRow++;
      });

      // Footer Row (Total)
      worksheet.getCell(`C${currentRow}`).value = 'TOTAL';
      worksheet.getCell(`C${currentRow}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1A4231' } };
      worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };

      const totValCell = worksheet.getCell(`D${currentRow}`);
      totValCell.value = faturaMaisRecente.valorTotal || faturaMaisRecente.valorTotalFatura || 0;
      totValCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1A4231' } };
      totValCell.numFmt = '"R$ "#,##0.00';
      totValCell.alignment = { horizontal: 'right' };

      ['A', 'B', 'C', 'D'].forEach(col => {
        const c = worksheet.getCell(`${col}${currentRow}`);
        c.border = {
          top: { style: 'thin', color: { argb: 'FF1A4231' } },
          bottom: { style: 'double', color: { argb: 'FF1A4231' } }
        };
      });

      // Auto column widths
      worksheet.columns.forEach(column => {
        let maxLen = 12;
        column?.eachCell?.({ includeEmpty: true }, cell => {
          const valStr = cell.value ? String(cell.value) : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        if (column) column.width = maxLen + 4;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeNumber = invoiceNumber.replace(/\//g, '-');
      link.download = `fatura_${safeNumber}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Fatura ${invoiceNumber} baixada em Excel (.xlsx)!`);
    } catch (err) {
      console.error('Erro ao baixar excel:', err);
      toast.error('Erro ao gerar o arquivo Excel.');
    }
  };

  const handleBaixarFaturaWord = async () => {
    if (!paciente || !paciente.id) {
      toast.error('Paciente não identificado.');
      return;
    }

    const faturasDoPaciente = (faturasPacientes || []).filter(
      (f: any) => f.idPaciente === paciente.id || f.pacienteId === paciente.id
    );

    if (faturasDoPaciente.length === 0) {
      toast.error('Nenhuma fatura encontrada no histórico para este paciente.');
      return;
    }

    // Ordenar por dataEmissao descendente para pegar a mais recente
    const faturaMaisRecenteRaw = [...faturasDoPaciente].sort((a, b) => {
      const dateA = a.dataEmissao ? new Date(a.dataEmissao).getTime() : 0;
      const dateB = b.dataEmissao ? new Date(b.dataEmissao).getTime() : 0;
      return dateB - dateA;
    })[0];

    const faturaMaisRecente = faturaMaisRecenteRaw as any;

    let empresaNome = 'RH Gestão Domiciliar';
    let empresaCnpj = '12.345.678/0001-99';
    let empresaEndereco = 'Rua Martins Ferreira, 71';
    try {
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.razaoSocial) empresaNome = data.razaoSocial;
        if (data.cnpj) empresaCnpj = data.cnpj;
        if (data.endereco) empresaEndereco = data.endereco;
      }
    } catch (err) {
      console.warn("Erro ao buscar dados da empresa para exportação, usando fallbacks:", err);
    }

    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        Table,
        TableRow,
        TableCell,
        AlignmentType,
        WidthType,
        BorderStyle
      } = docx;

      const formatDateBR = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
          return dateStr.split('-').reverse().join('/');
        }
        return dateStr;
      };

      const calculateRowValue = (p: any) => {
        const base = p.valorPlantao || 0;
        const adm = p.taxaAdm || 0;
        const ajuda = p.ajudaCusto || 0;
        let mult = 1.0;
        if (p.tipoDia === 'Feriado 20%') mult = 1.2;
        else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
        return (base * mult) + (adm * mult) + ajuda;
      };

      const invoiceNumber = faturaMaisRecente.numeroFatura || 'FAT-' + Number(faturaMaisRecente.id).toString().substring(0, 6);
      const plantoesValidos = (faturaMaisRecente.plantoesCongelados || []).filter((p: any) => {
        if (p.considerarFalta || p.status === 'falta' || p.status === 'Falta' || p.status === 'Cancelado' || p.status === 'cancelado') {
          return false;
        }
        return calculateRowValue(p) > 0;
      });
      const totalGlobal = plantoesValidos.reduce((acc: number, curr: any) => acc + calculateRowValue(curr), 0);

      // 1. Header Table
      const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: { style: BorderStyle.NONE },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 60, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: empresaNome, bold: true, size: 28, color: "1A4231", font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `CNPJ: ${empresaCnpj}`, size: 18, color: "555555", font: "Arial" })
                    ],
                    spacing: { before: 80 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Endereço: ${empresaEndereco}`, size: 18, color: "777777", font: "Arial" })
                    ],
                    spacing: { before: 80 }
                  })
                ]
              }),
              new TableCell({
                width: { size: 40, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "FATURA", bold: true, size: 36, color: "1A4231", font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Nº: ${invoiceNumber}`, size: 20, italics: true, font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 100 }
                  })
                ]
              })
            ]
          })
        ]
      });

      // 2. Horizontal divider
      const separator = new Paragraph({
        spacing: { before: 200, after: 200 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 12, color: "D1D5DB" }
        }
      });

      // 3. Info table Grid
      const detailsTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "F3F4F6" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "F3F4F6" }
        },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: "FAFAFA" },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Emissão: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: formatDateBR(faturaMaisRecente.dataEmissao || ''), size: 18, font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Paciente: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: faturaMaisRecente.nomePaciente || '---', size: 18, font: "Arial" })
                    ],
                    spacing: { before: 100 }
                  })
                ]
              }),
              new TableCell({
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: "FAFAFA" },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Status: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: faturaMaisRecente.status || 'Aberta', size: 18, bold: true, color: "15803D", font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Valor Total: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: `R$ ${totalGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 18, bold: true, color: "1A4231", font: "Arial" })
                    ],
                    spacing: { before: 100 }
                  })
                ]
              })
            ]
          })
        ]
      });

      // 4. Services Table Header Row
      const servicesHeader = new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            children: [new Paragraph({ children: [new TextRun({ text: "Data", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            children: [new Paragraph({ children: [new TextRun({ text: "Profissional", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            children: [new Paragraph({ children: [new TextRun({ text: "Serviço", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            children: [new Paragraph({ children: [new TextRun({ text: "Valor", bold: true, color: "FFFFFF", size: 18, font: "Arial" })], alignment: AlignmentType.RIGHT })]
          })
        ]
      });

      // Items Row
      const serviceRows = plantoesValidos.map((p: any) => {
        const valorLinha = calculateRowValue(p);
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: formatDateBR(p.data || ''), size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: formatNomeComEspacos(p.nomeProfissional || p.profissional), size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 35, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: p.tipoDia || 'Plantão Normal', size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: `R$ ${valorLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, size: 18, font: "Arial" })], alignment: AlignmentType.RIGHT })]
            })
          ]
        });
      });

      // Total Row
      const totalRow = new TableRow({
        children: [
          new TableCell({
            width: { size: 85, type: WidthType.PERCENTAGE },
            columnSpan: 3,
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: "TOTAL", bold: true, size: 20, color: "1A4231", font: "Arial" })], alignment: AlignmentType.RIGHT })]
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            shading: { fill: "F3F4F6" },
            margins: { top: 140, bottom: 140, left: 140, right: 140 },
            children: [new Paragraph({ children: [new TextRun({ text: `R$ ${totalGlobal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true, size: 20, color: "1A4231", font: "Arial" })], alignment: AlignmentType.RIGHT })]
          })
        ]
      });

      const servicesTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: "1A4231" },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: "1A4231" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB" }
        },
        rows: [servicesHeader, ...serviceRows, totalRow]
      });

      // 5. Build Document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            headerTable,
            separator,
            new Paragraph({ children: [new TextRun({ text: "DADOS DA FATURA E PACIENTE", bold: true, size: 20, color: "1A4231", font: "Arial" })], spacing: { after: 120 } }),
            detailsTable,
            new Paragraph({ text: "", spacing: { before: 180, after: 180 } }),
            new Paragraph({ children: [new TextRun({ text: "DETALHAMENTO DE SERVIÇOS PRESTADOS", bold: true, size: 20, color: "1A4231", font: "Arial" })], spacing: { after: 120 } }),
            servicesTable
          ]
        }]
      });

      const packerBlob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(packerBlob);
      const link = document.createElement('a');
      link.href = url;
      const safeNumber = invoiceNumber.replace(/\//g, '-');
      link.download = `fatura_${safeNumber}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Fatura ${invoiceNumber} baixada em Word (.docx)!`);
    } catch (err) {
      console.error('Erro ao baixar docx:', err);
      toast.error('Erro ao gerar o arquivo Word.');
    }
  };

  const fetchEmpresaInfo = async () => {
    try {
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setEmpresaInfo(data);
        return data;
      }
    } catch (err) {
      console.warn("Erro ao buscar dados da empresa para PNG, usando fallbacks:", err);
    }
    const fallback = {
      razaoSocial: 'RH Gestão Domiciliar',
      cnpj: '12.345.678/0001-99',
      endereco: 'Rua Martins Ferreira, 71',
      logoUrl: ''
    };
    setEmpresaInfo(fallback);
    return fallback;
  };

  const handleBaixarFaturaPng = async () => {
    if (!paciente || !paciente.id) {
      toast.error('Paciente não identificado.');
      return;
    }

    const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
    const matchedFatura = (faturasPacientes || []).find((f: any) => {
      const matchesPaciente = f.idPaciente === paciente.id || f.pacienteId === paciente.id || f.nomePaciente?.toLowerCase() === paciente.nome?.toLowerCase();
      const matchesPeriodo = f.mesReferencia === monthPrefix || (f.periodoApurado?.inicio && f.periodoApurado.inicio.startsWith(monthPrefix));
      return matchesPaciente && matchesPeriodo;
    });

    if (!matchedFatura) {
      const mesNome = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth];
      toast.error(`Aviso: A fatura de ${mesNome}/${calendarYear} para este paciente ainda não foi emitida.`);
      return;
    }

    const toastId = toast.loading('Preparando download da fatura em PDF...');

    try {
      // Carrega dados da empresa se necessário
      const emp = empresaInfo || await fetchEmpresaInfo();

      // Ativa renderização offscreen
      setFaturaParaBaixar(matchedFatura);

      // Dá tempo pro DOM renderizar
      await new Promise((resolve) => setTimeout(resolve, 500));

      const printElement = tempFaturaRef.current;
      if (!printElement) {
        throw new Error('Elemento de faturamento para PDF não renderizado no DOM.');
      }

      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(printElement, {
        backgroundColor: '#fcf8f2',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          sanitizeClonedDocForHtml2Canvas(clonedDoc, '#fcf8f2', '#1a3c2e');
          if (clonedDoc.body) {
            clonedDoc.body.style.width = '850px';
          }
        }
      });

      const formattedDate = matchedFatura.dataEmissao?.includes('T') ? matchedFatura.dataEmissao.split('T')[0] : (matchedFatura.dataEmissao?.replace(/\//g, '-') || 'Data');
      const safeName = (matchedFatura.nomePaciente || paciente.nome || 'Paciente').replace(/\s+/g, '_');

      exportCanvasToA4PDF(canvas, `Fatura_${safeName}_${formattedDate}.pdf`);

      toast.success('Fatura baixada em PDF com sucesso!', { id: toastId });
    } catch (err: any) {
      console.error('Erro ao gerar PDF da fatura:', err);
      toast.error('Erro ao baixar a fatura em PDF.', { id: toastId });
    } finally {
      setFaturaParaBaixar(null);
    }
  };

  const handleBaixarFaturaRecente = async () => {
    await handleBaixarFaturaExcel();
  };

  const handleGenerateProntuarioPNG = async () => {
    setIsGeneratingProntuarioPNG(true);
    const toastId = toast.loading('Gerando imagem (PNG) do Prontuário Clínico...');
    try {
      const element = document.getElementById('print-prontuario-area');
      if (!element) {
        throw new Error('Elemento do prontuário para impressão não encontrado.');
      }

      const html2canvas = (await import('html2canvas-pro')).default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          sanitizeClonedDocForHtml2Canvas(clonedDoc, '#ffffff', '#1e293b');
          const printEl = clonedDoc.getElementById('print-prontuario-area');
          if (printEl) {
            printEl.style.visibility = 'visible';
            printEl.style.display = 'block';
            printEl.style.maxHeight = 'none';
            printEl.style.overflow = 'visible';
            printEl.style.width = '820px';
            printEl.style.maxWidth = '820px';
            printEl.style.boxSizing = 'border-box';
            printEl.style.backgroundColor = '#ffffff';
            printEl.style.margin = '0';
            printEl.style.padding = '24px';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const safeName = (paciente?.nome || 'Paciente').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const fileName = `Prontuario_Clinico_${safeName}.png`;

      const link = document.createElement('a');
      link.href = imgData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Prontuário baixado em PNG com sucesso!', { id: toastId });
    } catch (err: any) {
      console.error('Erro ao gerar PNG do Prontuário:', err);
      toast.error('Erro ao gerar imagem: ' + (err?.message || 'Falha na geração'), { id: toastId });
    } finally {
      setIsGeneratingProntuarioPNG(false);
    }
  };

  const handleBaixarPreviaFinanceiraPNG = async () => {
    const toastId = toast.loading('Gerando imagem (PNG) da Prévia Financeira...');
    try {
      const element = document.getElementById('previa-financeira-modal-content');
      if (!element) {
        throw new Error('Elemento da prévia financeira não encontrado no DOM.');
      }

      const html2canvas = (await import('html2canvas-pro')).default;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024,
        onclone: (clonedDoc) => {
          sanitizeClonedDocForHtml2Canvas(clonedDoc, '#ffffff', '#1e293b');
          const modalEl = clonedDoc.getElementById('previa-financeira-modal-content');
          if (modalEl) {
            modalEl.style.maxHeight = 'none';
            modalEl.style.height = 'auto';
            modalEl.style.overflow = 'visible';
            modalEl.style.borderRadius = '16px';
            modalEl.style.boxShadow = 'none';
          }
          const scrollEl = clonedDoc.getElementById('previa-financeira-modal-body');
          if (scrollEl) {
            scrollEl.style.maxHeight = 'none';
            scrollEl.style.height = 'auto';
            scrollEl.style.overflow = 'visible';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const safeName = (paciente?.nome || 'Paciente').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthStr = monthNames[calendarMonth] || 'Mes';

      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Previa_Financeira_${safeName}_${monthStr}_${calendarYear}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Prévia Financeira baixada em PNG com sucesso!', { id: toastId });
    } catch (err: any) {
      console.error('Erro ao gerar PNG da prévia financeira:', err);
      toast.error('Erro ao baixar a prévia financeira em PNG.', { id: toastId });
    }
  };

  const handleConfirmExcluir = async () => {
    if (!paciente) return;
    
    let matches: Agendamento[] = [];
    const agendamentosPaciente = agendamentos.filter((a) => a.idPaciente === paciente.id);

    if (excluirPorType === 'datas') {
      matches = agendamentosPaciente.filter((s) => s.data === excluirStartDate);
    } else if (excluirPorType === 'profissional') {
      const profsToMatch = selectedExcluirProfs.length > 0 
        ? selectedExcluirProfs 
        : (excluirProfName.trim() ? [excluirProfName.trim()] : []);

      if (profsToMatch.length === 0) {
        toast.error('Selecione ao menos um profissional para remover.');
        return;
      }

      matches = agendamentosPaciente.filter(
        (s) =>
          s.data >= excluirStartDate &&
          s.data <= excluirEndDate &&
          profsToMatch.some((pName) =>
            (s.nomeProfissional || '').toLowerCase().includes(pName.toLowerCase())
          )
      );
    } else {
      matches = agendamentosPaciente.filter(
        (s) => s.data >= excluirStartDate && s.data <= excluirEndDate
      );
    }

    if (matches.length === 0) {
      toast.error('Nenhum agendamento correspondente aos filtros foi encontrado para exclusão.');
      return;
    }

    const closedCount = matches.filter((s) => s.escalaCongelada || s.status === 'Concluido').length;

    if (closedCount > 0) {
      toast.error('Escala fechada. Não é possível excluir esse plantão.');
      return;
    }

    setDeleteRecordConfirmInput('');
    setDeleteRecordDialog({
      isOpen: true,
      title: 'Confirmar Exclusão em Lote',
      message: `Você realmente deseja excluir permanentemente ${matches.length} agendamento(s) selecionados? Esta ação não pode ser desfeita.`,
      confirmText: 'Confirmar e Excluir',
      cancelText: 'Voltar',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await deleteAgendamentosBatch(matches.map((m) => m.id));
          setExcluirModalOpen(false);
          toast.success(`${matches.length} agendamento(s) excluído(s) com sucesso.`);
        } catch (err: any) {
          toast.error('Erro ao excluir agendamento: ' + (err.message || String(err)));
        } finally {
          setIsDeleting(false);
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
    if (!editShiftProfName || editShiftProfName.trim() === '') {
      toast.error('Por favor, selecione um profissional para o agendamento.');
      return;
    }
    if (!editShiftDate) {
      toast.error('Preencha as informações obrigatórias.');
      return;
    }
    if (editingShiftId && paciente) {
      const originalShift = plantoes.find((pl) => pl.id === editingShiftId);
      if (originalShift && originalShift.escalaCongelada) {
        toast.error('Atenção: Este plantão está CONGELADO e não pode ser editado. Reabra a escala primeiro!');
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
      toast.success('Plantão atualizado com sucesso.');
    }
  };

  // Compiled options representing all configured shifts (Principal + Additionals)
  const availableShifts = [
    {
      id: 'principal',
      tipoEscala: tipoEscala || 'Diurno 12h',
      horaInicio: horaInicioPadrao || '07:00',
      valorPlantao: parseNum(valorSugeridoPlantao, 150),
      ajudaCusto: parseNum(ajudaCusto, 0),
      taxaAdm: parseNum(taxaAdm, 0),
      label: `${tipoEscala || 'Diurno 12h'} (Principal)`
    },
    ...tiposPlantao.map(tp => ({
      id: tp.id,
      tipoEscala: tp.tipoEscala,
      horaInicio: tp.horaInicio,
      valorPlantao: parseNum(tp.valorPlantao, 150),
      ajudaCusto: parseNum(tp.ajudaCusto, 0),
      taxaAdm: parseNum(tp.taxaAdm, 0),
      label: `${tp.tipoEscala} (Adicional)`
    }))
  ];

  const getShiftNameForAgendamento = (ag: Agendamento) => {
    let multiplier = 1.0;
    if (ag.tipoDia === 'Feriado 20%') {
      multiplier = 1.2;
    } else if (ag.tipoDia === 'Feriado 50%') {
      multiplier = 1.5;
    }
    const baseValue = (ag.valorPlantao || 0) / multiplier;
    const startHour = ag.horario?.split('-')[0] || '';

    // Tenta encontrar correspondência exata no horário de início e valor base
    let match = availableShifts.find(opt => 
      opt.horaInicio === startHour && 
      Math.abs(opt.valorPlantao - baseValue) < 0.5
    );

    // Se não encontrar, tenta por horário de início apenas
    if (!match) {
      match = availableShifts.find(opt => opt.horaInicio === startHour);
    }

    // Se ainda não encontrar, tenta por valor base apenas
    if (!match) {
      match = availableShifts.find(opt => Math.abs(opt.valorPlantao - baseValue) < 0.5);
    }

    return match ? match.tipoEscala : (tipoEscala || 'Diurno 12h');
  };

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

  const cleanCpfValLocal = (cpf || '').replace(/\D/g, '');
  const isCpfLoaded = cleanCpfValLocal.length > 0;
  const isCpfFullLength = cleanCpfValLocal.length === 11;
  const isCpfValid = isCpfFullLength && validarCPF(cleanCpfValLocal);
  const isCpfInvalid = isCpfFullLength && !isCpfValid;

  const cleanCpfPagadorValLocal = (cpfPagador || '').replace(/\D/g, '');
  const isCpfPagadorLoaded = cleanCpfPagadorValLocal.length > 0;
  const isCpfPagadorFullLength = cleanCpfPagadorValLocal.length === 11;
  const isCpfPagadorValid = isCpfPagadorFullLength && validarCPF(cleanCpfPagadorValLocal);
  const isCpfPagadorInvalid = isCpfPagadorFullLength && !isCpfPagadorValid;

  let idadeCalculada = '---';
  if (dataNascimento) {
    try {
      const today = new Date();
      const birth = new Date(dataNascimento);
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      idadeCalculada = `${age} anos`;
    } catch (e) {
      idadeCalculada = '---';
    }
  }

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 space-y-6" id="patient-record-container">
      {/* Return */}
      <div className="flex items-center justify-between">
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
          className="bg-red-55 bg-red-50 border-l-4 border-red-500 text-red-800 p-4 rounded-r-xl shadow-sm text-xs flex items-start space-x-3"
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

      {/* Header of the Prontuário Consolidado (Single Header Flex) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200 gap-4 mb-6" id="cons-header-paciente">
        {/* Lado Esquerdo: Identificação do Paciente */}
        <div className="space-y-2 text-left min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight" id="prontuario-title-novo">
              {nome}
            </h1>
            <div className="flex-shrink-0">
              {pStatus === 'Ativo' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800 uppercase tracking-older">
                  • ATIVO
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 uppercase tracking-older">
                  • DESATIVADO
                </span>
              )}
            </div>
          </div>
          
          {/* Soft Badges menores de Bairro e Turno */}
          {!isNew && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1A3626]/8 text-[#1A3626] border border-slate-100">
                Bairro: {bairro || 'Sem Bairro'}
              </span>
              <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1A3626]/8 text-[#1A3626] border border-slate-100">
                Turno: {tipoEscala || 'Diurno 12h'} ({horaInicioPadrao || '07:00'})
              </span>
            </div>
          )}
        </div>

        {/* Lado Direito: Barra de Ações */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 md:justify-end w-full md:w-auto" id="patient-actions-bar">
          <GlossyButton
            type="button"
            onClick={onBack}
            variant="gray"
            id="btn-voltar-topo-global"
          >
            <ArrowLeft size={14} />
            <span>Voltar</span>
          </GlossyButton>
          {!isNew && (
            <GlossyButton
              type="button"
              onClick={() => setImprimirProntuarioModalOpen(true)}
              variant="blue"
              id="btn-imprimir-prontuario-global"
            >
              <Printer size={14} />
              <span>Exportar Prontuário</span>
            </GlossyButton>
          )}
          {!isCurrentlyDeactivated ? (
            <>
              {!isNew && userRole === 'Administrador' && (
                <GlossyButton
                  type="button"
                  onClick={() => {
                    setDeactivateConfirmInput('');
                    setAlertDeactivateOpen(true);
                  }}
                  variant="red"
                  id="btn-desativar-paciente"
                >
                  <Lock size={14} />
                  <span>Desativar Paciente</span>
                </GlossyButton>
              )}
              {userRole === 'Administrador' && (
                <GlossyButton
                  type="button"
                  onClick={handleSave}
                  variant="green"
                  id="btn-salvar-alteracoes"
                >
                  <Save size={14} />
                  <span>Salvar Alterações</span>
                </GlossyButton>
              )}
            </>
          ) : (
            userRole === 'Administrador' && (
              <GlossyButton
                type="button"
                onClick={handleReactivate}
                variant="yellow"
                id="btn-reativar-paciente"
              >
                <Unlock size={14} className="animate-bounce" />
                <span>Reativar Paciente</span>
              </GlossyButton>
            )
          )}
        </div>
      </div>

      {/* Content Form Body - Unified Layout with Extreme Minimalism */}
      <div className="space-y-4">
        {/* Right side form view containing horizontals sub tabs */}
        <div className="space-y-4">
          {/* sub-tabs header block */}
          <nav className="border-b border-gray-200 flex overflow-x-auto whitespace-nowrap gap-6 pb-0 w-full no-scrollbar md:flex-nowrap md:overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('geral')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'geral'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
            >
              <User size={15} />
              <span>Geral & Contato</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('endereco')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'endereco'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
            >
              <MapPin size={15} />
              <span>Endereço</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('medico')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'medico'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
            >
              <Stethoscope size={15} />
              <span>Info Médica</span>
            </button>
            {!isColaborador && (
              <button
                type="button"
                onClick={() => setActiveTab('plano')}
                className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                  activeTab === 'plano'
                    ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
                }`}
              >
                <Clock size={15} />
                <span>Plano de Atendimento</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('agendamento')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'agendamento'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
            >
              <CalendarDays size={15} />
              <span>Agendamento</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ocorrencias')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'ocorrencias'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
              id="tab-btn-ocorrencias"
            >
              <AlertOctagon size={15} />
              <span>Ocorrências</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('auditoria')}
              className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs md:text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'auditoria'
                  ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
              }`}
              id="tab-btn-auditoria"
            >
              <History size={15} />
              <span>Histórico</span>
            </button>
          </nav>

          {/* Form input sections */}
          <form onSubmit={handleSave} className="w-full min-h-[380px]">
            {activeTab === 'geral' && (
              <div className="w-full max-w-4xl mx-auto mt-6 mb-12 animate-in fade-in-30 slide-in-from-right-3 flex flex-col gap-6">
                {/* Cartão Central (Destaque Principal - Identidade) */}
                <div className="w-full bg-white rounded-2xl border border-[#113224]/10 p-6 md:p-8 shadow-sm space-y-4">
                  <h4 className="text-[#113224] text-lg font-bold border-b border-[#113224]/10 pb-2 uppercase tracking-wider">
                    DADOS PRINCIPAIS DO PACIENTE
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1 col-span-1 md:col-span-3">
                      <label className="block text-sm font-medium text-gray-750">Nome Completo *</label>
                      <input
                        type="text"
                        required
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                      />
                    </div>

                    <div className="space-y-1 col-span-1 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-750">CPF do Paciente *</label>
                      <input
                        type="text"
                        required
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={cpf}
                        onChange={(e) => setCpf(mascaraCPF(e.target.value))}
                        maxLength={14}
                        className={`w-full text-sm p-2.5 border rounded-lg bg-white focus:outline-none focus:ring-1 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal transition-all ${
                          isCpfInvalid
                            ? 'border-red-500 text-red-900 focus:ring-red-500 focus:border-red-500 bg-red-50/10'
                            : isCpfValid
                            ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                            : 'border-slate-300 text-gray-900 focus:ring-[#113224] focus:border-[#113224]'
                        }`}
                      />
                      {isCpfInvalid && (
                        <p className="text-[11px] text-red-600 font-semibold flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                          <AlertOctagon size={13} className="text-red-500 flex-shrink-0" />
                          <span>CPF inválido (dígito verificador incorreto).</span>
                        </p>
                      )}
                      {isCpfValid && (
                        <p className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                          <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>CPF válido!</span>
                        </p>
                      )}
                      {isCpfLoaded && !isCpfFullLength && (
                        <p className="text-[11px] text-amber-600 font-medium flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Insira os 11 dígitos do CPF</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1 col-span-1 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-750">Data de Nascimento *</label>
                      <input
                        type="date"
                        required
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={dataNascimento}
                        onChange={(e) => setDataNascimento(e.target.value)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                      />
                    </div>

                    <div className="space-y-1 col-span-1 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-750">Idade</label>
                      <input
                        type="text"
                        readOnly
                        value={idadeCalculada}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-500 bg-slate-50 cursor-default font-normal focus:outline-none mb-1"
                      />
                      {!showPacientePhone && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowPacientePhone(true)}
                            className="text-xs font-semibold text-[#113224] hover:text-[#C09A6D] flex items-center gap-1 transition-colors"
                          >
                            <span>+ Adicionar telefone</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {showPacientePhone && (
                      <div className="space-y-1 col-span-1 md:col-span-1 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                          <label className="block text-sm font-medium text-gray-750">Telefone (Opcional)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPacientePhone(false);
                              setTelefonePaciente('');
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors"
                          >
                            <span>Remover</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={telefonePaciente}
                          onChange={(e) => setTelefonePaciente(mascaraTelefone(e.target.value))}
                          maxLength={15}
                          className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                        />
                      </div>
                    )}

                    <div className="space-y-1 col-span-1 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-750">Altura</label>
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={altura}
                        onChange={(e) => setAltura(mascaraAltura(e.target.value))}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                      />
                    </div>

                    <div className="space-y-1 col-span-1 md:col-span-1">
                      <label className="block text-sm font-medium text-gray-750">Peso</label>
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={peso}
                        onChange={(e) => setPeso(mascaraPeso(e.target.value))}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                      />
                    </div>
                  </div>
                </div>

                {/* Cartão de Contato do Responsável */}
                <div className="w-full bg-slate-50 rounded-2xl border border-[#113224]/10 p-6 md:p-8 shadow-sm space-y-4">
                  <div>
                    <h4 className="text-sm font-bold text-[#113224] uppercase tracking-wider flex items-center gap-2">
                      <span className="text-[#C09A6D] text-lg">👤</span> CONTATO DO RESPONSÁVEL
                    </h4>
                    <div className="w-10 h-1 bg-[#C09A6D] rounded mt-1.5" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 col-span-1 md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-600">Representante Responsável *</label>
                      <input
                        type="text"
                        required
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={nomeResponsavel}
                        onChange={(e) => setNomeResponsavel(e.target.value)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                      />
                    </div>

                    <div className="space-y-1 col-span-1">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-semibold text-gray-600">Telefone do Responsável *</label>
                        {!showSecondPhone && (
                          <button
                            type="button"
                            onClick={() => setShowSecondPhone(true)}
                            className="text-xs font-semibold text-[#113224] hover:text-[#C09A6D] flex items-center gap-1 transition-colors"
                          >
                            <span>+ Adicionar outro</span>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={telefoneResponsavel}
                        onChange={(e) => setTelefoneResponsavel(mascaraTelefone(e.target.value))}
                        maxLength={15}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#C09A6D] focus:border-[#C09A6D] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                      />
                    </div>

                    {showSecondPhone && (
                      <div className="space-y-1 col-span-1">
                        <div className="flex justify-between items-center">
                          <label className="block text-xs font-semibold text-gray-600">Segundo Telefone do Responsável (Opcional)</label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowSecondPhone(false);
                              setTelefoneResponsavel2('');
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors"
                          >
                            <span>Remover</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={telefoneResponsavel2}
                          onChange={(e) => setTelefoneResponsavel2(mascaraTelefone(e.target.value))}
                          maxLength={15}
                          className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#C09A6D] focus:border-[#C09A6D] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                        />
                      </div>
                    )}

                    <div className="space-y-1 col-span-1">
                      <label className="block text-xs font-semibold text-gray-600">Parentesco (Opcional)</label>
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={parentescoResponsavel}
                        onChange={(e) => setParentescoResponsavel(e.target.value)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#C09A6D] focus:border-[#C09A6D] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                      />
                    </div>
                  </div>
                </div>

                {/* Cartão de Faturamento */}
                <div className="w-full bg-white rounded-2xl border border-[#113224]/10 p-6 shadow-sm space-y-4">
                  <h4 className="text-[#113224] text-sm font-bold border-b border-[#113224]/10 pb-2 uppercase tracking-wider">
                    DADOS DE FATURAMENTO E PAGAMENTO
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1 col-span-1">
                      <label className="block text-xs font-medium text-gray-750">Responsável pelo Pagamento? *</label>
                      <select
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={responsavelPagamento}
                        onChange={(e) => setResponsavelPagamento(e.target.value as any)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                      >
                        <option value="O próprio Paciente">O próprio Paciente</option>
                        <option value="Outro Responsável">Outro Responsável</option>
                      </select>
                    </div>

                    <div className="space-y-1 col-span-1">
                      <label className="block text-xs font-medium text-gray-750">Envio da Fatura/Boleto *</label>
                      <select
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={opcaoEnvio}
                        onChange={(e) => setOpcaoEnvio(e.target.value as any)}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal"
                      >
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="E-mail">E-mail</option>
                        <option value="Ambos">Ambos</option>
                        <option value="Somente fatura">Somente fatura</option>
                      </select>
                    </div>

                    {responsavelPagamento === 'Outro Responsável' && (
                      <>
                        <div className="space-y-1 col-span-1 md:col-span-2">
                          <label className="block text-xs font-medium text-gray-750">Nome do Pagador *</label>
                          <input
                            type="text"
                            required
                            disabled={isCurrentlyDeactivated || isColaborador}
                            value={nomePagador}
                            onChange={(e) => setNomePagador(e.target.value)}
                            className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                          />
                        </div>
                        <div className="space-y-1 col-span-1">
                          <label className="block text-xs font-medium text-gray-750">CPF do Pagador *</label>
                          <input
                            type="text"
                            required
                            disabled={isCurrentlyDeactivated || isColaborador}
                            value={cpfPagador}
                            onChange={(e) => setCpfPagador(mascaraCPF(e.target.value))}
                            maxLength={14}
                            className={`w-full text-sm p-2.5 border rounded-lg bg-white focus:outline-none focus:ring-1 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal transition-all ${
                              isCpfPagadorInvalid
                                ? 'border-red-500 text-red-900 focus:ring-red-500 focus:border-red-500 bg-red-50/10'
                                : isCpfPagadorValid
                                ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                                : 'border-slate-300 text-gray-900 focus:ring-[#113224] focus:border-[#113224]'
                            }`}
                          />
                          {isCpfPagadorInvalid && (
                            <p className="text-[11px] text-red-600 font-semibold flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                              <AlertOctagon size={13} className="text-red-500 flex-shrink-0" />
                              <span>CPF do pagador inválido (dígito verificador incorreto).</span>
                            </p>
                          )}
                          {isCpfPagadorValid && (
                            <p className="text-[11px] text-emerald-600 font-semibold flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                              <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>CPF do pagador válido!</span>
                            </p>
                          )}
                          {isCpfPagadorLoaded && !isCpfPagadorFullLength && (
                            <p className="text-[11px] text-amber-600 font-medium flex items-center space-x-1 mt-1 animate-in fade-in duration-200">
                              <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>Insira os 11 dígitos do CPF</span>
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {(opcaoEnvio === 'WhatsApp' || opcaoEnvio === 'Ambos') && (
                      <div className="space-y-1 col-span-1">
                        <label className="block text-xs font-medium text-gray-750">WhatsApp para Faturamento *</label>
                        <input
                          type="text"
                          required
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={whatsappFaturamento}
                          onChange={(e) => setWhatsappFaturamento(mascaraTelefone(e.target.value))}
                          className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#C09A6D] focus:border-[#C09A6D] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                        />
                      </div>
                    )}

                    {(opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') && (
                      <div className="space-y-1 col-span-1 md:col-span-2">
                        <label className="block text-xs font-medium text-gray-750">E-mail para Envio *</label>
                        <input
                          type="email"
                          required
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#C09A6D] focus:border-[#C09A6D] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                        />
                      </div>
                    )}

                    <div className="space-y-1 col-span-1">
                      <label className="block text-xs font-medium text-gray-750">Data do reajuste (mm/aa)</label>
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={dataReajuste}
                        onChange={(e) => setDataReajuste(mascaraMesAno(e.target.value))}
                        maxLength={5}
                        className="w-full text-sm p-2.5 border border-slate-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#113224] focus:border-[#113224] disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none font-normal"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'endereco' && (
              <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">ENDEREÇO DE ATENDIMENTO</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">CEP</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated || isColaborador}
                      value={cep}
                      onChange={(e) => setCep(mascaraCEP(e.target.value))}
                      onBlur={(e) => handleCepBlur(e.target.value)}
                      maxLength={9}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-550 focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Rua / Logradouro</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated || isColaborador}
                      value={rua}
                      onChange={(e) => setRua(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Número</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated || isColaborador}
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Bairro</label>
                    <input
                      type="text"
                      disabled={isCurrentlyDeactivated || isColaborador}
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Cidade / Estado</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={cidade}
                        onChange={(e) => setCidade(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        disabled={isCurrentlyDeactivated || isColaborador}
                        value={estado}
                        maxLength={2}
                        onChange={(e) => setEstado(e.target.value)}
                        className="w-16 text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 text-center disabled:bg-slate-100/80 disabled:cursor-not-allowed"
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
                    disabled={isCurrentlyDeactivated || isColaborador}
                    value={logisticaChegada}
                    onChange={(e) => setLogisticaChegada(e.target.value)}
                    rows={4}
                    className="w-full text-xs p-3 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed font-sans leading-relaxed"
                  />
                </div>
              </div>
            )}

            {activeTab === 'medico' && (
              <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-sm font-semibold text-gray-800 border-b border-slate-200 pb-2 uppercase tracking-wider">HISTÓRICO CLÍNICO & PRONTUÁRIO DOMICILIAR</h4>

                {/* Replicating the Visual Card/Grid format from the reference standard */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="text-sm font-semibold text-gray-800 flex items-center space-x-1.5">
                      <span className="w-1.5 h-3 bg-blue-500 rounded-sm inline-block"></span>
                      <span>Diagnósticos & Comorbidades</span>
                    </h5>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">Diagnóstico Principal *</label>
                        <input
                          type="text"
                          required
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={diagnosticoPrincipal}
                          onChange={(e) => setDiagnosticoPrincipal(e.target.value)}
                          className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:border-blue-550 focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium text-gray-700">Comorbidades Associadas</label>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={comorbidades}
                          onChange={(e) => setComorbidades(e.target.value)}
                          className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:border-blue-550 focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 border border-slate-200 rounded-xl space-y-3">
                    <h5 className="text-sm font-semibold text-gray-800 flex items-center space-x-1.5">
                      <span className="w-1.5 h-3 bg-red-500 rounded-sm inline-block"></span>
                      <span>Alergias & Crises</span>
                    </h5>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Alergias Conhecidas</label>
                        <input
                          type="text"
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={alergias}
                          onChange={(e) => setAlergias(e.target.value)}
                          className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Grau de Dependência *</label>
                        <select
                          disabled={isCurrentlyDeactivated || isColaborador}
                          value={grauDependencia}
                          onChange={(e) => setGrauDependencia(e.target.value as any)}
                          className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
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
                  <label className="block text-sm font-medium text-gray-700">Observações Clínicas Gerais:</label>
                  <textarea
                    disabled={isCurrentlyDeactivated || isColaborador}
                    value={observacoesClinicas}
                    onChange={(e) => setObservacoesClinicas(e.target.value)}
                    rows={3}
                    className="w-full text-sm p-2.5 bg-white border border-slate-300 rounded-lg text-gray-900 font-normal focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed shadow-none"
                  />
                </div>
              </div>
            )}

            {activeTab === 'plano' && !isColaborador && (
              <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">CONFIGURAÇÃO DE ESCALA (PLANTÃO PRINCIPAL)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1 col-span-1 md:col-span-1">
                    <label className="block text-xs font-normal text-slate-700">Tipo de Escala Principal</label>
                    <select
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
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
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                      value={horaInicioPadrao}
                      onChange={(e) => setHoraInicioPadrao(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Valor do Plantão (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                      value={valorSugeridoPlantao}
                      onChange={(e) => setValorSugeridoPlantao(mascaraFinanceira(e.target.value))}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed font-normal text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Valor Transporte (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                      value={valorTransporte}
                      onChange={(e) => {
                        const formatted = mascaraFinanceira(e.target.value);
                        setValorTransporte(formatted);
                        const valNum = converterMascaraParaNumero(formatted);
                        const alimNum = converterMascaraParaNumero(valorAlimentacao);
                        setAjudaCusto(formatarMoeda(valNum + alimNum));
                      }}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Valor Alimentação (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                      value={valorAlimentacao}
                      onChange={(e) => {
                        const formatted = mascaraFinanceira(e.target.value);
                        setValorAlimentacao(formatted);
                        const transNum = converterMascaraParaNumero(valorTransporte);
                        const valNum = converterMascaraParaNumero(formatted);
                        setAjudaCusto(formatarMoeda(transNum + valNum));
                      }}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-600"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-normal text-slate-700">Tx Adm (R$)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                      value={taxaAdm}
                      onChange={(e) => setTaxaAdm(mascaraFinanceira(e.target.value))}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100/80 disabled:cursor-not-allowed text-slate-600"
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
                    {!showExtraForm ? (
                      <div className="flex justify-start">
                        <button
                          type="button"
                          disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                          onClick={() => setShowExtraForm(true)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>+ Incluir Plantão Adicional</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-normal text-slate-600">Tipo da Escala</label>
                            <select
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
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
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                              value={newSubHoraInicio}
                              onChange={(e) => setNewSubHoraInicio(e.target.value)}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-normal text-slate-600">Valor Plantão (R$)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                              value={newSubValorPlantao}
                              onChange={(e) => setNewSubValorPlantao(mascaraFinanceira(e.target.value))}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-normal text-slate-600">Transporte (R$)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                              value={newSubValorTransporte}
                              onChange={(e) => {
                                const formatted = mascaraFinanceira(e.target.value);
                                setNewSubValorTransporte(formatted);
                                const transNum = converterMascaraParaNumero(formatted);
                                const alimNum = converterMascaraParaNumero(newSubValorAlimentacao);
                                setNewSubAjudaCusto(formatarMoeda(transNum + alimNum));
                              }}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-normal text-slate-600">Alimentação (R$)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                              value={newSubValorAlimentacao}
                              onChange={(e) => {
                                const formatted = mascaraFinanceira(e.target.value);
                                setNewSubValorAlimentacao(formatted);
                                const transNum = converterMascaraParaNumero(newSubValorTransporte);
                                const alimNum = converterMascaraParaNumero(formatted);
                                setNewSubAjudaCusto(formatarMoeda(transNum + alimNum));
                              }}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[10px] font-normal text-slate-600">Tx Adm (R$)</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                              value={newSubTaxaAdm}
                              onChange={(e) => setNewSubTaxaAdm(mascaraFinanceira(e.target.value))}
                              className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-white font-normal"
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end items-center">
                          <button
                            type="button"
                            disabled={userRole?.toLowerCase() === 'colaborador'}
                            onClick={() => {
                              setEditingSubId(null);
                              setNewSubTipoEscala('Diurno 12h');
                              setNewSubHoraInicio('07:00');
                              setNewSubValorPlantao('150,00');
                              setNewSubAjudaCusto('0,00');
                              setNewSubValorTransporte('0,00');
                              setNewSubValorAlimentacao('0,00');
                              setNewSubTaxaAdm('0,00');
                              setShowExtraForm(false);
                            }}
                            className="mr-2 px-3 py-1.5 text-xs font-semibold text-slate-750 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                            onClick={() => {
                              if (userRole?.toLowerCase() === 'colaborador') {
                                toast.error('Acesso Negado: Usuários com perfil Colaborador não possuem permissão para realizar alterações no Plano de Atendimento.');
                                return;
                              }
                              if (editingSubId) {
                                setNewSubValorPlantao(formatarMoeda(converterMascaraParaNumero(newSubValorPlantao)));
                                setNewSubAjudaCusto(formatarMoeda(converterMascaraParaNumero(newSubAjudaCusto)));
                                setNewSubValorTransporte(formatarMoeda(converterMascaraParaNumero(newSubValorTransporte)));
                                setNewSubValorAlimentacao(formatarMoeda(converterMascaraParaNumero(newSubValorAlimentacao)));
                                setNewSubTaxaAdm(formatarMoeda(converterMascaraParaNumero(newSubTaxaAdm)));

                                setTiposPlantao(tiposPlantao.map(t => t.id === editingSubId ? {
                                  ...t,
                                  tipoEscala: newSubTipoEscala,
                                  horaInicio: newSubHoraInicio,
                                  valorPlantao: converterMascaraParaNumero(newSubValorPlantao),
                                  ajudaCusto: converterMascaraParaNumero(newSubAjudaCusto),
                                  valorTransporte: converterMascaraParaNumero(newSubValorTransporte),
                                  valorAlimentacao: converterMascaraParaNumero(newSubValorAlimentacao),
                                  taxaAdm: converterMascaraParaNumero(newSubTaxaAdm)
                                } : t));
                                setEditingSubId(null);
                              } else {
                                const newType: EscalacaoPlano = {
                                  id: `tp-${Date.now()}`,
                                  tipoEscala: newSubTipoEscala,
                                  horaInicio: newSubHoraInicio,
                                  valorPlantao: converterMascaraParaNumero(newSubValorPlantao),
                                  ajudaCusto: converterMascaraParaNumero(newSubAjudaCusto),
                                  valorTransporte: converterMascaraParaNumero(newSubValorTransporte),
                                  valorAlimentacao: converterMascaraParaNumero(newSubValorAlimentacao),
                                  taxaAdm: converterMascaraParaNumero(newSubTaxaAdm),
                                };
                                setTiposPlantao([...tiposPlantao, newType]);
                              }
                              // Reset inputs to default values
                              setNewSubValorPlantao('150,00');
                              setNewSubAjudaCusto('0,00');
                              setNewSubValorTransporte('0,00');
                              setNewSubValorAlimentacao('0,00');
                              setNewSubTaxaAdm('0,00');
                              setShowExtraForm(false);
                            }}
                            className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>{editingSubId ? 'Salvar Edição' : 'Adicionar Modo de Plantão'}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Table of configured shifts, containing complete list (Principal + Additionals) */}
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs mb-4">
                    <table className="min-w-[700px] w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 font-semibold">
                          <th className="py-3 px-4 font-semibold text-slate-800 text-sm">Tipo do Plantão</th>
                          <th className="py-3 px-4 text-center font-semibold text-slate-800 text-sm">Horário de Início</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-800 text-sm">Valor Plantão</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-800 text-sm">Aj. de Custo</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-800 text-sm">Taxa Adm</th>
                          <th className="py-3 px-4 text-center w-48 font-semibold text-slate-800 text-sm">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-gray-900 text-sm md:text-base">
                        {allRows.map((tp, index) => (
                          <tr key={`tp-${tp.id}-${index}`} className={`transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                            <td className="py-3 px-4 font-normal text-gray-905 text-gray-900 flex items-center space-x-2">
                              <span>{tp.tipoEscala}</span>
                              {tp.isPrincipal && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                                  ⭐ Principal
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-mono bg-slate-50/35 text-sm">{tp.horaInicio}</td>
                            <td className="py-3 px-4 text-right font-normal text-slate-900">R$ {(Number(tp.valorPlantao) || 0).toFixed(2).replace('.', ',')}</td>
                            <td className="py-3 px-4 text-right text-slate-600 font-normal">R$ {(Number(tp.ajudaCusto) || 0).toFixed(2).replace('.', ',')}</td>
                            <td className="py-3 px-4 text-right text-slate-600 font-normal">R$ {(Number(tp.taxaAdm) || 0).toFixed(2).replace('.', ',')}</td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                {tp.isPrincipal ? (
                                  <>
                                    <span className="text-xs text-slate-400 italic mr-1">Padrão</span>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                                      onClick={() => handleDeletePlantao(tp.id, true)}
                                      className="py-1 px-2.5 border border-red-200 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-xs"
                                      title="Limpar plantão principal"
                                    >
                                      <Trash2 size={13} />
                                      <span>Excluir</span>
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                                      onClick={() => {
                                        setEditingSubId(tp.id);
                                        setNewSubTipoEscala(tp.tipoEscala);
                                        setNewSubHoraInicio(tp.horaInicio);
                                        setNewSubValorPlantao(formatarMoeda(tp.valorPlantao));
                                        setNewSubAjudaCusto(formatarMoeda(tp.ajudaCusto));
                                        setNewSubValorTransporte(formatarMoeda(tp.valorTransporte ?? tp.ajudaCusto ?? 0));
                                        setNewSubValorAlimentacao(formatarMoeda(tp.valorAlimentacao ?? 0));
                                        setNewSubTaxaAdm(formatarMoeda(tp.taxaAdm));
                                        setShowExtraForm(true);
                                      }}
                                      className="py-1 px-2.5 border border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-xs"
                                      title="Editar formato"
                                    >
                                      <Edit2 size={13} />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isCurrentlyDeactivated || userRole?.toLowerCase() === 'colaborador'}
                                      onClick={() => handleDeletePlantao(tp.id, false)}
                                      className="py-1 px-2.5 border border-red-200 text-red-650 hover:bg-red-50 hover:text-red-750 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold inline-flex items-center space-x-1 cursor-pointer text-xs"
                                      title="Excluir plantão adicional"
                                    >
                                      <Trash2 size={13} />
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

                {userRole?.toLowerCase() === 'colaborador' && (
                  <div className="flex justify-end pt-4 border-t border-slate-100 items-center justify-between">
                    <span className="text-xs text-amber-600 font-semibold italic flex items-center gap-1.5 bg-amber-50 border border-amber-200 p-2 rounded-lg">
                      ⚠️ Apenas administradores podem alterar as regras e valores do Plano de Atendimento.
                    </span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'plano' && isColaborador && (
              <div className="w-full max-w-xl mx-auto bg-rose-50/50 border border-rose-200 rounded-2xl p-6 text-center space-y-3 mt-6 mb-12">
                <AlertOctagon className="w-10 h-10 text-rose-600 mx-auto animate-bounce" />
                <h4 className="font-bold text-rose-800 text-sm">Acesso Negado</h4>
                <p className="text-xs text-rose-600 leading-relaxed">
                  Usuários com perfil Colaborador não possuem permissão para acessar o Plano de Atendimento deste paciente. Redirecionando...
                </p>
              </div>
            )}

            {activeTab === 'agendamento' && (
              <div className="w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-4 animate-in fade-in-30 slide-in-from-right-3">
                {/* Operations Header Buttons Deck - RH Gestão Domiciliar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">🛠️ Controles de Escala Operacional</span>
                  <div className="flex flex-wrap gap-2.5 items-center justify-start">
                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        setServicoExtraDesc('Visita de Enfermeira');
                        setServicoExtraCustomDesc('');
                        setServicoExtraData(new Date().toISOString().slice(0, 10));
                        setServicoExtraValor('');
                        setIsServicoExtraModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-blue-600 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <PlusCircle size={14} />
                      <span>+ Serviço Extra</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsFaturaModalOpen(true)}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-emerald-600 shadow-lg shadow-emerald-500/50 hover:shadow-emerald-500/80 cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <Receipt size={14} />
                      <span>Gerar Fatura</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        setOpenedFrom('button');
                        setAgnCalendarYear(calendarYear);
                        setAgnCalendarMonth(calendarMonth);
                        setSelectedDates([]);
                        setAvulsoProf('');
                        setAvulsoPlantaoOptionId('principal');
                        setAvulsoTipoDia('Normal');
                        setAvulsoObs('');
                        setAvulsoCuringa(false);
                        setAvulsoModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-sky-600 shadow-lg shadow-sky-500/50 hover:shadow-sky-500/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <Plus size={14} />
                      <span>Agendar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPreviaFinanceiraModalOpen(true)}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-purple-600 shadow-lg shadow-purple-500/50 hover:shadow-purple-500/80 cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <Calculator size={14} />
                      <span>Prévia Financeira</span>
                    </button>

                    {isCurrentMonthConcluded && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-black shadow-xs font-sans">
                        <Lock size={14} className="text-amber-700" />
                        <span>Escala Concluída</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                        const formattedLastDay = String(lastDay).padStart(2, '0');
                        setConcluirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setConcluirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${formattedLastDay}`);
                        setConcluirModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-indigo-600 shadow-lg shadow-indigo-500/50 hover:shadow-indigo-500/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <Check size={14} />
                      <span>Concluir</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                        const formattedLastDay = String(lastDay).padStart(2, '0');
                        setReabrirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setReabrirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${formattedLastDay}`);
                        setReabrirModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-amber-600 shadow-lg shadow-amber-500/50 hover:shadow-amber-500/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <RotateCcw size={14} />
                      <span>Reabrir</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCurrentlyDeactivated}
                      onClick={() => {
                        const lastDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                        const formattedLastDay = String(lastDay).padStart(2, '0');
                        setExcluirStartDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-01`);
                        setExcluirEndDate(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${formattedLastDay}`);
                        setExcluirModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-rose-600 shadow-lg shadow-rose-500/50 hover:shadow-rose-500/80 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <X size={14} />
                      <span>Exclusão</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBaixarFaturaExcel}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-amber-500 shadow-lg shadow-amber-400/50 hover:shadow-amber-400/80 cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Excel (.xlsx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBaixarFaturaWord}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-blue-600 shadow-lg shadow-blue-500/50 hover:shadow-blue-500/80 cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <Printer size={14} />
                      <span>Word (.docx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBaixarFaturaPng}
                      className="px-4 py-2 rounded-lg font-semibold text-white transition-all duration-300 transform hover:-translate-y-1 bg-teal-600 shadow-lg shadow-teal-500/50 hover:shadow-teal-500/80 cursor-pointer flex items-center space-x-1.5 text-xs font-sans"
                    >
                      <FileText size={14} />
                      <span>Baixar Fatura (PDF)</span>
                    </button>
                    
                  </div>
                </div>

                {calendarView === 'calendario' && (() => {
                  const gridDays = getDaysInMonthGrid(calendarMonth, calendarYear, brasilApiHolidays);
                  const currentMonthDays = gridDays.filter(cell => cell.isCurrentMonth);
                  
                  // Filter agendamentos for this patient in the current month
                  const patientAgendamentosThisMonth = agendamentos.filter(
                    (s) => s.idPaciente === (paciente?.id || '') && s.data.startsWith(`${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`)
                  );

                  // Extract unique professionals from these agendamentos, fallback if empty
                  let uniqueProfsThisMonth = Array.from(new Set(
                    patientAgendamentosThisMonth.map(s => s.nomeProfissional || 'Administrativa / Geral')
                  )).sort();

                  if (uniqueProfsThisMonth.length === 0) {
                    uniqueProfsThisMonth = ['Administrativa / Geral'];
                  }

                  const getDayOfWeekName = (dateStr: string) => {
                    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                    const d = new Date(dateStr + 'T12:00:00');
                    return days[d.getDay()] || '';
                  };

                  return (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm space-y-6 animate-in fade-in-30">
                      {/* Navigation control */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
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
                              const today = new Date();
                              setCalendarMonth(today.getMonth());
                              setCalendarYear(today.getFullYear());
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            MÊS
                          </button>

                          <h2 className="text-sm font-black text-slate-800 tracking-tight font-sans">
                            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} {calendarYear}
                          </h2>
                        </div>
                      </div>

                      {/* Contêiner Externo (Proteção Mobile) */}
                      <div className="w-full overflow-x-auto shadow-sm">
                        {/* A Grade (O Calendário em si) */}
                        <div className="min-w-[700px] lg:min-w-0 w-full grid grid-cols-7 gap-px bg-gray-300 border border-gray-300">
                          {/* Cabeçalho (Dias da Semana) */}
                          {[
                            { label: 'Domingo', color: 'bg-rose-500' },
                            { label: 'Segunda', color: 'bg-orange-500' },
                            { label: 'Terça', color: 'bg-sky-500' },
                            { label: 'Quarta', color: 'bg-green-600' },
                            { label: 'Quinta', color: 'bg-amber-500' },
                            { label: 'Sexta', color: 'bg-blue-600' },
                            { label: 'Sábado', color: 'bg-lime-600' }
                          ].map((day) => (
                            <div key={day.label} className={`p-3 text-center text-white font-bold ${day.color}`}>
                              {day.label}
                            </div>
                          ))}

                          {/* Células dos Dias (Os Quadrados) */}
                          {gridDays.map((cell) => {
                            const today = new Date();
                            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                            const isToday = cell.dateStr === todayStr;
                            const isSpecialHoliday = cell.holiday !== undefined;

                            // Filter agendamentos for this date and patient (Garantia de vínculo: data e idPaciente)
                            const rawDayAgendamentos = agendamentos.filter(
                              (s) => s.data === cell.dateStr && s.idPaciente === (paciente?.id || '')
                            );
                            const dayAgendamentos: Agendamento[] = [];
                            const seenIds = new Set<string>();
                            for (const s of rawDayAgendamentos) {
                              if (s.id && !seenIds.has(s.id)) {
                                seenIds.add(s.id);
                                dayAgendamentos.push(s);
                              }
                            }

                            return (
                              <div
                                key={cell.dateStr}
                                onClick={() => {
                                  if (isCurrentlyDeactivated) return;
                                  if (isMesConcluido(cell.dateStr)) {
                                    const [yr, mo] = cell.dateStr.split('-');
                                    toast.error(`Esta escala de ${mo}/${yr} já está concluída.`);
                                    return;
                                  }
                                  const [yr, mo, da] = cell.dateStr.split('-').map(Number);
                                  setOpenedFrom('calendar_cell');
                                  setAgnCalendarYear(yr);
                                  setAgnCalendarMonth(mo - 1);
                                  setSelectedDates([{ date: cell.dateStr, cycle: 1 }]);
                                  setAvulsoProf('');
                                  setAvulsoPlantaoOptionId('principal');
                                  setAvulsoTipoDia('Normal');
                                  setAvulsoObs('');
                                  setAvulsoCuringa(false);
                                  setAvulsoModalOpen(true);
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    type: 'day',
                                    targetDate: cell.dateStr
                                  });
                                }}
                                className={`bg-white min-h-[140px] p-2 flex flex-col hover:bg-gray-50 transition-colors cursor-pointer ${!cell.isCurrentMonth ? 'opacity-40' : ''}`}
                              >
                                {/* Número do Dia isolado no topo à direita com holiday se houver */}
                                <div className="flex items-center justify-between">
                                  {isSpecialHoliday ? (
                                    <span className="text-[8px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1 py-0.2 rounded truncate max-w-[75px]" title={cell.holiday}>
                                      🎉 {cell.holiday}
                                    </span>
                                  ) : (
                                    <div />
                                  )}
                                  <span className={`text-right text-sm font-semibold ${isToday ? 'text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full font-black' : 'text-gray-700'}`}>
                                    {cell.dayNumber}
                                  </span>
                                </div>

                                {/* Área de Plantões/Consultas */}
                                <div className="flex-1 mt-2 space-y-1 overflow-y-auto">
                                  {dayAgendamentos.map((ag) => {
                                    const isCancelled = ag.status === 'Cancelado';
                                    const isConcluido = ag.status === 'Concluido';
                                    const isFalta = ag.considerarFalta === true || (ag as any).atendimentoRealizado === 'Não' || (ag.status as string) === 'Falta' || (ag.status as string) === 'falta';

                                    const isCuringa = !!ag.isCuringa || ag.observacao?.toUpperCase().includes('CURINGA');
                                    const is50 = ag.tipoDia === 'Feriado 50%' || ag.tipoDia?.includes('50%') || ag.observacao?.includes('50%');
                                    const is20 = ag.tipoDia === 'Feriado 20%' || ag.tipoDia?.includes('20%') || ag.observacao?.includes('20%');

                                    let cardBgBorder = 'bg-blue-50/90 border-slate-250 text-slate-800 hover:bg-blue-100/90 hover:border-blue-300 shadow-3xs';
                                    if (isCancelled) {
                                      cardBgBorder = 'bg-slate-100 border-slate-200 text-slate-400 line-through';
                                    } else if (isFalta) {
                                      cardBgBorder = 'bg-rose-50 border-rose-300 text-rose-950 font-medium';
                                    } else if (isCuringa) {
                                      cardBgBorder = 'bg-purple-50 border-purple-300 text-purple-950 font-bold hover:bg-purple-100 hover:border-purple-400 shadow-3xs';
                                    } else if (is50) {
                                      cardBgBorder = 'bg-orange-50 border-orange-300 text-orange-950 font-bold hover:bg-orange-100 hover:border-orange-400 shadow-3xs';
                                    } else if (is20) {
                                      cardBgBorder = 'bg-amber-50 border-amber-300 text-amber-950 font-bold hover:bg-amber-100 hover:border-amber-400 shadow-3xs';
                                    } else if (isConcluido) {
                                      cardBgBorder = 'bg-slate-100 border-slate-300 text-slate-700 font-bold';
                                    }

                                    const profName = ag.nomeProfissional || 'Geral';
                                    const shiftTurno = (ag as any).tipoPlantao || (ag as any).turno || (ag as any).tipo || (ag as any).tipoEscala || getShiftNameForAgendamento(ag) || '';
                                    const shiftHorario = ag.horario || '';

                                    let statusStr = 'Normal';
                                    if (isCancelled) statusStr = 'Cancelado';
                                    else if (isFalta) statusStr = 'Falta Registrada';
                                    else if (isCuringa) statusStr = 'Curinga';
                                    else if (is50) statusStr = 'Feriado 50%';
                                    else if (is20) statusStr = 'Feriado 20%';
                                    else if (isConcluido) statusStr = 'Concluído';

                                    const fullTooltip = `${profName}${shiftTurno ? ` - ${shiftTurno}` : ''}${shiftHorario ? ` - ${shiftHorario}` : ''}${statusStr ? ` - ${statusStr}` : ''}${ag.observacao ? ` (${ag.observacao})` : ''}`;

                                    return (
                                      <div
                                        key={ag.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
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
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            type: 'shift',
                                            targetShift: ag
                                          });
                                        }}
                                        className={`p-1.5 border rounded-lg cursor-pointer flex flex-col text-left w-full transition-all duration-150 relative space-y-0.5 hover:-translate-y-0.5 group/shift ${cardBgBorder}`}
                                        title={fullTooltip}
                                      >
                                        {/* Copy Shift Button */}
                                        <button
                                          type="button"
                                          onClick={(e) => handleCopyShift(ag, e)}
                                          className="absolute right-1 top-1 hidden group-hover/shift:inline-flex items-center justify-center text-[7px] bg-white hover:bg-blue-50 text-slate-550 hover:text-blue-600 p-0.5 rounded border border-slate-200 transition-all shadow-3xs z-25 cursor-pointer"
                                          title="Copiar este Plantão"
                                        >
                                          <Copy size={7} />
                                        </button>

                                        <div className="flex justify-between items-center gap-1.5 w-full min-w-0">
                                          <span className={`flex-1 min-w-0 truncate font-bold text-[10px] leading-tight ${isFalta ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                                            {profName}
                                          </span>
                                          <div className="flex items-center space-x-0.5 shrink-0">
                                            {isFalta && (
                                              <span className="px-1 py-[0.2px] text-[6.5px] font-black uppercase bg-rose-200 text-rose-900 border border-rose-300 rounded font-sans">FALTA</span>
                                            )}
                                            {isCuringa && (
                                              <span className="px-1 py-[0.2px] text-[6.5px] font-black uppercase bg-purple-200 text-purple-900 border border-purple-300 rounded font-sans" title="Plantão Curinga">Curinga</span>
                                            )}
                                            {is50 && (
                                              <span className="px-1 py-[0.2px] text-[6.5px] font-black uppercase bg-orange-200 text-orange-900 border border-orange-300 rounded font-sans" title="Feriado +50%">50%</span>
                                            )}
                                            {is20 && (
                                              <span className="px-1 py-[0.2px] text-[6.5px] font-black uppercase bg-amber-200 text-amber-900 border border-amber-300 rounded font-sans" title="Feriado +20%">20%</span>
                                            )}
                                            {!isCuringa && !is50 && !is20 && !isFalta && !isCancelled && (
                                              <span className="px-1 py-[0.2px] text-[6.5px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200 rounded font-sans">Normal</span>
                                            )}
                                            {isConcluido && <span className="text-[8px]" title="Escala Fechada">🔒</span>}
                                          </div>
                                        </div>

                                        {shiftTurno && (
                                          <div className="text-[9px] text-slate-600 font-medium truncate leading-tight">
                                            {shiftTurno}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Legend and tips */}
                      <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 bg-slate-50 p-3.5 rounded-xl gap-2 font-mono border border-slate-100">
                        <span>💡 <strong>Legenda do Calendário:</strong> Identificação visual por tipo de dia e adicional.</span>
                        <div className="flex items-center space-x-2 shrink-0 font-extrabold flex-wrap gap-y-1">
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-100 border border-slate-300 rounded-xs mr-1"></span> Normal</span>
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-amber-100 border border-amber-300 rounded-xs mr-1"></span> 20%</span>
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-orange-100 border border-orange-300 rounded-xs mr-1"></span> 50%</span>
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-purple-100 border border-purple-300 rounded-xs mr-1"></span> Curinga</span>
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-slate-200 border border-slate-300 rounded-xs mr-1"></span> Fechado 🔒</span>
                          <span className="flex items-center"><span className="w-2.5 h-2.5 bg-rose-200 border border-rose-300 rounded-xs mr-1"></span> Falta/Cancelado 🔴</span>
                        </div>
                      </div>

                      {/* Context Menus */}
                      {contextMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setContextMenu(null)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setContextMenu(null);
                            }}
                          />
                          <div
                            className="fixed bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 min-w-[200px] text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                            style={{
                              top: contextMenu.y,
                              left: contextMenu.x,
                            }}
                          >
                            {contextMenu.type === 'shift' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setClipboardAgendamento(contextMenu.targetShift || null);
                                  toast.success('Agendamento copiado');
                                  setContextMenu(null);
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-semibold hover:bg-slate-50 flex items-center space-x-2 text-slate-700 cursor-pointer"
                              >
                                <Copy size={13.5} className="text-slate-400" />
                                <span>Copiar Agendamento</span>
                              </button>
                            )}

                            {contextMenu.type === 'day' && (
                              <>
                                <div className="px-3.5 py-1.5 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider select-none font-sans">
                                  Opções de Agendamento
                                </div>
                                {clipboardAgendamento ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (contextMenu.targetDate) {
                                        await handlePasteClipboardToDate(contextMenu.targetDate);
                                      }
                                      setContextMenu(null);
                                    }}
                                    className="w-full px-3.5 py-2 text-left text-xs font-bold hover:bg-emerald-50 hover:text-emerald-700 flex items-center space-x-2 text-emerald-600 cursor-pointer font-sans"
                                  >
                                    <Check size={13.5} className="text-emerald-500" />
                                    <span>Colar Agendamento</span>
                                  </button>
                                ) : (
                                  <div className="px-3.5 py-2 text-left text-xs text-slate-400 italic select-none font-sans">
                                    Nenhum agendamento copiado
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
 
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
                          className="w-full text-xs p-2 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                        />
                        {showProfDropdown && (
                          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-20 divide-y divide-slate-100 font-sans">
                            <div className="p-1.5 text-[9px] uppercase font-mono tracking-wider text-slate-400 bg-slate-50/50">
                              Profissionais Cadastrados (Aba de Profissionais):
                            </div>
                            {profissionais.filter(p =>
                              (removerAcentos(p.nome || '').includes(removerAcentos(newShiftProf || '')) ||
                              removerAcentos(p.especialidade || '').includes(removerAcentos(newShiftProf || ''))) &&
                              p.status === 'Ativo' &&
                              !isBlockedBidirectional(p)
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
                              (removerAcentos(p.nome || '').includes(removerAcentos(newShiftProf || '')) ||
                              removerAcentos(p.especialidade || '').includes(removerAcentos(newShiftProf || ''))) &&
                              p.status === 'Ativo' &&
                              !isBlockedBidirectional(p)
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
                                toast.error('Esta data já foi incluída na lista.');
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
                                    toast.error('Selecione as datas de início e fim.');
                                    return;
                                  }
                                  const start = new Date(batchStartDate + 'T12:00:00');
                                  const end = new Date(batchEndDate + 'T12:00:00');
                                  if (end < start) {
                                    toast.error('A data de término deve ser maior ou igual à data de início.');
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
                                    toast.error('Nenhuma data encontrada correspondente aos dias marcados no período.');
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
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-gray-800 font-semibold">
                        <th className="py-3 px-4 text-sm font-semibold text-gray-850 text-slate-800">Data</th>
                        <th className="py-3 px-4 text-sm font-semibold text-gray-850 text-slate-800">Profissional Alocado</th>
                        <th className="py-3 px-4 text-center text-sm font-semibold text-gray-850 text-slate-800">Status</th>
                        <th className="py-3 px-4 text-center text-sm font-semibold text-gray-850 text-slate-800">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-gray-900 text-sm md:text-base">
                      {isNew || filteredShiftsForPatient.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-gray-500 italic font-normal">
                            Nenhum plantão ativo programado para este paciente no sistema.
                          </td>
                        </tr>
                      ) : (
                        filteredShiftsForPatient.map((item, index) => {
                          const isCancelled = item.status === 'Cancelado';
                          return (
                            <tr
                              key={item.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isCancelled ? 'bg-rose-50/10 text-slate-400 line-through' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                              }`}
                            >
                              {/* Date & Weekday */}
                              <td className="py-3 px-4">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                  <div className="flex items-center space-x-1.5 whitespace-nowrap">
                                    <span className="font-semibold text-gray-905">{item.diaSemana}</span>
                                    <span className="text-slate-400">-</span>
                                    <span className="font-mono font-normal text-gray-900">{new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
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
                                      className={`px-2.5 py-1 text-xs font-semibold rounded-l-md border ${
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
                                      className={`px-2.5 py-1 text-xs font-semibold border-t border-b border-r ${
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
                                      className={`px-2.5 py-1 text-xs font-semibold rounded-r-md border-t border-b border-r ${
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
                              <td className="py-3 px-4 font-normal text-gray-900 text-base">
                                <div className="flex flex-col space-y-1">
                                  <span className="font-semibold">{item.profissional}</span>
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {(item.observacaoAgendamento?.includes('CURINGA') || item.profissional === 'CURINGA') && (
                                      <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wide bg-amber-100 text-amber-805 border border-amber-250 rounded">Curinga</span>
                                    )}
                                    {item.feriado === '20%' && (
                                      <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wide bg-blue-100 text-blue-805 border border-blue-200 rounded">+20%</span>
                                    )}
                                    {item.feriado === '50%' && (
                                      <span className="px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wide bg-rose-100 text-rose-805 border border-rose-200 rounded">+50%</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Status indicators */}
                              <td className="py-3 px-4 text-center">
                                {item.status === 'Confirmado' ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase">
                                    CONFIRMADO🟢
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-1">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 uppercase">
                                      CANCELADO🔴
                                    </span>
                                    {item.motivoCancelamento && (
                                      <span className="text-xs text-rose-800 block italic font-mono bg-rose-50 p-1 border border-rose-100 rounded leading-none max-w-[150px] truncate" title={item.motivoCancelamento}>
                                        {item.motivoCancelamento}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Actions column */}
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerEditShift(item)}
                                    title="Editar Profissional ou Data deste plantão"
                                    className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
                                  >
                                    ✏️ Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAgendamento(item.id)}
                                    title="Excluir permanentemente"
                                    className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-105 transition-colors cursor-pointer"
                                  >
                                    🗑️ Excluir
                                  </button>
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

            {activeTab === 'auditoria' && (
              <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-6 animate-in fade-in-30 slide-in-from-right-3">
                <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">HISTÓRICO DE AUDITORIA</h4>
                {loadingAuditLogs ? (
                  <div className="flex justify-center items-center py-10">
                    <svg className="animate-spin h-6 w-6 text-[#254A34]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-3 text-xs text-slate-500">Carregando logs do paciente...</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-xs">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/50">
                          <th className="text-left py-3.5 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Data</th>
                          <th className="text-left py-3.5 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Usuário</th>
                          <th className="text-left py-3.5 px-4 text-slate-500 font-bold uppercase tracking-wider text-[10px]">Ação</th>
                          <th className="text-left py-3.5 px-4 text-slate-500 font-medium uppercase tracking-wider text-[10px]">Descrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(() => {
                          const logsToDisplay = localAuditLogs.length > 0 
                            ? localAuditLogs 
                            : logsAuditoria.filter(log => log.documentId === paciente?.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                          if (logsToDisplay.length === 0) {
                            return (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400">Nenhum log encontrado para este paciente.</td>
                              </tr>
                            );
                          }

                          return logsToDisplay.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/60 transition-all duration-150 align-top">
                              <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap font-medium">{new Date(log.timestamp).toLocaleString()}</td>
                              <td className="py-3.5 px-4 text-slate-700 max-w-[130px] truncate leading-relaxed" title={log.userId}>{log.userId || 'Sistema'}</td>
                              <td className="py-3.5 px-4 text-slate-705 font-bold text-emerald-700 leading-relaxed">{log.action}</td>
                              <td className="py-3.5 px-4 text-slate-600 leading-relaxed">{log.description}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ocorrencias' && (
              <div className="w-full max-w-xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-6 md:p-8 mt-6 mb-12 space-y-6 animate-in fade-in-30 slide-in-from-right-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 uppercase tracking-wider italic">
                    {editingOcorrenciaId ? 'EDITAR OCORRÊNCIA' : 'CADASTRAR NOVA OCORRÊNCIA'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-normal text-slate-700">Data da Ocorrência *</label>
                      <input
                        type="date"
                        disabled={isColaborador}
                        value={ocData}
                        onChange={(e) => setOcData(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-normal text-slate-700">Profissional Envolvido</label>
                      <select
                        disabled={isColaborador}
                        value={ocProfId}
                        onChange={(e) => setOcProfId(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans"
                      >
                        <option value="">Nenhum (Ocorrência Administrativa / Geral)</option>
                        {profissionais.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nome} ({p.especialidade || p.profissao || 'Profissional'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="block text-xs font-normal text-slate-700">Descrição do Motivo *</label>
                      <textarea
                        rows={3}
                        disabled={isColaborador}
                        value={ocDescricao}
                        onChange={(e) => setOcDescricao(e.target.value)}
                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/55 focus:outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed font-sans"
                      />
                    </div>

                    {ocProfId && (
                      <div className="md:col-span-2 flex items-center space-x-2 py-1">
                        <input
                          type="checkbox"
                          id="check-bloquear-prof"
                          disabled={isColaborador}
                          checked={ocBloquear}
                          onChange={(e) => setOcBloquear(e.target.checked)}
                          className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <label htmlFor="check-bloquear-prof" className="text-xs font-semibold text-rose-700 cursor-pointer select-none disabled:opacity-50">
                          Bloquear este profissional para este paciente
                        </label>
                      </div>
                    )}
                  </div>

                  {!isColaborador && (
                    <div className="flex gap-2 justify-end mt-4">
                      {editingOcorrenciaId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOcorrenciaId(null);
                            setOcData(new Date().toISOString().split('T')[0]);
                            setOcProfId('');
                            setOcDescricao('');
                            setOcBloquear(false);
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Cancelar Edição
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={savingOcorrencia}
                        onClick={handleSaveOcorrencia}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/40 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save size={14} />
                        <span>{savingOcorrencia ? 'Salvando...' : 'Salvar Ocorrência'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Histórico list */}
                <div className="pt-6 border-t border-slate-100 font-sans">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Histórico de Ocorrências ({((pacientes.find(p => p.id === paciente?.id) || paciente)?.ocorrencias || []).length})
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBaixarOcorrenciasExcel}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-bold bg-[#1a3c2e] hover:bg-[#25523f] text-white rounded-lg transition active:scale-95"
                      >
                        <Receipt size={12} />
                        <span>Excel (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleBaixarOcorrenciasWord}
                        className="flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition active:scale-95"
                      >
                        <Printer size={12} />
                        <span>Word (.docx)</span>
                      </button>
                    </div>
                  </div>
                  
                  {(((pacientes.find(p => p.id === paciente?.id) || paciente)?.ocorrencias || []).length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-400 italic border border-dashed border-slate-200 rounded-xl">
                      Nenhuma ocorrência registrada para este paciente.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-300 text-gray-800 font-semibold text-xs uppercase tracking-wider">
                            <th className="py-3 px-4 text-sm font-semibold text-slate-800">Data</th>
                            <th className="py-3 px-4 text-sm font-semibold text-slate-800">Profissional</th>
                            <th className="py-3 px-4 text-sm font-semibold text-slate-800">Descrição / Relato</th>
                            <th className="py-3 px-4 text-center text-sm font-semibold text-slate-800">Status</th>
                            {!isColaborador && <th className="py-3 px-4 text-right text-sm font-semibold text-slate-800">Ações</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-gray-900 text-sm md:text-base">
                          {((pacientes.find(p => p.id === paciente?.id) || paciente)?.ocorrencias || []).map((oc, index) => (
                            <tr key={`oc-${oc.id || index}-${index}`} className={`transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                              <td className="py-3 px-4 whitespace-nowrap font-normal text-slate-500">
                                {oc.data ? oc.data.split('-').reverse().join('/') : '-'}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap font-semibold text-gray-900">
                                {oc.profissionalNome}
                              </td>
                              <td className="py-3 px-4 max-w-sm break-words text-gray-600 font-normal">
                                {oc.descricao}
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                {oc.bloquearProfissional ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    [ BLOQUEADO ]
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-605">
                                    Registrado
                                  </span>
                                )}
                              </td>
                              {!isColaborador && (
                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                  <div className="flex justify-end gap-2">
                                         <button
                                      type="button"
                                      onClick={() => handleDeleteOcorrencia(oc)}
                                      className="py-1 px-2.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded transition-colors text-xs font-medium cursor-pointer"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
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
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:outline-none focus:border-red-500"
              />
            </div>

            {/* Confirmation textbox */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Para autorizar, digite <span className="font-extrabold text-red-650 font-mono select-all">'CONFIRMAR'</span> abaixo:
              </label>
              <input
                type="text"
                value={deactivateConfirmInput}
                onChange={(e) => setDeactivateConfirmInput(e.target.value)}
                className="w-full text-xs font-mono font-bold tracking-widest px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-white uppercase focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAlertDeactivateOpen(false)}
                className="px-3.5 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeactivateConfirm}
                disabled={deactivateConfirmInput.trim().toUpperCase() !== 'CONFIRMAR'}
                className="px-4 py-2 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg font-bold shadow-md shadow-red-500/10 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed transition-all"
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
              <GlossyButton
                type="button"
                onClick={() => {
                  setCancelShiftModalOpen(false);
                  setSelectedShiftForCancel(null);
                }}
                variant="gray"
              >
                Voltar
              </GlossyButton>
              <GlossyButton
                type="button"
                onClick={handleConfirmCancelShift}
                variant="red"
                id="btn-confirm-cancel-shift"
              >
                Salvar Cancelamento
              </GlossyButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Shift/Professional Modal */}
      {editShiftModalOpen && (
        <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-4 font-sans">
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
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500"
                />
                {showEditProfDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 divide-y divide-slate-100 font-sans">
                    <div className="p-1.5 text-[9px] uppercase font-mono tracking-wider text-slate-400 bg-slate-50/50">
                      Profissionais Cadastrados (Aba de Profissionais):
                    </div>
                    {profissionais.filter(p =>
                      (removerAcentos(p.nome || '').includes(removerAcentos(editShiftProfName || '')) ||
                      removerAcentos(p.especialidade || '').includes(removerAcentos(editShiftProfName || ''))) &&
                      p.status === 'Ativo' &&
                      !isBlockedBidirectional(p)
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
                      (removerAcentos(p.nome || '').includes(removerAcentos(editShiftProfName || '')) ||
                      removerAcentos(p.especialidade || '').includes(removerAcentos(editShiftProfName || ''))) &&
                      p.status === 'Ativo' &&
                      !isBlockedBidirectional(p)
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
              <GlossyButton
                type="button"
                onClick={() => {
                  setEditShiftModalOpen(false);
                  setEditingShiftId(null);
                }}
                variant="gray"
              >
                Cancelar
              </GlossyButton>
              <GlossyButton
                type="button"
                onClick={handleSaveEditShift}
                variant="green"
              >
                Salvar Mudança
              </GlossyButton>
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
              Estrutura de dados NoSQL/Firestore homologada para faturamento corporativo no portal RH Gestão Domiciliar S.A.
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
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col p-6 space-y-4 font-sans">
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

            {isCurrentMonthConcluded && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs font-bold flex items-center gap-2 font-sans">
                <Lock size={16} className="text-amber-700 shrink-0" />
                <span>Esta escala já está concluída. Não é permitida a adição de novos agendamentos.</span>
              </div>
            )}

            <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-2 pb-4">
              {/* Professional Autocomplete Search Field */}
              <div className="space-y-1 relative">
                <label className="block text-xs font-bold text-slate-700">Alocar Profissional</label>
                <input
                  type="text"
                  value={avulsoProf}
                  onFocus={() => setShowAvulsoProfDropdown(true)}
                  onBlur={() => setTimeout(() => setShowAvulsoProfDropdown(false), 200)}
                  onChange={(e) => setAvulsoProf(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50 focus:outline-none focus:border-blue-500 font-sans"
                />
                {showAvulsoProfDropdown && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-55 divide-y divide-slate-100">
                    {profissionais
                      .filter(p =>
                        removerAcentos(p.nome || '').includes(removerAcentos(avulsoProf || '')) &&
                        p.status === 'Ativo' &&
                        !isBlockedBidirectional(p)
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

              {/* Data do(s) Plantão(ões) - Componente de Calendário Inline Multi-Date Picker */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Data do(s) Plantão(ões) <span className="text-slate-400 font-normal">(Clique nos dias para compor o lote)</span>
                  </label>
                  {selectedDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDates([])}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline transition-colors cursor-pointer"
                    >
                      Limpar Todas ({selectedDates.length})
                    </button>
                  )}
                </div>

                {/* Container do Calendário Inline */}
                <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3.5 shadow-2xs font-sans w-full space-y-2.5">
                  {/* Cabeçalho do Calendário com Navegação */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (agnCalendarMonth === 0) {
                          setAgnCalendarMonth(11);
                          setAgnCalendarYear(agnCalendarYear - 1);
                        } else {
                          setAgnCalendarMonth(agnCalendarMonth - 1);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                      title="Mês Anterior"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Calendar size={14} className="text-sky-600" />
                      <span>
                        {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][agnCalendarMonth]} {agnCalendarYear}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (agnCalendarMonth === 11) {
                          setAgnCalendarMonth(0);
                          setAgnCalendarYear(agnCalendarYear + 1);
                        } else {
                          setAgnCalendarMonth(agnCalendarMonth + 1);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all shadow-2xs cursor-pointer"
                      title="Próximo Mês"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Dias da Semana */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, index) => (
                      <div key={`cal-header-${index}`} className="py-0.5">{d}</div>
                    ))}
                  </div>

                  {/* Grid de Dias */}
                  <div className="grid grid-cols-7 gap-1 w-full">
                    {Array.from({ length: new Date(agnCalendarYear, agnCalendarMonth, 1).getDay() }).map((_, i) => (
                      <div key={`empty-${agnCalendarMonth}-${agnCalendarYear}-${i}`} className="h-9 w-full rounded-lg bg-transparent" />
                    ))}
                    {Array.from({ length: new Date(agnCalendarYear, agnCalendarMonth + 1, 0).getDate() }, (_, i) => i + 1).map((dayNum) => {
                      const formattedDate = `${agnCalendarYear}-${String(agnCalendarMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const isSelected = selectedDates.some(d => d.date === formattedDate);
                      const isToday = new Date().toDateString() === new Date(agnCalendarYear, agnCalendarMonth, dayNum).toDateString();
                      const isHoliday = feriados.some(f => f.date === formattedDate);
                      const isConcluded = isMesConcluido(formattedDate);

                      let stateClasses = 'bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-slate-200 shadow-2xs';

                      if (isSelected) {
                        stateClasses = 'bg-sky-600 hover:bg-sky-700 text-white font-black border border-sky-700 shadow-md shadow-sky-500/30 scale-100';
                      } else if (isConcluded) {
                        stateClasses = 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60';
                      } else if (isHoliday) {
                        stateClasses = 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 font-semibold';
                      } else if (isToday) {
                        stateClasses = 'bg-amber-50 hover:bg-amber-100 text-amber-950 border-2 border-amber-400 font-bold';
                      }

                      return (
                        <button
                          key={`${agnCalendarMonth}-${agnCalendarYear}-${dayNum}`}
                          type="button"
                          onClick={() => handleDateClick(formattedDate)}
                          className={`h-9 w-full rounded-lg flex items-center justify-center relative transition-all duration-150 cursor-pointer select-none text-xs font-semibold ${stateClasses}`}
                          title={isHoliday ? `Feriado (${formattedDate})` : isConcluded ? 'Mês Concluído' : formattedDate}
                        >
                          <span>{dayNum}</span>
                          {isSelected && (
                            <span className="absolute top-0.5 right-0.5 text-[8px] font-bold leading-none text-white/90">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo Visual em Pílulas (Tags Verdes com 'X') */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Plantões Selecionados ({selectedDates.length})
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl min-h-[42px]">
                    {selectedDates.length === 0 ? (
                      <span className="text-xs text-slate-400 italic px-1 flex items-center gap-1.5">
                        <Calendar size={13} className="text-slate-400" />
                        Nenhum dia selecionado. Clique nos dias do calendário acima para compor o lote.
                      </span>
                    ) : (
                      selectedDates
                        .slice()
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((item) => {
                          const [y, m, day] = item.date.split('-');
                          const displayDate = `${day}/${m}/${y}`;
                          return (
                            <span
                              key={item.date}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold shadow-2xs animate-in fade-in-50"
                            >
                              <span>{displayDate}</span>
                              {item.cycle === 2 && (
                                <span className="text-[10px] text-emerald-600 font-medium">(2º dia)</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedDates(prev => prev.filter(d => d.date !== item.date))}
                                className="text-emerald-600 hover:text-emerald-950 transition-colors p-0.5 rounded-full hover:bg-emerald-200/60 cursor-pointer"
                                title="Remover esta data"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              {/* Horário / Plantão Option Select Dropdown */}
              <div className="space-y-1 col-span-12">
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
              <div className="space-y-1 col-span-12">
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
              <CardBase className="mt-1 p-4 space-y-2.5">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider block border-b border-gray-100 pb-1.5">
                  Resumo Financeiro Estimado
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 text-xs text-gray-600 font-sans">
                  <span>Valor Líquido Repasse:</span>
                  <span className="font-semibold text-gray-900 text-right font-mono">R$ {computedRepasse.toFixed(2)}</span>
                  <span>Ajuda de Custo:</span>
                  <span className="font-semibold text-gray-900 text-right font-mono">R$ {computedAjuda.toFixed(2)}</span>
                  {userRole?.toLowerCase() === 'administrador' && (
                    <>
                      <span>Taxa Adm / Faturamento:</span>
                      <span className="font-semibold text-gray-900 text-right font-mono">R$ {computedTaxa.toFixed(2)}</span>
                    </>
                  )}
                  {userRole?.toLowerCase() === 'administrador' ? (
                    <div className="col-span-2 border-t border-gray-100 pt-2 flex justify-between font-bold text-sky-700">
                      <span>Faturamento Unid. Paciente:</span>
                      <span>R$ {(computedRepasse + computedTaxa + computedAjuda).toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="col-span-2 border-t border-gray-100 pt-2 flex justify-between font-bold text-emerald-700">
                      <span>Total Repasse + Ajuda:</span>
                      <span>R$ {(computedRepasse + computedAjuda).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedDates.length > 1 && (
                    <div className="col-span-2 border-t border-dashed border-indigo-100 pt-2 flex justify-between font-extrabold text-[#1a3c2e]">
                      <span>Total do Lote ({selectedDates.length}x):</span>
                      <span>
                        R$ {userRole?.toLowerCase() === 'administrador'
                          ? ((computedRepasse + computedTaxa + computedAjuda) * selectedDates.length).toFixed(2)
                          : ((computedRepasse + computedAjuda) * selectedDates.length).toFixed(2)
                        }
                      </span>
                    </div>
                  )}
                </div>
              </CardBase>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">Observações adicionais</label>
                <input
                  type="text"
                  value={avulsoObs}
                  onChange={(e) => setAvulsoObs(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-700 bg-slate-50/50 focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAvulsoModalOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={async (e) => {
                  e.preventDefault();
                  const success = await handleSalvarAgendamento();
                  if (success) {
                    setAvulsoModalOpen(false);
                  }
                }}
                className={`flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white font-medium rounded-lg shadow-lg shadow-blue-500/40 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isSaving ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                {isSaving ? 'Agendando...' : 'Confirmar e Agendar'}
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
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30 p-2 sm:p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] my-auto overflow-hidden font-sans">
              
              <div className="flex justify-between items-center border-b border-slate-100 px-5 py-4 shrink-0 bg-slate-50/50">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Info size={15} className="text-blue-600" />
                  <span>{isEditingDetails ? '✏️ Editar Plantão' : '📋 Detalhes do Plantão'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setDetailsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
              {!isEditingDetails ? (
                // View Mode
                (() => {
                  let viewMultiplier = 1.0;
                  if (selectedShiftForDetails.tipoDia === 'Feriado 20%') {
                    viewMultiplier = 1.2;
                  } else if (selectedShiftForDetails.tipoDia === 'Feriado 50%') {
                    viewMultiplier = 1.5;
                  }

                  const rawRepasse = parseNum(selectedShiftForDetails.valorRepasse || selectedShiftForDetails.valorPlantao);
                  const fallbackBase = rawRepasse > 0 ? rawRepasse : parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
                  const viewRepasseValue = (selectedShiftForDetails.considerarFalta ? 0 : fallbackBase) * viewMultiplier;
                  const viewTaxaValue = (selectedShiftForDetails.considerarFalta ? 0 : parseNum(selectedShiftForDetails.taxaAdm, parseNum(taxaAdm, 0))) * viewMultiplier;
                  const viewAjudaValue = selectedShiftForDetails.considerarFalta ? 0 : parseNum(selectedShiftForDetails.ajudaCusto, parseNum(ajudaCusto, 0));
                  const viewTotalValue = viewRepasseValue + viewTaxaValue + viewAjudaValue;

                  const fullAddress = paciente && paciente.endereco
                    ? `${paciente.endereco.rua || ''}, ${paciente.endereco.numero || ''} - ${paciente.bairro || paciente.endereco.bairro || ''}, ${paciente.endereco.cidade || ''}`
                    : paciente?.bairro || '';

                  return (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Paciente</span>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-800">{paciente?.nome || 'Paciente'}</p>
                          <button
                            type="button"
                            onClick={() => handleCopyToClipboard(paciente?.nome || '')}
                            className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Copiar Nome do Paciente"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>

                      {fullAddress && (
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Endereço de Atendimento</span>
                          <div className="flex items-start gap-1.5">
                            <p className="text-xs text-slate-600 leading-normal">{fullAddress}</p>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(fullAddress)}
                              className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer mt-0.5 flex-shrink-0"
                              title="Copiar Endereço"
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Profissional Cuidador</span>
                        <p className="text-sm font-bold text-slate-850 flex items-center gap-1.5 flex-wrap">
                          <span>{selectedShiftForDetails.nomeProfissional}</span>
                          {(selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao?.toUpperCase().includes('CURINGA')) && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wide bg-purple-100 text-purple-900 border border-purple-300 rounded shadow-3xs">⚡ Curinga</span>
                          )}
                          {(selectedShiftForDetails.tipoDia === 'Feriado 20%' || selectedShiftForDetails.tipoDia?.includes('20%') || selectedShiftForDetails.observacao?.includes('20%')) && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300 rounded shadow-3xs">⭐ +20%</span>
                          )}
                          {(selectedShiftForDetails.tipoDia === 'Feriado 50%' || selectedShiftForDetails.tipoDia?.includes('50%') || selectedShiftForDetails.observacao?.includes('50%')) && (
                            <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wide bg-orange-100 text-orange-900 border border-orange-300 rounded shadow-3xs">🔥 +50%</span>
                          )}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pb-1 border-b border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Data</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-700">{selectedShiftForDetails.data.split('-').reverse().join('/')}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(selectedShiftForDetails.data.split('-').reverse().join('/'))}
                              className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Copiar Data"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Horário</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-slate-700">{selectedShiftForDetails.horario}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(selectedShiftForDetails.horario)}
                              className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Copiar Horário"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Tipo de Dia / Categoria</span>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao?.toUpperCase().includes('CURINGA')) && (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-purple-100 text-purple-900 border border-purple-300 shadow-3xs inline-flex items-center gap-1">
                              <span>⚡</span>
                              <span>Plantão Curinga (Substituição)</span>
                            </span>
                          )}
                          {(selectedShiftForDetails.tipoDia === 'Feriado 50%' || selectedShiftForDetails.tipoDia?.includes('50%')) && (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-orange-100 text-orange-900 border border-orange-300 shadow-3xs inline-flex items-center gap-1">
                              <span>🔥</span>
                              <span>Feriado 50% (Acréscimo +50%)</span>
                            </span>
                          )}
                          {(selectedShiftForDetails.tipoDia === 'Feriado 20%' || selectedShiftForDetails.tipoDia?.includes('20%')) && (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-3xs inline-flex items-center gap-1">
                              <span>⭐</span>
                              <span>Feriado 20% (Acréscimo +20%)</span>
                            </span>
                          )}
                          {!(selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao?.toUpperCase().includes('CURINGA')) &&
                           !(selectedShiftForDetails.tipoDia === 'Feriado 50%' || selectedShiftForDetails.tipoDia?.includes('50%')) &&
                           !(selectedShiftForDetails.tipoDia === 'Feriado 20%' || selectedShiftForDetails.tipoDia?.includes('20%')) && (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-3xs inline-flex items-center gap-1">
                              <span>📅</span>
                              <span>Dia Normal (Sem Adicional)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedShiftForDetails.considerarFalta && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex flex-col gap-1">
                          <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Status: Falta Registrada</span>
                          <span className="text-sm text-red-800 font-medium">Motivo: {selectedShiftForDetails.motivoFalta || 'Não informado'}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">OBSERVAÇÕES</span>
                        {selectedShiftForDetails.observacao && selectedShiftForDetails.observacao.trim() !== '' ? (
                          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {selectedShiftForDetails.observacao}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-400 italic">
                            Nenhuma observação registrada.
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 p-3.5 border border-slate-150 rounded-xl space-y-1.5">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Detalhamento Financeiro</span>
                        <div className="grid grid-cols-2 text-xs text-slate-600 space-y-1 font-sans">
                          <span className="pt-1">Valor do Repasse:</span>
                          <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewRepasseValue.toFixed(2)}</span>
                          <span>Ajuda de Custo:</span>
                          <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewAjudaValue.toFixed(2)}</span>
                          {userRole?.toLowerCase() === 'administrador' && (
                            <>
                              <span>Taxa faturamento:</span>
                              <span className="text-right font-semibold text-slate-800 font-mono">R$ {viewTaxaValue.toFixed(2)}</span>
                            </>
                          )}
                          {userRole?.toLowerCase() === 'administrador' ? (
                            <div className="col-span-2 border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between font-bold text-sky-850">
                              <span>Faturamento total:</span>
                              <span className="font-mono">R$ {viewTotalValue.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div className="col-span-2 border-t border-slate-200 mt-1.5 pt-1.5 flex justify-between font-bold text-emerald-700">
                              <span>Total do Repasse + Ajuda:</span>
                              <span className="font-mono">R$ {(viewRepasseValue + viewAjudaValue).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>

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
                                if (selectedShiftForDetails.escalaCongelada || selectedShiftForDetails.status === 'Concluido') {
                                  toast.error("Escala fechada. Não é possível excluir esse plantão.");
                                  setIsConfirmingDelete(false);
                                  return;
                                }
                                try {
                                  await deleteAgendamento(selectedShiftForDetails.id);
                                  setDetailsModalOpen(false);
                                  setSelectedShiftForDetails(null);
                                  setIsConfirmingDelete(false);
                                } catch (err: any) {
                                  toast.error(err.message || "Erro ao excluir o plantão.");
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
                          {(selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao?.toLowerCase().includes('curinga')) && (
                            <button
                              type="button"
                              onClick={() => {
                                setCuringaShortcutData({
                                  profissionalId: selectedShiftForDetails.idProfissional || '',
                                  profissional: selectedShiftForDetails.nomeProfissional || '',
                                  pacienteId: selectedShiftForDetails.idPaciente || '',
                                  paciente: paciente?.nome || '',
                                  data: selectedShiftForDetails.data || '',
                                  motivo: 'Curinga',
                                  valor: viewRepasseValue + viewAjudaValue
                                });
                                setIsCuringaShortcutModalOpen(true);
                                setDetailsModalOpen(false);
                              }}
                              className="flex-1 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>💰 Pagar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              // Initialize edit forms
                              setDetailsProfName(selectedShiftForDetails.nomeProfissional);
                              setDetailsDate(selectedShiftForDetails.data);
                              setDetailsCuringa(!!selectedShiftForDetails.isCuringa || selectedShiftForDetails.observacao === 'CURINGA');
                              setDetailsTipoDia(selectedShiftForDetails.tipoDia || 'Normal');
                              setConsiderarFalta(selectedShiftForDetails.considerarFalta ?? false);
                              setMotivoFalta(selectedShiftForDetails.motivoFalta ?? 'Não Informado');
                              setAtendimentoRealizado(selectedShiftForDetails.atendimentoRealizado ?? 'Sim');
                              setDetailsObservacao(selectedShiftForDetails.observacao || '');
                              
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
                              if (selectedShiftForDetails.escalaCongelada || selectedShiftForDetails.status === 'Concluido') {
                                toast.error("Escala fechada. Não é possível excluir esse plantão.");
                                return;
                              }
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
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-705 text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 font-sans font-medium"
                    />
                    {showDetailsProfDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-25 divide-y divide-slate-100">
                        {profissionais
                          .filter(p =>
                            removerAcentos(p.nome || '').includes(removerAcentos(detailsProfName || '')) &&
                            p.status === 'Ativo' &&
                            !isBlockedBidirectional(p)
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

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Atendimento Realizado</label>
                    <select
                      value={atendimentoRealizado}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAtendimentoRealizado(val);
                        if (val === 'Não') {
                          setConsiderarFalta(true);
                        } else {
                          setConsiderarFalta(false);
                        }
                      }}
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none min-h-[48px]"
                    >
                      <option value="Sim">Sim</option>
                      <option value="Não">Não</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 p-1 border border-slate-100 rounded-lg bg-slate-50/50">
                    <span className="block text-xs font-bold text-slate-700">Considerar Falta</span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center space-x-2 cursor-pointer min-h-[48px] px-3 border border-slate-200 rounded-lg bg-white flex-1 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="considerarFaltaRadio"
                          checked={considerarFalta === true}
                          onChange={() => setConsiderarFalta(true)}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-700">Sim</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer min-h-[48px] px-3 border border-slate-200 rounded-lg bg-white flex-1 hover:bg-slate-50">
                        <input
                          type="radio"
                          name="considerarFaltaRadio"
                          checked={considerarFalta === false}
                          onChange={() => {
                            setConsiderarFalta(false);
                            setMotivoFalta('Não Informado');
                          }}
                          className="w-4 h-4 text-sky-600 focus:ring-sky-500 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-700">Não</span>
                      </label>
                    </div>
                  </div>

                  {considerarFalta && (
                    <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="block text-xs font-bold text-slate-700">Motivo</label>
                      <select
                        value={motivoFalta}
                        onChange={(e) => setMotivoFalta(e.target.value)}
                        className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none min-h-[48px]"
                      >
                        {['Não Informado', 'Cansaço', 'Compromisso', 'Consulta Médica', 'Doença', 'Falecimento de parente', 'Familiar Passou Mal', 'Filho (a) Doente', 'Greve de transporte', 'Mal Estar', 'Não compareceu', 'Pediu para sair da escala', 'Plantão Confirmado', 'Problema de Chuva', 'Problemas de Tiros', 'Profissional Doente', 'Profissional passou mal', 'Sem Transporte para o local', 'Serviço Suspenso pela Família', 'Solicitaram a Substituição', 'Trajeto iniciado', 'Troca na Escala', 'Viagem'].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700">Observações</label>
                    <textarea
                      rows={3}
                      value={detailsObservacao}
                      onChange={(e) => setDetailsObservacao(e.target.value)}
                      placeholder="Escreva uma observação..."
                      className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 font-sans resize-y min-h-[70px]"
                    />
                  </div>

                  <div className="flex items-center space-x-2 py-1">
                    <input
                      type="checkbox"
                      id="details-curinga-chk"
                      checked={detailsCuringa}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setDetailsCuringa(isChecked);
                        if (!isChecked) {
                          if (detailsObservacao.trim().toUpperCase() === 'CURINGA') {
                            setDetailsObservacao('');
                          } else if (detailsObservacao.toUpperCase().includes('CURINGA')) {
                            setDetailsObservacao(detailsObservacao.replace(/curinga/gi, '').trim());
                          }
                        } else {
                          if (!detailsObservacao.trim()) {
                            setDetailsObservacao('CURINGA');
                          }
                        }
                      }}
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
                      {userRole?.toLowerCase() === 'administrador' && (
                        <>
                          <span>Nova Taxa Adm:</span>
                          <span className="font-semibold text-slate-800 text-right font-mono">R$ {dComputedTaxaValue.toFixed(2)}</span>
                        </>
                      )}
                      {userRole?.toLowerCase() === 'administrador' ? (
                        <div className="col-span-2 border-t border-slate-150 pt-1 flex justify-between font-bold text-emerald-700">
                          <span>Nova Fatura Paciente:</span>
                          <span className="font-mono">R$ {(dComputedRepasseValue + dComputedTaxaValue + dComputedAjudaValue).toFixed(2)}</span>
                        </div>
                      ) : (
                        <div className="col-span-2 border-t border-slate-150 pt-1 flex justify-between font-bold text-emerald-700">
                          <span>Novo Total Repasse + Ajuda:</span>
                          <span className="font-mono">R$ {(dComputedRepasseValue + dComputedAjudaValue).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-100">
                    <GlossyButton
                      type="button"
                      onClick={() => setIsEditingDetails(false)}
                      variant="gray"
                      className="flex-1"
                    >
                      Voltar
                    </GlossyButton>
                    <GlossyButton
                      type="button"
                      onClick={async () => {
                        if (!detailsProfName || detailsProfName.trim() === '') {
                          toast.error('Por favor, selecione um profissional para o agendamento.');
                          return;
                        }
                        
                        try {
                          const chosenOpt = availableShifts.find((s) => s.id === detailsPlantaoOptionId) || availableShifts[0];
                          const baseRepasseValue = chosenOpt.valorPlantao || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
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
                          if (pickedProf && isBlockedBidirectional(pickedProf)) {
                            toast.error('Atenção: Este profissional possui uma restrição de atendimento (bloqueio) para este paciente devido a uma ocorrência passada.');
                            return;
                          }

                          let cleanObs = detailsObservacao.trim();
                          if (!detailsCuringa) {
                            if (cleanObs.toUpperCase() === 'CURINGA') {
                              cleanObs = '';
                            } else if (cleanObs.toUpperCase().includes('CURINGA')) {
                              cleanObs = cleanObs.replace(/curinga/gi, '').trim();
                            }
                          } else {
                            if (!cleanObs) {
                              cleanObs = 'CURINGA';
                            }
                          }

                          const updatedAg: any = {
                            ...selectedShiftForDetails,
                            idProfissional: pickedProf ? pickedProf.id : 'n/a',
                            nomeProfissional: detailsProfName,
                            data: detailsDate,
                            horario: `${chosenHoraInicio}-${getTerminoTime(chosenHoraInicio, durationHrs)}`,
                            valorPlantao: considerarFalta ? 0 : plantaoFinal,
                            valorRepasse: considerarFalta ? 0 : plantaoFinal,
                            ajudaCusto: considerarFalta ? 0 : finalAjuda,
                            taxaAdm: considerarFalta ? 0 : taxaAdmFinal,
                            tipoDia: detailsTipoDia,
                            isCuringa: detailsCuringa,
                            observacao: cleanObs,
                            considerarFalta,
                            motivoFalta: considerarFalta ? motivoFalta : '',
                            atendimentoRealizado
                          };

                          await updateAgendamento(updatedAg);

                          const hadAbsence = !!selectedShiftForDetails.considerarFalta;
                          const hasNoAbsence = !considerarFalta;
                          if (!isQuotaExceeded && !isTestMode && hadAbsence && hasNoAbsence && selectedShiftForDetails.idProfissional && selectedShiftForDetails.idProfissional !== 'n/a') {
                            const oclRef = collection(db, 'profissionais', selectedShiftForDetails.idProfissional, 'ocorrencias');
                            const q = query(oclRef, where('data', '==', selectedShiftForDetails.data), where('tipo', '==', 'automatica'));
                            getDocs(q).then((qSnap) => {
                              qSnap.docs.forEach((docSnap) => {
                                deleteDoc(doc(db, 'profissionais', selectedShiftForDetails.idProfissional, 'ocorrencias', docSnap.id)).catch(e => console.error(e));
                              });
                            }).catch(e => console.error("Erro ao remover ocorrência automática:", e));
                          }

                          if (!isQuotaExceeded && !isTestMode && considerarFalta && updatedAg.idProfissional && updatedAg.idProfissional !== 'n/a') {
                            try {
                              await addDoc(collection(db, 'profissionais', updatedAg.idProfissional, 'ocorrencias'), {
                                data: updatedAg.data,
                                paciente: paciente?.nome || 'Não Informado',
                                pacienteNome: paciente?.nome || 'Não Informado',
                                pacienteId: paciente?.id || 'n/a',
                                descricao: 'Falta registrada via Agenda. Motivo: ' + (updatedAg.motivoFalta || 'Não Informado'),
                                tipo: 'automatica',
                                bloquearEscala: false,
                                mesAno: updatedAg.data.substring(0, 7),
                                timestamp: serverTimestamp()
                              });
                            } catch (errOc) {
                              console.error("Erro ao gerar ocorrência de Falta automática para profissional:", errOc);
                            }
                          }

                          setSelectedShiftForDetails(updatedAg);
                          setIsEditingDetails(false);
                          showSuccessToast('Plantão atualizado com sucesso!', 'Plantão Atualizado');
                        } catch (err) {
                          toast.error('Erro ao atualizar plantão.');
                        }
                      }}
                      variant="green"
                      className="flex-1"
                    >
                      Salvar Mudanças
                    </GlossyButton>
                  </div>
                </div>
              )}
              </div>
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
                    <span>Selecione os dias ({['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][new Date().getMonth()]} {new Date().getFullYear()})</span>
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

                {/* Sub grid dinâmico do Mês Vigente */}
                <div className="grid grid-cols-7 gap-1 bg-white p-2 border border-slate-200 rounded-xl shadow-xs">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dw, i) => (
                    <div key={`cal2-header-${i}`} className="text-center font-extrabold text-[9px] text-slate-400 py-1">{dw}</div>
                  ))}
                  {/* Padding do mês anterior */}
                  {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, padIdx) => (
                    <div key={`pad-${padIdx}`} className="text-center text-[10px] text-slate-200 py-2 select-none font-mono"></div>
                  ))}
                  
                  {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }).map((_, dVal) => {
                    const dayNum = dVal + 1;
                    const yr = new Date().getFullYear();
                    const mo = String(new Date().getMonth() + 1).padStart(2, '0');
                    const dy = String(dayNum).padStart(2, '0');
                    const dateStr = `${yr}-${mo}-${dy}`;
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
                      className="w-full text-xs p-2 border border-slate-200 rounded-lg text-slate-700 bg-slate-50 focus:outline-none focus:border-blue-500 font-medium font-sans"
                    />
                    {showAvulsoProfDropdown && (
                      <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-25 divide-y divide-slate-100 font-sans">
                        {profissionais.filter(p =>
                          removerAcentos(p.nome || '').includes(removerAcentos(avulsoProf || '')) &&
                          p.status === 'Ativo' &&
                          !isBlockedBidirectional(p)
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

                  {userRole?.toLowerCase() === 'administrador' && (
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
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-600">Notas / Apontamentos Adicionais</label>
                  <textarea
                    value={avulsoObs}
                    onChange={(e) => setAvulsoObs(e.target.value)}
                    rows={2}
                    className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 font-sans focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-150 mt-4">
                <GlossyButton
                  type="button"
                  onClick={() => setAvulsoModalOpen(false)}
                  variant="gray"
                >
                  Voltar
                </GlossyButton>
                <GlossyButton
                  type="button"
                  onClick={async () => {
                    const success = await handleSalvarAgendamento();
                    if (success) {
                      setAvulsoModalOpen(false);
                    }
                  }}
                  variant="blue"
                >
                  Salvar Avulso(s)
                </GlossyButton>
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
              <div className="space-y-2 animate-in fade-in-15 font-sans">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase">
                    Selecione o(s) Profissional(is) Agendado(s):
                  </label>
                  {profsAgendadosNoPeriodo.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedExcluirProfs(profsAgendadosNoPeriodo.map((p) => p.nome))}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        Selecionar Todos
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedExcluirProfs([])}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>

                {/* Filtro por busca / autocomplete */}
                <input
                  type="text"
                  placeholder="Pesquisar profissional por nome..."
                  value={excluirProfName}
                  onChange={(e) => setExcluirProfName(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                />

                {/* Badges dos selecionados */}
                {selectedExcluirProfs.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50/60 border border-blue-150 rounded-lg max-h-24 overflow-y-auto">
                    {selectedExcluirProfs.map((prof) => (
                      <span
                        key={prof}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-xs"
                      >
                        {prof}
                        <button
                          type="button"
                          onClick={() => setSelectedExcluirProfs((prev) => prev.filter((p) => p !== prof))}
                          className="hover:bg-blue-700 rounded-full p-0.5 cursor-pointer text-blue-100 hover:text-white"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Lista de profissionais agendados no período */}
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 shadow-xs">
                  {(() => {
                    const term = removerAcentos(excluirProfName.toLowerCase().trim());
                    let listToShow = profsAgendadosNoPeriodo.filter((p) =>
                      removerAcentos(p.nome.toLowerCase()).includes(term)
                    );

                    // Se a busca não encontrar na lista do período, pesquisa na lista geral de profissionais ativos
                    if (listToShow.length === 0 && term) {
                      listToShow = profissionais
                        .filter(
                          (p) => p.status === 'Ativo' && removerAcentos(p.nome.toLowerCase()).includes(term)
                        )
                        .map((p) => ({ nome: p.nome, count: 0 }));
                    }

                    if (listToShow.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-slate-400 italic">
                          {profsAgendadosNoPeriodo.length === 0
                            ? 'Nenhum profissional agendado no período selecionado.'
                            : 'Nenhum profissional encontrado para o termo pesquisado.'}
                        </div>
                      );
                    }

                    return listToShow.map(({ nome, count }) => {
                      const isSelected = selectedExcluirProfs.includes(nome);
                      return (
                        <label
                          key={nome}
                          className={`flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer text-xs transition-colors ${
                            isSelected ? 'bg-blue-50/70 font-bold' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedExcluirProfs((prev) => [...prev, nome]);
                                } else {
                                  setSelectedExcluirProfs((prev) => prev.filter((p) => p !== nome));
                                }
                              }}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                            />
                            <span className="truncate text-slate-800">{nome}</span>
                          </div>
                          {count > 0 ? (
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                              {count} plantão(ões)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">0 plantões</span>
                          )}
                        </label>
                      );
                    });
                  })()}
                </div>
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
                    <h1 className="text-lg font-black text-slate-905 text-slate-900 tracking-tight uppercase leading-none">RH GESTÃO DOMICILIAR LTDA.</h1>
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
                <CardBase className="bg-[#faf9f6]/30 p-4">
                  <DataGrid cols={3} className="gap-4">
                    <DataField label="Paciente Assistido" value={nome || paciente?.nome} />
                    <DataField label="Logística de Chegada" value={logisticaChegada || 'Não explicitado'} />
                    <div className="text-right flex flex-col justify-center">
                      <span className="text-xs font-semibold text-gray-550 text-gray-500 uppercase tracking-wider block leading-none">Total de Turnos:</span>
                      <p className="text-sm font-bold text-[#142d22] font-mono mt-1">
                        {filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').length} Ativos
                      </p>
                    </div>
                  </DataGrid>
                </CardBase>

                {/* Resumo Consolidado de Custos (Conforme regra Arquiteto) */}
                <CardBase className="bg-[#faf9f6]/40 border border-gray-100 p-5 space-y-4">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">📊 Demonstrativo Financeiro de Repasses & Taxas</span>
                  <DataGrid cols={userRole?.toLowerCase() === 'colaborador' ? 1 : 4} className="gap-4">
                    <CardBase className={`p-4 bg-white/80 border border-gray-150 shadow-none ${userRole?.toLowerCase() === 'colaborador' ? 'col-span-1' : 'col-span-2 md:col-span-1'}`}>
                      <DataField 
                        label={userRole?.toLowerCase() === 'colaborador' ? "Total dos Meus Repasses" : "Total Repasse Profissionais"}
                        value={`R$ ${(() => {
                          let sum = 0;
                          filteredShiftsForPatient.forEach(s => {
                            if (s.status !== 'Cancelado') {
                              let base = Number(s.valorPlantao) || Number(paciente?.planoAtendimento?.valorSugeridoPlantao) || 150;
                              let extra = Number(s.ajudaCusto) || Number(paciente?.planoAtendimento?.ajudaCusto) || 0;
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
                        })()}`} 
                        className="font-mono text-xs font-bold text-emerald-800"
                      />
                    </CardBase>

                    {userRole?.toLowerCase() !== 'colaborador' && (
                      <>
                        <CardBase className="p-4 bg-white/80 border border-gray-150 shadow-none col-span-2 md:col-span-1">
                          <DataField 
                            label="Total Faturamento Tx Adm" 
                            value={`R$ ${(() => {
                              let sum = 0;
                              filteredShiftsForPatient.forEach(s => {
                                if (s.status !== 'Cancelado') {
                                  let baseTaxa = parseNum(s.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
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
                            })()}`} 
                            className="font-mono text-xs"
                          />
                        </CardBase>

                        <CardBase className="p-4 col-span-4 md:col-span-2 bg-[#1a3c2e]/5 border border-[#1a3c2e]/10 flex flex-col justify-center shadow-none">
                          <DataField 
                            label="Valor Consolidado Líquido Estimado da Fatura" 
                            value={`R$ ${(() => {
                              let sumRepasse = 0;
                              let sumTaxa = 0;
                              filteredShiftsForPatient.forEach(s => {
                                if (s.status !== 'Cancelado') {
                                  let base = parseNum(s.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
                                  let extra = parseNum(s.ajudaCusto) || parseNum(paciente?.planoAtendimento?.ajudaCusto, 0);
                                  let baseTaxa = parseNum(s.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
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
                            })()}`} 
                            className="font-mono text-emerald-800 text-sm"
                          />
                        </CardBase>
                      </>
                    )}
                  </DataGrid>
                </CardBase>

                {/* Tabela de Plantões Completas */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider text-left">Turnos Auditados Realizados:</h3>
                  <table className="w-full text-left text-sm border-collapse border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-gray-800 font-semibold text-xs uppercase">
                        <th className="py-3 px-3 border-r border-slate-200">Data & Semana</th>
                        <th className="py-3 px-3 border-r border-slate-200">Horário</th>
                        <th className="py-3 px-3 border-r border-slate-200">Profissional Cuidador Credenciado</th>
                        <th className="py-3 px-3 border-r border-slate-200">Feriado / Encargo</th>
                        <th className={`py-3 px-3 text-right ${userRole?.toLowerCase() !== 'colaborador' ? 'border-r border-slate-200' : ''}`}>Repasse Líquido</th>
                        {userRole?.toLowerCase() !== 'colaborador' && (
                          <th className="py-3 px-3 text-right">Taxa Adm</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-gray-900 text-sm md:text-base">
                      {filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').length === 0 ? (
                        <tr>
                          <td colSpan={userRole?.toLowerCase() === 'colaborador' ? 5 : 6} className="py-8 text-center text-gray-500 italic font-normal">Nenhum plantão ativo no período fechado.</td>
                        </tr>
                      ) : (
                        filteredShiftsForPatient.filter(x => x.status !== 'Cancelado').map((item, index) => {
                          const base = parseNum(item.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
                          const extra = parseNum(item.ajudaCusto) || parseNum(paciente?.planoAtendimento?.ajudaCusto, 0);
                          const baseTaxa = parseNum(item.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
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
                            <tr key={`shift-${item.id || index}-${index}`} className={`transition-colors hover:bg-slate-50 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                              <td className="py-3 px-3 border-r border-slate-200 font-sans font-medium text-gray-900 text-sm md:text-base">
                                {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')} ({item.diaSemana})
                              </td>
                              <td className="py-3 px-3 border-r border-slate-200 font-mono text-sm font-normal text-gray-600">
                                {item.horaInicio || '08:00'} - {item.horaTermino || '20:00'}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-200 font-sans font-normal text-gray-900 text-base">
                                {item.profissional}
                              </td>
                              <td className="py-3 px-3 border-r border-slate-200 font-sans font-normal text-gray-650 text-gray-600 text-sm">
                                {item.feriado ? `Feriado (+${item.feriado})` : 'Normal'}
                              </td>
                              <td className={`py-3 px-3 text-right font-normal text-gray-900 text-base ${userRole?.toLowerCase() !== 'colaborador' ? 'border-r border-slate-200' : ''}`}>
                                R$ {(Number(repasseCalculado) || 0).toFixed(2)}
                              </td>
                              {userRole?.toLowerCase() !== 'colaborador' && (
                                <td className="py-3 px-3 text-right font-normal text-gray-700 text-base">
                                  R$ {(Number(taxaCalculada) || 0).toFixed(2)}
                                </td>
                              )}
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
                      Coordenadoria de RH Gestão Domiciliar S.A.
                    </p>
                    <p className="text-[9px] text-slate-450 text-slate-400 leading-none">Representante Geral Legal Corporativo</p>
                  </div>
                  <div className="space-y-4 text-center">
                    <p className="border-t border-slate-400 pt-1.5 font-bold uppercase font-sans text-slate-850 text-slate-800">
                      Responsável / Família do Paciente:
                    </p>
                    <p className="text-[10px] font-semibold text-slate-650 truncate text-slate-700 leading-none">
                      {nomeResponsavel || '---'} {parentescoResponsavel ? `(${parentescoResponsavel})` : ''}
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

      {/* MODAL: EXPORTAR/IMPRIMIR PRONTUÁRIO CLÍNICO (PNG) */}
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
                  disabled={isGeneratingProntuarioPNG}
                  onClick={handleGenerateProntuarioPNG}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-lg shadow-sm flex items-center space-x-1 transition-all cursor-pointer disabled:opacity-50"
                  title="Baixar imagem PNG do Prontuário Clínico"
                >
                  <Printer size={13} className="mr-1" />
                  <span>{isGeneratingProntuarioPNG ? 'Gerando Imagem...' : 'Baixar Prontuário (PNG)'}</span>
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
                    <h1 className="text-xl font-black text-[#1a3c2e] tracking-tight uppercase leading-none">RH GESTÃO DOMICILIAR</h1>
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
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Altura:</span>
                      <p className="font-medium text-slate-750 mt-1 truncate">{altura || paciente?.altura || '---'}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Peso:</span>
                      <p className="font-medium text-slate-750 mt-1 truncate">{peso || paciente?.peso || '---'}</p>
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
                      <p className="font-bold text-slate-800 mt-1">{nomeResponsavel || '---'} {parentescoResponsavel ? `(${parentescoResponsavel})` : ''}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Telefone de Contato do Representante:</span>
                      <p className="font-mono text-slate-756 text-slate-700 mt-1">
                        {telefoneResponsavel || '---'}
                        {paciente?.telefoneResponsavel2 || telefoneResponsavel2 ? ` / ${paciente?.telefoneResponsavel2 || telefoneResponsavel2}` : ''}
                      </p>
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
                    {(opcaoEnvio === 'E-mail' || opcaoEnvio === 'Ambos') && (
                      <div>
                        <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">E-mail para Envio:</span>
                        <p className="font-medium text-slate-750 mt-1 truncate">{email || '---'}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] font-bold text-slate-450 block uppercase leading-none">Data do Reajuste:</span>
                      <p className="font-medium text-slate-750 mt-1">{dataReajuste || '---'}</p>
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
                      <p className="font-bold text-slate-800 font-mono mt-0.5">R$ {converterMascaraParaNumero(valorSugeridoPlantao).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8.5px] font-bold text-slate-450 block uppercase leading-none">Ajuda de Custo Profissional:</span>
                      <p className="font-bold text-slate-800 font-mono mt-0.5">R$ {converterMascaraParaNumero(ajudaCusto).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50/50">
                      <span className="text-[8.5px] font-bold text-slate-450 block uppercase leading-none">Taxa Adm do Fechamento:</span>
                      <p className="font-bold text-[#1a3c2e] font-mono mt-0.5">R$ {converterMascaraParaNumero(taxaAdm).toFixed(2).replace('.', ',')}</p>
                    </div>
                    <div className="p-2 border border-emerald-200 rounded-lg bg-emerald-50/20">
                      <span className="text-[8.5px] font-black text-[#1a3c2e] block uppercase leading-none">Consolidado Total por Turno:</span>
                      <p className="font-extrabold text-[#1a3c2e] font-mono mt-0.5">R$ {(converterMascaraParaNumero(valorSugeridoPlantao) + converterMascaraParaNumero(taxaAdm) + converterMascaraParaNumero(ajudaCusto)).toFixed(2).replace('.', ',')}</p>
                    </div>
                  </div>
                </div>

                {/* Termo de Veracidade / Encerramento */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[9px] text-slate-400 leading-relaxed font-sans text-left mt-4">
                  O prontuário acima compreende dados confidenciais e de uso clínico estrito da coordenadoria do RH Gestão Domiciliar Ltda. em conformidade com as diretivas do CFM (Conselho Federal de Medicina), COFEN e a Lei Geral de Proteção de Dados (LGPD). É de inteira obrigação das partes a confidencialidade e zelo no arquivamento deste registro impresso.
                </div>

              </div>
            </div>

            {/* Footer do dialog */}
            <div className="bg-slate-50 p-3.5 border-t border-slate-200 text-right print:hidden">
              <button
                type="button"
                onClick={() => setImprimirProntuarioModalOpen(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer font-sans"
              >
                Retornar ao Prontuário
              </button>
            </div>

          </div>
        </div>
      )}

      {isFaturaModalOpen && (() => {
        const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        const agMes = agendamentos.filter(
          (a) => a.idPaciente === paciente?.id && a.data && a.data.startsWith(monthPrefix)
        );

        let sumRep = 0;
        let sumTx = 0;
        let countNormal = 0;
        let countFeriado20 = 0;
        let countFeriado50 = 0;
        let concluidos = 0;
        let cancelados = 0;
        let ativos = 0;
        let faltas = 0;

        agMes.forEach(s => {
          if (s.status === 'Cancelado') {
            cancelados++;
          } else {
            if (s.considerarFalta) {
              faltas++;
            } else {
              if (s.status === 'Concluido' || s.escalaCongelada) {
                concluidos++;
              } else {
                ativos++;
              }

              let base = parseNum(s.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
              let extra = parseNum(s.ajudaCusto) || parseNum(paciente?.planoAtendimento?.ajudaCusto, 0);
              let baseTaxa = parseNum(s.taxaAdm) || parseNum(paciente?.planoAtendimento?.taxaAdm, 0);
              if (s.tipoDia === 'Feriado 20%') {
                countFeriado20++;
                sumRep += (base * 1.20) + extra;
                sumTx += baseTaxa * 1.20;
              } else if (s.tipoDia === 'Feriado 50%') {
                countFeriado50++;
                sumRep += (base * 1.50) + extra;
                sumTx += baseTaxa * 1.50;
              } else {
                countNormal++;
                sumRep += base + extra;
                sumTx += baseTaxa;
              }
            }
          }
        });

        const grandTotal = sumRep + sumTx;
        const totalPlantõesValidos = concluidos + ativos;
        const isEscalaAberta = ativos > 0 || totalPlantõesValidos === 0;

        const servicosExtrasDoMesModal = (servicosExtras || []).filter(
          (s) => (s.idPaciente === paciente?.id || (s as any).pacienteId === paciente?.id) &&
                 (s.data?.startsWith(monthPrefix) || s.mesReferencia === monthPrefix)
        );
        const somaServicosExtrasModal = servicosExtrasDoMesModal.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
        const totalFaturaModal = grandTotal + somaServicosExtrasModal;

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in-30 p-4 font-sans text-left">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-lg w-full flex flex-col transform transition-all duration-300">
              {/* Header com estilo financeiro */}
              <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 px-5 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-emerald-700/50 p-1.5 rounded-lg border border-emerald-500/30 flex items-center justify-center">
                    <Receipt size={18} className="text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider leading-none">
                      Faturamento - {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} de {calendarYear}
                    </h3>
                    <p className="text-[10px] text-emerald-250/80 mt-1 font-medium leading-none">
                      Fatura Individual do Paciente: {nome || paciente?.nome || 'Não definido'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFaturaModalOpen(false)}
                  className="text-emerald-100 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Conteúdo Bento Grid */}
              <div className="p-6 space-y-4 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Paciente Atendido:</span>
                    <p className="text-xs font-black text-slate-800 mt-1 truncate">{nome || paciente?.nome || '---'}</p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">Período Operacional:</span>
                    <p className="text-xs font-black text-emerald-800 mt-1 font-mono">
                      {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} / {calendarYear}
                    </p>
                  </div>
                </div>

                {/* Box de Status do Faturamento */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status da Cobertura de Plantões</span>
                    {isEscalaAberta ? (
                      <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded font-black uppercase">
                        Escala Aberta / Pendente
                      </span>
                    ) : (
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded font-black uppercase">
                        Escala Concluída 🔒
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      <span className="block text-[8.5px] font-bold text-slate-400 uppercase">Turnos Totais</span>
                      <strong className="block text-sm text-slate-700 mt-0.5">{totalPlantõesValidos}</strong>
                    </div>
                    <div className="bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/50">
                      <span className="block text-[8.5px] font-bold text-emerald-600 uppercase">Concluídos</span>
                      <strong className="block text-sm text-emerald-700 mt-0.5">{concluidos}</strong>
                    </div>
                    <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-100/50">
                      <span className="block text-[8.5px] font-bold text-amber-600 uppercase">Abertos / Confirmados</span>
                      <strong className="block text-sm text-amber-700 mt-0.5">{ativos}</strong>
                    </div>
                  </div>

                  {totalPlantõesValidos > 0 && (
                    <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 font-mono text-[10px] text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Turnos Normais:</span>
                        <span>{countNormal}x</span>
                      </div>
                      {countFeriado20 > 0 && (
                        <div className="flex justify-between">
                          <span>Feriados (+20%):</span>
                          <span>{countFeriado20}x</span>
                        </div>
                      )}
                      {countFeriado50 > 0 && (
                        <div className="flex justify-between">
                          <span>Feriados (+50%):</span>
                          <span>{countFeriado50}x</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-200 pt-1 font-bold text-slate-800">
                        <span>Plantões Consolidados:</span>
                        <span className="text-emerald-700">R$ {grandTotal.toFixed(2)}</span>
                      </div>
                      {somaServicosExtrasModal > 0 && (
                        <div className="flex justify-between font-bold text-blue-700">
                          <span>Serviços Extras ({servicosExtrasDoMesModal.length}x):</span>
                          <span>+ R$ {somaServicosExtrasModal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-slate-300 pt-1 font-black text-slate-900 text-xs">
                        <span>Valor Total da Fatura:</span>
                        <span className="text-emerald-800">R$ {totalFaturaModal.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {isEscalaAberta ? (
                    <div className="p-3 bg-red-50 text-red-900 border border-red-100 rounded-xl flex items-start gap-2.5">
                      <span className="text-xs pt-0.5">⚠️</span>
                      <p className="text-[10px] font-medium leading-relaxed font-sans">
                        <strong>Bloqueio de Faturamento:</strong> Existem {ativos} turnos em status ativo/confirmado pendentes de fechamento. Você deve ir na barra de ações operacionais e clicar em <strong>&quot;Dar Baixa Período&quot;</strong> para finalizar o ciclo operacional antes de poder faturar.
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50/50 text-emerald-950 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                      <span className="text-xs pt-0.5">✨</span>
                      <p className="text-[10px] font-semibold leading-relaxed font-sans">
                        Consolidação financeira liberada! A escala foi totalmente fechada com assinatura eletrônica. O lançamento irá gerar uma fatura oficial do contas a receber.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer do Dialog */}
              <div className="bg-white border-t border-slate-150 px-5 py-3.5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFaturaModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-lg transition-all cursor-pointer font-sans"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={totalPlantõesValidos === 0}
                  onClick={handleGerarFatura}
                  className={`px-4 py-2 text-white text-xs font-black rounded-lg transition-all shadow-md cursor-pointer font-sans ${
                    totalPlantõesValidos === 0 
                      ? 'bg-slate-300 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none' 
                      : 'bg-emerald-600 hover:bg-emerald-700 border border-emerald-500/20'
                  }`}
                >
                  Confirmar e Gerar Fatura
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL SERVIÇO EXTRA */}
      {isServicoExtraModalOpen && (() => {
        const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        const servicosExtrasMes = (servicosExtras || []).filter(
          (s) => (s.idPaciente === paciente?.id || (s as any).pacienteId === paciente?.id) &&
                 (s.data?.startsWith(monthPrefix) || s.mesReferencia === monthPrefix)
        );
        const totalMes = servicosExtrasMes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[120] animate-in fade-in-30 p-4 font-sans text-left">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-lg w-full flex flex-col transform transition-all duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-5 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-blue-600/50 p-1.5 rounded-lg border border-blue-400/30 flex items-center justify-center">
                    <PlusCircle size={18} className="text-blue-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider leading-none">
                      Lançar Serviço Extra / Material
                    </h3>
                    <p className="text-[10px] text-blue-100/80 mt-1 font-medium leading-none">
                      Paciente: {nome || paciente?.nome || '---'} | Mês: {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][calendarMonth]} / {calendarYear}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsServicoExtraModalOpen(false)}
                  className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Formulário */}
              <div className="p-6 space-y-4 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Novo Lançamento Extra</h4>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Descrição do Serviço / Material *
                    </label>
                    <select
                      value={servicoExtraDesc}
                      onChange={(e) => setServicoExtraDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                    >
                      <option value="Visita de Enfermeira">Visita de Enfermeira</option>
                      <option value="Coleta de Urina / Sangue">Coleta de Urina / Sangue</option>
                      <option value="Materiais / Curativos">Materiais / Curativos</option>
                      <option value="Medicamentos / Insumos">Medicamentos / Insumos</option>
                      <option value="Procedimento Especial">Procedimento Especial</option>
                      <option value="Outros">Outros (Especifique abaixo)</option>
                    </select>
                  </div>

                  {servicoExtraDesc === 'Outros' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Especifique a Descrição *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Aluguel de Cama Hospitalar..."
                        value={servicoExtraCustomDesc}
                        onChange={(e) => setServicoExtraCustomDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Data *
                      </label>
                      <input
                        type="date"
                        value={servicoExtraData}
                        onChange={(e) => setServicoExtraData(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-medium focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Valor (R$) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={servicoExtraValor}
                        onChange={(e) => setServicoExtraValor(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isSavingServicoExtra}
                    onClick={handleSaveServicoExtra}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>{isSavingServicoExtra ? 'Salvando...' : 'Salvar Serviço Extra'}</span>
                  </button>
                </div>

                {/* Tabela de Serviços Lançados no Mês */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Lançamentos Extras no Mês ({servicosExtrasMes.length})
                    </h4>
                    <span className="text-xs font-black font-mono text-blue-700">
                      Total: R$ {totalMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  {servicosExtrasMes.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3 text-center">
                      Nenhum serviço extra lançado neste mês.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-40 overflow-y-auto">
                      {servicosExtrasMes.map((s) => (
                        <div key={s.id} className="py-2 flex items-center justify-between text-xs font-sans">
                          <div>
                            <p className="font-bold text-slate-800">{s.descricao}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {new Date(s.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black font-mono text-slate-800">
                              R$ {Number(s.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <button
                              type="button"
                              title="Remover serviço extra"
                              onClick={async () => {
                                if (confirm('Deseja excluir este serviço extra?')) {
                                  await deleteServicoExtra(s.id);
                                  toast.success('Serviço extra removido.');
                                }
                              }}
                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white border-t border-slate-150 px-5 py-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsServicoExtraModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL PREVIA FINANCEIRA DA ESCALA MENSAL */}
      {isPreviaFinanceiraModalOpen && (() => {
        const monthPrefix = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
        
        // Filter agendamentos for current patient and active month
        const monthShiftsRaw = agendamentos.filter(
          (a) => a.idPaciente === (paciente?.id || '') && a.data && a.data.startsWith(monthPrefix)
        );

        // Deduplicate by ID
        const seenIds = new Set<string>();
        const monthShifts: Agendamento[] = [];
        monthShiftsRaw.forEach((s) => {
          if (s.id && !seenIds.has(s.id)) {
            seenIds.add(s.id);
            monthShifts.push(s);
          } else if (!s.id) {
            monthShifts.push(s);
          }
        });

        // Filter out absences / non-executed shifts ('Falta' / 'Cancelado' / considerarFalta)
        const validMonthShifts = monthShifts.filter((s) => {
          const isFalta = s.considerarFalta === true ||
                          (s.status as any) === 'Falta' ||
                          (s.status as string) === 'falta' ||
                          s.status === 'Cancelado' ||
                          (s as any).atendimentoRealizado === 'Não';
          return !isFalta;
        });

        // Group by Professional
        const groupedByProf: { [nomeProf: string]: Agendamento[] } = {};
        validMonthShifts.forEach((s) => {
          const profName = (s.nomeProfissional || 'Profissional Não Informado').trim();
          if (!groupedByProf[profName]) {
            groupedByProf[profName] = [];
          }
          groupedByProf[profName].push(s);
        });

        const sortedProfNames = Object.keys(groupedByProf).sort();

        // Helper to compute repasse value for a single shift
        const getRepasseValue = (s: Agendamento) => {
          if (s.status === 'Cancelado' || s.considerarFalta) return 0;
          
          let base = parseNum(s.valorRepasse) || parseNum(s.valorPlantao) || parseNum(paciente?.planoAtendimento?.valorSugeridoPlantao, 150);
          let extra = parseNum(s.ajudaCusto) || 0;
          
          if (s.tipoDia === 'Feriado 20%') {
            base = base * 1.20;
          } else if (s.tipoDia === 'Feriado 50%') {
            base = base * 1.50;
          }
          
          return base + extra;
        };

        // Compute grand total
        let grandTotalRepasse = 0;
        let totalShiftsCount = validMonthShifts.length;

        sortedProfNames.forEach((profName) => {
          const profShifts = groupedByProf[profName];
          profShifts.forEach((s) => {
            grandTotalRepasse += getRepasseValue(s);
          });
        });

        const formatCurrency = (val: number) => {
          return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
        };

        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const monthTitle = `${monthNames[calendarMonth]} de ${calendarYear}`;

        return (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in-30 p-4 font-sans text-left">
            <div id="previa-financeira-modal-content" className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] flex flex-col transform transition-all duration-300">
              
              {/* Header - Purple Theme */}
              <div className="bg-gradient-to-r from-purple-800 to-purple-950 px-6 py-4 text-white flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-700/50 p-2 rounded-xl border border-purple-400/30 flex items-center justify-center shadow-inner">
                    <Calculator size={22} className="text-purple-200" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold tracking-tight text-white flex items-center gap-2">
                      <span>Prévia Financeira da Escala</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-600/80 text-purple-100 px-2.5 py-0.5 rounded-full border border-purple-400/30">
                        {monthTitle}
                      </span>
                    </h3>
                    <p className="text-xs text-purple-200 font-medium">
                      <span className="text-white font-extrabold">{nome || paciente?.nome || 'Paciente'}</span> • Demonstrativo de repasses por profissional
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviaFinanceiraModalOpen(false)}
                  className="text-purple-200 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body - Scrollable content */}
              <div id="previa-financeira-modal-body" className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
                
                {/* Summary Cards Header */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-lg text-purple-700">
                      <User size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profissionais Escalados</span>
                      <span className="text-lg font-black text-slate-800">{sortedProfNames.length}</span>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="bg-purple-100 p-2.5 rounded-lg text-purple-700">
                      <CalendarDays size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Plantões Válidos</span>
                      <span className="text-lg font-black text-slate-800">{totalShiftsCount}</span>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 shadow-xs flex items-center gap-3">
                    <div className="bg-purple-600 p-2.5 rounded-lg text-white shadow-sm">
                      <Receipt size={20} />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">Total Repasse Previsto</span>
                      <span className="text-lg font-black text-purple-900">{formatCurrency(grandTotalRepasse)}</span>
                    </div>
                  </div>
                </div>

                {/* List of Professionals */}
                {sortedProfNames.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-sm font-bold text-slate-600">Nenhum plantão agendado para este mês.</p>
                    <p className="text-xs text-slate-400">Não foram encontrados registros de escala para o mês de {monthTitle}.</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {sortedProfNames.map((profName) => {
                      const profShifts = groupedByProf[profName].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
                      
                      let profTotalVal = 0;
                      profShifts.forEach((s) => {
                        profTotalVal += getRepasseValue(s);
                      });
                      const profValidCount = profShifts.length;

                      return (
                        <div key={profName} className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                          {/* Professional Header */}
                          <div className="bg-slate-100/80 px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <User size={16} className="text-purple-700" />
                              <h4 className="font-extrabold text-slate-800 text-sm tracking-tight">{profName}</h4>
                              <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                {profValidCount} {profValidCount === 1 ? 'plantão' : 'plantões'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Subtotal a Pagar:</span>
                              <span className="text-sm font-black text-purple-900 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                                {formatCurrency(profTotalVal)}
                              </span>
                            </div>
                          </div>

                          {/* Professional Shifts Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                                  <th className="py-2.5 px-4">Data</th>
                                  <th className="py-2.5 px-4">Horário / Turno</th>
                                  <th className="py-2.5 px-4">Tipo de Evento</th>
                                  <th className="py-2.5 px-4">Plantão</th>
                                  <th className="py-2.5 px-4 text-right">Valor Repasse</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-700">
                                {profShifts.map((s, idx) => {
                                  const val = getRepasseValue(s);
                                  const formattedDate = (() => {
                                    if (!s.data) return '-';
                                    const parts = s.data.split('-');
                                    if (parts.length < 3) return s.data;
                                    const year = parts[0];
                                    const month = parts[1];
                                    const day = parts[2];
                                    const d = new Date(s.data + 'T12:00:00');
                                    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                                    const dayName = weekDays[d.getDay()] || '';
                                    return `${day}/${month}/${year} (${dayName})`;
                                  })();

                                  const isCuringa = s.isCuringa;
                                  const eventTypeLabel = isCuringa ? 'Curinga' : (s.tipoDia || 'Normal');

                                  return (
                                    <tr key={s.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{formattedDate}</td>
                                      <td className="py-2.5 px-4 font-sans">{s.horario || '12h'}</td>
                                      <td className="py-2.5 px-4 font-sans">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                          isCuringa 
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                                            : s.tipoDia?.includes('Feriado')
                                            ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}>
                                          {eventTypeLabel}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono bg-slate-100 text-slate-700 border border-slate-200">
                                          {getPlantaoCargaHoraria(s)}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                                        {formatCurrency(val)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="bg-purple-50/40 border-t border-slate-200 font-bold text-xs">
                                  <td colSpan={4} className="py-2.5 px-4 text-right text-slate-700 font-sans uppercase text-[10px] tracking-wider">
                                    Valor Total ({profName}):
                                  </td>
                                  <td className="py-2.5 px-4 text-right font-mono font-extrabold text-purple-900 text-sm">
                                    {formatCurrency(profTotalVal)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 font-sans">
                <div className="text-xs text-slate-500 font-medium hidden sm:block">
                  Soma geral de repasses previstos: <span className="font-extrabold text-purple-900">{formatCurrency(grandTotalRepasse)}</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={handleBaixarPreviaFinanceiraPNG}
                    className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Download size={14} />
                    <span>Baixar PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviaFinanceiraModalOpen(false)}
                    className="px-5 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors cursor-pointer shadow-sm"
                  >
                    Fechar
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {deleteRecordDialog?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[120] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
          <div className="bg-[#F8F5F0] w-full max-w-sm rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 border border-red-100">
              <span className="text-xl">⚠️</span>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#1A3626] tracking-tight">
                {deleteRecordDialog.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {deleteRecordDialog.message}
              </p>
            </div>

            {/* Confirmation textbox */}
            <div className="bg-white border border-slate-250 rounded-xl p-3.5 space-y-2 text-left">
              <label className="block text-xs font-semibold text-slate-700">
                Para confirmar, digite <span className="font-extrabold text-red-650 font-mono select-all">'CONFIRMAR'</span> abaixo:
              </label>
              <input
                type="text"
                value={deleteRecordConfirmInput}
                onChange={(e) => setDeleteRecordConfirmInput(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono font-bold tracking-widest px-3 py-2 border border-slate-200 rounded-lg text-slate-800 bg-slate-50 uppercase focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteRecordDialog(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-full transition-all text-center cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteRecordDialog.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteRecordConfirmInput.trim().toUpperCase() !== 'CONFIRMAR') {
                    toast.error("Por favor, digite 'CONFIRMAR' para prosseguir.");
                    return;
                  }
                  try {
                    await deleteRecordDialog.onConfirm();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setDeleteRecordDialog(null);
                  }
                }}
                disabled={isDeleting || deleteRecordConfirmInput.trim().toUpperCase() !== 'CONFIRMAR'}
                className="flex-1 py-2 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-full transition-all text-center cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar e Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmOc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[150] animate-in fade-in-30">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4 font-sans text-left">
            <div className="flex items-start space-x-3 text-red-650">
              <span className="text-2xl mt-0.5 flex-shrink-0">⚠️</span>
              <div>
                <h3 className="font-bold text-sm text-slate-800">Confirmar Exclusão de Ocorrência</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Tem certeza que deseja excluir permanentemente esta ocorrência de data <strong>{deleteConfirmOc.data ? deleteConfirmOc.data.split('-').reverse().join('/') : '-'}</strong> relacionada ao profissional <strong>{deleteConfirmOc.profissionalNome || 'Administrativa / Geral'}</strong>? Esta ação não pode ser desfeita.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOc(null)}
                className="px-4 py-2 hover:bg-slate-100 font-medium text-xs text-slate-600 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteOcorrencia}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 font-extrabold text-xs text-white rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                Excluir Ocorrência
              </button>
            </div>
          </div>
        </div>
      )}

      {isCuringaShortcutModalOpen && (
        <ModalInserirDebito
          isOpen={isCuringaShortcutModalOpen}
          onClose={() => {
            setIsCuringaShortcutModalOpen(false);
            setCuringaShortcutData(null);
          }}
          dadosAtalhoCuringa={curingaShortcutData}
        />
      )}

      {/* Hidden off-screen Fatura rendering container for PNG download */}
      {faturaParaBaixar && (() => {
        const parseDate = (dateStr: string): number => {
          if (!dateStr) return 0;
          if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
              return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
            }
          } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            }
          }
          return new Date(dateStr).getTime() || 0;
        };

        const getFaturaRowVal = (p: any) => {
          const base = Number(p.valorPlantao || 0);
          const adm = Number(p.taxaAdm || 0);
          const ajuda = Number(p.ajudaCusto || 0);
          let mult = 1.0;
          if (p.tipoDia === 'Feriado 20%') mult = 1.2;
          else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
          return (base * mult) + (adm * mult) + ajuda;
        };

        const plantoesValidos = (faturaParaBaixar.plantoesCongelados || [])
          .filter((p: any) => {
            if (p.considerarFalta || p.status === 'falta' || p.status === 'Falta' || p.status === 'Cancelado' || p.status === 'cancelado') {
              return false;
            }
            const val = getFaturaRowVal(p);
            return val > 0;
          })
          .sort((a: any, b: any) => parseDate(a.data) - parseDate(b.data));

        const totalSomaPlantoes = plantoesValidos.reduce((acc: number, curr: any) => acc + getFaturaRowVal(curr), 0);

        return (
          <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm', pointerEvents: 'none' }}>
            <div ref={tempFaturaRef} className="w-[210mm] min-h-[297mm] p-[12mm] bg-white text-slate-800 font-sans border border-slate-200 mx-auto flex flex-col justify-between" style={{ color: '#1e293b' }}>
              <div>
                {/* 1. Cabeçalho Corporativo */}
                <div className="flex justify-between items-start border-b-2 border-[#1E3A2F] pb-4 mb-5">
                  <div className="flex items-center gap-4">
                    {empresaInfo?.logoUrl ? (
                      <img src={empresaInfo.logoUrl} alt="Logo" className="h-14 max-h-16 w-auto object-contain shrink-0" />
                    ) : (
                      <div className="w-28 shrink-0">
                        <Logo className="h-14 w-auto object-contain" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-extrabold text-[#1E3A2F] tracking-tight leading-tight">
                        {empresaInfo?.razaoSocial || 'RH GESTÃO DOMICILIAR LTDA.'}
                      </h2>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        CNPJ: {empresaInfo?.cnpj || '00.000.000/0000-00'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {empresaInfo?.endereco || 'Atendimento Domiciliar Especializado'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-black text-[#1E3A2F] tracking-wide">FATURA</h1>
                    <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                      Nº: {faturaParaBaixar.numeroFatura || 'FAT-0000'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Emissão: {faturaParaBaixar.dataEmissao ? (faturaParaBaixar.dataEmissao.includes('T') ? new Date(faturaParaBaixar.dataEmissao).toLocaleDateString('pt-BR') : faturaParaBaixar.dataEmissao) : new Date().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* 2. Box de Identificação - Dois Cards Informativos */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* Card 1: Paciente & Período de Atendimento */}
                  <div className="bg-[#F8FAF9] border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Identificação do Atendimento
                      </span>
                      <p className="text-xs text-slate-500 font-medium">Paciente:</p>
                      <p className="text-sm font-bold text-slate-900 leading-tight">
                        {faturaParaBaixar.nomePaciente || paciente?.nome || 'Paciente'}
                      </p>
                    </div>
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-xs text-slate-600 flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Período:</span>
                      <span className="font-semibold text-slate-800">
                        {plantoesValidos.length > 0
                          ? `${(plantoesValidos[0].data || '').split('-').reverse().join('/')} a ${(plantoesValidos[plantoesValidos.length - 1].data || '').split('-').reverse().join('/')}`
                          : 'Período Mensal'}
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Status & Valor Previsto */}
                  <div className="bg-[#F8FAF9] border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Status e Consolidação
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-100/80 text-emerald-800 border border-emerald-300/60">
                        {faturaParaBaixar.status || 'Emitida'}
                      </span>
                    </div>
                    <div className="mt-2 text-right">
                      <span className="text-[11px] text-slate-500 font-medium block">Valor Total Previsto:</span>
                      <p className="text-xl font-black text-[#1E3A2F] font-mono leading-none mt-1">
                        R$ {(faturaParaBaixar.valorTotal || faturaParaBaixar.valorTotalFatura || totalSomaPlantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Tabela de Escalas / Plantões */}
                <div className="rounded-lg overflow-hidden border border-slate-200 mb-5">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#1E3A2F] text-white">
                        <th className="py-2.5 px-3 text-center font-semibold text-[11px] uppercase tracking-wider w-[90px]">Data</th>
                        <th className="py-2.5 px-3 text-left font-semibold text-[11px] uppercase tracking-wider min-w-[170px]">Profissional</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-[11px] uppercase tracking-wider w-[100px]">Carga Horária</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-[11px] uppercase tracking-wider w-[120px]">Serviço</th>
                        <th className="py-2.5 px-3 text-right font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap min-w-[110px] w-[120px]">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {plantoesValidos.map((p: any, i: number) => {
                        const valorLinha = getFaturaRowVal(p);
                        const formatDateBR = (dateStr: string) => {
                          if (!dateStr) return '';
                          if (dateStr.includes('-')) {
                            return dateStr.split('-').reverse().join('/');
                          }
                          return dateStr;
                        };

                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F9FAFB]'}>
                            <td className="py-2 px-3 text-center font-mono text-slate-700">{formatDateBR(p.data)}</td>
                            <td className="py-2 px-3 text-left font-medium text-slate-800 whitespace-normal break-words">
                              {formatNomeComEspacos(p.profissional || p.nomeProfissional)}
                            </td>
                            <td className="py-2 px-3 text-center font-mono text-slate-600 font-medium">{getPlantaoCargaHoraria(p)}</td>
                            <td className="py-2 px-3 text-center text-slate-600">{p.tipoDia || 'Plantão Normal'}</td>
                            <td className="py-2 px-3 text-right text-slate-900 font-bold font-mono whitespace-nowrap">
                              R$ {valorLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 4. Totalizador */}
                <div className="flex justify-end mb-6">
                  <div className="bg-[#F8FAF9] border border-slate-200/90 rounded-xl p-4 text-right min-w-[240px] shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider block">
                      VALOR TOTAL DA FATURA
                    </span>
                    <span className="text-2xl font-black text-[#1E3A2F] font-mono block mt-0.5">
                      R$ {(faturaParaBaixar.valorTotal || faturaParaBaixar.valorTotalFatura || totalSomaPlantoes).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Rodapé Corporativo */}
              <div className="pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
                <span>Documento gerado eletronicamente pelo Sistema RH Gestão Domiciliar</span>
                <span>Página 1 de 1</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
