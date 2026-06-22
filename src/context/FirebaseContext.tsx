/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Paciente, Plantao, Profissional, CancelingReason, AuditLog, Agendamento, UsuarioSistema, DebitoProfissional, FaturaPaciente, FolhaPagamento } from '../types';
import { INITIAL_PACIENTES, INITIAL_PLANTOES } from '../mockData';
import { db, auth, storage, OperationType, handleFirestoreError } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail, sendEmailVerification, User } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  getDocFromServer,
  getDoc,
  serverTimestamp,
  query,
  where,
  orderBy
} from 'firebase/firestore';

interface FirebaseContextType {
  pacientes: Paciente[];
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
  addPaciente: (paciente: Omit<Paciente, 'id' | 'createdAt' | 'status'>) => Promise<Paciente>;
  updatePaciente: (paciente: Paciente) => Promise<void>;
  deactivatePaciente: (id: string, motivo: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;
  cancelPlantao: (id: string, motivo: CancelingReason) => Promise<void>;
  addPlantao: (plantao: Omit<Plantao, 'id'>) => Promise<Plantao>;
  updatePlantao: (plantao: Plantao) => Promise<void>;
  deletePlantao: (id: string) => Promise<void>;
  deletePlantoes: (ids: string[]) => Promise<void>;
  addAgendamento: (agendamento: Omit<Agendamento, 'id'>) => Promise<Agendamento>;
  updateAgendamento: (agendamento: Agendamento) => Promise<void>;
  deleteAgendamento: (id: string) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
  addProfissional: (profissional: Omit<Profissional, 'id' | 'createdAt' | 'status'>) => Promise<Profissional>;
  addUsuarioSistema: (user: Omit<UsuarioSistema, 'id'>) => Promise<UsuarioSistema>;
  deleteUsuarioSistema: (id: string) => Promise<void>;
  updateUsuarioSistema: (user: UsuarioSistema) => Promise<void>;
  updateProfissional: (profissional: Profissional) => Promise<void>;
  deleteProfissional: (id: string) => Promise<void>;
  debitosProfissionais: DebitoProfissional[];
  addDebitoProfissional: (debito: Omit<DebitoProfissional, 'id'>) => Promise<DebitoProfissional>;
  updateDebitoProfissional: (debito: DebitoProfissional) => Promise<void>;
  deleteDebitoProfissional: (id: string) => Promise<void>;
  faturasPacientes: FaturaPaciente[];
  addFaturaPaciente: (fatura: Omit<FaturaPaciente, 'id'>) => Promise<FaturaPaciente>;
  folhasPagamento: FolhaPagamento[];
  addFolhaPagamento: (folha: Omit<FolhaPagamento, 'id'>) => Promise<FolhaPagamento>;
  deleteFaturaPaciente: (id: string) => Promise<void>;
  deleteFolhaPagamento: (id: string) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  uploadProfissionalFoto: (file: File) => Promise<string>;
  uploadPdf: (file: File, path: string) => Promise<string>;
  logsAuditoria: AuditLog[];
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [debitosProfissionais, setDebitosProfissionais] = useState<DebitoProfissional[]>([]);
  const [faturasPacientes, setFaturasPacientes] = useState<FaturaPaciente[]>([]);
  const [folhasPagamento, setFolhasPagamento] = useState<FolhaPagamento[]>([]);
  const [logsAuditoria, setLogsAuditoria] = useState<AuditLog[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Authentication State Observer
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        const emailLower = currentUser.email?.toLowerCase();
        
        // Guard for email verification (exempting the bootstrap developer/admin email)
        if (!currentUser.emailVerified && emailLower !== 'renatobz@gmail.com') {
          await signOut(auth);
          alert('Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.');
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
              alert('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
              setUser(null);
              setLoading(false);
              return;
            } else {
              const docData = querySnapshot.docs[0].data();
              if (docData && docData.status === 'Inativo') {
                await signOut(auth);
                alert('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
                setUser(null);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.error("Erro na validação do Anti-Ghost Login:", e);
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
      alert('Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.');
      return;
    }
  };
  const activateAccount = async (email: string, pass: string) => {
    const usersRef = collection(db, 'usuarios_sistema');
    // Buscamos se existe usuário cadastrado com esse email e status == 'Ativo'
    const q = query(usersRef, where('email', '==', email), where('status', '==', 'Ativo'));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        throw new Error('⚠️ Acesso Negado: Este e-mail não está autorizado pelo administrador da empresa.');
    }
    // Cria credencial no Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      await sendEmailVerification(userCredential.user);
    }
    // Como criar um usuário faz ele logar automaticamente na mesma hora, fazemos signOut para não pular a tela de login
    await signOut(auth);
    setNotification('Acesso criado! Um e-mail de verificação oficial foi enviado para o colaborador.');
    alert('Acesso criado! Um e-mail de verificação oficial foi enviado para o colaborador.');
  };
  const logout = async () => { await signOut(auth); };
  const forgotPassword = async (email: string) => { await sendPasswordResetEmail(auth, email); };
  const [userRole, setUserRole] = useState<'Administrador' | 'Colaborador'>('Administrador');
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (user && user.email) {
      const emailLower = user.email.toLowerCase();
      
      // Anti-Ghost: Real-time Check
      if (usuariosSistema.length > 0) {
        const usuario = usuariosSistema.find(u => u.email?.toLowerCase() === emailLower);
        if (!usuario && emailLower !== 'renatobz@gmail.com') {
          signOut(auth).then(() => {
            alert('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
          });
          return;
        }
        if (usuario && usuario.status === 'Inativo' && emailLower !== 'renatobz@gmail.com') {
          signOut(auth).then(() => {
            alert('Acesso Bloqueado: Esta conta foi desativada ou excluída pelo administrador.');
          });
          return;
        }

        // 1. Maintain userRole state in sync with real-time list
        if (usuario) {
          const rawRole = usuario.nivelAcesso?.toLowerCase();
          if (rawRole === 'colaborador') {
            setUserRole('Colaborador');
          } else {
            setUserRole('Administrador');
          }
        } else {
          if (emailLower === 'renatobz@gmail.com') {
            setUserRole('Administrador');
          }
        }
      } else {
        // Safe default on empty list for the main developer
        if (emailLower === 'renatobz@gmail.com') {
          setUserRole('Administrador');
        }
      }

      // 2. Auto-bootstrap the current logged-in user in Firestore if they are 'renatobz@gmail.com'
      if (emailLower === 'renatobz@gmail.com') {
        const found = usuariosSistema.find(u => u.email?.toLowerCase() === emailLower);
        if (!found && usuariosSistema.length > 0) {
          const id = `user-${Date.now()}`;
          setDoc(doc(db, 'usuarios_sistema', id), {
            id,
            nome: 'Renato B. Z.',
            email: 'renatobz@gmail.com',
            nivelAcesso: 'Administrador',
            status: 'Ativo'
          }).catch(err => console.error("Error bootstrapping admin user in Firestore:", err));
        } else if (found && (found.nivelAcesso !== 'Administrador' || found.status !== 'Ativo')) {
          updateDoc(doc(db, 'usuarios_sistema', found.id), {
            nivelAcesso: 'Administrador',
            status: 'Ativo'
          }).catch(err => console.error("Error correcting admin user level in Firestore:", err));
        }
      }
    }
  }, [user, usuariosSistema]);

  const handleSetUserRole = (role: 'Administrador' | 'Colaborador') => {
    setUserRole(role);
  };

  // Perform Background Authentication and Real-time Live Firestore Mirroring
  useEffect(() => {
    let unsubscribePacientes: (() => void) | null = null;
    let unsubscribePlantoes: (() => void) | null = null;
    let unsubscribeAgendamentos: (() => void) | null = null;
    let unsubscribeProfissionais: (() => void) | null = null;
    let unsubscribeUsuariosSistema: (() => void) | null = null;
    let unsubscribeDebitosProfissionais: (() => void) | null = null;
    let unsubscribeFaturasPacientes: (() => void) | null = null;
    let unsubscribeFolhasPagamento: (() => void) | null = null;
    let unsubscribeLogsAuditoria: (() => void) | null = null;

    const initFirebaseSync = async () => {
      // 1. Validate connection on initial boot
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (connErr) {
        if (connErr instanceof Error && connErr.message.toLowerCase().includes('offline')) {
          console.error("Please check your Firebase configuration.");
        } else {
          console.log("Firestore initialized. Live mirroring active. Database is connecting dynamically.");
        }
      }

      // 2. Seed Firestore database automatically if empty
      try {
        const pSnap = await getDocs(collection(db, 'pacientes'));
        if (pSnap.empty) {
          for (const item of INITIAL_PACIENTES) {
            await setDoc(doc(db, 'pacientes', item.id), item);
          }
        }

        const plSnap = await getDocs(collection(db, 'plantoes'));
        if (plSnap.empty) {
          for (const item of INITIAL_PLANTOES) {
            await setDoc(doc(db, 'plantoes', item.id), item);
          }
        }
      } catch (seedErr) {
        console.warn("Skipped Firebase seeding:", seedErr);
      }

      // 3. Real-time Subscription to collections
      unsubscribePacientes = onSnapshot(collection(db, 'pacientes'), (snap) => {
        const list: Paciente[] = [];
        snap.forEach((d) => list.push(d.data() as Paciente));
        setPacientes(list);
        setLoading(false);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'pacientes'));

      unsubscribePlantoes = onSnapshot(collection(db, 'plantoes'), (snap) => {
        const list: Plantao[] = [];
        snap.forEach((d) => list.push(d.data() as Plantao));
        setPlantoes(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'plantoes'));

      unsubscribeAgendamentos = onSnapshot(collection(db, 'agendamentos'), (snap) => {
        const list: Agendamento[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Agendamento));
        setAgendamentos(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'agendamentos'));

      unsubscribeProfissionais = onSnapshot(collection(db, 'profissionais'), (snap) => {
        const list: Profissional[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Profissional));
        setProfissionais(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'profissionais'));
      
      unsubscribeUsuariosSistema = onSnapshot(collection(db, 'usuarios_sistema'), (snap) => {
        const list: UsuarioSistema[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as UsuarioSistema));
        setUsuariosSistema(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'usuarios_sistema'));

      unsubscribeDebitosProfissionais = onSnapshot(collection(db, 'debitos_profissionais'), (snap) => {
        const list: DebitoProfissional[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as DebitoProfissional));
        setDebitosProfissionais(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'debitos_profissionais'));

      unsubscribeFaturasPacientes = onSnapshot(collection(db, 'faturas_pacientes'), (snap) => {
        const list: FaturaPaciente[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as FaturaPaciente));
        setFaturasPacientes(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'faturas_pacientes'));

      unsubscribeFolhasPagamento = onSnapshot(collection(db, 'folhas_pagamento'), (snap) => {
        const list: FolhaPagamento[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as FolhaPagamento));
        setFolhasPagamento(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'folhas_pagamento'));

      unsubscribeLogsAuditoria = onSnapshot(collection(db, 'LogsAuditoria'), (snap) => {
        const list: AuditLog[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as AuditLog));
        setLogsAuditoria(list);
      }, (error) => handleFirestoreError(error, OperationType.GET, 'LogsAuditoria'));
    };

    initFirebaseSync();

    return () => {
      if (unsubscribePacientes) unsubscribePacientes();
      if (unsubscribePlantoes) unsubscribePlantoes();
      if (unsubscribeAgendamentos) unsubscribeAgendamentos();
      if (unsubscribeProfissionais) unsubscribeProfissionais();
      if (unsubscribeUsuariosSistema) unsubscribeUsuariosSistema();
      if (unsubscribeDebitosProfissionais) unsubscribeDebitosProfissionais();
      if (unsubscribeFaturasPacientes) unsubscribeFaturasPacientes();
      if (unsubscribeFolhasPagamento) unsubscribeFolhasPagamento();
      if (unsubscribeLogsAuditoria) unsubscribeLogsAuditoria();
    };
  }, []);

  // Update localStorage back cache passively for robust standalone offline mode
  useEffect(() => {
    if (pacientes.length > 0) {
      localStorage.setItem('firebase_simulated_pacientes', JSON.stringify(pacientes));
    }
  }, [pacientes]);

  useEffect(() => {
    if (plantoes.length > 0) {
      localStorage.setItem('firebase_simulated_plantoes', JSON.stringify(plantoes));
    }
  }, [plantoes]);

  useEffect(() => {
    if (profissionais.length >= 0) {
      localStorage.setItem('firebase_simulated_profissionais', JSON.stringify(profissionais));
    }
  }, [profissionais]);

  const addAuditLog = async (
    action: AuditLog['action'],
    collectionName: string,
    documentId: string,
    description: string
  ) => {
    try {
      const log: AuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'anonymous',
        action,
        collection: collectionName,
        documentId,
        description,
      };
      await setDoc(doc(db, 'LogsAuditoria', log.id), log);
    } catch (err) {
      console.error("Erro ao registrar log de auditoria:", err);
    }
  };

