import React, { useState, useEffect, useRef, useMemo } from 'react';
import { sanitizeClonedDocForHtml2Canvas } from '../lib/html2canvasSanitizer';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento, DocumentoAnexo, Ocorrencia } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays, Paperclip, AlertCircle, Printer, Download, FileImage, Search, Clock, User, Calendar, Receipt, Copy, Save, UserX } from 'lucide-react';
import { RelatorioCuringasModal } from '../components/RelatorioCuringasModal';
import { CardBase, DataGrid, DataField, SoftBadge } from '../components/ui/DesignSystem';
import { db, storage } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { profissionalSchema } from '../schemas/validationSchemas';
import { mascaraCPF, mascaraCNPJ, mascaraTelefone, mascaraCEP, validarCPF, maskBankAccount, normalizeText } from '../lib/masks';
import { fetchCep, fetchBanks } from '../lib/brasilApi';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { CardSkeleton } from '../components/ui/CardSkeleton';
import { GlossyButton } from '../components/GlossyButton';
import ExcelJS from 'exceljs';
import * as docx from 'docx';

interface ProfissionaisProps {
  initialSelectedProfId?: string;
  clearInitialSelectedProfId?: () => void;
}

export const Profissionais: React.FC<ProfissionaisProps> = ({
  initialSelectedProfId,
  clearInitialSelectedProfId
}) => {
  const { profissionais, pacientes, addProfissional, updateProfissional, deleteProfissional, uploadLogo, uploadProfissionalFoto, uploadPdf, userRole, loading: firebaseLoading, agendamentos, isQuotaExceeded, isTestMode } = useFirebase();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firebaseLoading) {
      setIsLoading(false);
    }
  }, [firebaseLoading]);

  const [selectedProfId, setSelectedProfId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'agenda' | 'cracha' | 'ocorrencias'>('dados');
  const [agendamentosProf, setAgendamentosProf] = useState<Agendamento[]>([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bankList, setBankList] = useState<{code: string; name: string}[]>([]);
  const [deleteProfConfirmOpen, setDeleteProfConfirmOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [isBankDropdownOpen, setIsBankDropdownOpen] = useState(false);
  const [isRelatorioCuringasOpen, setIsRelatorioCuringasOpen] = useState(false);

  const handleNavigateToProfile = (profId: string) => {
    const found = (profissionais || []).find(p => p.id === profId);
    if (found) {
      handleOpenModal(found, 'dados');
      window.location.hash = `/profissionais/${profId}`;
    }
  };

  const handleCopyToClipboard = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copiado para a área de transferência!');
    } catch (err) {
      console.error('Erro ao copiar para a área de transferência', err);
    }
  };

  // Cleanup no Unmount: Garante que o estado do modal e seleção seja limpo ao trocar de aba
  useEffect(() => {
    return () => {
      setIsModalOpen(false);
      setEditingProf(null);
      setSelectedProfId('');
      if (clearInitialSelectedProfId) {
        clearInitialSelectedProfId();
      }
      try {
        const url = new URL(window.location.href);
        if (url.hash && (url.hash.includes('profissionais') || url.hash.startsWith('#/profissionais/'))) {
          url.hash = '';
        }
        if (url.searchParams.has('profId')) {
          url.searchParams.delete('profId');
        }
        window.history.replaceState({}, '', url.toString().replace(/#$/, ''));
      } catch (err) {
        console.warn('Erro ao limpar URL no unmount de Profissionais:', err);
      }
    };
  }, [clearInitialSelectedProfId]);

  useEffect(() => {
    if (initialSelectedProfId) {
      const found = (profissionais || []).find(p => p.id === initialSelectedProfId);
      if (found) {
        handleOpenModal(found, 'dados');
      }
      if (clearInitialSelectedProfId) {
        clearInitialSelectedProfId();
      }
    }
  }, [initialSelectedProfId, profissionais, clearInitialSelectedProfId]);

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#/profissionais/')) {
        const id = hash.replace('#/profissionais/', '');
        const found = (profissionais || []).find(p => p.id === id);
        if (found) {
          handleOpenModal(found, 'dados');
        }
      } else {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('profId');
        if (id) {
          const found = (profissionais || []).find(p => p.id === id);
          if (found) {
            handleOpenModal(found, 'dados');
          }
        }
      }
    };

    if (profissionais && profissionais.length > 0) {
      checkRoute();
    }
    
    window.addEventListener('hashchange', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
    };
  }, [profissionais]);

  useEffect(() => {
    fetchBanks().then(banks => setBankList(banks.filter((b: any) => !!b.code).map((b: any) => ({ code: String(b.code), name: b.fullName || '' }))));
  }, []);

  const handleCepChange = async (cep: string) => {
    const masked = mascaraCEP(cep);
    setFormData(prev => ({...prev, endereco: {...prev.endereco, cep: masked}}));

    if (masked.length === 9) {
      const data = await fetchCep(masked);
      if (data && !data.errors) {
        setFormData(prev => ({
          ...prev,
          endereco: {
            ...prev.endereco,
            rua: data.street || prev.endereco.rua,
            bairro: data.neighborhood || prev.endereco.bairro,
            cidade: data.city || prev.endereco.cidade,
            estado: data.state || prev.endereco.estado
          }
        }));
      }
    }
  };

  // Estados para Gestão de Ocorrências e Bloqueio
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [termoBusca, setTermoBusca] = useState('');
  const [mesFiltro, setMesFiltro] = useState('Todos');

  const formatarMes = (mesAno: string) => {
    if (!mesAno || mesAno.length < 7) return mesAno;
    const [ano, mes] = mesAno.split('-');
    const nomesMeses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const numMes = parseInt(mes, 10);
    if (isNaN(numMes) || numMes < 1 || numMes > 12) return mesAno;
    return `${nomesMeses[numMes - 1]} de ${ano}`;
  };

  const mesesDisponiveis = useMemo(() => {
    const meses = ocorrencias.map(oc => {
      return oc.mesAno || (oc.data ? oc.data.substring(0, 7) : '');
    }).filter(Boolean);
    return Array.from(new Set(meses)).sort((a, b) => b.localeCompare(a));
  }, [ocorrencias]);

  const ocorrenciasFiltradas = useMemo(() => {
    return ocorrencias.filter(oc => {
      if (mesFiltro !== 'Todos') {
        const ocMonth = oc.mesAno || (oc.data ? oc.data.substring(0, 7) : '');
        if (ocMonth !== mesFiltro) return false;
      }
      if (termoBusca.trim() !== '') {
        const term = termoBusca.toLowerCase().trim();
        const matchesPaciente = (oc.pacienteNome || oc.paciente || '').toLowerCase().includes(term);
        const matchesDescricao = (oc.descricao || '').toLowerCase().includes(term);
        const matchesTipo = (oc.tipo || '').toLowerCase().includes(term);
        if (!matchesPaciente && !matchesDescricao && !matchesTipo) return false;
      }
      return true;
    });
  }, [ocorrencias, mesFiltro, termoBusca]);

  const totalFaltasMes = useMemo(() => {
    const currentMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
    return ocorrencias.filter(oc => {
      const ocMonth = oc.mesAno || (oc.data ? oc.data.substring(0, 7) : '');
      return oc.tipo === 'automatica' && ocMonth === currentMonth;
    }).length;
  }, [ocorrencias]);

  const totalDebitosMes = useMemo(() => {
    const currentMonth = new Date().toISOString().substring(0, 7); // e.g. "2026-06"
    return ocorrencias.filter(oc => {
      const ocMonth = oc.mesAno || (oc.data ? oc.data.substring(0, 7) : '');
      return oc.tipo === 'automatica_debito' && ocMonth === currentMonth;
    }).reduce((sum, oc) => sum + (Number((oc as any).valor) || 0), 0);
  }, [ocorrencias]);
  const [ocData, setOcData] = useState(new Date().toISOString().split('T')[0]);
  const [ocPacienteId, setOcPacienteId] = useState('');
  const [ocDescricao, setOcDescricao] = useState('');
  const [ocBloquear, setOcBloquear] = useState(false);
  const [editingOcorrenciaId, setEditingOcorrenciaId] = useState<string | null>(null);
  const [savingOcorrencia, setSavingOcorrencia] = useState(false);
  const [deleteConfirmOc, setDeleteConfirmOc] = useState<Ocorrencia | null>(null);
  const [exibindoFormOcorrencia, setExibindoFormOcorrencia] = useState(false);
  const [plantaoSelecionado, setPlantaoSelecionado] = useState<Agendamento | null>(null);
  const occurrenceFormRef = useRef<HTMLDivElement>(null);

  const handleCloseFormOcorrencia = () => {
    setExibindoFormOcorrencia(false);
    setEditingOcorrenciaId(null);
    setOcData(new Date().toISOString().split('T')[0]);
    setOcPacienteId('');
    setOcDescricao('');
    setOcBloquear(false);
  };

  // Estados para documentos anexos reais (Storage + Firestore)
  const [tipoDocumentoAnexo, setTipoDocumentoAnexo] = useState<string>('');
  const [arquivoAnexo, setArquivoAnexo] = useState<File | null>(null);
  const [salvandoAnexo, setSalvandoAnexo] = useState<boolean>(false);
  const documentoInputRef = useRef<HTMLInputElement>(null);

  // Estado para titularidade de conta bancária (Sim/Não)
  const [isTitularConta, setIsTitularConta] = useState<string>('Sim');

  // Estado para exibir campo de Conselho Profissional
  const [showConselhoField, setShowConselhoField] = useState<boolean>(false);

  // Estado para visualização de documentos em modal
  const [previewDoc, setPreviewDoc] = useState<{ url: string; tipo: string; nome?: string } | null>(null);

  const isImageFile = (url: string, name?: string) => {
    const urlLower = (url || '').toLowerCase();
    const nameLower = (name || '').toLowerCase();
    return (
      urlLower.includes('.png') || urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.gif') || urlLower.includes('.webp') || urlLower.includes('.svg') ||
      nameLower.endsWith('.png') || nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.gif') || nameLower.endsWith('.webp') || nameLower.endsWith('.svg') ||
      urlLower.includes('image') || nameLower.startsWith('img-') || nameLower.includes('whatsapp')
    );
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (editingProf && activeTab === 'agenda') {
      setLoadingAgenda(true);

      if (isQuotaExceeded) {
        const agList = (agendamentos || []).filter(a => a.idProfissional === editingProf.id);
        agList.sort((a, b) => {
          const dateA = a.data || '';
          const dateB = b.data || '';
          if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
          }
          const timeA = a.horario || '';
          const timeB = b.horario || '';
          return timeB.localeCompare(timeA);
        });
        setAgendamentosProf(agList);
        setLoadingAgenda(false);
        return;
      }

      if (isQuotaExceeded || isTestMode) {
        const agList = (agendamentos || []).filter(a => a.idProfissional === editingProf.id);
        agList.sort((a, b) => {
          const dateA = a.data || '';
          const dateB = b.data || '';
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return (b.horario || '').localeCompare(a.horario || '');
        });
        setAgendamentosProf(agList);
        setLoadingAgenda(false);
        return;
      }

      const q = query(
        collection(db, 'agendamentos'),
        where('idProfissional', '==', editingProf.id),
        orderBy('data', 'desc')
      );
      
      let unsubscribeFallback: (() => void) | null = null;
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const agList: Agendamento[] = [];
        snapshot.forEach(doc => {
          agList.push({ ...doc.data(), id: doc.id } as Agendamento);
        });
        setAgendamentosProf(agList);
        setLoadingAgenda(false);
      }, (err) => {
        console.warn('Erro ao buscar com orderBy (provável falta de índice), tentando fallback de ordenação em memória:', err);
        const fallbackQ = query(
          collection(db, 'agendamentos'),
          where('idProfissional', '==', editingProf.id)
        );
        unsubscribeFallback = onSnapshot(fallbackQ, (snapshot) => {
          const agList: Agendamento[] = [];
          snapshot.forEach(doc => {
            agList.push({ ...doc.data(), id: doc.id } as Agendamento);
          });
          // Sort in-memory from most recent to oldest
          agList.sort((a, b) => {
            const dateA = a.data || '';
            const dateB = b.data || '';
            if (dateA !== dateB) {
              return dateB.localeCompare(dateA);
            }
            const timeA = a.horario || '';
            const timeB = b.horario || '';
            return timeB.localeCompare(timeA);
          });
          setAgendamentosProf(agList);
          setLoadingAgenda(false);
        }, (fallbackErr) => {
          console.error('Erro total no fallback de agendamentos:', fallbackErr);
          setLoadingAgenda(false);
        });
      });
      
      return () => {
        unsubscribe();
        if (unsubscribeFallback) unsubscribeFallback();
      };
    } else {
      setAgendamentosProf([]);
      setLoadingAgenda(false);
    }
  }, [editingProf, activeTab, isQuotaExceeded, isTestMode, agendamentos]);

  useEffect(() => {
    if (editingProf && activeTab === 'ocorrencias') {
      if (isQuotaExceeded || isTestMode) {
        setOcorrencias([]);
        return;
      }

      const q = query(
        collection(db, 'profissionais', editingProf.id, 'ocorrencias'),
        orderBy('data', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: Ocorrencia[] = [];
        snapshot.forEach(doc => {
          list.push({ ...doc.data(), id: doc.id } as Ocorrencia);
        });
        setOcorrencias(list);
      }, (err) => {
        console.error('Error fetching occurrences for professional:', err);
      });
      
      return () => unsubscribe();
    } else {
      setOcorrencias([]);
      setTermoBusca('');
      setMesFiltro('Todos');
    }
  }, [editingProf, activeTab, isQuotaExceeded]);

  const [formData, setFormData] = useState({
    nome: '',
    especialidade: '',
    telefone: '',
    foto: '',
    temMei: false,
    cnpj: '',
    meiIrregular: false,
    sexo: '' as string,
    dataNascimento: '',
    idade: undefined as number | string | undefined,
    profissao: '' as string,
    rg: '',
    cpf: '',
    conselho: '',
    status: '' as string,
    ativo: true as boolean,
    dadosBancarios: {
        banco: '',
        agencia: '',
        conta: '',
        pix: '',
        tipoConta: ''
    },
    endereco: {
        rua: '',
        numero: '',
        cep: '',
        bairro: '',
        cidade: '',
        estado: ''
    },
    documentos: {
      cracha: '',
      certificados: '',
      comprovanteResidencia: '',
      vacinas: '',
      outros: ''
    },
    documentosAnexos: [] as DocumentoAnexo[],
    nomeTitularConta: '',
    cpfTitularConta: '',
    grauParentescoTitular: '',
  });

  // Convert YYYY-MM-DD from Firebase DB to DD/MM/AAAA for state/input
  const formatDbDateToInput = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    const regexYmd = /^\d{4}-\d{2}-\d{2}$/;
    if (regexYmd.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  // Calculate age based on DD/MM/AAAA formatted date string
  const calculateAge = (dateString: string): string => {
    if (!dateString || dateString.length !== 10) return '';
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return '';
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return '';
    if (month < 1 || month > 12) return '';
    if (day < 1 || day > 31) return '';
    if (year < 1900 || year > new Date().getFullYear()) return '';
    
    const birthDate = new Date(year, month - 1, day);
    if (
      isNaN(birthDate.getTime()) ||
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month - 1 ||
      birthDate.getDate() !== day
    ) {
      return '';
    }
    
    const today = new Date();
    let calculatedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      calculatedAge--;
    }
    
    if (calculatedAge >= 0) {
      return `${calculatedAge} anos`;
    }
    return '';
  };

  // Mask function for birthday input (DD/MM/AAAA)
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    val = val.replace(/(\d{2})(\d)/, '$1/$2');
    val = val.replace(/(\d{2})(\d)/, '$1/$2');
    setFormData(prev => ({ ...prev, dataNascimento: val }));
  };

  // Calculate age based on dataNascimento
  useEffect(() => {
    if (formData.dataNascimento && formData.dataNascimento.length === 10) {
      const computedAge = calculateAge(formData.dataNascimento);
      setFormData(prev => ({ ...prev, idade: computedAge || '' }));
    } else {
      setFormData(prev => ({ ...prev, idade: '' }));
    }
  }, [formData.dataNascimento]);

  const cleanCpfValLocal = (formData.cpf || '').replace(/\D/g, '');
  const isCpfLoaded = cleanCpfValLocal.length > 0;
  const isCpfFullLength = cleanCpfValLocal.length === 11;
  const isCpfValid = isCpfFullLength && validarCPF(cleanCpfValLocal);
  const isCpfInvalid = isCpfFullLength && !isCpfValid;

  const cleanCpfTitularValLocal = (formData.cpfTitularConta || '').replace(/\D/g, '');
  const isCpfTitularLoaded = cleanCpfTitularValLocal.length > 0;
  const isCpfTitularFullLength = cleanCpfTitularValLocal.length === 11;
  const isCpfTitularValid = isCpfTitularFullLength && validarCPF(cleanCpfTitularValLocal);
  const isCpfTitularInvalid = isCpfTitularFullLength && !isCpfTitularValid;

  const handleOpenModal = (prof: Profissional | null = null, initialTab: 'dados' | 'agenda' | 'cracha' | 'ocorrencias' = 'dados') => {
    setEditingProf(prof);
    setActiveTab(initialTab);
    
    // Resetar estados de anexo de documento
    setTipoDocumentoAnexo('');
    setArquivoAnexo(null);
    setSalvandoAnexo(false);
    if (documentoInputRef.current) {
      documentoInputRef.current.value = '';
    }

    // Resetar estados de ocorrências
    setOcData(new Date().toISOString().split('T')[0]);
    setOcPacienteId('');
    setOcDescricao('');
    setOcBloquear(false);
    setEditingOcorrenciaId(null);
    setSavingOcorrencia(false);

    // Definir estado de titularidade da conta
    setIsTitularConta(prof ? (prof.isTitularConta === 'Não' || prof.isTitularConta === false ? 'Não' : 'Sim') : 'Sim');

    // Definir se exibe conselho profissional (abre aberto se o profissional já tiver conselho cadastrado)
    setShowConselhoField(!!(prof && prof.conselho));
 
    setFormData(prof ? {
        nome: prof.nome || '',
        especialidade: prof.especialidade || '',
        telefone: prof.telefone || '',
        foto: prof.foto || '',
        temMei: prof.temMei ?? false,
        cnpj: prof.cnpj || '',
        meiIrregular: prof.meiIrregular ?? false,
        sexo: prof.sexo || 'Masculino',
        dataNascimento: formatDbDateToInput(prof.dataNascimento || ''),
        idade: prof.idade,
        profissao: prof.profissao || 'Cuidadora(o)',
        rg: prof.rg || '',
        cpf: prof.cpf || '',
        conselho: prof.conselho || '',
        status: prof.status || 'Ativo',
        ativo: prof.ativo ?? (prof.status === 'Ativo'),
        dadosBancarios: {
          banco: prof.dadosBancarios?.banco || '',
          agencia: prof.dadosBancarios?.agencia || '',
          conta: prof.dadosBancarios?.conta || '',
          pix: prof.dadosBancarios?.pix || '',
          tipoConta: prof.dadosBancarios?.tipoConta || ''
        },
        endereco: prof.endereco ? {
          rua: prof.endereco.rua || '',
          numero: prof.endereco.numero || '',
          cep: prof.endereco.cep || '',
          bairro: prof.endereco.bairro || '',
          cidade: prof.endereco.cidade || '',
          estado: prof.endereco.estado || ''
        } : { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
        documentos: {
          cracha: prof.documentos?.cracha || '',
          certificados: prof.documentos?.certificados || '',
          comprovanteResidencia: prof.documentos?.comprovanteResidencia || '',
          vacinas: prof.documentos?.vacinas || '',
          outros: prof.documentos?.outros || ''
        },
        documentosAnexos: prof.documentosAnexos || [],
        nomeTitularConta: prof.nomeTitularConta || '',
        cpfTitularConta: prof.cpfTitularConta || '',
        grauParentescoTitular: prof.grauParentescoTitular || '',
    } as any : {
        nome: '',
        especialidade: '',
        telefone: '',
        foto: '',
        temMei: false,
        cnpj: '',
        meiIrregular: false,
        sexo: '',
        dataNascimento: '',
        idade: undefined,
        profissao: '',
        rg: '',
        cpf: '',
        conselho: '',
        status: 'Ativo',
        ativo: true,
        dadosBancarios: { banco: '', agencia: '', conta: '', pix: '', tipoConta: '' },
        endereco: { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
        documentos: {
          cracha: '',
          certificados: '',
          comprovanteResidencia: '',
          vacinas: '',
          outros: ''
        },
        documentosAnexos: [],
        nomeTitularConta: '',
        cpfTitularConta: '',
        grauParentescoTitular: '',
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProf(null);
    setSelectedProfId('');
    if (clearInitialSelectedProfId) {
      clearInitialSelectedProfId();
    }
    
    // Clean hash and query parameters from URL to prevent auto-opening on next view
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      if (url.searchParams.has('profId')) {
        url.searchParams.delete('profId');
      }
      window.history.replaceState({}, '', url.toString().replace(/#$/, ''));
    } catch (err) {
      console.warn('Erro ao limpar URL ao fechar modal:', err);
    }
  };

  // Funções de Gestão de Ocorrências e Sincronização de Bloqueios de Escala
  const updateBlockedPatients = async (profId: string) => {
    if (isTestMode || isQuotaExceeded) return;
    try {
      const occSnap = await getDocs(collection(db, 'profissionais', profId, 'ocorrencias'));
      const blockedSet = new Set<string>();
      occSnap.forEach(oDoc => {
        const data = oDoc.data();
        if (data.bloquearEscala && data.pacienteId) {
          blockedSet.add(data.pacienteId);
        }
      });
      const uniqueBlocked = Array.from(blockedSet);
      await updateDoc(doc(db, 'profissionais', profId), {
        pacientesBloqueados: uniqueBlocked
      });
      console.log('Escalas bloqueadas do profissional:', uniqueBlocked);
    } catch (err) {
      console.error('Erro de sincronização de pacientesBloqueados:', err);
    }
  };

  const handleSaveOcorrencia = async () => {
    if (!editingProf) return;
    if (!ocDescricao.trim()) {
      alert('Por favor, detalhe a ocorrência.');
      return;
    }

    setSavingOcorrencia(true);
    try {
      const chosenPaciente = ocPacienteId ? pacientes.find(p => p.id === ocPacienteId) : null;
      const payload: any = {
        data: ocData,
        pacienteId: ocPacienteId || '',
        pacienteNome: chosenPaciente ? chosenPaciente.nome : 'Administrativa / Geral',
        descricao: ocDescricao.trim(),
        bloquearEscala: ocPacienteId ? ocBloquear : false,
        createdAt: new Date().toISOString(),
        tipo: 'manual'
      };

      if (isTestMode || isQuotaExceeded) {
        const newOc: Ocorrencia = {
          id: editingOcorrenciaId || `oc-${Date.now()}`,
          ...payload
        };
        if (editingOcorrenciaId) {
          setOcorrencias(prev => prev.map(o => o.id === editingOcorrenciaId ? newOc : o));
          setSuccessMessage('Ocorrência atualizada com sucesso (Modo de Testes).');
        } else {
          setOcorrencias(prev => [newOc, ...prev]);
          setSuccessMessage('Ocorrência registrada com sucesso (Modo de Testes).');
        }
        setOcData(new Date().toISOString().split('T')[0]);
        setOcPacienteId('');
        setOcDescricao('');
        setOcBloquear(false);
        setEditingOcorrenciaId(null);
        setExibindoFormOcorrencia(false);
        setSavingOcorrencia(false);
        return;
      }

      if (editingOcorrenciaId) {
        const docRef = doc(db, 'profissionais', editingProf.id, 'ocorrencias', editingOcorrenciaId);
        await updateDoc(docRef, payload);
        setSuccessMessage('Ocorrência atualizada com sucesso.');
      } else {
        const colRef = collection(db, 'profissionais', editingProf.id, 'ocorrencias');
        await addDoc(colRef, payload);
        setSuccessMessage('Ocorrência registrada com sucesso.');
      }

      // Atualiza a trava 'pacientesBloqueados' no documento base do profissional
      await updateBlockedPatients(editingProf.id);

      // Limpar form
      setOcData(new Date().toISOString().split('T')[0]);
      setOcPacienteId('');
      setOcDescricao('');
      setOcBloquear(false);
      setEditingOcorrenciaId(null);
      setExibindoFormOcorrencia(false);
    } catch (err) {
      console.error('Erro ao salvar ocorrencia:', err);
      setSuccessMessage('Erro ao salvar ocorrência.');
    } finally {
      setSavingOcorrencia(false);
    }
  };

  const handleEditOcorrenciaClick = (oc: Ocorrencia) => {
    if (!oc.id) return;
    setEditingOcorrenciaId(oc.id);
    setOcData(oc.data);
    setOcPacienteId(oc.pacienteId);
    setOcDescricao(oc.descricao);
    setOcBloquear(oc.bloquearEscala);
    setExibindoFormOcorrencia(true);

    // Form smooth scroll to view
    setTimeout(() => {
      occurrenceFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const handleDeleteOcorrencia = async (oc: Ocorrencia) => {
    setDeleteConfirmOc(oc);
  };

  const handleConfirmDeleteOcorrencia = async () => {
    if (!editingProf || !deleteConfirmOc || !deleteConfirmOc.id) return;

    if (isTestMode || isQuotaExceeded) {
      setOcorrencias(prev => prev.filter(o => o.id !== deleteConfirmOc.id));
      setSuccessMessage('Ocorrência excluída com sucesso (Modo de Testes).');
      setDeleteConfirmOc(null);
      return;
    }

    try {
      const docRef = doc(db, 'profissionais', editingProf.id, 'ocorrencias', deleteConfirmOc.id);
      await deleteDoc(docRef);
      setSuccessMessage('Ocorrência excluída com sucesso.');

      // Recalcula bloqueios
      await updateBlockedPatients(editingProf.id);
    } catch (err) {
      console.error('Erro ao excluir ocorrencia:', err);
      setSuccessMessage('Erro ao excluir ocorrência.');
    } finally {
      setDeleteConfirmOc(null);
    }
  };

  const handleBaixarOcorrenciasExcel = async () => {
    if (!editingProf) {
      toast.error('Profissional não selecionado.');
      return;
    }

    if (ocorrenciasFiltradas.length === 0) {
      toast.error('Nenhuma ocorrência registrada atende aos filtros para exportar.');
      return;
    }

    let empresaNome = 'RH Cuidado Domiciliar';
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
        { key: 'C', width: 25 },
        { key: 'D', width: 50 },
        { key: 'E', width: 15 }
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
      profInfoSub.value = `Profissional: ${editingProf.nome}`;
      profInfoSub.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF1F2937' } };
      profInfoSub.alignment = { horizontal: 'right' };

      const extraCell = worksheet.getCell('D4');
      extraCell.value = `CPF: ${editingProf.cpf || '---'} | Tipo: ${editingProf.profissao || editingProf.especialidade || '---'}`;
      extraCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };
      extraCell.alignment = { horizontal: 'right' };

      // Separator line
      worksheet.getRow(5).height = 10;
      for (let c = 1; c <= 5; c++) {
        worksheet.getCell(5, c).border = {
          bottom: { style: 'medium', color: { argb: 'FFD1D5DB' } }
        };
      }

      // Format Date helper
      const formatarDataBR = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-')) {
          return dateStr.split('-').reverse().join('/');
        }
        return dateStr;
      };

      // Statistics grid on line 7
      worksheet.getCell('A7').value = 'Total Faltas (Mês):';
      worksheet.getCell('B7').value = totalFaltasMes;
      worksheet.getCell('C7').value = 'Total Débitos (Mês):';
      
      const valDebitosCell = worksheet.getCell('D7');
      valDebitosCell.value = totalDebitosMes;
      valDebitosCell.numFmt = '"R$ "#,##0.00';

      const statRefs = ['A7', 'B7', 'C7', 'D7'];
      statRefs.forEach(ref => {
        const c = worksheet.getCell(ref);
        c.font = { name: 'Arial', size: 10 };
      });
      ['A7', 'C7'].forEach(ref => {
        worksheet.getCell(ref).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF374151' } };
      });
      worksheet.getCell('B7').font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
      valDebitosCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } };

      // Space
      worksheet.getRow(8).height = 15;

      // Filter settings displayed
      worksheet.getCell('A9').value = 'Filtro por Período:';
      worksheet.getCell('B9').value = mesFiltro === 'Todos' ? 'Histórico Completo' : formatarMes(mesFiltro);
      worksheet.getCell('A9').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF6B7280' } };
      worksheet.getCell('B9').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };

      if (termoBusca) {
        worksheet.getCell('C9').value = 'Busca:';
        worksheet.getCell('D9').value = `"${termoBusca}"`;
        worksheet.getCell('C9').font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF6B7280' } };
        worksheet.getCell('D9').font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF4B5563' } };
      }

      // Space
      worksheet.getRow(10).height = 10;

      // Table Header (Row 11)
      const tableHeaderRow = worksheet.getRow(11);
      tableHeaderRow.height = 24;
      ['A11', 'B11', 'C11', 'D11', 'E11'].forEach((cellRef, idx) => {
        const hCell = worksheet.getCell(cellRef);
        hCell.value = ['Data', 'Paciente', 'Status / Bloqueio', 'Descrição do Motivo', 'Valor / Débito'][idx];
        hCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        hCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1A4231' } // Dark Green
        };
        hCell.alignment = { vertical: 'middle', horizontal: idx === 4 ? 'right' : 'left' };
      });

      let currentRow = 12;

      ocorrenciasFiltradas.forEach((oc: any) => {
        worksheet.getCell(`A${currentRow}`).value = formatarDataBR(oc.data || '');
        worksheet.getCell(`B${currentRow}`).value = oc.pacienteNome || oc.paciente || 'Não Informado';
        
        let statusString = oc.bloquearEscala ? 'BLOQUEADO' : 'Sem Bloqueio';
        if (oc.tipo === 'automatica') statusString += ' (Sistema / Falta)';
        else if (oc.tipo === 'automatica_debito') statusString += ' (Sistema / Débito)';
        worksheet.getCell(`C${currentRow}`).value = statusString;
        
        worksheet.getCell(`D${currentRow}`).value = oc.descricao || '';

        const valCell = worksheet.getCell(`E${currentRow}`);
        if (oc.tipo === 'automatica_debito' && oc.valor) {
          valCell.value = Number(oc.valor);
          valCell.numFmt = '"R$ "#,##0.00';
        } else {
          valCell.value = '---';
        }
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

      // Adjust column styles
      worksheet.columns.forEach(column => {
        let maxLen = 12;
        column?.eachCell?.({ includeEmpty: true }, cell => {
          const valStr = cell.value ? String(cell.value) : '';
          if (valStr.length > maxLen) maxLen = valStr.length;
        });
        if (column) column.width = Math.min(maxLen + 4, 60); // limit max width so it fits
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = editingProf.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `ocorrencias_${safeName}.xlsx`;
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
    if (!editingProf) {
      toast.error('Profissional não selecionado.');
      return;
    }

    if (ocorrenciasFiltradas.length === 0) {
      toast.error('Nenhuma ocorrência registrada atende aos filtros para exportar.');
      return;
    }

    let empresaNome = 'RH Cuidado Domiciliar';
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
                      new TextRun({ text: `Profissional: ${editingProf.nome}`, bold: true, size: 18, color: "111111", font: "Arial" })
                    ],
                    alignment: AlignmentType.RIGHT,
                    spacing: { before: 80 }
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: `CPF: ${editingProf.cpf || '---'} | Cargo: ${editingProf.profissao || editingProf.especialidade || '---'}`, size: 16, color: "555555", font: "Arial" })
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
                width: { size: 50, type: WidthType.PERCENTAGE },
                shading: { fill: "FAFAFA" },
                margins: { top: 120, bottom: 120, left: 150, right: 150 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Faltas (Mês Atual): ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: String(totalFaltasMes), bold: true, color: "B91C1C", size: 18, font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Período: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: mesFiltro === 'Todos' ? 'Histórico Completo' : formatarMes(mesFiltro), size: 18, font: "Arial" })
                    ],
                    spacing: { before: 80 }
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
                      new TextRun({ text: "Débitos (Mês Atual): ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: `R$ ${totalDebitosMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true, color: "B91C1C", size: 18, font: "Arial" })
                    ]
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({ text: "Total de Registros Encontrados: ", bold: true, size: 18, color: "4B5563", font: "Arial" }),
                      new TextRun({ text: String(ocorrenciasFiltradas.length), size: 18, font: "Arial" })
                    ],
                    spacing: { before: 80 }
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
            width: { size: 22, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Paciente", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 23, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Origem / Status", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Descrição do Motivo", bold: true, color: "FFFFFF", size: 18, font: "Arial" })] })]
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            shading: { fill: "1A4231" },
            margins: { top: 150, bottom: 150, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: "Valor", bold: true, color: "FFFFFF", size: 18, font: "Arial" })], alignment: AlignmentType.RIGHT })]
          })
        ]
      });

      // Occurrences lists
      const tableBodyRows = ocorrenciasFiltradas.map((oc: any) => {
        let statusText = oc.bloquearEscala ? 'BLOQUEADO' : 'Sem Bloqueio';
        if (oc.tipo === 'automatica') statusText += ' (Sistema/Falta)';
        else if (oc.tipo === 'automatica_debito') statusText += ' (Sistema/Débito)';

        const formattedVal = oc.tipo === 'automatica_debito' && oc.valor
          ? `R$ ${Number(oc.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '---';

        return new TableRow({
          children: [
            new TableCell({
              width: { size: 15, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: formatarDataBR(oc.data || ''), size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 22, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: oc.pacienteNome || oc.paciente || 'Não Informado', size: 18, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 23, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: statusText, size: 16, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: oc.descricao || '', size: 16, font: "Arial" })] })]
            }),
            new TableCell({
              width: { size: 12, type: WidthType.PERCENTAGE },
              margins: { top: 120, bottom: 120, left: 120, right: 120 },
              children: [new Paragraph({ children: [new TextRun({ text: formattedVal, size: 18, font: "Arial" })], alignment: AlignmentType.RIGHT })]
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
      const safeName = editingProf.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `ocorrencias_${safeName}.docx`;
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (uploading) {
      alert("Aguarde o upload dos arquivos finalizar.");
      return;
    }

    // Validação robusta com Zod
    const cleanCpfVal = (formData.cpf || '').replace(/\D/g, '');
    const validation = profissionalSchema.safeParse({ ...formData, cpf: cleanCpfVal });
    
    if (!validation.success) {
      alert(validation.error.issues[0].message);
      return;
    }

    if (!validarCPF(cleanCpfVal)) {
      toast.error('O CPF do profissional é inválido. Por favor, verifique os dígitos verificadores.');
      return;
    }

    // 1 - Antes de salvar um novo profissional o sistema deve verificar se o c.p.f já consta como cadastrado.
    if (!editingProf) {
      const cpfJaCadastrado = profissionais.some(p => {
        const pCpf = (p.cpf || '').replace(/\D/g, '');
        return pCpf === cleanCpfVal;
      });
      if (cpfJaCadastrado) {
        toast.error('Aviso: Este CPF já consta como cadastrado para outro profissional.');
        return;
      }
    }

    // Trava de Duplicidade Cruzada de CPF (Anti-Duplicação)
    const formattedCpfVal = mascaraCPF(cleanCpfVal);
    const cpfOptions = [cleanCpfVal, formattedCpfVal].filter(Boolean);

    try {
      const profQuery = query(collection(db, 'profissionais'), where('cpf', 'in', cpfOptions));
      const profSnap = await getDocs(profQuery);
      const duplicateProf = profSnap.docs.find((doc: any) => !editingProf || doc.id !== editingProf?.id);
      if (duplicateProf) {
        toast.error('Falha no cadastro: Este CPF já se encontra registrado em nosso sistema.');
        return;
      }

      const pacQuery = query(collection(db, 'pacientes'), where('cpf', 'in', cpfOptions));
      const pacSnap = await getDocs(pacQuery);
      if (!pacSnap.empty) {
        toast.error('Falha no cadastro: Este CPF já se encontra registrado em nosso sistema.');
        return;
      }
    } catch (dbErr) {
      console.warn("Aviso na verificação de CPF (usando verificação local):", dbErr);
      const cpfEmPacientes = (pacientes || []).some(p => {
        const pCpf = (p.cpf || '').replace(/\D/g, '');
        return pCpf === cleanCpfVal;
      });
      if (cpfEmPacientes) {
        toast.error('Falha no cadastro: Este CPF já se encontra registrado em nosso sistema.');
        return;
      }
    }

    // Validação de Tipo de Conta obrigatório caso agência e conta estejam preenchidos
    const hasAgencia = !!(formData.dadosBancarios?.agencia && formData.dadosBancarios.agencia.trim() !== '');
    const hasConta = !!(formData.dadosBancarios?.conta && formData.dadosBancarios.conta.trim() !== '');
    if ((hasAgencia || hasConta) && !(formData.dadosBancarios?.tipoConta && formData.dadosBancarios.tipoConta.trim() !== '')) {
      toast.error('O Tipo de Conta é obrigatório quando Agência e Conta estão preenchidos.');
      return;
    }

    if (isTitularConta === 'Não') {
      const cleanCpfTitularVal = (formData.cpfTitularConta || '').replace(/\D/g, '');
      if (cleanCpfTitularVal && !validarCPF(cleanCpfTitularVal)) {
        toast.error('O CPF do titular da conta bancária é inválido. Por favor, verifique os dígitos verificadores.');
        return;
      }
    }

    setLoading(true); // O estado loading precisa ser definido no componente, adicionarei logo adiante

    try {
      const rawData = {
        ...formData,
        especialidade: formData.profissao,
        ativo: formData.status === 'Ativo',
        isTitularConta: isTitularConta === 'Sim' ? 'Sim' : 'Não',
        nomeTitularConta: isTitularConta === 'Não' ? formData.nomeTitularConta : '',
        cpfTitularConta: isTitularConta === 'Não' ? formData.cpfTitularConta : '',
        grauParentescoTitular: isTitularConta === 'Não' ? formData.grauParentescoTitular : ''
      };

      // Limpar campos undefined para evitar erros no Firestore setDoc()
      const finalData: any = {};
      Object.keys(rawData).forEach(key => {
        const val = (rawData as any)[key];
        if (val !== undefined) {
          finalData[key] = val;
        }
      });

      if (editingProf) {
        const updated = { ...editingProf, ...finalData } as any;
        await updateProfissional(updated, true);
        setEditingProf(updated);
        setFormData({
          nome: updated.nome || '',
          especialidade: updated.especialidade || '',
          telefone: updated.telefone || '',
          foto: updated.foto || '',
          temMei: updated.temMei ?? false,
          cnpj: updated.cnpj || '',
          meiIrregular: updated.meiIrregular ?? false,
          sexo: updated.sexo || 'Masculino',
          dataNascimento: formatDbDateToInput(updated.dataNascimento || ''),
          idade: updated.idade,
          profissao: updated.profissao || 'Cuidadora(o)',
          rg: updated.rg || '',
          cpf: updated.cpf || '',
          conselho: updated.conselho || '',
          status: updated.status || 'Ativo',
          ativo: updated.ativo ?? (updated.status === 'Ativo'),
          dadosBancarios: {
            banco: updated.dadosBancarios?.banco || '',
            agencia: updated.dadosBancarios?.agencia || '',
            conta: updated.dadosBancarios?.conta || '',
            pix: updated.dadosBancarios?.pix || '',
            tipoConta: updated.dadosBancarios?.tipoConta || ''
          },
          endereco: updated.endereco ? {
            rua: updated.endereco.rua || '',
            numero: updated.endereco.numero || '',
            cep: updated.endereco.cep || '',
            bairro: updated.endereco.bairro || '',
            cidade: updated.endereco.cidade || '',
            estado: updated.endereco.estado || ''
          } : { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
          documentos: {
            cracha: updated.documentos?.cracha || '',
            certificados: updated.documentos?.certificados || '',
            comprovanteResidencia: updated.documentos?.comprovanteResidencia || '',
            vacinas: updated.documentos?.vacinas || '',
            outros: updated.documentos?.outros || ''
          },
          documentosAnexos: updated.documentosAnexos || [],
          nomeTitularConta: updated.nomeTitularConta || '',
          cpfTitularConta: updated.cpfTitularConta || '',
          grauParentescoTitular: updated.grauParentescoTitular || '',
        } as any);

        toast.success(`Profissional ${updated.nome} atualizado com sucesso!`, {
          icon: '✅',
        });
      } else {
        const created = await addProfissional(finalData as any, true);
        setEditingProf(created);
        setFormData({
          nome: created.nome || '',
          especialidade: created.especialidade || '',
          telefone: created.telefone || '',
          foto: created.foto || '',
          temMei: created.temMei ?? false,
          cnpj: created.cnpj || '',
          meiIrregular: created.meiIrregular ?? false,
          sexo: created.sexo || 'Masculino',
          dataNascimento: formatDbDateToInput(created.dataNascimento || ''),
          idade: created.idade,
          profissao: created.profissao || 'Cuidadora(o)',
          rg: created.rg || '',
          cpf: created.cpf || '',
          conselho: created.conselho || '',
          status: created.status || 'Ativo',
          ativo: created.ativo ?? (created.status === 'Ativo'),
          dadosBancarios: {
            banco: created.dadosBancarios?.banco || '',
            agencia: created.dadosBancarios?.agencia || '',
            conta: created.dadosBancarios?.conta || '',
            pix: created.dadosBancarios?.pix || '',
            tipoConta: created.dadosBancarios?.tipoConta || ''
          },
          endereco: created.endereco ? {
            rua: created.endereco.rua || '',
            numero: created.endereco.numero || '',
            cep: created.endereco.cep || '',
            bairro: created.endereco.bairro || '',
            cidade: created.endereco.cidade || '',
            estado: created.endereco.estado || ''
          } : { rua: '', numero: '', cep: '', bairro: '', cidade: '', estado: '' },
          documentos: {
            cracha: created.documentos?.cracha || '',
            certificados: created.documentos?.certificados || '',
            comprovanteResidencia: created.documentos?.comprovanteResidencia || '',
            vacinas: created.documentos?.vacinas || '',
            outros: created.documentos?.outros || ''
          },
          documentosAnexos: created.documentosAnexos || [],
          nomeTitularConta: created.nomeTitularConta || '',
          cpfTitularConta: created.cpfTitularConta || '',
          grauParentescoTitular: created.grauParentescoTitular || '',
        } as any);

        toast.success(`Profissional ${created.nome} cadastrado com sucesso!`, {
          icon: '✅',
        });
      }
    } catch (err: any) {
      console.error("Erro ao salvar:", err);
      if (err?.message?.includes('exceeds the maximum allowed size') || err?.message?.includes('maximum allowed size')) {
        toast.error("Falha ao salvar: A imagem ou arquivo em anexo é muito pesado. O limite máximo é de 1MB. Reduza o arquivo e tente novamente.");
        return;
      }
      toast.error("Erro ao salvar os dados");
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploading(true);
      const loadingToast = toast.loading("Enviando foto do profissional...");
      try {
        const url = await uploadProfissionalFoto(file);
        setFormData(prev => ({ ...prev, foto: url }));
        toast.success("Foto do profissional atualizada com sucesso!", { id: loadingToast });
      } catch (err) {
        console.error("Erro ao subir foto:", err);
        toast.error("Erro ao enviar foto. Tente novamente.", { id: loadingToast });
      } finally {
        setUploading(false);
        if (e.target) {
          e.target.value = '';
        }
      }
    }
  };

  const removeDocumentoAnexoRow = async (id: string | number) => {
    const updated = (formData.documentosAnexos || []).filter(doc => doc.id !== id);
    setFormData(prev => ({
      ...prev,
      documentosAnexos: updated
    }));

    if (editingProf) {
      try {
        const profRef = doc(db, 'profissionais', editingProf.id);
        await updateDoc(profRef, {
          documentosAnexos: updated
        });
        setSuccessMessage("Anexo removido com sucesso!");
      } catch (err) {
        console.error("Erro ao remover anexo do Firestore:", err);
      }
    }
  };

  const handleUploadAnexo = async () => {
    if (!editingProf) {
      toast.error("Por favor, salve o profissional primeiro para poder enviar documentos anexos.");
      return;
    }

    // 3. Validação Pré-Upload
    if (!arquivoAnexo) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }

    // 2. Validação de Formato e Alerta Prévio (Frontend):
    const allowedTypes = [
      'image/jpeg', 
      'image/png', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(arquivoAnexo.type)) {
      toast.error('Formato inválido. Envie apenas JPG, PNG, PDF ou Word (Doc/Docx).');
      alert('Formato inválido. Envie apenas JPG, PNG, PDF ou Word (Doc/Docx).');
      return;
    }

    const MAX_SIZE_5MB = 5 * 1024 * 1024; // 5MB
    if (arquivoAnexo.size > MAX_SIZE_5MB) {
      toast.error("O arquivo excede o limite máximo de 5MB permitido.");
      return;
    }

    if (!tipoDocumentoAnexo) {
      toast.error("Por favor, selecione o Tipo de Documento.");
      return;
    }

    // 1. Gerenciamento de Estado Obrigatório (Try/Catch/Finally)
    setSalvandoAnexo(true);

    try {
      const id = editingProf.id;
      // Fazer o upload para o Firebase Storage
      let downloadUrl = '';

      try {
        const pathRef = `profissionais/${id}/${arquivoAnexo.name}`;
        const storageRef = ref(storage, pathRef);
        
        const uploadPromise = uploadBytes(storageRef, arquivoAnexo).then(res => getDownloadURL(res.ref));
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT_STORAGE')), 2000)
        );

        downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (storageError) {
        console.warn("Upload via Firebase Storage falhou ou expirou, usando fallback Base64:", storageError);
        // Fallback: carregar como base64 data URL
        downloadUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(arquivoAnexo);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
        });
      }

      // Criar o objeto conforme especificado no requisito do usuário:
      // { url: downloadUrl, tipo: tipoDocumentoAnexo, nome: arquivo.name, data: new Date() }
      const novoAnexo = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        tipo: tipoDocumentoAnexo,
        url: downloadUrl,
        arquivo: downloadUrl, // compatibilidade
        nome: arquivoAnexo.name,
        nomeArquivo: arquivoAnexo.name, // compatibilidade
        data: new Date().toISOString()
      };

      // Carregar os anexos existentes no formData
      const currentAnexos = formData.documentosAnexos || [];
      const updatedAnexos = [...currentAnexos, novoAnexo];

      // Atualizar o Firestore
      const profRef = doc(db, 'profissionais', id);
      await updateDoc(profRef, {
        documentosAnexos: updatedAnexos
      });

      // Atualizar o estado local
      setFormData(prev => ({
        ...prev,
        documentosAnexos: updatedAnexos
      }));

      // Limpar os campos do input
      setArquivoAnexo(null);
      setTipoDocumentoAnexo('');
      if (documentoInputRef.current) {
        documentoInputRef.current.value = '';
      }

      // Exiba o alerta de 'Salvo com sucesso' APENAS dentro do then do Firestore
      setSuccessMessage("Documento anexo salvo com sucesso!");
      toast.success("Documento anexo salvo com sucesso!");

    } catch (error: any) {
      console.error("Erro no upload:", error);
      const errMsg = error?.message || 'Verifique sua conexão ou permissões.';
      toast.error(`Erro ao enviar o arquivo. ${errMsg}`);
      alert(`Erro ao enviar o arquivo. ${errMsg}`);
    } finally {
      // 4. Verificação de Regras do Storage (Lembrete):
      // LEMBRETE: Verificar as regras do Firebase Storage (storage.rules).
      // Se as regras estiverem fechadas (allow write: if false;), a requisição ficará pendente ou falhará.
      setSalvandoAnexo(false); // ISSO DESTRAVA O BOTÃO
    }
  };

  const BadgeGerador = ({ profData }: { profData: Partial<Profissional> }) => {
    const badgeRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<{logoUrl: string, razaoSocial: string, cnpj: string}>({logoUrl: '', razaoSocial: '', cnpj: ''});
    const [loadingConfig, setLoadingConfig] = useState(true);
    const [logoBase64, setLogoBase64] = useState<string>('');
    const [fotoBase64, setFotoBase64] = useState<string>('');

    // Safe utility to fetch any image url and convert it into a local Base64 string to prevent CORS canvas rendering failures
    const urlToBase64 = async (url: string): Promise<string> => {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn("[BadgeGerador] Failed to fetch convert image to Base64 via fetch, trying with Image element fallback:", err);
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = url;
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = reject;
        });
      }
    };

    useEffect(() => {
      const fetchConfig = async () => {
        if (isQuotaExceeded) {
          setLoadingConfig(false);
          return;
        }
        try {
          const docRef = doc(db, 'configuracoes_empresa', 'empresa');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setConfig(docSnap.data() as any);
          }
        } catch (err: any) {
          if (err?.message?.includes('Quota') || err?.code === 'resource-exhausted') {
            console.warn("Quota limit exceeded when fetching configurações (ignorado).");
          } else {
            console.error("Erro ao buscar configurações:", err);
          }
        } finally {
          setLoadingConfig(false);
        }
      };
      fetchConfig();
    }, [isQuotaExceeded]);

    // Load and convert both Logo and Profile photo to Base64 strings to preempt CORS exceptions in html2canvas
    useEffect(() => {
      const loadBase64Images = async () => {
        if (config.logoUrl) {
          try {
            const b64 = await urlToBase64(config.logoUrl);
            setLogoBase64(b64);
          } catch (e) {
            console.warn("Could not convert company logo to Base64:", e);
            setLogoBase64(config.logoUrl); // Fallback to raw url
          }
        } else {
          setLogoBase64('');
        }

        if (profData.foto) {
          try {
            const b64 = await urlToBase64(profData.foto);
            setFotoBase64(b64);
          } catch (e) {
            console.warn("Could not convert profile photo to Base64:", e);
            setFotoBase64(profData.foto); // Fallback to raw url
          }
        } else {
          setFotoBase64('');
        }
      };

      if (!loadingConfig) {
        loadBase64Images();
      }
    }, [config.logoUrl, profData.foto, loadingConfig]);

    const handleDownloadPng = async () => {
      setLoading(true);
      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture for PNG with onclone...");
          const html2canvas = (await import('html2canvas-pro')).default;
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              sanitizeClonedDocForHtml2Canvas(clonedDoc, '#fcf8f2', '#1a3c2e');
            }
          });
          
          console.log("[BadgeGerador] Canvas generated successfully. Converting to PNG data URL.");
          const imgData = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = imgData;
          link.download = `cracha_${profData.nome || 'profissional'}.png`;
          link.click();
          console.log("[BadgeGerador] PNG file downloaded.");
        } catch (err: any) {
          console.error("Erro ao gerar PNG:", err);
          alert(`Infelizmente erro ao gerar o arquivo PNG: ${err.message || String(err)}`);
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
      }
      setLoading(false);
    };

    const handleDownloadWord = async () => {
      setLoading(true);
      if (badgeRef.current) {
        try {
          console.log("[BadgeGerador] Starting html2canvas capture with onclone...");
          const html2canvas = (await import('html2canvas-pro')).default;
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true, // safe because we converted to base64 but can render other parts
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              sanitizeClonedDocForHtml2Canvas(clonedDoc, '#fcf8f2', '#1a3c2e');
            }
          });
          
          console.log("[BadgeGerador] Canvas generated successfully. Converting to blob.");
          // JPEG format at 0.9 quality reduces payload to prevent parser failures or crash in mobile tools
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          
          const htmlStr = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <title>Crachá de Identidade</title>
  </head>
  <body style="background-color: #fcf8f2; text-align: center; margin: 0; padding: 40px 0;">
    <!-- O width fixo em 320px garante que o Word não estique a imagem -->
    <img src="${imgData}" width="320" style="width: 320px; height: auto; border: 1px solid #b8860b; border-radius: 10px; box-shadow: 2px 2px 10px rgba(0,0,0,0.1);" />
  </body>
  </html>`;
          
          const blob = new Blob(['\ufeff', htmlStr], { type: 'application/msword' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `cracha_${profData.nome || 'profissional'}.doc`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log("[BadgeGerador] Badge file triggered for download.");
        } catch (err: any) {
          console.error("Erro ao gerar Word:", err);
          alert(`Infelizmente erro ao gerar o arquivo de download: ${err.message || String(err)}\nPor favor tente novamente.`);
        }
      } else {
        alert("Referência do elemento do crachá não encontrada.");
      }
      setLoading(false);
    };

    return (
      <div className="space-y-4 p-4 print:p-0 print:m-0 flex flex-col items-center">
        <div className="flex flex-col items-center gap-2 print:hidden mb-2">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={loading || loadingConfig}
              className="px-6 py-2.5 bg-[#1a3c2e] text-[#C5A059] font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:bg-gray-400 cursor-pointer shadow-sm border border-[#C5A059]"
            >
              {loading ? 'Preparando...' : <><FileImage size={14} /> Baixar Crachá (PNG)</>}
            </button>
          </div>
        </div>
        
        {/* Crachá Integrado no Estilo da Simulação (100% Dinâmico) */}
        <div 
          ref={badgeRef}
          className="relative w-[580px] h-[380px] bg-white rounded-2xl border-2 border-[#C5A059] p-1.5 shadow-xl overflow-hidden font-sans select-none"
        >
          <div className="relative w-full h-full border border-[#C5A059]/70 rounded-xl p-5 flex flex-col items-center justify-between bg-white overflow-hidden">
            
            {/* Marca d'Água (Watermark Background) com Símbolo de Coração e Folha em Opacidade de ~6% */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.06] z-0" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="heart-leaf-watermark" x="0" y="0" width="55" height="55" patternUnits="userSpaceOnUse">
                  <g stroke="#C5A059" strokeWidth="1.2" fill="none">
                    <path d="M 22 10 C 17 5 10 7 8 13 C 5 21 13 27 22 35 C 31 27 39 21 36 13 C 34 7 27 5 22 10 Z" fill="#C5A059" fillOpacity="0.3" />
                    <path d="M 27 12 C 32 15 30 23 23 27 C 22 28 20 22 24 16 C 26 13 27 12 27 12 Z" fill="#1a3c2e" fillOpacity="0.4" />
                  </g>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#heart-leaf-watermark)" />
            </svg>

            {/* Arcos Decorativos Dourados (Top & Bottom Metallic Arches - Perfectly Framing Photo and Text) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 580 380" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="badge-gold-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#C5A059" stopOpacity="0.08" />
                  <stop offset="20%" stopColor="#D4AF37" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#F3E5AB" stopOpacity="1" />
                  <stop offset="80%" stopColor="#D4AF37" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#C5A059" stopOpacity="0.08" />
                </linearGradient>
              </defs>
              {/* Arco Superior Reposicionado (Descido para abraçar a foto e harmonizar o espaço negativo) */}
              <path d="M 45 85 Q 290 35 535 85 Q 290 49 45 85 Z" fill="url(#badge-gold-arc-grad)" />
              {/* Arco Inferior Sweeping Low Below Details (Subido 2 pontos) */}
              <path d="M 45 310 Q 290 365 535 310 Q 290 351 45 310 Z" fill="url(#badge-gold-arc-grad)" />
            </svg>

            {/* Logotipo Principal no Canto Superior Esquerdo (bg-transparent + mix-blend-multiply na img) */}
            <div className="absolute top-3.5 left-5 z-10 flex items-center bg-transparent pointer-events-none">
              {loadingConfig ? (
                <div className="w-28 h-10 bg-slate-100/50 animate-pulse rounded" />
              ) : logoBase64 ? (
                <img 
                  src={logoBase64} 
                  alt="Logo da Empresa" 
                  className="h-13 w-auto object-contain mix-blend-multiply bg-transparent" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <div className="flex items-center gap-2 bg-transparent">
                  <svg className="w-10 h-10 text-[#C5A059] bg-transparent" viewBox="0 0 100 100" fill="none">
                    <path d="M 50 18 C 38 8 20 12 16 26 C 10 44 28 58 50 76 C 72 58 90 44 84 26 C 80 12 62 8 50 18 Z" fill="#C5A059" />
                    <path d="M 50 30 C 42 22 32 24 29 31 C 24 40 36 49 50 60 C 64 49 76 40 71 31 C 68 24 58 22 50 30 Z" fill="#1a3c2e" />
                  </svg>
                  <div className="flex flex-col text-left bg-transparent">
                    <span className="text-lg font-extrabold text-[#1a3c2e] leading-none tracking-tight">RH</span>
                    <span className="text-[9px] font-bold text-[#1a3c2e] tracking-wider uppercase mt-0.5">Gestão Domiciliar</span>
                  </div>
                </div>
              )}
            </div>

            {/* Layout Central: Foto Centralizada com Moldura Dourada Fina e Dados Dinâmicos - Alinhamento Óptico Perfeito entre os Arcos */}
            <div className="z-10 flex flex-col items-center justify-center my-auto w-full pt-3 pb-1">
              {/* Foto do Profissional com Moldura Dourada Fina e Cantos Arredondados */}
              <div className="w-28 h-36 border-[2.5px] border-[#C5A059] rounded-2xl overflow-hidden bg-slate-50 shadow-md flex items-center justify-center shrink-0">
                {fotoBase64 || profData?.foto ? (
                  <img 
                    src={fotoBase64 || profData.foto} 
                    alt={profData?.nome || 'Foto do Profissional'} 
                    className="w-full h-full object-cover rounded-[13px]" 
                    crossOrigin="anonymous" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-2 text-center">
                    <svg className="w-10 h-10 text-[#C5A059]/60 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Sem Foto</span>
                  </div>
                )}
              </div>

              {/* Informações Organizadas do Profissional (Abaixo da Foto - Flutuando perfeitamente no centro) */}
              <div className="mt-2.5 text-center space-y-0.5">
                <div className="text-sm md:text-base text-slate-800 leading-tight">
                  <span className="font-normal text-slate-700">Nome: </span>
                  <span className="font-bold text-slate-900">{profData?.nome || "Profissional não identificado"}</span>
                </div>
                <div className="text-xs md:text-sm text-slate-800 leading-tight">
                  <span className="font-normal text-slate-700">CPF: </span>
                  <span className="font-semibold text-slate-800">{profData?.cpf || "000.000.000-00"}</span>
                </div>
                <div className="text-xs md:text-sm text-slate-800 leading-tight">
                  <span className="font-normal text-slate-700">Cargo: </span>
                  <span className="font-semibold text-slate-800">
                    {(profData as any)?.cargo || profData?.profissao || profData?.especialidade || "Cuidadora"}
                  </span>
                </div>
              </div>
            </div>

            {/* Integração de Dados Corporativos (Canto Inferior Direito) */}
            <div className="absolute bottom-4 right-5 z-10 text-right text-xs leading-tight font-sans">
              <div className="font-bold text-slate-900">{config.razaoSocial || "RH Gestão Domiciliar"}</div>
              <div className="text-[11px] text-slate-800 font-semibold">{config.cnpj ? `CNPJ: ${config.cnpj}` : "CNPJ: 68.152.234/0001-98"}</div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const filteredAndSortedProfissionais = useMemo(() => {
    const query = normalizeText(searchTerm).trim();
    const cleanQuery = query.replace(/\D/g, '');

    return (profissionais || [])
      .filter(prof => {
        // filter by selected dropdown
        if (selectedProfId && prof.id !== selectedProfId) {
          return false;
        }

        const cleanCpf = (prof.cpf || '').replace(/\D/g, '');
        const cleanPhone = (prof.telefone || '').replace(/\D/g, '');

        const matchSearch = !query ||
          normalizeText(prof.nome).includes(query) ||
          normalizeText(prof.cpf).includes(query) ||
          normalizeText(prof.telefone).includes(query) ||
          normalizeText(prof.especialidade).includes(query) ||
          (cleanQuery && cleanCpf.includes(cleanQuery)) ||
          (cleanQuery && cleanPhone.includes(cleanQuery));

        return matchSearch;
      })
      .sort((a, b) => {
        const statusA = a.status === 'Ativo' ? 0 : 1;
        const statusB = b.status === 'Ativo' ? 0 : 1;
        if (statusA !== statusB) {
          return statusA - statusB;
        }
        const nameA = (a.nome || '').toLowerCase();
        const nameB = (b.nome || '').toLowerCase();
        return nameA.localeCompare(nameB, 'pt-BR');
      });
  }, [profissionais, selectedProfId, searchTerm]);

  return (
    <div className="space-y-5">
      {/* Search and filter block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm print:hidden">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Universal Search Field */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 bg-slate-50 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
            />
          </div>

          {/* Status/Professional Selector dropdown */}
          <div className="relative max-w-xs w-full">
            <select
              value={selectedProfId}
              onChange={e => setSelectedProfId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner cursor-pointer"
            >
              <option value="">Todos os profissionais (Ativos e Inativos)</option>
              {(profissionais || []).sort((a, b) => {
                const statusA = a.status === 'Ativo' ? 0 : 1;
                const statusB = b.status === 'Ativo' ? 0 : 1;
                if (statusA !== statusB) {
                  return statusA - statusB;
                }
                const nameA = (a.nome || '').toLowerCase();
                const nameB = (b.nome || '').toLowerCase();
                return nameA.localeCompare(nameB, 'pt-BR');
              }).map(prof => (
                <option key={prof.id} value={prof.id}>
                  {prof.nome} - {prof.cpf || 'Sem CPF'} {prof.status === 'Inativo' ? '(Inativo)' : ''}
                </option>
              ))}
            </select>
          </div>

          {(selectedProfId || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedProfId('');
              }}
              className="text-xs text-slate-400 hover:text-emerald-600 underline font-semibold cursor-pointer"
            >
              Resetar Filtros
            </button>
          )}
        </div>

        {/* Right side primary action */}
        <div className="flex items-center gap-2">
          <GlossyButton
            onClick={() => handleOpenModal()}
            variant="green"
          >
            <Plus size={14} />
            <span>Novo Profissional</span>
          </GlossyButton>

          <GlossyButton
            onClick={() => setIsRelatorioCuringasOpen(true)}
            variant="red"
          >
            <UserX size={14} />
            <span>Relatório de Curingas</span>
          </GlossyButton>
        </div>
      </div>

      {/* Unified Cards list for all screen sizes */}
      <div className="space-y-3 print:hidden" id="professionals-cards-container">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <CardSkeleton key={`prof-skeleton-${i}`} />
          ))
        ) : filteredAndSortedProfissionais.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-sm">
            <div className="flex flex-col items-center justify-center space-y-2">
              <AlertCircle size={28} className="text-slate-300 animate-bounce" />
              <p className="font-medium text-slate-500">Nenhum profissional localizado</p>
              <p className="text-xs text-slate-400">Tente buscar por outro termo ou desmarque os filtros.</p>
            </div>
          </div>
        ) : (
          filteredAndSortedProfissionais.map((prof, index) => {
            const cleanPhone = (prof.telefone || '').trim();

            return (
              <div
                key={`prof-card-${prof.id || index}`}
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm hover:border-gray-200 transition-all animate-in fade-in-50"
              >
                {/* Left Section: Info */}
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Name & Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNavigateToProfile(prof.id)}
                      className="font-bold text-slate-800 text-base hover:text-emerald-600 transition-colors cursor-pointer text-left focus:outline-none"
                    >
                      {prof.nome}
                    </button>
                    <SoftBadge variant={prof.status === 'Ativo' ? 'green' : 'red'}>
                      {prof.status || 'Inativo'}
                    </SoftBadge>
                  </div>

                  {/* Subinfo Row: Phone and Specialty horizontally aligned */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 font-medium">
                    {prof.especialidade ? (
                      <span className="flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-150 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        {prof.especialidade}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-semibold italic">
                        Geral
                      </span>
                    )}
                    {cleanPhone && (
                      <span className="flex items-center gap-1 bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                        <strong>Telefone:</strong> {cleanPhone}
                      </span>
                    )}
                    {prof.cpf && (
                      <span className="text-slate-500 font-mono">
                        <strong>CPF:</strong> {prof.cpf}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Section: Ghost Circular button with Pencil/Edit icon */}
                <div className="flex items-center justify-end flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(prof, 'dados')}
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all cursor-pointer border border-transparent hover:border-emerald-100 flex items-center justify-center"
                    title="Editar Profissional"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-xs print:bg-white print:p-0 print:items-start">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              if (activeTab === 'dados') {
                handleSave(e);
              }
            }} 
            className="bg-white p-6 rounded-2xl w-full max-w-3xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 print:shadow-none print:border-none print:max-h-full print:overflow-visible"
          >
             <div className="flex justify-between items-center pb-2 border-b border-slate-100 print:hidden">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-extrabold text-[#1a3c2e] text-base sm:text-lg">
                  {editingProf ? 'Cadastro do Profissional' : 'Novo Cadastro de Profissional'}
                </h3>
              </div>
              <div className="flex items-center gap-4">
                 {editingProf && userRole === 'Administrador' && (
                   <div className="flex items-center gap-2">
                     <button
                       type="button"
                       onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'Ativo' ? 'Inativo' : 'Ativo' }))}
                       className={`w-12 h-6 rounded-full transition-colors ${formData.status === 'Ativo' ? 'bg-[#1a3c2e]' : 'bg-[#d1d1d1]'}`}
                     >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.status === 'Ativo' ? 'translate-x-7' : 'translate-x-1'}`} />
                     </button>
                     <span className={`text-xs font-bold ${formData.status === 'Ativo' ? 'text-[#1a3c2e]' : 'text-[#d1d1d1]'}`}>Status: {formData.status}</span>
                   </div>
                 )}
                 <button type="button" onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-50 transition-colors">
                    <X size={18} />
                 </button>
              </div>
            </div>
            
            <nav className="border-b border-gray-200 flex overflow-x-auto whitespace-nowrap gap-6 pb-0 w-full no-scrollbar md:flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('dados')}
                className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                  activeTab === 'dados'
                    ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
                }`}
              >
                Dados Pessoais
              </button>
              {editingProf && (
                <>
                  <button
                    type="button"
                    onClick={() => setActiveTab('agenda')}
                    className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === 'agenda'
                        ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
                    }`}
                  >
                    <CalendarDays size={13} /> <span>Agenda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('cracha')}
                    className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === 'cracha'
                        ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
                    }`}
                  >
                    <span>Crachá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('ocorrencias')}
                    className={`shrink-0 flex items-center space-x-1.5 pb-2.5 px-1 text-xs font-semibold whitespace-nowrap transition-all border-b-2 ${
                      activeTab === 'ocorrencias'
                        ? 'border-emerald-500 text-emerald-600 font-bold bg-transparent'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 bg-transparent'
                    }`}
                  >
                    <span>Ocorrências</span>
                  </button>
                </>
              )}
            </nav>

            {(() => {
              switch (activeTab) {
                case 'ocorrencias': return (
                  <div className="space-y-6">
                    {/* Form de Ocorrências */}
                    {exibindoFormOcorrencia ? (
                      <div ref={occurrenceFormRef} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50 space-y-4 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center border-b pb-1">
                          <h4 className="text-xs font-black text-[#1a3c2e] uppercase tracking-wider block">
                            {editingOcorrenciaId ? 'Editar Ocorrência' : 'Registrar Nova Ocorrência'}
                          </h4>
                          <button 
                            type="button" 
                            onClick={handleCloseFormOcorrencia} 
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Fechar Formulário"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#1a3c2e] uppercase block">Data</label>
                            <input
                              type="date"
                              value={ocData}
                              onChange={(e) => setOcData(e.target.value)}
                              className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-white focus:ring-1 focus:ring-[#1a3c2e]"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-[#1a3c2e] uppercase block">Paciente</label>
                            <select
                              value={ocPacienteId}
                              onChange={(e) => setOcPacienteId(e.target.value)}
                              className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-white focus:ring-1 focus:ring-[#1a3c2e]"
                            >
                              <option value="">Nenhum (Ocorrência Administrativa / Geral)</option>
                              {[...pacientes].sort((a, b) => a.nome.localeCompare(b.nome)).map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.nome} {p.status ? `(${p.status})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-[#1a3c2e] uppercase block">Descrição do Motivo</label>
                            <textarea
                              rows={3}
                              value={ocDescricao}
                              onChange={(e) => setOcDescricao(e.target.value)}
                              className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-white focus:ring-1 focus:ring-[#1a3c2e]"
                              required
                            />
                          </div>
                        </div>

                        {/* Checkbox de Bloqueio */}
                        {ocPacienteId && (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              id="ocBloquear"
                              checked={ocBloquear}
                              onChange={(e) => setOcBloquear(e.target.checked)}
                              className="w-4 h-4 text-[#1a3c2e] border-slate-300 rounded focus:ring-[#1a3c2e] cursor-pointer"
                            />
                            <label htmlFor="ocBloquear" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                              Bloquear na escala deste paciente
                            </label>
                          </div>
                        )}

                        {/* Botões do Form de Ocorrência */}
                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                          <GlossyButton
                            type="button"
                            onClick={handleCloseFormOcorrencia}
                            variant="gray"
                          >
                            Cancelar
                          </GlossyButton>
                          <GlossyButton
                            type="button"
                            onClick={handleSaveOcorrencia}
                            disabled={savingOcorrencia}
                            variant="green"
                          >
                            {savingOcorrencia ? 'Salvando...' : 'Salvar Ocorrência'}
                          </GlossyButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <GlossyButton
                          type="button"
                          onClick={() => setExibindoFormOcorrencia(true)}
                          variant="blue"
                        >
                          <span>+ Registrar Ocorrência</span>
                        </GlossyButton>
                      </div>
                    )}

                    {/* Bento Grid Dashboard de Ocorrências Mensais */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-orange-700 uppercase tracking-widest block">Faltas neste mês</span>
                          <span className="text-3xl font-black text-orange-900 block leading-none">{totalFaltasMes}</span>
                        </div>
                        <div className="p-3 bg-white/60 rounded-lg text-orange-700 border border-orange-200">
                          <AlertCircle className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-rose-700 uppercase tracking-widest block">Débitos neste mês</span>
                          <span className="text-3xl font-black text-rose-900 block leading-none">
                            {totalDebitosMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div className="p-3 bg-white/60 rounded-lg text-rose-700 border border-rose-200">
                          <CalendarDays className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    {/* Barra de Ferramentas - Busca e Filtro */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          id="input-busca-ocorrencia"
                          value={termoBusca}
                          onChange={(e) => setTermoBusca(e.target.value)}
                          className="w-full pl-9 pr-3 py-1.5 text-xs text-slate-705 placeholder-slate-400 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1a3c2e] focus:border-[#1a3c2e] rounded-lg transition"
                        />
                        {termoBusca && (
                          <button
                            type="button"
                            onClick={() => setTermoBusca('')}
                            className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      
                      <div className="w-full sm:w-48 flex items-center gap-2">
                        <label htmlFor="select-mes-filtro" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          Mês:
                        </label>
                        <select
                          id="select-mes-filtro"
                          value={mesFiltro}
                          onChange={(e) => setMesFiltro(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs text-slate-705 bg-white border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#1a3c2e] focus:border-[#1a3c2e] rounded-lg cursor-pointer transition font-medium"
                        >
                          <option value="Todos">Todos os Meses</option>
                          {mesesDisponiveis.map(m => (
                            <option key={`opt-mes-${m}`} value={m}>
                              {formatarMes(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Histórico de Ocorrências */}
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-1">
                        <h4 className="text-xs font-black text-[#1a3c2e] uppercase tracking-wider block">
                          Histórico de Ocorrências ({ocorrenciasFiltradas.length})
                        </h4>
                        <div className="flex flex-wrap items-center gap-2">
                          {(termoBusca || mesFiltro !== 'Todos') && (
                            <button
                              type="button"
                              onClick={() => {
                                setTermoBusca('');
                                setMesFiltro('Todos');
                              }}
                              className="text-[10px] font-extrabold text-red-600 hover:text-red-800 uppercase tracking-widest cursor-pointer transition-colors mr-2 hover:underline"
                            >
                              Limpar Filtros
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleBaixarOcorrenciasExcel}
                            className="flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-bold bg-[#1a3c2e] hover:bg-[#25523f] text-white rounded-lg transition"
                          >
                            <Receipt size={12} />
                            <span>Excel (.xlsx)</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleBaixarOcorrenciasWord}
                            className="flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                          >
                            <Printer size={12} />
                            <span>Word (.docx)</span>
                          </button>
                        </div>
                      </div>
                      {ocorrencias.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center p-4 bg-slate-50 rounded-lg">
                          Nenhuma ocorrência registrada para este profissional.
                        </p>
                      ) : ocorrenciasFiltradas.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center p-4 bg-slate-50 rounded-lg">
                          Nenhuma ocorrência atende aos filtros de busca selecionados.
                        </p>
                      ) : (
                        <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-150 text-[#1a3c2e] font-black uppercase tracking-wider text-[10px]">
                                <th className="p-3">Data</th>
                                <th className="p-3">Paciente</th>
                                <th className="p-3">Status / Bloqueio</th>
                                <th className="p-3">Descrição do Motivo</th>
                                <th className="p-3 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ocorrenciasFiltradas.map((oc, index) => (
                                <tr key={`oc-${oc.id || index}-${index}`} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                    {oc.data.split('-').reverse().join('/')}
                                  </td>
                                  <td className="p-3 font-bold text-slate-800">{oc.pacienteNome || oc.paciente || 'Não Informado'}</td>
                                  <td className="p-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {oc.bloquearEscala ? (
                                        <span className="inline-block bg-red-100 text-red-750 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-red-200 uppercase tracking-wide">
                                          BLOQUEADO
                                        </span>
                                      ) : (
                                        <span className="inline-block bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 uppercase tracking-wide">
                                          Sem Bloqueio
                                        </span>
                                      )}
                                      {oc.tipo === 'automatica' && (
                                        <span className="inline-block bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-sky-200 uppercase tracking-wide">
                                          Sistema / Falta
                                        </span>
                                      )}
                                      {oc.tipo === 'automatica_debito' && (
                                        <span className="inline-block bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black border border-rose-200 uppercase tracking-wide">
                                          Sistema / Débito
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-slate-600 break-words max-w-[200px]">{oc.descricao}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleEditOcorrenciaClick(oc)}
                                        title="Editar Ocorrência"
                                        className="p-1.5 text-blue-600 hover:text-white hover:bg-blue-600 rounded-lg border border-blue-200 hover:border-blue-600 transition-all cursor-pointer"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteOcorrencia(oc)}
                                        title="Excluir Ocorrência"
                                        className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg border border-red-200 hover:border-red-600 transition-all cursor-pointer"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Dialog de confirmação de exclusão para ocorrência */}
                    {deleteConfirmOc && (
                      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in-30">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4 font-sans">
                          <div className="flex items-start space-x-3 text-red-600">
                            <AlertCircle size={24} className="mt-0.5 flex-shrink-0 text-red-600" />
                            <div>
                              <h3 className="font-bold text-sm text-slate-800">Confirmar Exclusão</h3>
                              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                Tem certeza que deseja excluir permanentemente a ocorrência de data {deleteConfirmOc.data.split('-').reverse().join('/')} relacionada ao paciente <strong>{deleteConfirmOc.pacienteNome}</strong>? Esta ação não pode ser desfeita.
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
                  </div>
                );
                case 'cracha': return <BadgeGerador profData={formData as any} />;
                case 'agenda': {
                  if (plantaoSelecionado) {
                    const patientObj = pacientes.find(p => p.id === plantaoSelecionado.idPaciente);
                    const patientName = patientObj ? patientObj.nome : 'Paciente Desconhecido';
                    const patientAddress = patientObj && patientObj.endereco
                      ? `${patientObj.endereco.rua || ''}, ${patientObj.endereco.numero || ''} - ${patientObj.bairro || patientObj.endereco.bairro || ''}, ${patientObj.endereco.cidade || ''}`
                      : patientObj?.bairro || '';
                    
                    const valorBase = Number(plantaoSelecionado.valorPlantao) || 0;
                    const ajudaCusto = Number(plantaoSelecionado.ajudaCusto || (plantaoSelecionado as any).ajudaDeCusto) || 0;
                    const valorRepasseTotal = valorBase + ajudaCusto;
                    
                    return (
                      <div className="space-y-4 p-4 border border-[#b8860b]/20 bg-[#fcf8f2] rounded-xl animate-in fade-in duration-200">
                        <div className="flex justify-between items-center border-b border-[#b8860b]/10 pb-2">
                          <h4 className="text-xs font-black text-[#1a3c2e] uppercase tracking-wider">
                            Detalhes do Plantão
                          </h4>
                          <button
                            type="button"
                            onClick={() => setPlantaoSelecionado(null)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200/50 transition-colors cursor-pointer flex items-center justify-center"
                            title="Fechar Detalhes"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Paciente</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between gap-1.5">
                              <span>{patientName}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(patientName)}
                                className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Copiar Paciente"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>

                          {patientAddress && (
                            <div className="space-y-1 sm:col-span-2">
                              <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Endereço de Atendimento</span>
                              <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between gap-1.5">
                                <span className="text-xs font-normal text-slate-650">{patientAddress}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyToClipboard(patientAddress)}
                                  className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer flex-shrink-0"
                                  title="Copiar Endereço"
                                >
                                  <Copy size={13} />
                                </button>
                              </div>
                            </div>
                          )}
                          
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Data do Plantão</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between gap-1.5">
                              <span>{plantaoSelecionado.data ? plantaoSelecionado.data.split('-').reverse().join('/') : '--/--/----'}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(plantaoSelecionado.data ? plantaoSelecionado.data.split('-').reverse().join('/') : '')}
                                className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Copiar Data"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Horário</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150 flex items-center justify-between gap-1.5">
                              <span>{plantaoSelecionado.horario || 'Não definido'}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyToClipboard(plantaoSelecionado.horario || '')}
                                className="text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                                title="Copiar Horário"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Status</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150 flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${
                                plantaoSelecionado.status === 'Confirmado' ? 'bg-emerald-500' :
                                plantaoSelecionado.status === 'Concluido' ? 'bg-blue-500' :
                                plantaoSelecionado.status === 'Cancelado' ? 'bg-rose-500' : 'bg-amber-500'
                              }`} />
                              {plantaoSelecionado.status}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Valor do Plantão</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150">
                              R$ {valorBase.toFixed(2).replace('.', ',')}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Ajuda de Custo</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150">
                              R$ {ajudaCusto.toFixed(2).replace('.', ',')}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Valor de Repasse</span>
                            <div className="font-bold text-[#1a3c2e] p-2.5 bg-white rounded-lg border border-slate-150">
                              R$ {valorRepasseTotal.toFixed(2).replace('.', ',')}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">Tipo de Dia</span>
                            <div className="font-bold text-slate-800 p-2.5 bg-white rounded-lg border border-slate-150">
                              {plantaoSelecionado.tipoDia || 'Normal'}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end pt-3 border-t border-slate-150/50 mt-4">
                          <button
                            type="button"
                            onClick={() => setPlantaoSelecionado(null)}
                            className="px-5 py-1.5 bg-[#1a3c2e] text-[#b8860b] hover:opacity-90 font-bold text-xs rounded-lg transition-opacity cursor-pointer"
                          >
                            Fechar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-[#1a3c2e] uppercase tracking-wider">
                          Plantões do Profissional ({agendamentosProf.length})
                        </h4>
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                          Escala Geral
                        </span>
                      </div>

                      {loadingAgenda ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-2">
                          <span className="animate-spin text-xl text-[#1a3c2e]">⏳</span>
                          <p className="text-xs text-slate-500 font-semibold animate-pulse">Carregando agenda...</p>
                        </div>
                      ) : agendamentosProf.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <Calendar className="text-slate-300 mb-2" size={24} />
                          <p className="text-slate-500 text-xs text-center py-1 font-medium">
                            Nenhum plantão agendado para este profissional.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {agendamentosProf.map((ag) => {
                            const patientObj = pacientes.find(p => p.id === ag.idPaciente);
                            const patientName = patientObj ? patientObj.nome : 'Paciente Desconhecido';
                            
                            // Formatar data em bloco "Dia / Mês"
                            let day = "--";
                            let month = "---";
                            if (ag.data) {
                              const [ano, mesStr, diaStr] = ag.data.split('-');
                              if (diaStr && mesStr) {
                                day = diaStr;
                                const mesesShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                                const mesIndex = parseInt(mesStr, 10) - 1;
                                if (mesIndex >= 0 && mesIndex < 12) {
                                  month = mesesShort[mesIndex];
                                }
                              }
                            }

                            // Status Color Styling
                            let statusBg = "bg-slate-100 text-slate-600 border-slate-200";
                            if (ag.status === 'Confirmado') {
                              statusBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
                            } else if (ag.status === 'Concluido') {
                              statusBg = "bg-blue-50 text-blue-700 border-blue-100";
                            } else if (ag.status === 'Cancelado') {
                              statusBg = "bg-rose-50 text-rose-700 border-rose-100";
                            } else if (ag.status === 'Aberta') {
                              statusBg = "bg-amber-50 text-amber-700 border-amber-100";
                            }

                            return (
                              <div 
                                key={ag.id} 
                                onClick={() => setPlantaoSelecionado(ag)}
                                className="bg-white border border-slate-100 rounded-xl p-3 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex items-start gap-3 relative overflow-hidden cursor-pointer"
                                title="Ver Detalhes do Plantão"
                              >
                                {/* Calendário Bento Left */}
                                <div className="flex-shrink-0 w-11 h-11 bg-slate-50 rounded-lg border border-slate-100 flex flex-col items-center justify-center p-1">
                                  <span className="text-xs font-black text-slate-700 leading-none">{day}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{month}</span>
                                </div>

                                {/* Conteúdo Meio */}
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                      <Clock size={11} /> {ag.horario || 'Horário não definido'}
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${statusBg}`}>
                                      {ag.status}
                                    </span>
                                  </div>

                                  <h5 className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5 pt-0.5">
                                    <User size={12} className="text-slate-400 flex-shrink-0" />
                                    <span className="truncate">{patientName}</span>
                                  </h5>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                                    <span>Repasse: <strong className="font-semibold text-slate-700">R$ {ag.valorRepasse?.toFixed(2) || '0.00'}</strong></span>
                                    {ag.tipoDia && ag.tipoDia !== 'Normal' && (
                                      <span className="text-[9px] bg-amber-50 text-amber-800 px-1 py-0.2 rounded font-bold">{ag.tipoDia}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                default: return (
                  <div className="space-y-6">
                    {/* Bloco 1: Dados Pessoais */}
                    <CardBase className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-3 flex justify-center mb-2">
                        <label className={`relative cursor-pointer group ${uploading ? 'pointer-events-none opacity-80' : ''}`}>
                          <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" disabled={uploading} />
                          <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-200 flex flex-col items-center justify-center overflow-hidden bg-white hover:border-[#1a3c2e] hover:bg-gray-50 transition-all shadow-inner">
                            {uploading ? (
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <span className="animate-spin text-[#1a3c2e] text-sm">⏳</span>
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Subindo...</span>
                              </div>
                            ) : formData.foto ? (
                              <div className="relative w-full h-full group">
                                <img src={formData.foto} alt="Foto" className="w-full h-full object-cover"/>
                                <div className="absolute inset-0 bg-[#1a3c2e]/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-bold uppercase transition-all">
                                  Alterar
                                </div>
                              </div>
                            ) : (
                              <span className="text-[10px] font-semibold text-gray-450 uppercase tracking-widest text-gray-400">Add Foto</span>
                            )}
                          </div>
                        </label>
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                        <input type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" required />
                      </div>
                      
                      <div className={`space-y-1 ${formData.meiIrregular ? 'opacity-60' : ''}`}>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Tem MEI?</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={formData.meiIrregular}
                            onClick={() => setFormData({...formData, temMei: true})}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${formData.temMei ? 'bg-[#1a3c2e] text-[#b8860b] shadow-xs' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${formData.meiIrregular ? 'cursor-not-allowed' : ''}`}
                          >
                            SIM
                          </button>
                          <button
                            type="button"
                            disabled={formData.meiIrregular}
                            onClick={() => setFormData({...formData, temMei: false, cnpj: ''})}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${!formData.temMei ? 'bg-red-50 text-red-700 shadow-xs border border-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${formData.meiIrregular ? 'cursor-not-allowed' : ''}`}
                          >
                            NÃO
                          </button>
                        </div>
                      </div>
                      
                      {formData.temMei && (
                        <div className="space-y-1 md:col-span-1">
                           <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider text-emerald-800">CNPJ</label>
                           <input 
                             type="text" 
                             value={formData.cnpj} 
                             onChange={e => setFormData({...formData, cnpj: mascaraCNPJ(e.target.value)})} 
                             maxLength={18} 
                             disabled={formData.meiIrregular}
                             className={`p-2 border border-emerald-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-emerald-700 bg-emerald-50/50 text-emerald-900 ${formData.meiIrregular ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-500' : ''}`} 
                             required={formData.temMei} 
                           />
                        </div>
                      )}

                      {/* Status de Regularidade Fiscal MEI (Apenas Administrador pode alterar) */}
                      {formData.temMei && (
                        <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-3.5 space-y-2 mt-1" id="mei-status-container">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📋</span>
                              <div>
                                <h4 className="text-xs font-bold text-amber-900">Status na Receita Federal</h4>
                                <p className="text-[10px] text-amber-700">Controle de regularidade fiscal do profissional MEI.</p>
                              </div>
                            </div>
                            
                            {userRole === 'Administrador' ? (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={formData.meiIrregular} 
                                  onChange={(e) => setFormData({...formData, meiIrregular: e.target.checked})}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                <span className="ml-2 text-xs font-bold text-slate-700">
                                  {formData.meiIrregular ? 'Irregular (Suspenso)' : 'Regular'}
                                </span>
                              </label>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${formData.meiIrregular ? 'bg-amber-200 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {formData.meiIrregular ? 'Irregular (Suspenso)' : 'Regular'}
                                </span>
                              </div>
                            )}
                          </div>

                          {formData.meiIrregular && (
                            <div className="flex items-start gap-2 bg-amber-100/75 border border-amber-300/50 rounded-lg p-2.5 text-amber-900">
                              <span className="text-sm">⚠️</span>
                              <div className="text-[11px] leading-relaxed">
                                <p className="font-bold">Atenção: CNPJ Temporariamente Inválido/Suspenso.</p>
                                <p>Os dados do MEI foram preservados, mas este profissional será tratado como <strong className="font-black">Sem MEI</strong> no faturamento e emissão de folhas até a regularização.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sexo</label>
                        <select value={formData.sexo} onChange={e => setFormData({...formData, sexo: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white font-sans text-gray-800">
                          <option value="">Selecione...</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Feminino">Feminino</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Data de Nascimento</label>
                        <input 
                          type="text" 
                          maxLength={10} 
                          value={formData.dataNascimento} 
                          onChange={handleDateChange} 
                          className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" 
                        />
                      </div>
                      <div className="space-y-1">
                         <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Idade</label>
                         <input type="text" value={formData.idade || ''} disabled className="p-2 border border-gray-100 rounded-lg text-xs w-full bg-gray-50 text-gray-400 font-medium" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPF (Obrigatório)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.cpf}
                            onChange={e => setFormData({...formData, cpf: mascaraCPF(e.target.value)})}
                            maxLength={14}
                            className={`p-2 pr-8 border rounded-lg text-xs w-full focus:outline-none focus:ring-1 transition-all ${
                              isCpfInvalid
                                ? 'border-red-500 text-red-950 focus:ring-red-500 focus:border-red-500 bg-red-50/10'
                                : isCpfValid
                                ? 'border-emerald-500 text-emerald-950 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                                : 'border-gray-200 text-gray-800 focus:ring-[#1a3c2e] focus:border-transparent'
                            }`}
                            required
                          />
                          {formData.cpf && (
                            <button
                              type="button"
                              onClick={() => handleCopyToClipboard(formData.cpf)}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                              title="Copiar CPF"
                            >
                              <Copy size={13} />
                            </button>
                          )}
                        </div>
                        {isCpfInvalid && (
                          <p className="text-[10px] text-red-600 font-semibold flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                            <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                            <span>CPF inválido (dígito verificador incorreto).</span>
                          </p>
                        )}
                        {isCpfValid && (
                          <p className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                            <Check size={12} className="text-emerald-500 flex-shrink-0" strokeWidth={3} />
                            <span>CPF válido!</span>
                          </p>
                        )}
                        {isCpfLoaded && !isCpfFullLength && (
                          <p className="text-[10px] text-amber-600 font-medium flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                            <span className="text-amber-500 text-xs font-bold leading-none flex-shrink-0">⚠️</span>
                            <span>Insira os 11 dígitos do CPF</span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Profissão (Obrigatório)</label>
                        <input type="text" value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800 mb-1" required />
                        {!showConselhoField && (
                          <div className="pt-0.5 pb-1">
                            <button
                              type="button"
                              onClick={() => setShowConselhoField(true)}
                              className="text-[11px] font-semibold text-[#1a3c2e] hover:text-[#C09A6D] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>+ Conselho / Registro</span>
                            </button>
                          </div>
                        )}
                      </div>
                      {showConselhoField && (
                        <div className="space-y-1 animate-in fade-in duration-200">
                          <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conselho Profissional</label>
                            <button
                              type="button"
                              onClick={() => {
                                setShowConselhoField(false);
                                setFormData(prev => ({ ...prev, conselho: '' }));
                              }}
                              className="text-[10px] font-bold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>Remover</span>
                            </button>
                          </div>
                          <input type="text" value={formData.conselho} onChange={e => setFormData({...formData, conselho: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone (Obrigatório)</label>
                        <input type="tel" value={formData.telefone} onChange={e => setFormData({...formData, telefone: mascaraTelefone(e.target.value)})} maxLength={15} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" required />
                      </div>
                    </CardBase>

                    {/* Bloco 2: Endereço */}
                    <CardBase className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <span className="md:col-span-4 font-bold text-xs text-[#1a3c2e] uppercase border-b border-gray-50 pb-2 mb-1">Endereço</span>
                       <input type="text" value={formData.endereco.cep} onChange={e => handleCepChange(e.target.value)} maxLength={9} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" value={formData.endereco.rua} onChange={e => setFormData({...formData, endereco: {...formData.endereco, rua: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs md:col-span-2 text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" value={formData.endereco.numero} onChange={e => setFormData({...formData, endereco: {...formData.endereco, numero: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" value={formData.endereco.bairro} onChange={e => setFormData({...formData, endereco: {...formData.endereco, bairro: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" value={formData.endereco.cidade} onChange={e => setFormData({...formData, endereco: {...formData.endereco, cidade: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" value={formData.endereco.estado} onChange={e => setFormData({...formData, endereco: {...formData.endereco, estado: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                    </CardBase>

                    {/* Bloco 3: Financeiro */}
                    <CardBase className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <div className="md:col-span-4 flex items-center justify-between border-b border-gray-50 pb-2 mb-1">
                          <span className="font-bold text-xs text-[#1a3c2e] uppercase">Financeiro</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 normal-case">Titular da Conta?</span>
                            <select
                              value={isTitularConta}
                              onChange={(e) => setIsTitularConta(e.target.value)}
                              className="p-1 px-2 border border-gray-200 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1a3c2e] cursor-pointer"
                            >
                              <option value="Sim">Sim</option>
                              <option value="Não">Não</option>
                            </select>
                          </div>
                       </div>

                       {isTitularConta === 'Não' && (
                          <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-dashed border-gray-100 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome do Titular da Conta</label>
                              <input
                                type="text"
                                value={formData.nomeTitularConta || ''}
                                onChange={e => setFormData({ ...formData, nomeTitularConta: e.target.value })}
                                className="p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800"
                                required={isTitularConta === 'Não'}
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPF do Titular</label>
                              <input
                                type="text"
                                value={formData.cpfTitularConta || ''}
                                onChange={e => setFormData({ ...formData, cpfTitularConta: mascaraCPF(e.target.value) })}
                                maxLength={14}
                                className={`p-2 border rounded-lg text-xs bg-white transition-all ${
                                  isCpfTitularInvalid
                                    ? 'border-red-500 text-red-955 focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-red-50/10'
                                    : isCpfTitularValid
                                    ? 'border-emerald-500 text-emerald-950 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-emerald-50/10'
                                    : 'border-gray-200 text-gray-800 focus:ring-1 focus:ring-[#1a3c2e]'
                                }`}
                                required={isTitularConta === 'Não'}
                              />
                              {isCpfTitularInvalid && (
                                <p className="text-[10px] text-red-600 font-semibold flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                                  <AlertCircle size={12} className="text-red-500 flex-shrink-0" />
                                  <span>CPF do titular inválido.</span>
                                </p>
                              )}
                              {isCpfTitularValid && (
                                <p className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                                  <Check size={12} className="text-emerald-500 flex-shrink-0" strokeWidth={3} />
                                  <span>CPF do titular válido!</span>
                                </p>
                              )}
                              {isCpfTitularLoaded && !isCpfTitularFullLength && (
                                <p className="text-[10px] text-amber-600 font-medium flex items-center space-x-1 mt-0.5 animate-in fade-in duration-200">
                                  <span className="text-amber-500 text-xs font-bold leading-none flex-shrink-0">⚠️</span>
                                  <span>Insira os 11 dígitos do CPF</span>
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Grau de Parentesco</label>
                              <select
                                value={formData.grauParentescoTitular || ''}
                                onChange={e => setFormData({ ...formData, grauParentescoTitular: e.target.value })}
                                className="p-2 border border-gray-200 rounded-lg text-xs bg-white text-gray-800 cursor-pointer"
                                required={isTitularConta === 'Não'}
                              >
                                <option value="">Selecione...</option>
                                <option value="Cônjuge">Cônjuge</option>
                                <option value="Filho(a)">Filho(a)</option>
                                <option value="Pai/Mãe">Pai/Mãe</option>
                                <option value="Outro">Outro</option>
                              </select>
                            </div>
                          </div>
                       )}
                        <div className="relative flex flex-col gap-1 w-full" id="bank-selector-container">
                          <div className="relative">
                            <input
                              type="text"
                              value={isBankDropdownOpen ? bankSearch : (formData.dadosBancarios.banco || '')}
                              onFocus={() => {
                                setBankSearch('');
                                setIsBankDropdownOpen(true);
                              }}
                              onBlur={() => {
                                // Delay to allow selection before closing
                                setTimeout(() => setIsBankDropdownOpen(false), 200);
                              }}
                              onChange={(e) => {
                                setBankSearch(e.target.value);
                                setIsBankDropdownOpen(true);
                              }}
                              className="w-full p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e] bg-white cursor-pointer font-sans"
                            />
                            <div className="absolute right-2 top-2.5 pointer-events-none text-gray-400">
                              <Search size={14} />
                            </div>
                          </div>

                          {isBankDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl z-50 divide-y divide-slate-100">
                              <button
                                type="button"
                                onMouseDown={() => {
                                  setFormData({
                                    ...formData,
                                    dadosBancarios: {
                                      ...formData.dadosBancarios,
                                      banco: ''
                                    }
                                  });
                                  setBankSearch('');
                                  setIsBankDropdownOpen(false);
                                }}
                                className="w-full text-left p-2 hover:bg-slate-50 transition-colors text-xs font-medium text-gray-400 italic"
                              >
                                Limpar seleção (Sem banco)
                              </button>
                              {(() => {
                                const query = bankSearch.toLowerCase().trim();
                                const filtered = bankList.filter(
                                  b => b.code.toLowerCase().includes(query) || b.name.toLowerCase().includes(query)
                                );

                                if (filtered.length === 0) {
                                  return <div className="p-2 text-xs text-gray-400 text-center">Nenhum banco encontrado</div>;
                                }

                                return filtered.map(b => {
                                  const valueStr = `[${b.code}] - ${b.name}`;
                                  const isSelected = formData.dadosBancarios.banco === valueStr;
                                  return (
                                    <button
                                      key={b.code}
                                      type="button"
                                      onMouseDown={() => {
                                        setFormData({
                                          ...formData,
                                          dadosBancarios: {
                                            ...formData.dadosBancarios,
                                            banco: valueStr
                                          }
                                        });
                                        setBankSearch('');
                                        setIsBankDropdownOpen(false);
                                      }}
                                      className={`w-full text-left p-2 hover:bg-slate-50 transition-colors text-xs font-medium flex items-center justify-between ${
                                        isSelected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                                      }`}
                                    >
                                      <span>[{b.code}] - {b.name}</span>
                                      {isSelected && <Check size={12} className="text-blue-600" />}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}
                        </div>
                        <select
                          id="tipo-conta-select"
                          value={formData.dadosBancarios.tipoConta || ''}
                          onChange={e => setFormData({
                            ...formData,
                            dadosBancarios: {
                              ...formData.dadosBancarios,
                              tipoConta: e.target.value as 'corrente' | 'poupanca' | 'pagamento' | ''
                            }
                          })}
                          className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e] bg-white cursor-pointer font-sans"
                        >
                          <option value="">Tipo de Conta...</option>
                          <option value="corrente">Conta Corrente</option>
                          <option value="poupanca">Conta Poupança</option>
                          <option value="pagamento">Conta de Pagamento</option>
                        </select>
                        {false && <select value={formData.dadosBancarios.banco} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})} id="banco-select" className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e]">
                          <option value="">Selecione um banco...</option>
                          {bankList.map(b => (
                            <option key={b.code} value={`[${b.code}] - ${b.name}`}>[{b.code}] - {b.name}</option>
                          ))}
                        </select>}
                        <input type="text" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e]" />
                        <input type="text" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: maskBankAccount(e.target.value)}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e]" />
                       <div className="relative">
                         <input
                           type="text"
                           value={formData.dadosBancarios.pix}
                           onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})}
                           className="p-2 pr-8 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e] w-full"
                         />
                         {formData.dadosBancarios.pix && (
                           <button
                             type="button"
                             onClick={() => handleCopyToClipboard(formData.dadosBancarios.pix)}
                             className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer"
                             title="Copiar PIX"
                           >
                             <Copy size={13} />
                           </button>
                         )}
                       </div>
                    </CardBase>

                    {/* Bloco 4: Documentos Anexos */}
                    <CardBase className="space-y-3">
                        <span className="font-bold text-xs text-[#1a3c2e] uppercase border-b border-gray-50 pb-2 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" /> Documentos Anexos
                        </span>
                        
                        {!editingProf ? (
                          <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200/50 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>Para anexar documentos, primeiro salve o cadastro básico deste novo profissional no botão "Salvar" abaixo.</span>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Form de Upload */}
                            <div className="p-3 border border-slate-200/60 rounded-xl bg-white space-y-3">
                              <span className="block font-semibold text-xs text-slate-700">Adicionar Novo Documento</span>
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="space-y-1 md:col-span-5">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Documento</label>
                                  <select 
                                    value={tipoDocumentoAnexo} 
                                    onChange={e => setTipoDocumentoAnexo(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-slate-50 focus:ring-1 focus:ring-[#1a3c2e] focus:outline-none"
                                  >
                                    <option value="">Selecione o tipo de documento...</option>
                                    <option value="Identidade">Identidade</option>
                                    <option value="Comprovante de residência">Comprovante de residência</option>
                                    <option value="Vacinas">Vacinas</option>
                                    <option value="Certificado">Certificado</option>
                                    <option value="Formulário">Formulário</option>
                                  </select>
                                </div>
                                
                                <div className="space-y-1 md:col-span-4">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Arquivo</label>
                                  <input 
                                    type="file" 
                                    ref={documentoInputRef}
                                    accept="image/jpeg, image/png, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                    onChange={e => {
                                      const file = e.target.files?.[0] || null;
                                      if (file) {
                                        const allowedTypes = [
                                          'image/jpeg', 
                                          'image/png', 
                                          'application/pdf', 
                                          'application/msword', 
                                          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                        ];
                                        if (!allowedTypes.includes(file.type)) {
                                          toast.error('Formato inválido. Envie apenas JPG, PNG, PDF ou Word (Doc/Docx).');
                                          alert('Formato inválido. Envie apenas JPG, PNG, PDF ou Word (Doc/Docx).');
                                          e.target.value = '';
                                          setArquivoAnexo(null);
                                          return;
                                        }
                                      }
                                      setArquivoAnexo(file);
                                    }}
                                    className="p-1 border border-slate-200 rounded-lg text-xs w-full bg-slate-50 cursor-pointer"
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <GlossyButton
                                    type="button"
                                    onClick={handleUploadAnexo}
                                    disabled={salvandoAnexo}
                                    variant="green"
                                    className="w-full"
                                  >
                                    {salvandoAnexo ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        <span>Carregando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Salvar Anexo</span>
                                      </>
                                    )}
                                  </GlossyButton>
                                </div>
                              </div>
                            </div>

                            {/* Lista de Documentos já gravados */}
                            <div className="space-y-2">
                              <span className="block font-semibold text-xs text-slate-700">Arquivos Salvos ({ (formData.documentosAnexos || []).length })</span>
                              {(!formData.documentosAnexos || formData.documentosAnexos.length === 0) ? (
                                <p className="text-xs text-slate-400 italic p-2">Nenhum documento anexado ainda.</p>
                              ) : (
                                <div className="grid grid-cols-1 gap-2">
                                  {(formData.documentosAnexos || []).map((docItem, idx) => (
                                    <div key={`doc-${docItem.id || idx}-${idx}`} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm text-xs">
                                      <div className="flex items-center gap-2 min-w-0 mr-4">
                                        <div className="p-1.5 bg-slate-100 rounded text-[#1a3c2e]">
                                          <Paperclip className="w-3.5 h-3.5" strokeWidth={2.5} />
                                        </div>
                                        <div className="truncate">
                                          <p className="font-bold text-[#1a3c2e]">{docItem.tipo}</p>
                                          <p className="text-[10px] text-slate-500 truncate">{docItem.nome || docItem.nomeArquivo || 'Anexo'}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {(docItem.url || docItem.arquivo) && (
                                          <button 
                                            type="button" 
                                            onClick={() => setPreviewDoc({
                                              url: docItem.url || docItem.arquivo || '',
                                              tipo: docItem.tipo || 'Documento',
                                              nome: docItem.nome || docItem.nomeArquivo || 'Anexo'
                                            })}
                                            className="px-2.5 py-1 text-[10px] font-bold text-[#b8860b] bg-[#b8860b]/10 rounded hover:bg-[#b8860b]/20 transition-colors cursor-pointer"
                                          >
                                            Visualizar
                                          </button>
                                        )}
                                        <button 
                                          type="button" 
                                          onClick={() => removeDocumentoAnexoRow(docItem.id)} 
                                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Deletar anexo definitivamente"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                    </CardBase>
                  </div>
                );
              }
            })()}

            {activeTab === 'dados' && (
              <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100 mt-2 print:hidden">
                  {editingProf && userRole === 'Administrador' && (
                      <GlossyButton
                          type="button"
                          onClick={() => setDeleteProfConfirmOpen(true)}
                          variant="red"
                      >
                          <Trash2 size={13} />
                          Excluir
                      </GlossyButton>
                  )}
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <GlossyButton
                    type="submit"
                    disabled={loading}
                    variant="green"
                  >
                    <Save size={13} />
                    {loading ? 'Salvando...' : 'Salvar'}
                  </GlossyButton>
              </div>
            )}
          </form>
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-5 right-5 z-[100] bg-[#1a3c2e] text-[#b8860b] border border-[#b8860b]/30 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold">{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="ml-2 text-[#b8860b]/70 hover:text-[#b8860b] text-xs font-bold leading-none">×</button>
        </div>
      )}

      {/* Modal de Visualização de Documentos */}
      {previewDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-[#1a3c2e]/10 text-[#1a3c2e] rounded-lg flex-shrink-0">
                  <Paperclip className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <div className="truncate">
                  <h3 className="font-bold text-sm text-[#1a3c2e]">{previewDoc.tipo}</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[200px] sm:max-w-md">{previewDoc.nome || 'Anexo'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 px-3 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg text-xs transition-all font-bold cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-grow flex items-center justify-center bg-slate-100/50 min-h-[300px]">
              {(() => {
                const isImg = isImageFile(previewDoc.url, previewDoc.nome);
                if (isImg) {
                  return (
                    <div className="relative group max-w-full">
                      <img
                        src={previewDoc.url}
                        alt={previewDoc.nome}
                        referrerPolicy="no-referrer"
                        className="max-h-[55vh] max-w-full object-contain mx-auto rounded-lg shadow-md border border-slate-200 bg-white"
                        onError={(e) => {
                          e.currentTarget.referrerPolicy = "";
                        }}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center p-6 sm:p-8 bg-white rounded-2xl border border-slate-200/50 shadow-sm max-w-md w-full space-y-4">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                        <FileImage className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 text-sm">Visualização de Documento</h4>
                        <p className="text-xs text-slate-500 mt-1">Este arquivo ({previewDoc.nome || 'Anexo'}) não é uma imagem comum ou requer um visualizador externo (ex: PDF grande).</p>
                      </div>
                      
                      <div className="flex flex-col gap-2 pt-2">
                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-[#1a3c2e] hover:bg-[#11291f] text-[#b8860b] py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Abrir em Nova Aba</span>
                        </a>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-0 justify-between items-center bg-slate-50">
              <span className="text-[10px] font-semibold text-slate-400 font-mono truncate max-w-xs">Arquivo em Nuvem de Armazenamento Seguro</span>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-semibold text-[#1a3c2e] hover:bg-slate-200/60 rounded-lg border border-slate-200 transition-all cursor-pointer inline-flex items-center gap-1 w-full sm:w-auto justify-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-5 py-2 text-xs font-bold bg-[#1a3c2e] text-[#b8860b] hover:bg-[#122b21] rounded-lg shadow-sm transition-all cursor-pointer w-full sm:w-auto"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for deleting Professional */}
      {editingProf && (
        <ConfirmModal
          isOpen={deleteProfConfirmOpen}
          onClose={() => setDeleteProfConfirmOpen(false)}
          onConfirm={async () => {
            try {
              await deleteProfissional(editingProf.id);
              setSelectedProfId('');
              handleCloseModal();
              setDeleteProfConfirmOpen(false);
              toast.success("Profissional excluído com sucesso!", {
                icon: '✅',
              });
            } catch (err) {
              console.error(err);
              toast.error("Erro ao excluir profissional.");
            }
          }}
          title="Excluir Profissional"
          description={`Atenção: Você está prestes a excluir permanentemente o cadastro do profissional ${editingProf.nome}. Esta ação não pode ser desfeita e removerá seus registros.`}
          confirmText="Confirmar Exclusão"
        />
      )}

      {/* Relatório de Curingas Modal */}
      <RelatorioCuringasModal
        isOpen={isRelatorioCuringasOpen}
        onClose={() => setIsRelatorioCuringasOpen(false)}
      />
    </div>
  );
};
