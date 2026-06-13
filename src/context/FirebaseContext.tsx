/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Paciente, Plantao, CancelingReason } from '../types';
import { INITIAL_PACIENTES, INITIAL_PLANTOES } from '../mockData';
import { db, auth, OperationType, handleFirestoreError } from '../lib/firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';

interface FirebaseContextType {
  pacientes: Paciente[];
  plantoes: Plantao[];
  loading: boolean;
  userRole: 'administrador' | 'colaborador';
  setUserRole: (role: 'administrador' | 'colaborador') => void;
  addPaciente: (paciente: Omit<Paciente, 'id' | 'createdAt' | 'status'>) => Promise<Paciente>;
  updatePaciente: (paciente: Paciente) => Promise<void>;
  deactivatePaciente: (id: string, motivo: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;
  cancelPlantao: (id: string, motivo: CancelingReason) => Promise<void>;
  addPlantao: (plantao: Omit<Plantao, 'id'>) => Promise<Plantao>;
  updatePlantao: (plantao: Plantao) => Promise<void>;
  deletePlantao: (id: string) => Promise<void>;
  deletePlantoes: (ids: string[]) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [plantoes, setPlantoes] = useState<Plantao[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'administrador' | 'colaborador'>('administrador');

  // Load Saved Admin Role Preference locally
  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole === 'administrador' || savedRole === 'colaborador') {
      setUserRole(savedRole);
    }
  }, []);

  const handleSetUserRole = (role: 'administrador' | 'colaborador') => {
    setUserRole(role);
    localStorage.setItem('user_role', role);
  };

  // Perform Background Authentication and Real-time Live Firestore Mirroring
  useEffect(() => {
    let unsubscribePacientes: (() => void) | null = null;
    let unsubscribePlantoes: (() => void) | null = null;

    const initFirebaseSync = async () => {
      try {
        // 1. Silent anonymous auth to set credentials & bypass rules gate nicely
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn("Auth silent fallback (offline format assumed):", authErr);
      }

      // 2. Validate connection on initial boot
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (connErr) {
        if (connErr instanceof Error && connErr.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }

      // 3. Seed Firestore database automatically if empty
      try {
        const pSnap = await getDocs(collection(db, 'pacientes'));
        if (pSnap.empty) {
          console.log("Seeding Firestore with default pacientes data records...");
          for (const item of INITIAL_PACIENTES) {
            await setDoc(doc(db, 'pacientes', item.id), item);
          }
        }

        const plSnap = await getDocs(collection(db, 'plantoes'));
        if (plSnap.empty) {
          console.log("Seeding Firestore with default plantões logs...");
          for (const item of INITIAL_PLANTOES) {
            await setDoc(doc(db, 'plantoes', item.id), item);
          }
        }
      } catch (seedErr) {
        console.warn("Skipped Firebase seeding (using client fallback or active existing base):", seedErr);
      }

      // 4. Real-time Subscription to collections
      const pacColl = collection(db, 'pacientes');
      unsubscribePacientes = onSnapshot(
        pacColl,
        (snap) => {
          const list: Paciente[] = [];
          snap.forEach((d) => {
            list.push(d.data() as Paciente);
          });
          setPacientes(list);
          setLoading(false);
        },
        (error) => {
          console.error("Paciente live sync error:", error);
          // Fallback to local storage state if permissions rules block or offline
          const fallbackPac = localStorage.getItem('firebase_simulated_pacientes');
          if (fallbackPac) {
            setPacientes(JSON.parse(fallbackPac));
          } else {
            setPacientes(INITIAL_PACIENTES);
          }
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, 'pacientes');
        }
      );

      const plColl = collection(db, 'plantoes');
      unsubscribePlantoes = onSnapshot(
        plColl,
        (snap) => {
          const list: Plantao[] = [];
          snap.forEach((d) => {
            list.push(d.data() as Plantao);
          });
          setPlantoes(list);
        },
        (error) => {
          console.error("Plantões live sync error:", error);
          const fallbackPl = localStorage.getItem('firebase_simulated_plantoes');
          if (fallbackPl) {
            setPlantoes(JSON.parse(fallbackPl));
          } else {
            setPlantoes(INITIAL_PLANTOES);
          }
          handleFirestoreError(error, OperationType.GET, 'plantoes');
        }
      );
    };

    initFirebaseSync();

    return () => {
      if (unsubscribePacientes) unsubscribePacientes();
      if (unsubscribePlantoes) unsubscribePlantoes();
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

  // Firestore DB mutations
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
      await setDoc(doc(db, 'pacientes', id), fullPaciente);
      return fullPaciente;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `pacientes/${id}`);
      throw err;
    }
  };

  const updatePaciente = async (updatedPac: Paciente) => {
    try {
      await setDoc(doc(db, 'pacientes', updatedPac.id), updatedPac);
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
      await setDoc(doc(db, 'plantoes', id), fullPlantao);
      return fullPlantao;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `plantoes/${id}`);
      throw err;
    }
  };

  const updatePlantao = async (updatedPlantao: Plantao) => {
    try {
      await setDoc(doc(db, 'plantoes', updatedPlantao.id), updatedPlantao);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `plantoes/${updatedPlantao.id}`);
      throw err;
    }
  };

  const deletePlantao = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'plantoes', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plantoes/${id}`);
      throw err;
    }
  };

  const deletePlantoes = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'plantoes', id));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `plantoes/batch`);
      throw err;
    }
  };

  const deletePaciente = async (id: string) => {
    const todayStr = new Date().toLocaleDateString('pt-BR');
    try {
      await updateDoc(doc(db, 'pacientes', id), {
        status: 'Desativado',
        desativadoEm: todayStr,
        desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pacientes/${id}`);
      throw err;
    }
  };

  return (
    <FirebaseContext.Provider
      value={{
        pacientes,
        plantoes,
        loading,
        userRole,
        setUserRole: handleSetUserRole,
        addPaciente,
        updatePaciente,
        deactivatePaciente,
        reactivatePaciente,
        cancelPlantao,
        addPlantao,
        updatePlantao,
        deletePlantao,
        deletePlantoes,
        deletePaciente,
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