  const addPaciente = async (newPac: Omit<Paciente, 'id' | 'createdAt' | 'status'>) => {
    const id = `pac-${Date.now()}`;
    const fullPaciente: Paciente = {
      ...newPac,
      id,
      status: 'Ativo',
      createdAt: new Date().toISOString(),
      desativadoEm: null,
      desativadoMotivo: null,
    };

    try {
      console.log(`[Firebase] setDoc, paciente id: ${id}`);
      await setDoc(doc(db, 'pacientes', id), fullPaciente);
      await addAuditLog('CREATE', 'pacientes', id, `Paciente criado: ${fullPaciente.nome}`);
      setNotification(`Paciente '${fullPaciente.nome}' criado com sucesso.`);
      return fullPaciente;
    } catch (err) {
      console.error(`[Firebase] Erro setDoc: ${err}`);
      handleFirestoreError(err, OperationType.CREATE, `pacientes/${id}`);
      throw err;
    }
  };

  const updatePaciente = async (updatedPac: Paciente) => {
    try {
      await setDoc(doc(db, 'pacientes', updatedPac.id), updatedPac);
      await addAuditLog('UPDATE', 'pacientes', updatedPac.id, `Paciente atualizado: ${updatedPac.nome}`);
      setNotification(`Paciente '${updatedPac.nome}' atualizado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${updatedPac.id}`);
      throw err;
    }
  };

