import React, { useState, useEffect, useRef, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento, DocumentoAnexo, Ocorrencia } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays, Paperclip, AlertCircle, Printer, Download, FileImage, Search, Clock, User, Calendar, Receipt, Copy, Save } from 'lucide-react';
import { CardBase, DataGrid, DataField, SoftBadge } from '../components/ui/DesignSystem';
import { db, storage } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, updateDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { profissionalSchema } from '../schemas/validationSchemas';
import { mascaraCPF, mascaraCNPJ, mascaraTelefone, mascaraCEP, validarCPF } from '../lib/masks';
import { fetchCep, fetchBanks } from '../lib/brasilApi';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '../components/ConfirmModal';
import { CardSkeleton } from '../components/ui/CardSkeleton';

interface ProfissionaisProps {
  initialSelectedProfId?: string;
  clearInitialSelectedProfId?: () => void;
}

export const Profissionais: React.FC<ProfissionaisProps> = ({
  initialSelectedProfId,
  clearInitialSelectedProfId
}) => {
  const { profissionais, pacientes, addProfissional, updateProfissional, deleteProfissional, uploadLogo, uploadProfissionalFoto, uploadPdf, userRole, loading: firebaseLoading } = useFirebase();
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
  }, [editingProf, activeTab]);

  useEffect(() => {
    if (editingProf && activeTab === 'ocorrencias') {
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
  }, [editingProf, activeTab]);

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
    idade: undefined as number | undefined,
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

  // Calculate age based on dataNascimento
  useEffect(() => {
    if (formData.dataNascimento) {
      const today = new Date();
      const birthDate = new Date(formData.dataNascimento);
      if (!isNaN(birthDate.getTime())) {
        let calculatedAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          calculatedAge--;
        }
        if (calculatedAge >= 0) {
          setFormData(prev => ({ ...prev, idade: calculatedAge }));
        }
      }
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
 
    setFormData(prof ? {
        nome: prof.nome || '',
        especialidade: prof.especialidade || '',
        telefone: prof.telefone || '',
        foto: prof.foto || '',
        temMei: prof.temMei ?? false,
        cnpj: prof.cnpj || '',
        meiIrregular: prof.meiIrregular ?? false,
        sexo: prof.sexo || 'Masculino',
        dataNascimento: prof.dataNascimento || '',
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
    if (!ocPacienteId) {
      alert('Por favor, selecione o paciente.');
      return;
    }
    if (!ocDescricao.trim()) {
      alert('Por favor, detalhe a ocorrência.');
      return;
    }

    setSavingOcorrencia(true);
    try {
      const chosenPaciente = pacientes.find(p => p.id === ocPacienteId);
      const payload: any = {
        data: ocData,
        pacienteId: ocPacienteId,
        pacienteNome: chosenPaciente ? chosenPaciente.nome : 'Paciente Desconhecido',
        descricao: ocDescricao.trim(),
        bloquearEscala: ocBloquear,
        createdAt: new Date().toISOString(),
        tipo: 'manual'
      };

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
      const ExcelJS = (await import('exceljs')).default;
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
      const docx = await import('docx');
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

    // Trava de Duplicidade Cruzada de CPF (Anti-Duplicação)
    const formattedCpfVal = mascaraCPF(cleanCpfVal);
    const cpfOptions = [cleanCpfVal, formattedCpfVal].filter(Boolean);

    try {
      const profQuery = query(collection(db, 'profissionais'), where('cpf', 'in', cpfOptions));
      const profSnap = await getDocs(profQuery);
      const duplicateProf = profSnap.docs.find(doc => !editingProf || doc.id !== editingProf?.id);
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
      console.error("Erro ao verificar duplicidade de CPF:", dbErr);
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
          dataNascimento: updated.dataNascimento || '',
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
          dataNascimento: created.dataNascimento || '',
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
    } catch (err) {
      console.error("Erro ao salvar:", err);
      toast.error("Erro ao salvar profissional. Tente novamente.");
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
      alert("Por favor, salve o profissional primeiro para poder enviar documentos anexos.");
      return;
    }
    if (!arquivoAnexo) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    if (!tipoDocumentoAnexo) {
      alert("Por favor, selecione o Tipo de Documento.");
      return;
    }

    setSalvandoAnexo(true);

    try {
      const id = editingProf.id;
      // Fazer o upload para o Firebase Storage
      const pathRef = `profissionais/${id}/${arquivoAnexo.name}`;
      const storageRef = ref(storage, pathRef);
      
      const uploadResult = await uploadBytes(storageRef, arquivoAnexo);
      const downloadUrl = await getDownloadURL(uploadResult.ref);

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

    } catch (err) {
      console.error("Erro no upload de documento real:", err);
      alert("Erro ao enviar documento. Tente novamente.");
    } finally {
      setSalvandoAnexo(false);
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
        try {
          const docRef = doc(db, 'configuracoes_empresa', 'empresa');
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setConfig(docSnap.data() as any);
          }
        } catch (err) {
          console.error("Erro ao buscar configurações:", err);
        } finally {
          setLoadingConfig(false);
        }
      };
      fetchConfig();
    }, []);

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
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              const allElements = clonedDoc.getElementsByTagName('*');
              for (let i = 0; i < allElements.length; i++) {
                const el = allElements[i] as HTMLElement;
                const computedStyle = window.getComputedStyle(el);
                
                if (computedStyle.backgroundColor.includes('oklab') || computedStyle.backgroundColor.includes('oklch')) {
                  el.style.setProperty('background-color', '#fcf8f2', 'important');
                }
                if (computedStyle.color.includes('oklab') || computedStyle.color.includes('oklch')) {
                  el.style.setProperty('color', '#1a3c2e', 'important');
                }
                if (computedStyle.borderColor.includes('oklab') || computedStyle.borderColor.includes('oklch')) {
                  el.style.setProperty('border-color', '#b8860b', 'important');
                }
              }
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
          const canvas = await html2canvas(badgeRef.current, {
            scale: 2,
            useCORS: true,
            allowTaint: true, // safe because we converted to base64 but can render other parts
            logging: false,
            backgroundColor: '#fcf8f2',
            onclone: (clonedDoc) => {
              try {
                const allElements = clonedDoc.getElementsByTagName('*');
                for (let i = 0; i < allElements.length; i++) {
                  const el = allElements[i] as HTMLElement;
                  const style = window.getComputedStyle(el);
                  if (!style) continue;
                  
                  if (style.backgroundColor && (style.backgroundColor.includes('oklab') || style.backgroundColor.includes('oklch'))) {
                    el.style.setProperty('background-color', '#fcf8f2', 'important');
                  }
                  if (style.color && (style.color.includes('oklab') || style.color.includes('oklch'))) {
                    el.style.setProperty('color', '#1a3c2e', 'important');
                  }
                  if (style.borderColor && (style.borderColor.includes('oklab') || style.borderColor.includes('oklch'))) {
                    el.style.setProperty('border-color', '#b8860b', 'important');
                  }
                }
              } catch (e) {
                console.warn("Erro ao higienizar oklab no clone", e);
              }
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
      <div className="space-y-4 p-4 print:p-0 print:m-0">
        <div className="flex flex-col items-center gap-2 print:hidden mb-4">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={loading || loadingConfig}
              className="px-6 py-2.5 bg-[#1a3c2e] text-[#b8860b] font-bold text-xs rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2 disabled:bg-gray-400 cursor-pointer shadow-sm border border-[#b8860b]"
            >
              {loading ? 'Preparando...' : <><FileImage size={14} /> Baixar</>}
            </button>
          </div>
        </div>
        
        {/* We move ref={badgeRef} to the actual card container only, so downloading excludes the button and any surrounding non-badge UI elements */}
        <div className="flex flex-row gap-0 justify-center items-stretch print:flex-row print:gap-0 p-4 bg-[#fcf8f2] border-2 border-[#b8860b] rounded-xl shadow-sm divide-x divide-gray-200 w-[700px] h-[400px]" ref={badgeRef}>
          {/* Lado Esquerdo (Frente) */}
          <div className="w-1/2 p-6 flex flex-col items-center justify-between text-center">
             <div className="w-full flex justify-center mb-4">
                {loadingConfig ? (
                  <div className="w-32 h-16 bg-gray-100 animate-pulse rounded" />
                ) : logoBase64 ? (
                  <img src={logoBase64} alt="Logo" className="object-contain h-20 w-auto mix-blend-multiply" crossOrigin="anonymous" />
                ) : <div className="w-32 h-16 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">Sem Logo</div>}
             </div>
                
             <div className="flex-grow flex items-center justify-center">
                  <div className="w-32 h-40 object-cover rounded-sm border border-gray-300 overflow-hidden">
                      {fotoBase64 ? (
                        <img src={fotoBase64} alt="Foto" className="w-full h-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <div className="w-full h-full bg-gray-150 flex items-center justify-center text-slate-400 text-xs font-bold">Sem Foto</div>
                      )}
                  </div>
             </div>
             <div className="mt-4">
                <div className="font-bold text-lg text-slate-900">{profData.nome || "Nome do Profissional"}</div>
                <div className="text-sm text-slate-700 mt-1">{profData.profissao || "Profissão"}</div>
             </div>
          </div>
          
          {/* Lado Direito (Verso) */}
          <div className="w-1/2 p-6 flex flex-col justify-between">
             <div className="w-full">
               <table className="w-full text-left border-collapse">
                 <tbody>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">Nome</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.nome}</div>
                     </td>
                   </tr>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">CPF</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.cpf}</div>
                     </td>
                   </tr>
                   <tr className="border-b border-slate-300">
                     <td className="py-2">
                        <div className="italic text-slate-500 text-xs">RG</div>
                        <div className="text-sm font-semibold text-slate-800">{profData.rg}</div>
                     </td>
                   </tr>
                 </tbody>
               </table>
             </div>
             
             <div className="w-full flex flex-col items-center justify-center text-center text-sm text-slate-800 mt-auto">
               <p className="font-bold mb-1">{config.razaoSocial || "Razão Social"}</p>
               <p>{config.cnpj || "CNPJ"}</p>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const filteredAndSortedProfissionais = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
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
          (prof.nome || '').toLowerCase().includes(query) ||
          (prof.cpf || '').toLowerCase().includes(query) ||
          (prof.telefone || '').toLowerCase().includes(query) ||
          (prof.especialidade || '').toLowerCase().includes(query) ||
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
        <div className="flex flex-wrap items-center gap-3 flex-1 w-full">
          {/* Universal Search Field */}
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou telefone..."
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

        {/* Primary action */}
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm w-full sm:w-auto justify-center transition-colors"
        >
          <Plus size={14} /> Novo Profissional
        </button>
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
                className="bg-white p-4 rounded-xl shadow-xs border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm hover:border-gray-200 transition-all animate-in fade-in-50"
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
                              required
                            >
                              <option value="">Selecione o paciente...</option>
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
                              placeholder="Descreva detalhadamente o motivo da ocorrência..."
                              value={ocDescricao}
                              onChange={(e) => setOcDescricao(e.target.value)}
                              className="p-2 border border-slate-200 rounded-lg text-sm w-full bg-white focus:ring-1 focus:ring-[#1a3c2e]"
                              required
                            />
                          </div>
                        </div>

                        {/* Checkbox de Bloqueio */}
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

                        {/* Botões do Form de Ocorrência */}
                        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={handleCloseFormOcorrencia}
                            className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveOcorrencia}
                            disabled={savingOcorrencia}
                            className="px-4 py-1.5 text-xs font-extrabold text-white bg-red-650 hover:bg-red-700 rounded-lg transition shadow-sm disabled:opacity-50 cursor-pointer"
                            style={{ backgroundColor: '#1a3c2e', color: '#b8860b' }}
                          >
                            {savingOcorrencia ? 'Salvando...' : 'Salvar Ocorrência'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setExibindoFormOcorrencia(true)}
                          className="px-4 py-2 bg-[#1a3c2e] text-[#b8860b] text-xs font-extrabold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer border border-[#b8860b]/30 shadow-xs"
                        >
                          <span>+ Registrar Ocorrência</span>
                        </button>
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
                          placeholder="Buscar por motivo, paciente ou descrição..."
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
                        <input type="text" placeholder="Digite o nome completo" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" required />
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
                             placeholder="00.000.000/0000-00" 
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
                        <input type="date" value={formData.dataNascimento} onChange={e => setFormData({...formData, dataNascimento: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Idade</label>
                         <input type="text" value={formData.idade || ''} disabled className="p-2 border border-gray-100 rounded-lg text-xs w-full bg-gray-50 text-gray-400" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">RG</label>
                        <input type="text" placeholder="Digite o RG" value={formData.rg} onChange={e => setFormData({...formData, rg: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">CPF (Obrigatório)</label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="000.000.000-00"
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
                        <input type="text" placeholder="Digite a profissão" value={formData.profissao} onChange={e => setFormData({...formData, profissao: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Conselho Profissional</label>
                        <input type="text" placeholder="Digite o conselho" value={formData.conselho} onChange={e => setFormData({...formData, conselho: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Telefone (Obrigatório)</label>
                        <input type="tel" placeholder="(00) 00000-0000" value={formData.telefone} onChange={e => setFormData({...formData, telefone: mascaraTelefone(e.target.value)})} maxLength={15} className="p-2 border border-gray-200 rounded-lg text-xs w-full focus:ring-1 focus:ring-[#1a3c2e] focus:border-transparent outline-none bg-white text-gray-800" required />
                      </div>
                    </CardBase>

                    {/* Bloco 2: Endereço */}
                    <CardBase className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <span className="md:col-span-4 font-bold text-xs text-[#1a3c2e] uppercase border-b border-gray-50 pb-2 mb-1">Endereço</span>
                       <input type="text" placeholder="CEP" value={formData.endereco.cep} onChange={e => handleCepChange(e.target.value)} maxLength={9} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" placeholder="Logradouro" value={formData.endereco.rua} onChange={e => setFormData({...formData, endereco: {...formData.endereco, rua: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs md:col-span-2 text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" placeholder="Nº" value={formData.endereco.numero} onChange={e => setFormData({...formData, endereco: {...formData.endereco, numero: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" placeholder="Bairro" value={formData.endereco.bairro} onChange={e => setFormData({...formData, endereco: {...formData.endereco, bairro: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" placeholder="Cidade" value={formData.endereco.cidade} onChange={e => setFormData({...formData, endereco: {...formData.endereco, cidade: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
                       <input type="text" placeholder="UF" value={formData.endereco.estado} onChange={e => setFormData({...formData, endereco: {...formData.endereco, estado: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 focus:ring-1 focus:ring-[#1a3c2e] outline-none" />
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
                                placeholder="Nome Completo do Titular"
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
                                placeholder="CPF do Titular"
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
                              placeholder="Pesquise por nome ou número do banco..."
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
                        <input type="text" placeholder="Agência" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e]" />
                       <input type="text" placeholder="Conta" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})} className="p-2 border border-gray-200 rounded-lg text-xs text-gray-800 outline-none focus:ring-1 focus:ring-[#1a3c2e]" />
                       <div className="relative">
                         <input
                           type="text"
                           placeholder="PIX"
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
                                    <option value="Crachá">Crachá</option>
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
                                    onChange={e => setArquivoAnexo(e.target.files?.[0] || null)}
                                    className="p-1 border border-slate-200 rounded-lg text-xs w-full bg-slate-50 cursor-pointer"
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <button
                                    type="button"
                                    onClick={handleUploadAnexo}
                                    disabled={salvandoAnexo}
                                    className="w-full bg-[#1a3c2e] text-[#b8860b] hover:bg-[#132c22] disabled:bg-slate-300 disabled:text-slate-500 rounded-lg font-bold py-2 px-3 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    {salvandoAnexo ? (
                                      <>
                                        <span className="w-3 h-3 border-2 border-[#b8860b] border-t-transparent rounded-full animate-spin"></span>
                                        <span>Carregando...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Salvar Anexo</span>
                                      </>
                                    )}
                                  </button>
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
                      <button
                          type="button"
                          onClick={() => setDeleteProfConfirmOpen(true)}
                          className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                          <Trash2 size={13} />
                          Excluir
                      </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-md text-xs font-semibold disabled:bg-gray-450 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Save size={13} />
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
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
    </div>
  );
};
