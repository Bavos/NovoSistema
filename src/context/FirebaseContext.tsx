/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Paciente, Plantao, Profissional, CancelingReason, AuditLog, Agendamento, UsuarioSistema, DebitoProfissional, FaturaPaciente, FolhaPagamento, ServicoExtra } from '../types';
import { INITIAL_PACIENTES, INITIAL_PLANTOES, INITIAL_PROFESSIONALS } from '../mockData';
import { db, auth, storage, OperationType, handleFirestoreError } from '../lib/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'react-hot-toast';
import { normalizeText } from '../lib/masks';
import { logError } from '../lib/diagnostics';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  getDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';

interface FirebaseContextType {
  isTestMode: boolean;
  isSandbox: boolean;
  toggleTestMode: (enabled?: boolean) => void;
  pacientes: Paciente[];
  isQuotaExceeded: boolean;
  loadingPacientes: boolean;
  hasMore: boolean;
  loadMorePacientes: () => Promise<void>;
  fetchFirstPagePacientes: (search?: string, filterId?: string, forceRefresh?: boolean) => Promise<void>;
  fetchNextPage: () => Promise<void>;
  fetchPreviousPage: () => Promise<void>;
  hasPreviousPage: boolean;
  totalPacientes: { ativos: number; inativos: number };
  fetchCounts: () => Promise<void>;
  plantoes: Plantao[];
  agendamentos: Agendamento[];
  loading: boolean;
  user: User | null;
  userRole: 'Administrador' | 'Colaborador';
  usuariosSistema: UsuarioSistema[];
  setUserRole: (role: 'Administrador' | 'Colaborador') => void;
  notification: string | null;
  setNotification: (msg: string | null) => void;
  login: (email: string, pass: string) => Promise<void>;
  activateAccount: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  profissionais: Profissional[];
  addPaciente: (paciente: Omit<Paciente, 'id' | 'createdAt' | 'status'>, skipNotification?: boolean) => Promise<Paciente>;
  updatePaciente: (paciente: Paciente, skipNotification?: boolean) => Promise<void>;
  deactivatePaciente: (id: string, motivo: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;
  cancelPlantao: (id: string, motivo: CancelingReason) => Promise<void>;
  addPlantao: (plantao: Omit<Plantao, 'id'>) => Promise<Plantao>;
  updatePlantao: (plantao: Plantao) => Promise<void>;
  deletePlantao: (id: string) => Promise<void>;
  deletePlantoes: (ids: string[]) => Promise<void>;
  addAgendamento: (agendamento: Omit<Agendamento, 'id'>) => Promise<Agendamento>;
  addAgendamentosBatch: (agendamentos: Omit<Agendamento, 'id'>[]) => Promise<Agendamento[]>;
  updateAgendamento: (agendamento: Agendamento) => Promise<void>;
  updateAgendamentosBatch: (agendamentos: (Partial<Agendamento> & { id: string })[]) => Promise<void>;
  deleteAgendamento: (id: string) => Promise<void>;
  deleteAgendamentosBatch: (ids: string[]) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
  addProfissional: (profissional: Omit<Profissional, 'id' | 'createdAt' | 'status'>, skipNotification?: boolean) => Promise<Profissional>;
  addUsuarioSistema: (user: Omit<UsuarioSistema, 'id'>) => Promise<UsuarioSistema>;
  deleteUsuarioSistema: (id: string) => Promise<void>;
  updateUsuarioSistema: (user: UsuarioSistema) => Promise<void>;
  updateProfissional: (profissional: Profissional, skipNotification?: boolean) => Promise<void>;
  deleteProfissional: (id: string) => Promise<void>;
  debitosProfissionais: DebitoProfissional[];
  addDebitoProfissional: (debito: Omit<DebitoProfissional, 'id'>) => Promise<DebitoProfissional>;
  updateDebitoProfissional: (debito: DebitoProfissional) => Promise<void>;
  deleteDebitoProfissional: (id: string) => Promise<void>;
  faturasPacientes: FaturaPaciente[];
  addFaturaPaciente: (fatura: Omit<FaturaPaciente, 'id'>) => Promise<FaturaPaciente>;
  servicosExtras: ServicoExtra[];
  addServicoExtra: (servico: Omit<ServicoExtra, 'id'>) => Promise<ServicoExtra>;
  deleteServicoExtra: (id: string) => Promise<void>;
  folhasPagamento: FolhaPagamento[];
  addFolhaPagamento: (folha: Omit<FolhaPagamento, 'id'>) => Promise<FolhaPagamento>;
  deleteFaturaPaciente: (id: string) => Promise<void>;
  deleteFolhaPagamento: (id: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadProfissionalFoto: (file: File) => Promise<string>;
  uploadPdf: (file: File, path: string) => Promise<string>;
  logsAuditoria: AuditLog[];
  addAuditLog: (action: AuditLog['action'], collectionName: string, documentId: string, description: string) => Promise<void>;
  seedDatabase?: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

let lastQuotaToastTime = 0;

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sandbox_mode_enabled') === 'true';
    } catch (e) {
      return false;
    }
  });

  const toggleTestMode = (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !isTestMode;
    try {
      localStorage.setItem('sandbox_mode_enabled', String(nextVal));
    } catch (e) {}
    setIsTestMode(nextVal);
    if (nextVal) {
      toast.success("🧪 Modo de Testes / Sandbox ATIVADO! Operando isoladamente com dados simulados.", {
        id: 'sandbox-toast',
        duration: 4000
      });
    } else {
      toast.success("🔌 Modo de Testes DESATIVADO. Conectado ao Firebase de produção.", {
        id: 'sandbox-toast',
        duration: 4000
      });
    }
  };

  const handleQuotaError = (err: any, source: string): boolean => {
    const errStr = String(err).toLowerCase();
    const isQuota = errStr.includes('quota') || errStr.includes('exhausted') || errStr.includes('limit exceeded') || errStr.includes('limit_exceeded') || errStr.includes('resource-exhausted') || errStr.includes('resource_exhausted');
    const isOffline = errStr.includes('offline') || errStr.includes('unavailable') || errStr.includes('could not reach') || errStr.includes('failed to get document') || errStr.includes('backend didn\'t respond');

    if (isQuota || isOffline) {
      if (!isQuotaExceeded) {
        setIsQuotaExceeded(true);
        loadLocalData();
      }
      
      const now = Date.now();
      if (now - lastQuotaToastTime > 10000) {
        lastQuotaToastTime = now;
        console.warn(`[Firebase Fallback] ${isQuota ? 'Cota excedida' : 'Conexão offline'} detectada em: ${source}. Ativando modo de contingência local.`);
        if (isQuota) {
          toast.error("⚠️ Limite de Cota do Firebase Excedido: Operando em Modo de Contingência Local.", {
            duration: 5000,
            position: 'top-center',
            id: 'quota-error'
          });
        }
      }
      return true;
    }
    return false;
  };

  const EXCLUDED_PATIENT_NAMES = [
    'Roberto Carlos Silva',
    'João Albuquerque',
    'Maria Eduarda Fernandes',
    'Clara Rezende de Oliveira'
  ];
  const EXCLUDED_PATIENT_IDS = ['pac-1', 'pac-2', 'pac-3', 'pac-4'];

  const isExcludedPatient = (pac: any, docId?: string) => {
    if (!pac && !docId) return false;
    if (docId && EXCLUDED_PATIENT_IDS.includes(docId)) return true;
    if (pac?.id && EXCLUDED_PATIENT_IDS.includes(pac.id)) return true;
    if (pac?.nome && EXCLUDED_PATIENT_NAMES.some(name => pac.nome.toLowerCase().trim() === name.toLowerCase().trim())) return true;
    return false;
  };

  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [debitosProfissionais, setDebitosProfissionais] = useState<DebitoProfissional[]>([]);
  const [faturasPacientes, setFaturasPacientes] = useState<FaturaPaciente[]>([]);
  const [servicosExtras, setServicosExtras] = useState<ServicoExtra[]>([]);
  const [folhasPagamento, setFolhasPagamento] = useState<FolhaPagamento[]>([]);
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLog[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLocalData = () => {
    try {
      console.warn("[Firebase Quota Fallback] Carregando dados de contingência do localStorage...");
      const cachedPacientes = localStorage.getItem('contingency_pacientes');
      const cachedPlantoes = localStorage.getItem('contingency_plantoes');
      const cachedAgendamentos = localStorage.getItem('contingency_agendamentos');
      const cachedProfissionais = localStorage.getItem('contingency_profissionais');
      const cachedDebitos = localStorage.getItem('contingency_debitos');
      const cachedFaturas = localStorage.getItem('contingency_faturas');
      const cachedFolhas = localStorage.getItem('contingency_folhas');
      const cachedLogs = localStorage.getItem('contingency_logs');
      const cachedUsers = localStorage.getItem('contingency_users');

      if (cachedPacientes) {
        const parsed: Paciente[] = JSON.parse(cachedPacientes);
        const filtered = parsed.filter(p => !isExcludedPatient(p));
        setPacientes(filtered);
        localStorage.setItem('contingency_pacientes', JSON.stringify(filtered));
      } else {
        const filtered = INITIAL_PACIENTES.filter(p => !isExcludedPatient(p));
        setPacientes(filtered);
        localStorage.setItem('contingency_pacientes', JSON.stringify(filtered));
      }

      if (cachedPlantoes) {
        const parsed: Plantao[] = JSON.parse(cachedPlantoes);
        const filtered = parsed.filter(p => !EXCLUDED_PATIENT_IDS.includes(p.pacienteId));
        setPlantoes(filtered);
        localStorage.setItem('contingency_plantoes', JSON.stringify(filtered));
      } else {
        const filtered = INITIAL_PLANTOES.filter(p => !EXCLUDED_PATIENT_IDS.includes(p.pacienteId));
        setPlantoes(filtered);
        localStorage.setItem('contingency_plantoes', JSON.stringify(filtered));
      }

      if (cachedAgendamentos) {
        setAgendamentos(JSON.parse(cachedAgendamentos));
      } else {
        setAgendamentos([]);
        localStorage.setItem('contingency_agendamentos', JSON.stringify([]));
      }

      if (cachedProfissionais) {
        setProfissionais(JSON.parse(cachedProfissionais));
      } else {
        const mapped: Profissional[] = INITIAL_PROFESSIONALS.map((prof) => ({
          id: prof.id,
          nome: prof.name,
          especialidade: prof.role,
          telefone: prof.tel,
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          ativo: true,
          profissao: prof.role.includes('Médica') ? 'Médica(o)' : prof.role.includes('Enfermagem') ? 'Téc. Enfermagem' : prof.role.includes('Enfermeira') ? 'Enfermeira(o)' : prof.role.includes('Fisioterapeuta') ? 'Fisioterapeuta' : 'Cuidadora(o)',
        }));
        setProfissionais(mapped);
        localStorage.setItem('contingency_profissionais', JSON.stringify(mapped));
      }

      if (cachedDebitos) {
        setDebitosProfissionais(JSON.parse(cachedDebitos));
      } else {
        setDebitosProfissionais([]);
        localStorage.setItem('contingency_debitos', JSON.stringify([]));
      }

      if (cachedFaturas) {
        setFaturasPacientes(JSON.parse(cachedFaturas));
      } else {
        setFaturasPacientes([]);
        localStorage.setItem('contingency_faturas', JSON.stringify([]));
      }

      if (cachedFolhas) {
        setFolhasPagamento(JSON.parse(cachedFolhas));
      } else {
        setFolhasPagamento([]);
        localStorage.setItem('contingency_folhas', JSON.stringify([]));
      }

      if (cachedLogs) {
        setLogsAuditoria(JSON.parse(cachedLogs));
      } else {
        setLogsAuditoria([]);
        localStorage.setItem('contingency_logs', JSON.stringify([]));
      }

      if (cachedUsers) {
        setUsuariosSistema(JSON.parse(cachedUsers));
      } else {
        const initialUsers: UsuarioSistema[] = [
          {
            id: 'user-renato',
            nome: 'Renato B. Z.',
            email: 'renatobz@gmail.com',
            nivelAcesso: 'Administrador',
            status: 'Ativo'
          }
        ];
        setUsuariosSistema(initialUsers);
        localStorage.setItem('contingency_users', JSON.stringify(initialUsers));
      }

      setLoading(false);
      setLoadingPacientes(false);
    } catch (e) {
      console.error("Erro ao carregar dados locais de contingência:", e);
    }
  };

  const loadSandboxData = () => {
    try {
      console.warn("[Modo de Testes / Sandbox] Carregando dados simulados na memória do navegador...");
      const sandboxPacientes = localStorage.getItem('sandbox_pacientes');
      const sandboxPlantoes = localStorage.getItem('sandbox_plantoes');
      const sandboxAgendamentos = localStorage.getItem('sandbox_agendamentos');
      const sandboxProfissionais = localStorage.getItem('sandbox_profissionais');
      const sandboxDebitos = localStorage.getItem('sandbox_debitos');
      const sandboxFaturas = localStorage.getItem('sandbox_faturas');
      const sandboxFolhas = localStorage.getItem('sandbox_folhas');
      const sandboxLogs = localStorage.getItem('sandbox_logs');
      const sandboxUsers = localStorage.getItem('sandbox_users');

      if (sandboxPacientes) {
        const parsed: Paciente[] = JSON.parse(sandboxPacientes);
        const filtered = parsed.filter(p => !isExcludedPatient(p));
        setPacientes(filtered);
        localStorage.setItem('sandbox_pacientes', JSON.stringify(filtered));
      } else {
        const filtered = INITIAL_PACIENTES.filter(p => !isExcludedPatient(p));
        setPacientes(filtered);
        localStorage.setItem('sandbox_pacientes', JSON.stringify(filtered));
      }

      if (sandboxPlantoes) {
        const parsed: Plantao[] = JSON.parse(sandboxPlantoes);
        const filtered = parsed.filter(p => !EXCLUDED_PATIENT_IDS.includes(p.pacienteId));
        setPlantoes(filtered);
        localStorage.setItem('sandbox_plantoes', JSON.stringify(filtered));
      } else {
        const filtered = INITIAL_PLANTOES.filter(p => !EXCLUDED_PATIENT_IDS.includes(p.pacienteId));
        setPlantoes(filtered);
        localStorage.setItem('sandbox_plantoes', JSON.stringify(filtered));
      }

      if (sandboxAgendamentos) {
        setAgendamentos(JSON.parse(sandboxAgendamentos));
      } else {
        setAgendamentos([]);
        localStorage.setItem('sandbox_agendamentos', JSON.stringify([]));
      }

      if (sandboxProfissionais) {
        setProfissionais(JSON.parse(sandboxProfissionais));
      } else {
        const mapped: Profissional[] = INITIAL_PROFESSIONALS.map((prof) => ({
          id: prof.id,
          nome: prof.name,
          especialidade: prof.role,
          telefone: prof.tel,
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          ativo: true,
          profissao: prof.role.includes('Médica') ? 'Médica(o)' : prof.role.includes('Enfermagem') ? 'Téc. Enfermagem' : prof.role.includes('Enfermeira') ? 'Enfermeira(o)' : prof.role.includes('Fisioterapeuta') ? 'Fisioterapeuta' : 'Cuidadora(o)',
        }));
        setProfissionais(mapped);
        localStorage.setItem('sandbox_profissionais', JSON.stringify(mapped));
      }

      if (sandboxDebitos) {
        setDebitosProfissionais(JSON.parse(sandboxDebitos));
      } else {
        setDebitosProfissionais([]);
        localStorage.setItem('sandbox_debitos', JSON.stringify([]));
      }

      if (sandboxFaturas) {
        setFaturasPacientes(JSON.parse(sandboxFaturas));
      } else {
        setFaturasPacientes([]);
        localStorage.setItem('sandbox_faturas', JSON.stringify([]));
      }

      if (sandboxFolhas) {
        setFolhasPagamento(JSON.parse(sandboxFolhas));
      } else {
        setFolhasPagamento([]);
        localStorage.setItem('sandbox_folhas', JSON.stringify([]));
      }

      if (sandboxLogs) {
        setLogsAuditoria(JSON.parse(sandboxLogs));
      } else {
        setLogsAuditoria([]);
        localStorage.setItem('sandbox_logs', JSON.stringify([]));
      }

      if (sandboxUsers) {
        setUsuariosSistema(JSON.parse(sandboxUsers));
      } else {
        const initialUsers: UsuarioSistema[] = [
          {
            id: 'user-renato',
            nome: 'Renato B. Z. (Simulado)',
            email: 'renatobz@gmail.com',
            nivelAcesso: 'Administrador',
            status: 'Ativo'
          }
        ];
        setUsuariosSistema(initialUsers);
        localStorage.setItem('sandbox_users', JSON.stringify(initialUsers));
      }

      setLoading(false);
      setLoadingPacientes(false);
    } catch (e) {
      console.error("Erro ao carregar dados do modo de testes / sandbox:", e);
    }
  };

  useEffect(() => {
    if (isTestMode) {
      loadSandboxData();
    } else if (isQuotaExceeded) {
      loadLocalData();
    }
  }, [isTestMode, isQuotaExceeded]);

  useEffect(() => {
    const purgeExcludedPatients = async () => {
      try {
        for (const id of EXCLUDED_PATIENT_IDS) {
          deleteDoc(doc(db, 'pacientes', id)).catch(() => {});
        }
      } catch (e) {
        // Silently ignore if offline
      }
    };
    purgeExcludedPatients();
  }, []);

  // Pagination and count states for patients
  const [totalPacientes, setTotalPacientes] = useState<{ ativos: number; inativos: number }>({ ativos: 0, inativos: 0 });
  const [currentSearch, setCurrentSearch] = useState('');
  const [currentFilterId, setCurrentFilterId] = useState('todos');
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const [pageHistory, setPageHistory] = useState<any[]>([]);

  const hasPreviousPage = pageHistory.length > 0;

  const fetchCounts = async () => {
    if (isTestMode || isQuotaExceeded) {
      const active = pacientes.filter(p => p.status === 'Ativo').length;
      const inactive = pacientes.filter(p => p.status === 'Desativado').length;
      setTotalPacientes({ ativos: active, inativos: inactive });
      return;
    }
    try {
      const coll = collection(db, 'pacientes');
      const qAtivos = query(coll, where('status', '==', 'Ativo'));
      const qInativos = query(coll, where('status', '==', 'Desativado'));

      const [snapAtivos, snapInativos] = await Promise.all([
        getCountFromServer(qAtivos),
        getCountFromServer(qInativos)
      ]);

      setTotalPacientes({
        ativos: snapAtivos.data().count,
        inativos: snapInativos.data().count
      });
    } catch (err) {
      if (handleQuotaError(err, 'fetchCounts')) {
        const active = pacientes.filter(p => p.status === 'Ativo').length;
        const inactive = pacientes.filter(p => p.status === 'Desativado').length;
        setTotalPacientes({ ativos: active, inativos: inactive });
      } else {
        console.warn("Erro ao obter contagem de pacientes do servidor, usando contagem local:", err);
        const active = pacientes.filter(p => p.status === 'Ativo').length;
        const inactive = pacientes.filter(p => p.status === 'Desativado').length;
        setTotalPacientes({ ativos: active, inativos: inactive });
      }
    }
  };

  const buildPacienteQuery = (search: string, filterId: string) => {
    let q = query(collection(db, 'pacientes'), orderBy('nome'));

    if (filterId && filterId !== 'todos') {
      q = query(collection(db, 'pacientes'), where('id', '==', filterId));
    } else if (search) {
      const normalizedSearch = search.trim();
      const capitalizedSearch = normalizedSearch.charAt(0).toUpperCase() + normalizedSearch.slice(1);
      q = query(
        collection(db, 'pacientes'),
        where('nome', '>=', capitalizedSearch),
        where('nome', '<=', capitalizedSearch + '\uf8ff'),
        orderBy('nome')
      );
    }
    return q;
  };

  const fetchFirstPagePacientes = async (search = '', filterId = 'todos', forceRefresh = false) => {
    setLoadingPacientes(true);
    setCurrentSearch(search);
    setCurrentFilterId(filterId);

    if (isTestMode || isQuotaExceeded) {
      if (!search.trim() && filterId === 'todos') {
        if (isTestMode) loadSandboxData();
        else loadLocalData();
        setLoadingPacientes(false);
        setLoading(false);
        return;
      }
      let filtered = [...pacientes];
      if (filterId && filterId !== 'todos') {
        filtered = filtered.filter(p => p.id === filterId);
      } else if (search) {
        const normSearch = normalizeText(search);
        filtered = filtered.filter(p => normalizeText(p.nome).includes(normSearch));
      }
      filtered.sort((a, b) => a.nome.localeCompare(b.nome));
      setPacientes(filtered);
      setLoadingPacientes(false);
      setLoading(false);
      return;
    }

    // Cache Guard: Se não houver busca/filtro e os pacientes já estiverem carregados no estado do Contexto,
    // reutiliza os dados locais a menos que seja um refresh explícito (forceRefresh = true).
    if (!forceRefresh && !search.trim() && filterId === 'todos' && pacientes.length > 0) {
      setLoadingPacientes(false);
      setLoading(false);
      return;
    }

    if (search.trim()) {
      try {
        let qBase = query(collection(db, 'pacientes'), orderBy('nome'));
        if (filterId && filterId !== 'todos') {
          qBase = query(collection(db, 'pacientes'), where('id', '==', filterId));
        }
        const q = query(qBase, limit(1000));
        const snap = await getDocs(q);
        let list: Paciente[] = [];
        snap.forEach((d) => {
          const p = d.data() as Paciente;
          if (isExcludedPatient(p, d.id)) {
            deleteDoc(doc(db, 'pacientes', d.id)).catch(() => {});
          } else {
            list.push(p);
          }
        });

        const normSearch = normalizeText(search);
        list = list.filter(p => normalizeText(p.nome).includes(normSearch));
        setPacientes(list);
        setLastVisible(null);
        setHasMore(false);
        setPageHistory([]);
      } catch (error) {
        if (handleQuotaError(error, 'fetchFirstPagePacientesSearch')) {
          // Fallback triggers local
        } else {
          console.error("Erro ao buscar pacientes:", error);
        }
      } finally {
        setLoadingPacientes(false);
        setLoading(false);
      }
      return;
    }

    try {
      const qBase = buildPacienteQuery(search, filterId);
      const q = query(qBase, limit(50));
      const snap = await getDocs(q);
      const list: Paciente[] = [];
      snap.forEach((d) => {
        const p = d.data() as Paciente;
        if (isExcludedPatient(p, d.id)) {
          deleteDoc(doc(db, 'pacientes', d.id)).catch(() => {});
        } else {
          list.push(p);
        }
      });
      setPacientes(list);
      
      if (!snap.empty) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snap.docs.length === 50);
      } else {
        setLastVisible(null);
        setHasMore(false);
      }
      setPageHistory([]);
    } catch (error) {
      if (handleQuotaError(error, 'fetchFirstPagePacientes')) {
        // Fallback local pagination triggered above, which is perfect
      } else {
        console.error("Erro ao carregar primeira página de pacientes:", error);
      }
    } finally {
      setLoadingPacientes(false);
      setLoading(false);
    }
  };

  const loadMorePacientes = async () => {
    await fetchNextPage();
  };

  const fetchNextPage = async () => {
    if (isQuotaExceeded) return;
    if (!hasMore || loadingPacientes || !lastVisible) return;
    setLoadingPacientes(true);
    try {
      setPageHistory((prev) => [...prev, lastVisible]);
      const qBase = buildPacienteQuery(currentSearch, currentFilterId);
      const q = query(qBase, startAfter(lastVisible), limit(50));
      const snap = await getDocs(q);
      const list: Paciente[] = [];
      snap.forEach((d) => {
        const p = d.data() as Paciente;
        if (isExcludedPatient(p, d.id)) {
          deleteDoc(doc(db, 'pacientes', d.id)).catch(() => {});
        } else {
          list.push(p);
        }
      });
      setPacientes(list);
      
      if (!snap.empty) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snap.docs.length === 50);
      } else {
        setLastVisible(null);
        setHasMore(false);
      }
    } catch (error) {
      if (!handleQuotaError(error, 'fetchNextPage')) {
        console.error("Erro ao carregar próxima página de pacientes:", error);
      }
    } finally {
      setLoadingPacientes(false);
    }
  };

  const fetchPreviousPage = async () => {
    if (isQuotaExceeded) return;
    if (pageHistory.length === 0 || loadingPacientes) return;
    setLoadingPacientes(true);
    try {
      const prevCursor = pageHistory.length >= 2 ? pageHistory[pageHistory.length - 2] : null;
      const qBase = buildPacienteQuery(currentSearch, currentFilterId);
      
      let q;
      if (prevCursor) {
        q = query(qBase, startAfter(prevCursor), limit(50));
      } else {
        q = query(qBase, limit(50));
      }

      const snap = await getDocs(q);
      const list: Paciente[] = [];
      snap.forEach((d) => {
        const p = d.data() as Paciente;
        if (isExcludedPatient(p, d.id)) {
          deleteDoc(doc(db, 'pacientes', d.id)).catch(() => {});
        } else {
          list.push(p);
        }
      });
      setPacientes(list);
      
      if (!snap.empty) {
        const lastDoc = snap.docs[snap.docs.length - 1];
        setLastVisible(lastDoc);
        setHasMore(snap.docs.length === 50);
      } else {
        setLastVisible(null);
        setHasMore(false);
      }
      setPageHistory((prev) => prev.slice(0, -1));
    } catch (error) {
      if (!handleQuotaError(error, 'fetchPreviousPage')) {
        console.error("Erro ao carregar página anterior de pacientes:", error);
      }
    } finally {
      setLoadingPacientes(false);
    }
  };

  // Authentication State Observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const emailLower = currentUser.email?.toLowerCase();
        
        // Guard for email verification (exempting the bootstrap developer/admin email)
        if (!currentUser.emailVerified && emailLower !== 'renatobz@gmail.com') {
          await signOut(auth);
          toast.error('Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.');
          setUser(null);
          setLoading(false);
          return;
        }

        try {
          if (emailLower !== 'renatobz@gmail.com') {
            const q = query(collection(db, 'usuarios_sistema'), where('email', '==', currentUser.email));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
              await signOut(auth);
              toast.error('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
              setUser(null);
              setLoading(false);
              return;
            } else {
              const docData = querySnapshot.docs[0].data();
              if (docData && docData.status === 'Inativo') {
                await signOut(auth);
                toast.error('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
                setUser(null);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e: any) {
          console.warn("Aviso na validação de login (verificando cota/modo contingência):", e);
          const wasQuota = handleQuotaError(e, 'validação-login');
          if (wasQuota) {
            try {
              const localUsersStr = localStorage.getItem('contingency_users');
              if (localUsersStr) {
                const localUsers = JSON.parse(localUsersStr);
                const localUser = localUsers.find((u: any) => u.email?.toLowerCase() === emailLower);
                if (localUser && localUser.status === 'Inativo') {
                  await signOut(auth);
                  toast.error('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
                  setUser(null);
                  setLoading(false);
                  return;
                }
              }
            } catch (err) {
              console.warn("Erro ao verificar usuário local em contingência:", err);
            }
          }
        }
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, pass: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const loggedUser = userCredential.user;
    if (loggedUser && !loggedUser.emailVerified && loggedUser.email?.toLowerCase() !== 'renatobz@gmail.com') {
      await signOut(auth);
      toast.error('Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.');
      const err: any = new Error('auth/email-not-verified');
      err.code = 'auth/email-not-verified';
      throw err;
    }
  };

  const activateAccount = async (email: string, pass: string) => {
    try {
      const usersRef = collection(db, 'usuarios_sistema');
      const q = query(usersRef, where('email', '==', email), where('status', '==', 'Ativo'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        throw new Error('⚠️ Acesso Negado: Este e-mail não está autorizado pelo administrador da empresa.');
      }
    } catch (e: any) {
      if (handleQuotaError(e, 'activateAccount')) {
        console.warn("Quota exceeded during activateAccount, proceeding with fallback");
      } else {
        throw e;
      }
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      await sendEmailVerification(userCredential.user);
    }
    await signOut(auth);
    setNotification('Acesso criado! Um e-mail de verificação oficial foi enviado para o colaborador.');
    toast.success('Acesso criado! Um e-mail de verificação oficial foi enviado para o seu e-mail.');
  };

  const logout = async () => {
    await signOut(auth);
  };

  const forgotPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const [userRole, setUserRole] = useState<'Administrador' | 'Colaborador'>('Administrador');
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [notification, setNotificationState] = useState<string | null>(null);

  const setNotification = (msg: string | null) => {
    setNotificationState(msg);
    if (msg) {
      if (msg.toLowerCase().includes('erro') || msg.toLowerCase().includes('não coincidem') || msg.toLowerCase().includes('falha')) {
        toast.error(msg);
      }
    }
  };

  // Clean, non-looping userRole synchronization
  useEffect(() => {
    if (user && user.email) {
      const emailLower = user.email.toLowerCase();
      if (emailLower === 'renatobz@gmail.com') {
        setUserRole('Administrador');
      } else if (usuariosSistema.length > 0) {
        const usuario = usuariosSistema.find(u => u.email?.toLowerCase() === emailLower);
        if (usuario) {
          setUserRole(usuario.nivelAcesso === 'Colaborador' ? 'Colaborador' : 'Administrador');
        }
      }
    }
  }, [user, usuariosSistema]);

  const handleSetUserRole = (role: 'Administrador' | 'Colaborador') => {
    setUserRole(role);
  };

  // Safe and straightforward onSnapshot real-time sync with limit(50)
  useEffect(() => {
    if (isTestMode) {
      loadSandboxData();
      return;
    }

    if (!user) {
      setPacientes([]);
      setPlantoes([]);
      setAgendamentos([]);
      setProfissionais([]);
      setUsuariosSistema([]);
      setDebitosProfissionais([]);
      setFaturasPacientes([]);
      setFolhasPagamento([]);
      setLogsAuditoria([]);
      return;
    }

    if (isQuotaExceeded) {
      loadLocalData();
      return;
    }

    // Load initial paginated patients first page and count absolute totals
    fetchFirstPagePacientes().catch((err) => {
      if (!handleQuotaError(err, 'fetchFirstPagePacientes')) {
        console.error("fetchFirstPagePacientes unhandled rejection:", err);
      }
    });
    fetchCounts().catch((err) => {
      if (!handleQuotaError(err, 'fetchCounts')) {
        console.error("fetchCounts unhandled rejection:", err);
      }
    });

    const unsubscribePlantoes = onSnapshot(
      query(collection(db, 'plantoes'), limit(2000)),
      (snap) => {
        const list: Plantao[] = [];
        snap.forEach((d) => list.push(d.data() as Plantao));
        setPlantoes(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'plantoes')) {
          console.error("Error subscribing to plantoes:", error);
        }
      }
    );

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const inicioDoMes = `${currentYear}-${currentMonth}-01`;

    const unsubscribeAgendamentos = onSnapshot(
      query(
        collection(db, 'agendamentos'),
        where('data', '>=', inicioDoMes),
        orderBy('data', 'desc'),
        limit(5000)
      ),
      (snap) => {
        const list: Agendamento[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Agendamento));
        setAgendamentos(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'agendamentos')) {
          console.error("Error subscribing to agendamentos:", error);
        }
      }
    );

    const unsubscribeProfissionais = onSnapshot(
      query(collection(db, 'profissionais'), limit(1000)),
      (snap) => {
        const list: Profissional[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Profissional));
        setProfissionais(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'profissionais')) {
          console.error("Error subscribing to profissionais:", error);
        }
      }
    );
    
    const unsubscribeUsuariosSistema = onSnapshot(
      query(collection(db, 'usuarios_sistema'), limit(1000)),
      (snap) => {
        const list: UsuarioSistema[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as UsuarioSistema));
        setUsuariosSistema(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'usuarios_sistema')) {
          console.error("Error subscribing to usuarios_sistema:", error);
        }
      }
    );

    const unsubscribeDebitos = onSnapshot(
      query(collection(db, 'debitos_profissionais'), limit(2000)),
      (snap) => {
        const list: DebitoProfissional[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as DebitoProfissional));
        setDebitosProfissionais(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'debitos_profissionais')) {
          console.error("Error subscribing to debitos_profissionais:", error);
        }
      }
    );

    const unsubscribeFaturas = onSnapshot(
      query(collection(db, 'faturas_pacientes'), limit(2000)),
      (snap) => {
        const list: FaturaPaciente[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as FaturaPaciente));
        setFaturasPacientes(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'faturas_pacientes')) {
          console.error("Error subscribing to faturas_pacientes:", error);
        }
      }
    );

    const unsubscribeFolhas = onSnapshot(
      query(collection(db, 'folhas_pagamento'), limit(2000)),
      (snap) => {
        const list: FolhaPagamento[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as FolhaPagamento));
        setFolhasPagamento(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'folhas_pagamento')) {
          console.error("Error subscribing to folhas_pagamento:", error);
        }
      }
    );

    const unsubscribeServicosExtras = onSnapshot(
      query(collection(db, 'servicos_extras'), limit(2000)),
      (snap) => {
        const list: ServicoExtra[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as ServicoExtra));
        setServicosExtras(list);
      },
      (error) => {
        if (!handleQuotaError(error, 'servicos_extras')) {
          console.error("Error subscribing to servicos_extras:", error);
        }
      }
    );

    return () => {
      unsubscribePlantoes();
      unsubscribeAgendamentos();
      unsubscribeProfissionais();
      unsubscribeUsuariosSistema();
      unsubscribeDebitos();
      unsubscribeFaturas();
      unsubscribeFolhas();
      unsubscribeServicosExtras();
    };
  }, [user?.uid, isQuotaExceeded, isTestMode]);

  const addAuditLog = async (
    action: AuditLog['action'],
    collectionName: string,
    documentId: string,
    description: string
  ) => {
    if (isQuotaExceeded) {
      const log: AuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'local',
        action,
        collection: collectionName,
        documentId,
        description,
      };
      const updatedList = [log, ...logsAuditoria];
      setLogsAuditoria(updatedList);
      localStorage.setItem('contingency_logs', JSON.stringify(updatedList));
      return;
    }

    try {
      const currentUserEmail = auth.currentUser?.email?.toLowerCase() || '';
      const usuario = usuariosSistema.find(u => u.email?.toLowerCase() === currentUserEmail);
      const userId = usuario?.id || auth.currentUser?.uid || currentUserEmail || 'anonymous';

      const log: AuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId,
        action,
        collection: collectionName,
        documentId,
        description,
      };
      await setDoc(doc(db, 'LogsAuditoria', log.id), log);
    } catch (err) {
      console.error("Erro ao registrar log de auditoria:", err);
      handleQuotaError(err, 'addAuditLog');
    }
  };

  const addPaciente = async (newPac: Omit<Paciente, 'id' | 'createdAt' | 'status'>, skipNotification?: boolean) => {
    const id = `pac-${Date.now()}`;
    const fullPaciente: Paciente = {
      ...newPac,
      id,
      status: 'Ativo',
      createdAt: new Date().toISOString(),
      desativadoEm: null,
      desativadoMotivo: null,
    };

    if (isQuotaExceeded) {
      const updatedList = [fullPaciente, ...pacientes];
      setPacientes(updatedList);
      localStorage.setItem('contingency_pacientes', JSON.stringify(updatedList));
      if (!skipNotification) {
        setNotification(`Paciente '${fullPaciente.nome}' cadastrado com sucesso (Contingência Local).`);
      }
      return fullPaciente;
    }

    try {
      await setDoc(doc(db, 'pacientes', id), fullPaciente);
      setPacientes((prev) => [fullPaciente, ...prev]);
      await addAuditLog('CREATE', 'pacientes', id, `Paciente criado: ${fullPaciente.nome}`);
      fetchCounts();
      if (!skipNotification) {
        setNotification(`Paciente '${fullPaciente.nome}' cadastrado com sucesso.`);
      }
      return fullPaciente;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `pacientes/${id}`);
      throw err;
    }
  };

  const updatePaciente = async (updatedPac: Paciente, skipNotification?: boolean) => {
    if (isQuotaExceeded) {
      const updatedList = pacientes.map((p) => (p.id === updatedPac.id ? updatedPac : p));
      setPacientes(updatedList);
      localStorage.setItem('contingency_pacientes', JSON.stringify(updatedList));
      if (!skipNotification) {
        setNotification(`Paciente '${updatedPac.nome}' atualizado com sucesso (Contingência Local).`);
      }
      return;
    }

    try {
      await setDoc(doc(db, 'pacientes', updatedPac.id), updatedPac);
      setPacientes((prev) =>
        prev.map((p) => (p.id === updatedPac.id ? updatedPac : p))
      );
      await addAuditLog('UPDATE', 'pacientes', updatedPac.id, `Paciente atualizado: ${updatedPac.nome}`);
      fetchCounts();
      if (!skipNotification) {
        setNotification(`Paciente '${updatedPac.nome}' atualizado com sucesso.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${updatedPac.id}`);
      throw err;
    }
  };

  const deactivatePaciente = async (id: string, motivo: string) => {
    const todayStr = new Date().toLocaleDateString('pt-BR');

    if (isQuotaExceeded) {
      const updatedList = pacientes.map((p) =>
        p.id === id
          ? { ...p, status: 'Desativado' as const, desativadoEm: todayStr, desativadoMotivo: motivo }
          : p
      );
      setPacientes(updatedList);
      localStorage.setItem('contingency_pacientes', JSON.stringify(updatedList));
      setNotification(`Paciente desativado com sucesso (Contingência Local).`);
      return;
    }

    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Desativado',
        desativadoEm: todayStr,
        desativadoMotivo: motivo,
      });
      setPacientes((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'Desativado', desativadoEm: todayStr, desativadoMotivo: motivo }
            : p
        )
      );
      await addAuditLog('UPDATE', 'pacientes', id, `Paciente desativado: ${motivo}`);
      fetchCounts();
      setNotification(`Paciente desativado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const reactivatePaciente = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = pacientes.map((p) =>
        p.id === id
          ? { ...p, status: 'Ativo' as const, desativadoEm: null, desativadoMotivo: null }
          : p
      );
      setPacientes(updatedList);
      localStorage.setItem('contingency_pacientes', JSON.stringify(updatedList));
      setNotification(`Paciente reativado com sucesso (Contingência Local).`);
      return;
    }

    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Ativo',
        desativadoEm: null,
        desativadoMotivo: null,
      });
      setPacientes((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, status: 'Ativo', desativadoEm: null, desativadoMotivo: null }
            : p
        )
      );
      await addAuditLog('UPDATE', 'pacientes', id, `Paciente reativado`);
      fetchCounts();
      setNotification(`Paciente reativado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const cancelPlantao = async (id: string, motivo: CancelingReason) => {
    if (isQuotaExceeded) {
      const updatedList = plantoes.map((p) =>
        p.id === id
          ? { ...p, status: 'Cancelado' as const, motivoCancelamento: motivo }
          : p
      );
      setPlantoes(updatedList);
      localStorage.setItem('contingency_plantoes', JSON.stringify(updatedList));
      setNotification(`Plantão cancelado com sucesso (Contingência Local).`);
      return;
    }

    try {
      await updateDoc(doc(db, 'plantoes', id), {
        status: 'Cancelado',
        motivoCancelamento: motivo,
      });
      await addAuditLog('UPDATE', 'plantoes', id, `Plantão cancelado: ${motivo}`);
      setNotification(`Plantão cancelado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `plantoes/${id}`);
      throw err;
    }
  };

  const addPlantao = async (newPlantao: Omit<Plantao, 'id'>) => {
    const id = `plt-${Date.now()}`;
    const fullPlantao: Plantao = {
      ...newPlantao,
      id,
    };

    if (isQuotaExceeded) {
      const updatedList = [fullPlantao, ...plantoes];
      setPlantoes(updatedList);
      localStorage.setItem('contingency_plantoes', JSON.stringify(updatedList));
      setNotification(`Plantão criado com sucesso (Contingência Local).`);
      return fullPlantao;
    }

    try {
      await setDoc(doc(db, 'plantoes', id), fullPlantao);
      await addAuditLog('CREATE', 'plantoes', id, `Plantão criado para paciente: ${newPlantao.pacienteId}`);
      setNotification(`Plantão criado com sucesso.`);
      return fullPlantao;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `plantoes/${id}`);
      throw err;
    }
  };

  const updatePlantao = async (updatedPlantao: Plantao) => {
    if (isQuotaExceeded) {
      const updatedList = plantoes.map((p) => (p.id === updatedPlantao.id ? updatedPlantao : p));
      setPlantoes(updatedList);
      localStorage.setItem('contingency_plantoes', JSON.stringify(updatedList));
      setNotification(`Plantão atualizado com sucesso (Contingência Local).`);
      return;
    }

    try {
      await setDoc(doc(db, 'plantoes', updatedPlantao.id), updatedPlantao);
      await addAuditLog('UPDATE', 'plantoes', updatedPlantao.id, `Plantão atualizado`);
      setNotification(`Plantão atualizado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `plantoes/${updatedPlantao.id}`);
      throw err;
    }
  };

  const deletePlantao = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = plantoes.filter((p) => p.id !== id);
      setPlantoes(updatedList);
      localStorage.setItem('contingency_plantoes', JSON.stringify(updatedList));
      setNotification(`Plantão excluído com sucesso (Contingência Local).`);
      return;
    }

    try {
      await deleteDoc(doc(db, 'plantoes', id));
      await addAuditLog('DELETE', 'plantoes', id, `Plantão excluído`);
      setNotification(`Plantão excluído com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plantoes/${id}`);
      throw err;
    }
  };

  const deletePlantoes = async (ids: string[]) => {
    if (isQuotaExceeded) {
      const updatedList = plantoes.filter((p) => !ids.includes(p.id));
      setPlantoes(updatedList);
      localStorage.setItem('contingency_plantoes', JSON.stringify(updatedList));
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.delete(doc(db, 'plantoes', id));
      }
      await batch.commit();
      for (const id of ids) {
        await addAuditLog('DELETE', 'plantoes', id, `Plantão excluído em lote`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plantoes/batch`);
      throw err;
    }
  };

  const isEscalaConcluida = (idPaciente?: string, dateStr?: string): boolean => {
    if (!idPaciente || !dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length < 2) return false;
    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const keyMMSlashYYYY = `${month}/${year}`;
    const keyMMYYYY = `${month}-${year}`;
    const keyYYYYMM = `${year}-${month}`;

    const pac = pacientes.find((p) => p.id === idPaciente);
    if (pac && pac.mesesConcluidos && Array.isArray(pac.mesesConcluidos)) {
      return (
        pac.mesesConcluidos.includes(keyMMSlashYYYY) ||
        pac.mesesConcluidos.includes(keyMMYYYY) ||
        pac.mesesConcluidos.includes(keyYYYYMM)
      );
    }

    return false;
  };

  const addAgendamento = async (newAg: Omit<Agendamento, 'id'>) => {
    if (isEscalaConcluida(newAg.idPaciente, newAg.data)) {
      const [yr, mo] = (newAg.data || '').split('-');
      const formattedMonthYear = yr && mo ? `${mo}/${yr}` : 'selecionado';
      const errMsg = `Esta escala de ${formattedMonthYear} já está concluída.`;
      toast.error(errMsg);
      throw new Error(errMsg);
    }

    if (isQuotaExceeded) {
      const fullAg: Agendamento = { ...newAg, id: `ag-${Date.now()}`, status: 'Aberta' as const };
      const updatedList = [fullAg, ...agendamentos];
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification('Agendamento criado com sucesso (Contingência Local).');
      return fullAg;
    }

    try {
      const fullAgToSave = { ...newAg, status: newAg.status || 'Aberta' } as any;
      Object.keys(fullAgToSave).forEach(key => {
        if (fullAgToSave[key] === undefined) {
          delete fullAgToSave[key];
        }
      });
      const docRef = await addDoc(collection(db, 'agendamentos'), fullAgToSave);
      const fullAgendamento: Agendamento = { ...fullAgToSave, id: docRef.id };
      await addAuditLog('CREATE', 'agendamentos', docRef.id, `Agendamento criado: ${fullAgendamento.data}`);
      setAgendamentos(prev => [fullAgendamento, ...prev]);
      setNotification('Agendamento criado com sucesso.');
      return fullAgendamento;
    } catch (err) {
      if (handleQuotaError(err, 'addAgendamento')) {
        const fullAg: Agendamento = { ...newAg, id: `ag-${Date.now()}`, status: newAg.status || ('Aberta' as const) };
        const updatedList = [fullAg, ...agendamentos];
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification('Agendamento criado com sucesso (Contingência Local).');
        return fullAg;
      }
      handleFirestoreError(err, OperationType.CREATE, 'agendamentos');
      throw err;
    }
  };

  const addAgendamentosBatch = async (newAgs: Omit<Agendamento, 'id'>[]) => {
    for (const ag of newAgs) {
      if (isEscalaConcluida(ag.idPaciente, ag.data)) {
        const [yr, mo] = (ag.data || '').split('-');
        const formattedMonthYear = yr && mo ? `${mo}/${yr}` : 'selecionado';
        const errMsg = `Esta escala de ${formattedMonthYear} já está concluída.`;
        toast.error(errMsg);
        throw new Error(errMsg);
      }
    }

    if (isQuotaExceeded) {
      const fullAgs: Agendamento[] = newAgs.map((newAg, idx) => ({
        ...newAg,
        id: `ag-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        status: newAg.status || 'Aberta'
      }));
      const updatedList = [...fullAgs, ...agendamentos];
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification(`${fullAgs.length} agendamentos criados com sucesso (Contingência Local).`);
      return fullAgs;
    }

    try {
      const batch = writeBatch(db);
      const createdAgs: Agendamento[] = [];
      
      for (const newAg of newAgs) {
        const newRef = doc(collection(db, 'agendamentos'));
        const fullAgToSave = { ...newAg, status: newAg.status || 'Aberta' } as any;
        Object.keys(fullAgToSave).forEach(key => {
          if (fullAgToSave[key] === undefined) {
            delete fullAgToSave[key];
          }
        });
        batch.set(newRef, fullAgToSave);
        createdAgs.push({ ...fullAgToSave, id: newRef.id });
      }

      await batch.commit();

      for (const ag of createdAgs) {
        await addAuditLog('CREATE', 'agendamentos', ag.id, `Agendamento criado em lote: ${ag.data}`);
      }

      setAgendamentos(prev => [...createdAgs, ...prev]);
      setNotification(`${createdAgs.length} agendamentos criados com sucesso.`);
      return createdAgs;
    } catch (err) {
      if (handleQuotaError(err, 'addAgendamentosBatch')) {
        const fullAgs: Agendamento[] = newAgs.map((newAg, idx) => ({
          ...newAg,
          id: `ag-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
          status: newAg.status || 'Aberta'
        }));
        const updatedList = [...fullAgs, ...agendamentos];
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification(`${fullAgs.length} agendamentos criados com sucesso (Contingência Local).`);
        return fullAgs;
      }
      handleFirestoreError(err, OperationType.CREATE, 'agendamentos/batch');
      throw err;
    }
  };

  const updateAgendamento = async (ag: Agendamento) => {
    if (isQuotaExceeded) {
      const updatedList = agendamentos.map((a) => (a.id === ag.id ? ag : a));
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification('Agendamento atualizado (Contingência Local).');
      return;
    }
    try {
      const agToSave = { ...ag} as any;
      Object.keys(agToSave).forEach(key => {
        if (agToSave[key] === undefined) {
          delete agToSave[key];
        }
      });
      await setDoc(doc(db, 'agendamentos', ag.id), agToSave);
      await addAuditLog('UPDATE', 'agendamentos', ag.id, `Agendamento atualizado: ${ag.id}`);
      setAgendamentos(prev => prev.map((a) => (a.id === ag.id ? ag : a)));
      setNotification('Agendamento atualizado.');
    } catch (err) {
      if (handleQuotaError(err, 'updateAgendamento')) {
        const updatedList = agendamentos.map((a) => (a.id === ag.id ? ag : a));
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification('Agendamento atualizado (Contingência Local).');
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, `agendamentos/${ag.id}`);
      throw err;
    }
  };

  const updateAgendamentosBatch = async (agendamentosToUpdate: (Partial<Agendamento> & { id: string })[]) => {
    if (isQuotaExceeded) {
      const updatedList = agendamentos.map(a => {
        const update = agendamentosToUpdate.find(upd => upd.id === a.id);
        return update ? { ...a, ...update } as Agendamento : a;
      });
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification(`${agendamentosToUpdate.length} agendamentos atualizados (Contingência Local).`);
      return;
    }
    
    try {
      const chunks = [];
      for (let i = 0; i < agendamentosToUpdate.length; i += 500) {
        chunks.push(agendamentosToUpdate.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((ag) => {
          const agToSave = { ...ag } as any;
          Object.keys(agToSave).forEach(key => {
            if (agToSave[key] === undefined) {
              delete agToSave[key];
            }
          });
          const ref = doc(db, 'agendamentos', ag.id);
          batch.set(ref, agToSave, { merge: true });
        });
        await batch.commit();
      }
      
      setAgendamentos(prev => prev.map(a => {
        const update = agendamentosToUpdate.find(upd => upd.id === a.id);
        return update ? { ...a, ...update } as Agendamento : a;
      }));
      setNotification(`${agendamentosToUpdate.length} agendamentos atualizados em lote.`);
    } catch (err) {
      if (handleQuotaError(err, 'updateAgendamentosBatch')) {
        const updatedList = agendamentos.map(a => {
          const update = agendamentosToUpdate.find(upd => upd.id === a.id);
          return update ? { ...a, ...update } as Agendamento : a;
        });
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification(`${agendamentosToUpdate.length} agendamentos atualizados (Contingência Local).`);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, 'agendamentos/batch');
      throw err;
    }
  };

  const deleteAgendamento = async (id: string) => {
    const existing = agendamentos.find(a => a.id === id);
    if (existing && isEscalaConcluida(existing.idPaciente, existing.data)) {
      toast.error('Escala fechada. Não é possível excluir esse plantão.');
      return;
    }

    if (isQuotaExceeded) {
      const updatedList = agendamentos.filter((a) => a.id !== id);
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification('Agendamento excluído (Contingência Local).');
      return;
    }

    try {
      await deleteDoc(doc(db, 'agendamentos', id));
      await addAuditLog('DELETE', 'agendamentos', id, `Agendamento excluído`);
      setAgendamentos(prev => prev.filter((a) => a.id !== id));
      setNotification('Agendamento excluído.');
    } catch (err) {
      if (handleQuotaError(err, 'deleteAgendamento')) {
        const updatedList = agendamentos.filter((a) => a.id !== id);
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification('Agendamento excluído (Contingência Local).');
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, `agendamentos/${id}`);
      throw err;
    }
  };

  const deleteAgendamentosBatch = async (ids: string[]) => {
    const toDelete = agendamentos.filter(a => ids.includes(a.id));
    const invalid = toDelete.some(a => isEscalaConcluida(a.idPaciente, a.data));
    if (invalid) {
      toast.error('Algum dos plantões selecionados está com escala fechada.');
      return;
    }

    if (isQuotaExceeded) {
      const updatedList = agendamentos.filter((a) => !ids.includes(a.id));
      setAgendamentos(updatedList);
      localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
      setNotification(`${ids.length} agendamentos excluídos (Contingência Local).`);
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.delete(doc(db, 'agendamentos', id));
      }
      await batch.commit();

      for (const id of ids) {
        await addAuditLog('DELETE', 'agendamentos', id, `Agendamento excluído em lote`);
      }

      setAgendamentos(prev => prev.filter((a) => !ids.includes(a.id)));
      setNotification(`${ids.length} agendamentos excluídos com sucesso.`);
    } catch (err) {
      if (handleQuotaError(err, 'deleteAgendamentosBatch')) {
        const updatedList = agendamentos.filter((a) => !ids.includes(a.id));
        setAgendamentos(updatedList);
        localStorage.setItem('contingency_agendamentos', JSON.stringify(updatedList));
        setNotification(`${ids.length} agendamentos excluídos (Contingência Local).`);
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, 'agendamentos/batch');
      throw err;
    }
  };

  const addProfissional = async (newProf: Omit<Profissional, 'id' | 'createdAt' | 'status'>, skipNotification?: boolean) => {
    const id = `prof-${Date.now()}`;
    const fullProfissional: Profissional = {
      ...newProf,
      id,
      status: 'Ativo',
      createdAt: new Date().toISOString(),
    };

    if (isQuotaExceeded) {
      const updatedList = [fullProfissional, ...profissionais];
      setProfissionais(updatedList);
      localStorage.setItem('contingency_profissionais', JSON.stringify(updatedList));
      if (!skipNotification) {
        setNotification(`Cuidador '${fullProfissional.nome}' cadastrado com sucesso (Contingência Local).`);
      }
      return fullProfissional;
    }

    try {
      await setDoc(doc(db, 'profissionais', id), fullProfissional);
      await addAuditLog('CREATE', 'profissionais', id, `Profissional criado: ${fullProfissional.nome}`).catch(() => {});
      if (!skipNotification) {
        setNotification(`Cuidador '${fullProfissional.nome}' cadastrado com sucesso.`);
      }
      setProfissionais(prev => [fullProfissional, ...prev.filter(p => p.id !== id)]);
      return fullProfissional;
    } catch (err) {
      console.warn("Aviso no addProfissional (usando fallback local):", err);
      setProfissionais(prev => [fullProfissional, ...prev.filter(p => p.id !== id)]);
      try {
        const currentList = JSON.parse(localStorage.getItem('contingency_profissionais') || '[]');
        localStorage.setItem('contingency_profissionais', JSON.stringify([fullProfissional, ...currentList.filter((p: any) => p.id !== id)]));
      } catch (e) {}
      if (!skipNotification) {
        setNotification(`Cuidador '${fullProfissional.nome}' cadastrado com sucesso.`);
      }
      return fullProfissional;
    }
  };

  const addUsuarioSistema = async (newUser: Omit<UsuarioSistema, 'id'>) => {
    if (isQuotaExceeded) {
      const id = `user-${Date.now()}`;
      const fullUser: UsuarioSistema = { ...newUser, id };
      const updatedList = [fullUser, ...usuariosSistema];
      setUsuariosSistema(updatedList);
      localStorage.setItem('contingency_users', JSON.stringify(updatedList));
      setNotification(`Utilizador '${newUser.nome}' adicionado com sucesso (Contingência Local).`);
      return fullUser;
    }

    try {
      const docRef = doc(collection(db, 'usuarios_sistema'));
      const id = docRef.id;
      const fullUser: UsuarioSistema = { ...newUser, id };
      await setDoc(docRef, fullUser);
      setNotification(`Utilizador '${newUser.nome}' adicionado com sucesso.`);
      return fullUser;
    } catch (err) {
      console.error("Erro ao adicionar utilizador:", err);
      handleFirestoreError(err, OperationType.CREATE, 'usuarios_sistema');
      throw err;
    }
  };

  const deleteUsuarioSistema = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = usuariosSistema.filter((u) => u.id !== id);
      setUsuariosSistema(updatedList);
      localStorage.setItem('contingency_users', JSON.stringify(updatedList));
      setNotification('Utilizador removido com sucesso (Contingência Local).');
      return;
    }

    try {
      const targetUser = usuariosSistema.find(u => u.id === id);
      const emailAlvo = targetUser?.email || '';

      await addDoc(collection(db, 'audit_logs'), {
        acao: 'EXCLUSAO_COLABORADOR',
        emailAlvo,
        dataHora: new Date().toISOString(),
        adminResponsavel: auth.currentUser?.email || 'anonymous'
      });

      await deleteDoc(doc(db, 'usuarios_sistema', id));
      setNotification('Utilizador removido com sucesso.');
    } catch (err) {
      console.error("Erro ao remover utilizador:", err);
      handleFirestoreError(err, OperationType.DELETE, 'usuarios_sistema');
      throw err;
    }
  };

  const updateUsuarioSistema = async (user: UsuarioSistema) => {
    if (isQuotaExceeded) {
      const updatedList = usuariosSistema.map((u) => (u.id === user.id ? user : u));
      setUsuariosSistema(updatedList);
      localStorage.setItem('contingency_users', JSON.stringify(updatedList));
      setNotification(`Utilizador '${user.nome}' atualizado com sucesso (Contingência Local).`);
      return;
    }

    try {
      const updatedUser = { ...user, id: user.id };
      await setDoc(doc(db, 'usuarios_sistema', user.id), updatedUser);
      setNotification(`Utilizador '${user.nome}' atualizado com sucesso.`);
    } catch (err) {
      console.error("Erro ao atualizar utilizador:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'usuarios_sistema');
      throw err;
    }
  };

  const updateProfissional = async (updatedProf: Profissional, skipNotification?: boolean) => {
    if (isQuotaExceeded) {
      const updatedList = profissionais.map((p) => (p.id === updatedProf.id ? updatedProf : p));
      setProfissionais(updatedList);
      localStorage.setItem('contingency_profissionais', JSON.stringify(updatedList));
      if (!skipNotification) {
        setNotification(`Cuidador '${updatedProf.nome}' atualizado com sucesso (Contingência Local).`);
      }
      return;
    }

    try {
      await setDoc(doc(db, 'profissionais', updatedProf.id), updatedProf);
      await addAuditLog('UPDATE', 'profissionais', updatedProf.id, `Profissional atualizado: ${updatedProf.nome}`).catch(() => {});
      if (!skipNotification) {
        setNotification(`Cuidador '${updatedProf.nome}' atualizado com sucesso.`);
      }
      setProfissionais(prev => prev.map(p => p.id === updatedProf.id ? updatedProf : p));
    } catch (err) {
      console.warn("Aviso no updateProfissional (usando fallback local):", err);
      setProfissionais(prev => prev.map(p => p.id === updatedProf.id ? updatedProf : p));
      try {
        const currentList = JSON.parse(localStorage.getItem('contingency_profissionais') || '[]');
        const updatedList = currentList.map((p: any) => p.id === updatedProf.id ? updatedProf : p);
        localStorage.setItem('contingency_profissionais', JSON.stringify(updatedList));
      } catch (e) {}
      if (!skipNotification) {
        setNotification(`Cuidador '${updatedProf.nome}' atualizado com sucesso.`);
      }
    }
  };

  const deleteProfissional = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = profissionais.filter((p) => p.id !== id);
      setProfissionais(updatedList);
      localStorage.setItem('contingency_profissionais', JSON.stringify(updatedList));
      setNotification('Cuidador excluído com sucesso (Contingência Local).');
      return;
    }

    try {
      await deleteDoc(doc(db, 'profissionais', id));
      await addAuditLog('DELETE', 'profissionais', id, `Profissional excluído`);
      setNotification('Cuidador excluído com sucesso.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `profissionais/${id}`);
      throw err;
    }
  };

  const deletePaciente = async (id: string) => {
    const todayStr = new Date().toLocaleDateString('pt-BR');

    if (isQuotaExceeded) {
      const updatedList = pacientes.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'Desativado' as const,
              desativadoEm: todayStr,
              desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
            }
          : p
      );
      setPacientes(updatedList);
      localStorage.setItem('contingency_pacientes', JSON.stringify(updatedList));
      setNotification('Paciente desativado logicamente com sucesso (Contingência Local).');
      return;
    }

    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Desativado',
        desativadoEm: todayStr,
        desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
      });
      setPacientes((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                status: 'Desativado',
                desativadoEm: todayStr,
                desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
              }
            : p
        )
      );
      await addAuditLog('DELETE', 'pacientes', id, `Paciente inativado via exclusão lógica`);
      fetchCounts();
      setNotification('Paciente desativado logicamente com sucesso.');
    } catch (err) {
      console.error("Erro na exclusão lógica:", err);
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const addDebitoProfissional = async (debito: Omit<DebitoProfissional, 'id'>) => {
    const id = `deb-${Date.now()}`;
    const dataToSave: DebitoProfissional = {
      ...debito,
      id,
      status: debito.status || 'pendente'
    };

    if (isQuotaExceeded) {
      const updatedList = [dataToSave, ...debitosProfissionais];
      setDebitosProfissionais(updatedList);
      localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
      setNotification(`Débito de R$ ${debito.valor} registrado com sucesso para ${debito.nomeProfissional} (Contingência Local).`);
      return dataToSave;
    }

    try {
      const docRef = await addDoc(collection(db, 'debitos_profissionais'), dataToSave);
      await addAuditLog('CREATE', 'debitos_profissionais', docRef.id, `Débito adicionado para o profissional ${debito.nomeProfissional}: R$ ${debito.valor}`);

      try {
        let dateStr = '';
        if (!debito.data) {
          dateStr = new Date().toISOString().split('T')[0];
        } else {
          try {
            let dObj: Date = new Date();
            if (typeof debito.data.toDate === 'function') {
              dObj = debito.data.toDate();
            } else if (debito.data instanceof Date) {
              dObj = debito.data;
            } else if (debito.data.seconds) {
              dObj = new Date(debito.data.seconds * 1000);
            } else if (typeof debito.data === 'string') {
              dateStr = debito.data.includes('T') ? debito.data.split('T')[0] : debito.data;
            } else {
              dObj = new Date(debito.data);
            }
            if (!dateStr) {
              const y = dObj.getFullYear();
              const m = String(dObj.getMonth() + 1).padStart(2, '0');
              const d = String(dObj.getDate()).padStart(2, '0');
              dateStr = `${y}-${m}-${d}`;
            }
          } catch (e) {
            dateStr = new Date().toISOString().split('T')[0];
          }
        }

        await addDoc(collection(db, 'profissionais', debito.idProfissional, 'ocorrencias'), {
          data: dateStr,
          paciente: debito.nomePaciente || 'Não se aplica',
          pacienteNome: debito.nomePaciente || 'Não se aplica',
          pacienteId: debito.idPaciente || 'n/a',
          descricao: 'Débito lançado via sistema. Motivo: ' + debito.motivo + ' | Valor: R$ ' + debito.valor,
          tipo: 'automatica_debito',
          bloquearEscala: false,
          debitoIdOriginado: docRef.id,
          valor: Number(debito.valor),
          mesAno: dateStr.substring(0, 7),
          timestamp: serverTimestamp()
        });
      } catch (errOc) {
        console.error("Erro ao gerar ocorrência automática de débito:", errOc);
      }

      setNotification(`Débito de R$ ${debito.valor} registrado com sucesso para ${debito.nomeProfissional}.`);
      return { ...dataToSave, id: docRef.id } as DebitoProfissional;
    } catch (err) {
      console.error("Erro ao adicionar débito:", err);
      if (handleQuotaError(err, 'addDebitoProfissional')) {
        const updatedList = [dataToSave, ...debitosProfissionais];
        setDebitosProfissionais(updatedList);
        localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
        setNotification(`Débito de R$ ${debito.valor} registrado com sucesso para ${debito.nomeProfissional} (Contingência Local).`);
        return dataToSave;
      }
      handleFirestoreError(err, OperationType.CREATE, 'debitos_profissionais');
      throw err;
    }
  };

  const deleteDebitoProfissional = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = debitosProfissionais.filter((d) => d.id !== id);
      setDebitosProfissionais(updatedList);
      localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
      setNotification('Débito removido com sucesso (Contingência Local).');
      return;
    }

    try {
      try {
        const debSnap = await getDoc(doc(db, 'debitos_profissionais', id));
        if (debSnap.exists()) {
          const debData = debSnap.data();
          if (debData && debData.idProfissional) {
            const oclRef = collection(db, 'profissionais', debData.idProfissional, 'ocorrencias');
            const q = query(oclRef, where('debitoIdOriginado', '==', id));
            const qSnap = await getDocs(q);
            for (const docSnap of qSnap.docs) {
              await deleteDoc(doc(db, 'profissionais', debData.idProfissional, 'ocorrencias', docSnap.id));
            }
          }
        }
      } catch (errRevert) {
        console.error("Erro na reversão automática de ocorrência de débito:", errRevert);
      }

      await deleteDoc(doc(db, 'debitos_profissionais', id));
      await addAuditLog('DELETE', 'debitos_profissionais', id, `Débito excluído`);
      setNotification('Débito removido com sucesso.');
    } catch (err) {
      console.error("Erro ao remover débito:", err);
      if (handleQuotaError(err, 'deleteDebitoProfissional')) {
        const updatedList = debitosProfissionais.filter((d) => d.id !== id);
        setDebitosProfissionais(updatedList);
        localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
        setNotification('Débito removido com sucesso (Contingência Local).');
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, `debitos_profissionais/${id}`);
      throw err;
    }
  };

  const updateDebitoProfissional = async (debito: DebitoProfissional) => {
    if (isQuotaExceeded) {
      const updatedList = debitosProfissionais.map((d) => (d.id === debito.id ? debito : d));
      setDebitosProfissionais(updatedList);
      localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
      setNotification(`Débito de R$ ${debito.valor} atualizado com sucesso (Contingência Local).`);
      return;
    }

    try {
      await setDoc(doc(db, 'debitos_profissionais', debito.id), debito);
      await addAuditLog('UPDATE', 'debitos_profissionais', debito.id, `Débito atualizado para o profissional ${debito.nomeProfissional}: R$ ${debito.valor}`);
      setNotification(`Débito de R$ ${debito.valor} atualizado com sucesso.`);
    } catch (err) {
      console.error("Erro ao atualizar débito:", err);
      if (handleQuotaError(err, 'updateDebitoProfissional')) {
        const updatedList = debitosProfissionais.map((d) => (d.id === debito.id ? debito : d));
        setDebitosProfissionais(updatedList);
        localStorage.setItem('contingency_debitos', JSON.stringify(updatedList));
        setNotification(`Débito de R$ ${debito.valor} atualizado com sucesso (Contingência Local).`);
        return;
      }
      handleFirestoreError(err, OperationType.UPDATE, `debitos_profissionais/${debito.id}`);
      throw err;
    }
  };

  const removeUndefinedDeep = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(removeUndefinedDeep);
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = removeUndefinedDeep(val);
      }
    }
    return clean;
  };

  const addFaturaPaciente = async (fatura: Omit<FaturaPaciente, 'id'>) => {
    const id = `fat-${Date.now()}`;
    const cleanedFatura = removeUndefinedDeep(fatura);
    const dataToSave: FaturaPaciente = { ...cleanedFatura, id };

    if (isQuotaExceeded) {
      const updatedList = [dataToSave, ...faturasPacientes];
      setFaturasPacientes(updatedList);
      localStorage.setItem('contingency_faturas', JSON.stringify(updatedList));
      setNotification('Fatura salva com sucesso (Contingência Local).');
      return dataToSave;
    }

    try {
      const docRef = await addDoc(collection(db, 'faturas_pacientes'), cleanedFatura);
      await addAuditLog('CREATE', 'faturas_pacientes', docRef.id, `Fatura criada para paciente ${cleanedFatura.nomePaciente || cleanedFatura.pacienteNome || ''}: ${cleanedFatura.numeroFatura || id}`);
      setNotification('Fatura salva com sucesso.');
      const newFatura = { id: docRef.id, ...cleanedFatura } as FaturaPaciente;
      setFaturasPacientes(prev => [newFatura, ...prev.filter(f => f.id !== docRef.id)]);
      return newFatura;
    } catch (err) {
      console.error("Erro ao salvar fatura:", err);
      if (handleQuotaError(err, 'addFaturaPaciente')) {
        const updatedList = [dataToSave, ...faturasPacientes];
        setFaturasPacientes(updatedList);
        localStorage.setItem('contingency_faturas', JSON.stringify(updatedList));
        setNotification('Fatura salva com sucesso (Contingência Local).');
        return dataToSave;
      }
      handleFirestoreError(err, OperationType.CREATE, 'faturas_pacientes');
      throw err;
    }
  };

  const deleteFaturaPaciente = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = faturasPacientes.filter((f) => f.id !== id);
      setFaturasPacientes(updatedList);
      localStorage.setItem('contingency_faturas', JSON.stringify(updatedList));
      setNotification('Fatura removida com sucesso (Contingência Local).');
      return;
    }

    try {
      await deleteDoc(doc(db, 'faturas_pacientes', id));
      await addAuditLog('DELETE', 'faturas_pacientes', id, `Fatura excluída`);
      setNotification('Fatura removida com sucesso.');
    } catch (err) {
      console.error("Erro ao remover fatura:", err);
      if (handleQuotaError(err, 'deleteFaturaPaciente')) {
        const updatedList = faturasPacientes.filter((f) => f.id !== id);
        setFaturasPacientes(updatedList);
        localStorage.setItem('contingency_faturas', JSON.stringify(updatedList));
        setNotification('Fatura removida com sucesso (Contingência Local).');
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, `faturas_pacientes/${id}`);
      throw err;
    }
  };

  const addServicoExtra = async (servico: Omit<ServicoExtra, 'id'>): Promise<ServicoExtra> => {
    const dataToSave = {
      ...servico,
      createdAt: new Date().toISOString()
    };
    if (isTestMode || isQuotaExceeded) {
      const newServ = { id: 'serv_' + Date.now(), ...dataToSave };
      setServicosExtras(prev => [newServ, ...prev]);
      return newServ;
    }
    try {
      const docRef = await addDoc(collection(db, 'servicos_extras'), dataToSave);
      await addAuditLog('CREATE', 'servicos_extras', docRef.id, `Serviço extra adicionado para paciente ${servico.idPaciente}: ${servico.descricao}`);
      return { id: docRef.id, ...dataToSave };
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'servicos_extras');
      const fallback = { id: 'serv_' + Date.now(), ...dataToSave };
      setServicosExtras(prev => [fallback, ...prev]);
      return fallback;
    }
  };

  const deleteServicoExtra = async (id: string): Promise<void> => {
    if (isTestMode || isQuotaExceeded) {
      setServicosExtras(prev => prev.filter(s => s.id !== id));
      return;
    }
    try {
      await deleteDoc(doc(db, 'servicos_extras', id));
      await addAuditLog('DELETE', 'servicos_extras', id, `Serviço extra excluído`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `servicos_extras/${id}`);
      setServicosExtras(prev => prev.filter(s => s.id !== id));
    }
  };

  const deleteFolhaPagamento = async (id: string) => {
    if (isQuotaExceeded) {
      const updatedList = folhasPagamento.filter((f) => f.id !== id);
      setFolhasPagamento(updatedList);
      localStorage.setItem('contingency_folhas', JSON.stringify(updatedList));
      setNotification('Folha removida com sucesso (Contingência Local).');
      return;
    }

    try {
      await deleteDoc(doc(db, 'folhas_pagamento', id));
      await addAuditLog('DELETE', 'folhas_pagamento', id, `Folha excluída`);
      setNotification('Folha removida com sucesso.');
    } catch (err) {
      console.error("Erro ao remover folha:", err);
      if (handleQuotaError(err, 'deleteFolhaPagamento')) {
        const updatedList = folhasPagamento.filter((f) => f.id !== id);
        setFolhasPagamento(updatedList);
        localStorage.setItem('contingency_folhas', JSON.stringify(updatedList));
        setNotification('Folha removida com sucesso (Contingência Local).');
        return;
      }
      handleFirestoreError(err, OperationType.DELETE, `folhas_pagamento/${id}`);
      throw err;
    }
  };

  const compressImage = (file: File, maxWidth: number = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        }, 'image/jpeg', 0.6);
      };
      img.onerror = reject;
    });
  };

  const uploadLogo = async (file: File): Promise<string> => {
    if (isTestMode) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }

    let compressedBlob: Blob;
    try {
      compressedBlob = await compressImage(file, 180);
    } catch (e) {
      compressedBlob = file;
    }

    try {
      const storageRef = ref(storage, `logos/${file.name}`);
      const uploadPromise = uploadBytes(storageRef, compressedBlob).then(res => getDownloadURL(res.ref));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_STORAGE')), 2000)
      );
      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (error: any) {
      console.warn("Firebase Storage logo upload indisponível, usando fallback Base64:", error);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedBlob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }
  };

  const uploadProfissionalFoto = async (file: File): Promise<string> => {
    if (isTestMode) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }

    let compressedBlob: Blob;
    try {
      compressedBlob = await compressImage(file, 250);
    } catch (e) {
      compressedBlob = file;
    }

    try {
      const storageRef = ref(storage, `profissional_fotos/${Date.now()}_${file.name}`);
      const uploadPromise = uploadBytes(storageRef, compressedBlob).then(res => getDownloadURL(res.ref));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_STORAGE')), 2000)
      );
      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (error: any) {
      console.warn("Firebase Storage photo upload indisponível, usando fallback Base64 leve:", error);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(compressedBlob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }
  };

  const uploadPdf = async (file: File, path: string): Promise<string> => {
    if (isTestMode) {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }

    try {
      const storageRef = ref(storage, path);
      const uploadPromise = uploadBytes(storageRef, file).then(res => getDownloadURL(res.ref));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_STORAGE')), 2000)
      );
      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (err: any) {
      console.warn("Firebase Storage PDF upload indisponível, usando fallback Base64:", err);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }
  };

  const addFolhaPagamento = async (folha: Omit<FolhaPagamento, 'id'>) => {
    const id = `fol-${Date.now()}`;
    const cleanedFolha = removeUndefinedDeep(folha);
    const dataToSave: FolhaPagamento = { ...cleanedFolha, id };

    if (isQuotaExceeded) {
      const updatedList = [dataToSave, ...folhasPagamento];
      setFolhasPagamento(updatedList);
      localStorage.setItem('contingency_folhas', JSON.stringify(updatedList));
      setNotification('Folha fechada com sucesso (Contingência Local).');
      return dataToSave;
    }

    try {
      const docRef = await addDoc(collection(db, 'folhas_pagamento'), cleanedFolha);
      await addAuditLog('CREATE', 'folhas_pagamento', docRef.id, `Folha fechada para profissional ${cleanedFolha.nomeProfissional}`);
      setNotification('Folha fechada com sucesso.');
      const newFolha = { id: docRef.id, ...cleanedFolha } as FolhaPagamento;
      setFolhasPagamento(prev => [newFolha, ...prev.filter(f => f.id !== docRef.id)]);
      return newFolha;
    } catch (err) {
      console.error("Erro ao fechar folha:", err);
      if (handleQuotaError(err, 'addFolhaPagamento')) {
        const updatedList = [dataToSave, ...folhasPagamento];
        setFolhasPagamento(updatedList);
        localStorage.setItem('contingency_folhas', JSON.stringify(updatedList));
        setNotification('Folha fechada com sucesso (Contingência Local).');
        return dataToSave;
      }
      handleFirestoreError(err, OperationType.CREATE, 'folhas_pagamento');
      throw err;
    }
  };

  const seedDatabase = async () => {
    if (isTestMode) {
      localStorage.removeItem('sandbox_pacientes');
      localStorage.removeItem('sandbox_plantoes');
      localStorage.removeItem('sandbox_agendamentos');
      localStorage.removeItem('sandbox_profissionais');
      localStorage.removeItem('sandbox_debitos');
      localStorage.removeItem('sandbox_faturas');
      localStorage.removeItem('sandbox_folhas');
      localStorage.removeItem('sandbox_logs');
      localStorage.removeItem('sandbox_users');
      loadSandboxData();
      setNotification("Dados simulados do Modo de Testes restaurados com sucesso!");
      return;
    }

    try {
      setNotification("Populando banco de dados com dados de demonstração...");
      
      await setDoc(doc(db, 'configuracoes_empresa', 'empresa'), {
        id: 'empresa',
        razaoSocial: 'RH Gestão Domiciliar',
        cnpj: '12.345.678/0001-99',
        endereco: 'Avenida Atlântica, 1720, Copacabana, Rio de Janeiro - RJ',
        logoUrl: '',
        dominiosAutorizados: ['gmail.com'],
        updatedAt: new Date().toISOString()
      });

      await setDoc(doc(db, 'usuarios_sistema', 'user-renato'), {
        id: 'user-renato',
        nome: 'Renato B. Z.',
        email: 'renatobz@gmail.com',
        nivelAcesso: 'Administrador',
        status: 'Ativo'
      });

      for (const p of INITIAL_PACIENTES) {
        await setDoc(doc(db, 'pacientes', p.id), p);
      }

      const mappedProfessionals: Profissional[] = INITIAL_PROFESSIONALS.map((prof) => ({
        id: prof.id,
        nome: prof.name,
        especialidade: prof.role,
        telefone: prof.tel,
        status: 'Ativo',
        createdAt: new Date().toISOString(),
        ativo: true,
        profissao: prof.role.includes('Médica') ? 'Médica(o)' : prof.role.includes('Enfermagem') ? 'Téc. Enfermagem' : prof.role.includes('Enfermeira') ? 'Enfermeira(o)' : prof.role.includes('Fisioterapeuta') ? 'Fisioterapeuta' : 'Cuidadora(o)',
      }));
      for (const prof of mappedProfessionals) {
        await setDoc(doc(db, 'profissionais', prof.id), prof);
      }

      for (const plant of INITIAL_PLANTOES) {
        await setDoc(doc(db, 'plantoes', plant.id), plant);
      }

      await fetchCounts();
      await fetchFirstPagePacientes();

      setNotification("Banco de dados populado com sucesso!");
    } catch (err: any) {
      console.error("Error seeding database:", err);
      setNotification("Erro ao popular banco de dados.");
      toast.error("Erro ao popular banco de dados: " + (err.message || String(err)));
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        isTestMode,
        isSandbox: isTestMode,
        toggleTestMode,
        pacientes,
        isQuotaExceeded,
        loadingPacientes,
        hasMore,
        loadMorePacientes,
        fetchFirstPagePacientes,
        fetchNextPage,
        fetchPreviousPage,
        hasPreviousPage,
        totalPacientes,
        fetchCounts,
        plantoes,
        agendamentos,
        loading,
        user,
        userRole,
        setUserRole: handleSetUserRole,
        notification,
        setNotification,
        login,
        activateAccount,
        logout,
        forgotPassword,
        addPaciente,
        updatePaciente,
        deactivatePaciente,
        reactivatePaciente,
        cancelPlantao,
        addPlantao,
        updatePlantao,
        deletePlantao,
        deletePlantoes,
        addAgendamento,
        addAgendamentosBatch,
        updateAgendamento,
        updateAgendamentosBatch,
        deleteAgendamento,
        deleteAgendamentosBatch,
        deletePaciente,
        profissionais,
        usuariosSistema,
        addProfissional,
        updateProfissional,
        deleteProfissional,
        addUsuarioSistema,
        deleteUsuarioSistema,
        updateUsuarioSistema,
        debitosProfissionais,
        addDebitoProfissional,
        updateDebitoProfissional,
        deleteDebitoProfissional,
        faturasPacientes,
        deleteFaturaPaciente,
        servicosExtras,
        addServicoExtra,
        deleteServicoExtra,
        deleteFolhaPagamento,
        uploadLogo,
        uploadProfissionalFoto,
        uploadPdf,
        addFaturaPaciente,
        folhasPagamento,
        addFolhaPagamento,
        logsAuditoria,
        addAuditLog,
        seedDatabase,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
