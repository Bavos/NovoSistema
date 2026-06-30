/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { PatientList } from '../components/PatientList';
import { PatientRecord } from '../components/PatientRecord';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface PacientesProps {
  globalSearchQuery?: string;
  onViewChange?: (isForm: boolean, title: string) => void;
  initialSelectedPatient?: any;
  clearInitialSelectedPatient?: () => void;
}

export const Pacientes: React.FC<PacientesProps> = ({ 
  globalSearchQuery, 
  onViewChange,
  initialSelectedPatient,
  clearInitialSelectedPatient
}) => {
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [isNewPatient, setIsNewPatient] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const { pacientes, deletePaciente, deactivatePaciente, loading } = useFirebase();

  useEffect(() => {
    if (!loading) {
      setIsLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (initialSelectedPatient) {
      setSelectedPaciente(initialSelectedPatient);
      setIsNewPatient(false);
      if (clearInitialSelectedPatient) {
        clearInitialSelectedPatient();
      }
    }
  }, [initialSelectedPatient, clearInitialSelectedPatient]);

  const handleBackToList = () => {
    setSelectedPaciente(null);
    setIsNewPatient(false);
  };

  const handleSelectPatient = (paciente: any) => {
    setSelectedPaciente(paciente);
    setIsNewPatient(false);
  };

  const handleNewPatientClick = () => {
    console.log("[Pacientes] Novo paciente clicado");
    setSelectedPaciente(null);
    setIsNewPatient(true);
  };

  const isBrowsingForm = !!(selectedPaciente || isNewPatient);

  // Sync title changes with App's layout header when selecting list vs edit forms
  useEffect(() => {
    if (onViewChange) {
      if (selectedPaciente) {
        onViewChange(true, 'Prontuário');
      } else if (isNewPatient) {
        onViewChange(true, 'Novo Paciente');
      } else {
        onViewChange(false, 'Gestão Integrada de Pacientes');
      }
    }
  }, [selectedPaciente, isNewPatient, onViewChange, selectedPaciente?.nome]);

  if (isBrowsingForm) {
    return (
      <ErrorBoundary onReset={handleBackToList}>
        <PatientRecord
          paciente={selectedPaciente}
          onBack={handleBackToList}
          onSelectPatient={handleSelectPatient}
        />
      </ErrorBoundary>
    );
  }

  return (
    <PatientList
      pacientes={pacientes}
      onSelectPatient={handleSelectPatient}
      onNewPatient={handleNewPatientClick}
      onDeletePatient={(id) => deletePaciente(id)}
      onDeactivatePatient={(id, motivo) => deactivatePaciente(id, motivo)}
      globalSearchQuery={globalSearchQuery || ''}
      isLoading={isLoading}
    />
  );
};

export default Pacientes;
