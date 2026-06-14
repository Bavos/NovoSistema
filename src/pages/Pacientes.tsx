/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { PatientList } from '../components/PatientList';
import { PatientRecord } from '../components/PatientRecord';

interface PacientesProps {
  globalSearchQuery: string;
  onViewChange?: (isForm: boolean, title: string) => void;
}

export const Pacientes: React.FC<PacientesProps> = ({ globalSearchQuery, onViewChange }) => {
  const [selectedPaciente, setSelectedPaciente] = useState<any>(null);
  const [isNewPatient, setIsNewPatient] = useState<boolean>(false);
  const { pacientes, deletePaciente, deactivatePaciente } = useFirebase();

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
        onViewChange(true, `Prontuário: ${selectedPaciente.nome}`);
      } else if (isNewPatient) {
        onViewChange(true, 'Novo Paciente');
      } else {
        onViewChange(false, 'Gestão Integrada de Pacientes');
      }
    }
  }, [selectedPaciente, isNewPatient, onViewChange, selectedPaciente?.nome]);

  if (isBrowsingForm) {
    return (
      <PatientRecord
        paciente={selectedPaciente}
        onBack={handleBackToList}
      />
    );
  }

  return (
    <PatientList
      pacientes={pacientes}
      onSelectPatient={handleSelectPatient}
      onNewPatient={handleNewPatientClick}
      onDeletePatient={(id) => deletePaciente(id)}
      onDeactivatePatient={(id, motivo) => deactivatePaciente(id, motivo)}
      globalSearchQuery={globalSearchQuery}
    />
  );
};

export default Pacientes;