  const deactivatePaciente = async (id: string, motivo: string) => {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Desativado',
        desativadoEm: todayStr,
        desativadoMotivo: motivo,
      });
      await addAuditLog('UPDATE', 'pacientes', id, `Paciente desativado: ${motivo}`);
      setNotification(`Paciente desativado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const reactivatePaciente = async (id: string) => {
    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Ativo',
        desativadoEm: null,
        desativadoMotivo: null,
      });
      setNotification(`Paciente reativado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const cancelPlantao = async (id: string, motivo: CancelingReason) => {
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

    try {
      console.log(`[Firebase] Adding plantao: ${id} for patient: ${newPlantao.pacienteId}`);
      await setDoc(doc(db, 'plantoes', id), fullPlantao);
      await addAuditLog('CREATE', 'plantoes', id, `Plantão criado para paciente: ${newPlantao.pacienteId}`);
      setNotification(`Plantão criado com sucesso.`);
      return fullPlantao;
    } catch (err) {
      console.error('[Firebase] Error adding plantao:', id, err);
      handleFirestoreError(err, OperationType.CREATE, `plantoes/${id}`);
      throw err;
    }
  };

  const updatePlantao = async (updatedPlantao: Plantao) => {
    try {
      console.log(`[Firebase] Updating plantao: ${updatedPlantao.id}`);
      await setDoc(doc(db, 'plantoes', updatedPlantao.id), updatedPlantao);
      await addAuditLog('UPDATE', 'plantoes', updatedPlantao.id, `Plantão atualizado`);
      setNotification(`Plantão atualizado com sucesso.`);
    } catch (err) {
      console.error('[Firebase] Error updating plantao:', updatedPlantao.id, err);
      handleFirestoreError(err, OperationType.UPDATE, `plantoes/${updatedPlantao.id}`);
      throw err;
    }
  };

  const deletePlantao = async (id: string) => {
    try {
      console.log(`[Firebase] Deleting plantao: ${id}`);
      await deleteDoc(doc(db, 'plantoes', id));
      await addAuditLog('DELETE', 'plantoes', id, `Plantão excluído`);
      setNotification(`Plantão excluído com sucesso.`);
    } catch (err) {
      console.error('[Firebase] Error deleting plantao:', id, err);
      handleFirestoreError(err, OperationType.DELETE, `plantoes/${id}`);
      throw err;
    }
  };

  const deletePlantoes = async (ids: string[]) => {
    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.delete(doc(db, 'plantoes', id));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plantoes/batch`);
      throw err;
    }
  };

  const addAgendamento = async (newAg: Omit<Agendamento, 'id'>) => {
    try {
      const fullAgToSave = { ...newAg, status: 'Aberta' as const };
      const docRef = await addDoc(collection(db, 'agendamentos'), fullAgToSave);
      const fullAgendamento: Agendamento = { ...fullAgToSave, id: docRef.id };
      await addAuditLog('CREATE', 'agendamentos', docRef.id, `Agendamento criado: ${fullAgendamento.data}`);
      setNotification('Agendamento criado com sucesso.');
      return fullAgendamento;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'agendamentos');
      throw err;
    }
  };

  const updateAgendamento = async (ag: Agendamento) => {
    try {
      await setDoc(doc(db, 'agendamentos', ag.id), ag);
      await addAuditLog('UPDATE', 'agendamentos', ag.id, `Agendamento atualizado: ${ag.id}`);
      setNotification('Agendamento atualizado.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agendamentos/${ag.id}`);
      throw err;
    }
  };

  const deleteAgendamento = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'agendamentos', id));
      await addAuditLog('DELETE', 'agendamentos', id, `Agendamento excluído`);
      setNotification('Agendamento excluído.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `agendamentos/${id}`);
      throw err;
    }
  };

  const addProfissional = async (newProf: Omit<Profissional, 'id' | 'createdAt' | 'status'>) => {
    const id = `prof-${Date.now()}`;
    const fullProfissional: Profissional = {
      ...newProf,
      id,
      status: 'Ativo',
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'profissionais', id), fullProfissional);
      await addAuditLog('CREATE', 'profissionais', id, `Profissional criado: ${fullProfissional.nome}`);
      setNotification(`Cuidador '${fullProfissional.nome}' cadastrado com sucesso.`);
      return fullProfissional;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `profissionais/${id}`);
      throw err;
    }
  };

  const addUsuarioSistema = async (newUser: Omit<UsuarioSistema, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'usuarios_sistema'), newUser);
      const fullUser: UsuarioSistema = { ...newUser, id: docRef.id };
      setNotification(`Utilizador '${newUser.nome}' adicionado com sucesso.`);
      return fullUser;
    } catch (err) {
      console.error("Erro ao adicionar utilizador:", err);
      handleFirestoreError(err, OperationType.CREATE, 'usuarios_sistema');
      throw err;
    }
  };

  const deleteUsuarioSistema = async (id: string) => {
    try {
      const targetUser = usuariosSistema.find(u => u.id === id);
      const emailAlvo = targetUser?.email || '';

      // 1. ANTES de executar o deleteDoc, cria um registro na coleção audit_logs usando addDoc
      await addDoc(collection(db, 'audit_logs'), {
        acao: 'EXCLUSAO_COLABORADOR',
        emailAlvo,
        dataHora: new Date().toISOString(),
        adminResponsavel: auth.currentUser?.email || 'anonymous'
      });

      // 2. Só após o log ser salvo, executa a exclusão da ficha do colaborador no Firestore
      await deleteDoc(doc(db, 'usuarios_sistema', id));
      setNotification('Utilizador removido com sucesso.');
    } catch (err) {
      console.error("Erro ao remover utilizador:", err);
      handleFirestoreError(err, OperationType.DELETE, 'usuarios_sistema');
      throw err;
    }
  };

  const updateUsuarioSistema = async (user: UsuarioSistema) => {
    try {
      await setDoc(doc(db, 'usuarios_sistema', user.id), user);
      setNotification(`Utilizador '${user.nome}' atualizado com sucesso.`);
    } catch (err) {
      console.error("Erro ao atualizar utilizador:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'usuarios_sistema');
      throw err;
    }
  };

  const updateProfissional = async (updatedProf: Profissional) => {
    try {
      await setDoc(doc(db, 'profissionais', updatedProf.id), updatedProf);
      await addAuditLog('UPDATE', 'profissionais', updatedProf.id, `Profissional atualizado: ${updatedProf.nome}`);
      setNotification(`Cuidador '${updatedProf.nome}' atualizado com sucesso.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profissionais/${updatedProf.id}`);
      throw err;
    }
  };

  const deleteProfissional = async (id: string) => {
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
    console.log("Iniciando exclusão lógica do paciente:", id);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Desativado',
        desativadoEm: todayStr,
        desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
      });
      console.log("Exclusão lógica realizada com sucesso para:", id);
      setNotification('Paciente desativado logicamente com sucesso.');
    } catch (err) {
      console.error("Erro na exclusão lógica:", err);
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  const addDebitoProfissional = async (debito: Omit<DebitoProfissional, 'id'>) => {
    try {
      const dataToSave = {
        ...debito,
        status: debito.status || 'pendente'
      };
      const docRef = await addDoc(collection(db, 'debitos_profissionais'), dataToSave);
      await addAuditLog('CREATE', 'debitos_profissionais', docRef.id, `Débito adicionado para o profissional ${debito.nomeProfissional}: R$ ${debito.valor}`);

      // Auto-create occurrence in professional's subcollection
      try {
        let dateStr = '';
        if (!debito.data) {
          dateStr = new Date().toISOString().split('T')[0];
        } else {
          try {
            let dObj: Date;
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
      return { id: docRef.id, ...dataToSave } as DebitoProfissional;
    } catch (err) {
      console.error("Erro ao adicionar débito:", err);
      handleFirestoreError(err, OperationType.CREATE, 'debitos_profissionais');
      throw err;
    }
  };

  const deleteDebitoProfissional = async (id: string) => {
    try {
      // Fetch the debit first to find out which professional it belongs to
      try {
        const debSnap = await getDoc(doc(db, 'debitos_profissionais', id));
        if (debSnap.exists()) {
          const debData = debSnap.data();
          if (debData && debData.idProfissional) {
            // Find and delete the automatic ocorrencia for this debit
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
      handleFirestoreError(err, OperationType.DELETE, `debitos_profissionais/${id}`);
      throw err;
    }
  };

  const updateDebitoProfissional = async (debito: DebitoProfissional) => {
    try {
      await setDoc(doc(db, 'debitos_profissionais', debito.id), debito);
      await addAuditLog('UPDATE', 'debitos_profissionais', debito.id, `Débito atualizado para o profissional ${debito.nomeProfissional}: R$ ${debito.valor}`);
      setNotification(`Débito de R$ ${debito.valor} atualizado com sucesso.`);
    } catch (err) {
      console.error("Erro ao atualizar débito:", err);
      handleFirestoreError(err, OperationType.UPDATE, `debitos_profissionais/${debito.id}`);
      throw err;
    }
  };

  const addFaturaPaciente = async (fatura: Omit<FaturaPaciente, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'faturas_pacientes'), fatura);
      await addAuditLog('CREATE', 'faturas_pacientes', docRef.id, `Fatura criada para paciente ${fatura.nomePaciente}: ${fatura.numeroFatura}`);
      setNotification('Fatura salva com sucesso.');
      return { id: docRef.id, ...fatura } as FaturaPaciente;
    } catch (err) {
      console.error("Erro ao salvar fatura:", err);
      handleFirestoreError(err, OperationType.CREATE, 'faturas_pacientes');
      throw err;
    }
  };

  const deleteFaturaPaciente = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'faturas_pacientes', id));
      await addAuditLog('DELETE', 'faturas_pacientes', id, `Fatura excluída`);
      setNotification('Fatura removida com sucesso.');
    } catch (err) {
      console.error("Erro ao remover fatura:", err);
      handleFirestoreError(err, OperationType.DELETE, `faturas_pacientes/${id}`);
      throw err;
    }
  };

  const deleteFolhaPagamento = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'folhas_pagamento', id));
      await addAuditLog('DELETE', 'folhas_pagamento', id, `Folha excluída`);
      setNotification('Folha removida com sucesso.');
    } catch (err) {
      console.error("Erro ao remover folha:", err);
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
        }, file.type, 0.7);
      };
      img.onerror = reject;
    });
  };

  const uploadLogo = async (file: File): Promise<string> => {
    try {
      console.log(`[Diagnostic] Iniciando upload do arquivo para Firebase Storage: "logos/${file.name}". Tamanho original: ${file.size} bytes`);
      
      // Limit to max 180px width to keep it ultra lightweight for Firestore Doc (safe Base64 conversion is less than 10KB)
      const compressedBlob = await compressImage(file, 180);
      console.log(`[Diagnostic] Imagem comprimida. Novo tamanho: ${compressedBlob.size} bytes`);

      const storageRef = ref(storage, `logos/${file.name}`);
      console.log(`[Diagnostic] Referência do Storage criada com sucesso.`);

      // Strict timeout of 3.5 seconds for Firebase Storage upload to prevent indefinite loops when Storage is inactive/unconfigured
      const uploadPromise = uploadBytes(storageRef, compressedBlob);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Limite de tempo excedido ao carregar no Firebase Storage (Storage não está ativo no console do Firebase). Iniciando contingência Base64 com salvamento instantâneo.')), 3500)
      );

      const uploadResult = await Promise.race([uploadPromise, timeoutPromise]);
      console.log(`[Diagnostic] Sucesso no uploadBytes. Bytes enviados. Metadata:`, uploadResult.metadata);

      console.log(`[Diagnostic] Obtendo URL de download pública do Storage...`);
      const downloadPromise = getDownloadURL(storageRef);
      const url = await Promise.race([downloadPromise, timeoutPromise]);
      console.log(`[Diagnostic] URL obtida com sucesso: "${url}".`);

      return url;
    } catch (error: any) {
      console.error(`[Diagnostic] Erro no uploadLogo:`, error);
      throw new Error(`Erro ao enviar logo: ${error.message || String(error)}`);
    }
  };

  const uploadProfissionalFoto = async (file: File): Promise<string> => {
    try {
      console.log(`[Diagnostic] Iniciando upload de foto do profissional para Firebase Storage: "profissional_fotos/${file.name}"`);
      const storageRef = ref(storage, `profissional_fotos/${Date.now()}_${file.name}`);
      
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Limite de tempo excedido no upload de foto para o Firebase Storage.')), 3500)
      );

      await Promise.race([uploadPromise, timeoutPromise]);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error: any) {
      console.warn("[Diagnostic] Upload via Firebase Storage falhou ou expirou, usando fallback Base64 comprimido:", error);
      try {
        // Comprime a imagem para manter o tamanho super reduzido e seguro para salvar no Firestore (largura max de 250px)
        const compressedBlob = await compressImage(file, 250);
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(compressedBlob);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
        });
      } catch (compressErr) {
        console.error("[Diagnostic] Erro ao comprimir foto, convertendo arquivo bruto para Base64:", compressErr);
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
        });
      }
    }
  };

  const uploadPdf = async (file: File, path: string): Promise<string> => {
    try {
      const storageRef = ref(storage, path);
      const uploadPromise = uploadBytes(storageRef, file);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT: Limite de 5s excedido no upload do PDF.')), 5000)
      );
      await Promise.race([uploadPromise, timeoutPromise]);
      return await getDownloadURL(storageRef);
    } catch (err: any) {
      console.warn("Firebase Storage PDF upload failed, converting to Base64 fallback:", err);
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
      });
    }
  };

  const addFolhaPagamento = async (folha: Omit<FolhaPagamento, 'id'>) => {
    try {
      const docRef = await addDoc(collection(db, 'folhas_pagamento'), folha);
      await addAuditLog('CREATE', 'folhas_pagamento', docRef.id, `Folha fechada para profissional ${folha.nomeProfissional}`);
      setNotification('Folha fechada com sucesso.');
      return { id: docRef.id, ...folha } as FolhaPagamento;
    } catch (err) {
      console.error("Erro ao fechar folha:", err);
      handleFirestoreError(err, OperationType.CREATE, 'folhas_pagamento');
      throw err;
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        pacientes,
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
        updateAgendamento,
        deleteAgendamento,
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
        deleteFolhaPagamento,
        uploadLogo,
        uploadProfissionalFoto,
        uploadPdf,
        addFaturaPaciente,
        folhasPagamento,
        addFolhaPagamento,
        logsAuditoria,
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
