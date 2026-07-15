import { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Paciente, EscalacaoPlano } from '../types';
import { formatarMoeda, converterMascaraParaNumero } from '../lib/masks';

export function usePacienteData(pacienteId: string | null | undefined, initialPaciente?: Paciente | null) {
  const { pacientes, updatePaciente } = useFirebase();
  const [tipoEscala, setTipoEscala] = useState<string>('Diurno 12h');
  const [horaInicioPadrao, setHoraInicioPadrao] = useState('07:00');
  const [valorSugeridoPlantao, setValorSugeridoPlantao] = useState<string>('150,00');
  const [ajudaCusto, setAjudaCusto] = useState<string>('0,00');
  const [valorTransporte, setValorTransporte] = useState<string>('0,00');
  const [valorAlimentacao, setValorAlimentacao] = useState<string>('0,00');
  const [taxaAdm, setTaxaAdm] = useState<string>('0,00');
  const [tiposPlantao, setTiposPlantao] = useState<EscalacaoPlano[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Simulate Firestore fetch for the specific patient
  useEffect(() => {
    if (pacienteId) {
      setLoading(true);
      // Simulate network look-up delay from Firestore
      const timer = setTimeout(() => {
        const found = pacientes.find(p => p.id === pacienteId) || initialPaciente;
        if (found && found.planoAtendimento) {
          setTipoEscala(found.planoAtendimento.tipoEscala || 'Diurno 12h');
          setHoraInicioPadrao(found.planoAtendimento.horaInicioPadrao || '07:00');
          setValorSugeridoPlantao(formatarMoeda(found.planoAtendimento.valorSugeridoPlantao ?? 150));
          setAjudaCusto(formatarMoeda(found.planoAtendimento.ajudaCusto ?? 0));
          setValorTransporte(formatarMoeda(found.planoAtendimento.valorTransporte ?? found.planoAtendimento.ajudaCusto ?? 0));
          setValorAlimentacao(formatarMoeda(found.planoAtendimento.valorAlimentacao ?? 0));
          setTaxaAdm(formatarMoeda(found.planoAtendimento.taxaAdm ?? 0));
          setTiposPlantao(found.planoAtendimento.tiposPlantao || []);
        }
        setLoading(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pacienteId, pacientes, initialPaciente]);

  // Simulate firestore "updateDoc" function
  const updateDoc = async (id: string, updatedFields: Partial<Paciente>) => {
    setLoading(true);
    return new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        try {
          const current = pacientes.find(p => p.id === id) || initialPaciente;
          if (!current) {
            throw new Error('Paciente não encontrado no Firestore.');
          }

          const updatedObj: Paciente = {
            ...current,
            ...updatedFields,
            planoAtendimento: {
              ...current.planoAtendimento,
              ...(updatedFields.planoAtendimento || {})
            }
          };

          await updatePaciente(updatedObj);
          resolve();
        } catch (error) {
          reject(error);
        } finally {
          setLoading(false);
        }
      }, 300);
    });
  };

  const savePlanoAtendimento = async () => {
    if (!pacienteId) {
      alert('Erro: ID do paciente não fornecido.');
      return;
    }

    if (valorSugeridoPlantao === '' || valorTransporte === '' || valorAlimentacao === '' || taxaAdm === '') {
      alert('Erro de Validação: Os campos "Valor do Plantão", "Transporte", "Alimentação" e "Taxa Adm" não podem ficar vazios/em branco.');
      return;
    }

    try {
      const payload = {
        planoAtendimento: {
          tipoEscala,
          horaInicioPadrao,
          valorSugeridoPlantao: converterMascaraParaNumero(valorSugeridoPlantao),
          ajudaCusto: converterMascaraParaNumero(valorTransporte) + converterMascaraParaNumero(valorAlimentacao),
          valorTransporte: converterMascaraParaNumero(valorTransporte),
          valorAlimentacao: converterMascaraParaNumero(valorAlimentacao),
          taxaAdm: converterMascaraParaNumero(taxaAdm),
          tiposPlantao,
        }
      };

      await updateDoc(pacienteId, payload);
      alert('Plano de Atendimento salvo com sucesso no Firestore!');
    } catch (error: any) {
      alert('Erro ao persistir plano de Atendimento: ' + error.message);
    }
  };

  return {
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
    loading,
    updateDoc,
    savePlanoAtendimento,
  };
}
