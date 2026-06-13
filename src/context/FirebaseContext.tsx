/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Paciente, Plantao, CancelingReason } from '../types';
import { INITIAL_PACIENTES, INITIAL_PLANTOES } from '../mockData';

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

  // Sync with localStorage
  useEffect(() => {
    const savedPacientes = localStorage.getItem('firebase_simulated_pacientes');
    const savedPlantoes = localStorage.getItem('firebase_simulated_plantoes');
    const savedRole = localStorage.getItem('user_role');

    if (savedRole === 'administrador' || savedRole === 'colaborador') {
      setUserRole(savedRole);
    }

    if (savedPacientes && savedPlantoes) {
      setPacientes(JSON.parse(savedPacientes));
      setPlantoes(JSON.parse(savedPlantoes));
    } else {
      localStorage.setItem('firebase_simulated_pacientes', JSON.stringify(INITIAL_PACIENTES));
      localStorage.setItem('firebase_simulated_plantoes', JSON.stringify(INITIAL_PLANTOES));
      setPacientes(INITIAL_PACIENTES);
      setPlantoes(INITIAL_PLANTOES);
    }
    setLoading(false);
  }, []);

  const handleSetUserRole = (role: 'administrador' | 'colaborador') => {
    setUserRole(role);
    localStorage.setItem('user_role', role);
  };

  const saveToStorage = (updatedPatients: Paciente[], updatedShifts: Plantao[]) => {
    localStorage.setItem('firebase_simulated_pacientes', JSON.stringify(updatedPatients));
    localStorage.setItem('firebase_simulated_plantoes', JSON.stringify(updatedShifts));
  };

  const addPaciente = async (newPac: Omit<Paciente, 'id' | 'createdAt' | 'status'>) => {
    return new Promise<Paciente>((resolve) => {
      setTimeout(() => {
        const fullPaciente: Paciente = {
          ...newPac,
          id: `pac-${Date.now()}`,
          status: 'Ativo',
          createdAt: new Date().toISOString(),
          desativadoEm: null,
          desativadoMotivo: null,
        };

        const updated = [...pacientes, fullPaciente];
        setPacientes(updated);
        saveToStorage(updated, plantoes);
        resolve(fullPaciente);
      }, 500); // Simulate network latency
    });
  };

  const updatePaciente = async (updatedPac: Paciente) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updated = pacientes.map((p) => (p.id === updatedPac.id ? updatedPac : p));
        setPacientes(updated);
        saveToStorage(updated, plantoes);
        resolve();
      }, 500);
    });
  };

  const deactivatePaciente = async (id: string, motivo: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const todayStr = new Date().toLocaleDateString('pt-BR');
        const updated = pacientes.map((p) => {
          if (p.id === id) {
            return {
              ...p,
              status: 'Desativado' as const,
              desativadoEm: todayStr,
              desativadoMotivo: motivo,
            };
          }
          return p;
        });
        setPacientes(updated);
        saveToStorage(updated, plantoes);
        resolve();
      }, 500);
    });
  };

  const reactivatePaciente = async (id: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updated = pacientes.map((p) => {
          if (p.id === id) {
            return {
              ...p,
              status: 'Ativo' as const,
              desativadoEm: null,
              desativadoMotivo: null,
            };
          }
          return p;
        });
        setPacientes(updated);
        saveToStorage(updated, plantoes);
        resolve();
      }, 500);
    });
  };

  const cancelPlantao = async (id: string, motivo: CancelingReason) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updatedShipments = plantoes.map((pl) => {
          if (pl.id === id) {
            return {
              ...pl,
              status: 'Cancelado' as const,
              motivoCancelamento: motivo,
            };
          }
          return pl;
        });
        setPlantoes(updatedShipments);
        saveToStorage(pacientes, updatedShipments);
        resolve();
      }, 500);
    });
  };

  const addPlantao = async (newPlantao: Omit<Plantao, 'id'>) => {
    return new Promise<Plantao>((resolve) => {
      setTimeout(() => {
        const fullPlantao: Plantao = {
          ...newPlantao,
          id: `plt-${Date.now()}`,
        };
        const updated = [...plantoes, fullPlantao];
        setPlantoes(updated);
        saveToStorage(pacientes, updated);
        resolve(fullPlantao);
      }, 300);
    });
  };

  const updatePlantao = async (updatedPlantao: Plantao) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updated = plantoes.map((pl) => (pl.id === updatedPlantao.id ? updatedPlantao : pl));
        setPlantoes(updated);
        saveToStorage(pacientes, updated);
        resolve();
      }, 305);
    });
  };

  const deletePlantao = async (id: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updated = plantoes.filter((pl) => pl.id !== id);
        setPlantoes(updated);
        saveToStorage(pacientes, updated);
        resolve();
      }, 300);
    });
  };

  const deletePlantoes = async (ids: string[]) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const updated = plantoes.filter((pl) => !ids.includes(pl.id));
        setPlantoes(updated);
        saveToStorage(pacientes, updated);
        resolve();
      }, 300);
    });
  };

  const deletePaciente = async (id: string) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const todayStr = new Date().toLocaleDateString('pt-BR');
        const updated = pacientes.map((p) => {
          if (p.id === id) {
            return {
              ...p,
              status: 'Desativado' as const,
              desativadoEm: todayStr,
              desativadoMotivo: 'Exclusão lógica do registro (Inativo de acordo com diretrizes de segurança)',
            };
          }
          return p;
        });
        setPacientes(updated);
        saveToStorage(updated, plantoes);
        resolve();
      }, 400);
    });
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
