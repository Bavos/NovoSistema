/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from 'docx';
import React, { useState, useRef } from 'react';
import {
  Briefcase,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle,
  AlertTriangle,
  Award,
  TrendingDown,
  MapPin,
  Clock,
  Trash2,
  X,
  Plus,
  Info,
  Pencil
} from 'lucide-react';
import { INITIAL_PROFESSIONALS } from '../mockData';
import { useFirebase } from '../context/FirebaseContext';
import { Agendamento, DebitoProfissional } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

/* ----------------------------------------------------
 * Tab 2: Profissionais Co-curators
 * ---------------------------------------------------- */
export const ProfissionaisDashboard: React.FC = () => {
  const professionals = INITIAL_PROFESSIONALS;


  return (
    <div className="space-y-5 animate-in fade-in-30" id="profissionais-dashboard shadow-sm">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Resta de Profissionais Credenciados</h2>
          <p className="text-xs text-slate-400">Verifique a disponibilidade, telefones e avaliações técnicas da equipe ativa.</p>
        </div>
        <button
          onClick={() => alert('Simulação de cadastro de novo profissional')}
          className="px-4 py-2 bg-[#0F172A] text-white hover:bg-slate-800 rounded-md text-xs font-semibold shadow-md transition-colors cursor-pointer"
        >
          + Credenciar Profissional
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {professionals.map((prof) => (
          <div key={prof.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3 relative">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                {prof.name.split(' ').slice(1).map(n => n[0]).join('')}
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-tight">{prof.name}</h4>
                <p className="text-[10px] text-slate-400">{prof.role}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2.5 space-y-1.5 text-[11px] text-slate-600">
              <p className="flex items-center space-x-1">
                <MapPin size={12} className="text-slate-400" />
                <span>Atuação: {prof.area}</span>
              </p>
              <p className="flex items-center space-x-1">
                <Award size={12} className="text-amber-500" />
                <span>Avaliação média: <strong className="text-slate-800">{prof.rating}⭐</strong></span>
              </p>
              <p className="flex items-center space-x-1">
                <span>Contato: <strong>{prof.tel}</strong></span>
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[10px]">
              <span className={`px-2 py-0.5 rounded-full font-bold ${
                prof.status === 'Em Plantão' ? 'bg-amber-15 px-2 bg-amber-50 text-amber-700' :
                prof.status === 'Ativo' ? 'bg-green-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {prof.status}
              </span>
              <button
                onClick={() => alert(`Acessando escala do profissional ${prof.name}`)}
                className="text-blue-600 font-semibold hover:underline"
              >
                Ver Escala →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


/* ----------------------------------------------------
 * Tab 3: Escalas de Plantões Consolidada
 * ---------------------------------------------------- */
export const EscalasDashboard: React.FC = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 animate-in fade-in-30" id="escalas-dashboard">
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-sidebar-divider border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Painel Consolidado de Escalas Diárias</h2>
            <p className="text-xs text-slate-400">Visão integrada de prestadores escalados para o dia de hoje (12/06/2026).</p>
          </div>
          <div className="flex space-x-2">
            <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-slate-600">12/06/2026</span>
            <button
              onClick={handlePrint}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors print:hidden"
            >
              Imprimir Escala
            </button>
          </div>
        </div>

        {/* Calendar timeline visual placeholder */}
        <div className="grid grid-cols-7 gap-1 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 text-center text-[10px] uppercase font-bold text-slate-500 select-none">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
            <div key={d} className={`p-2 border-r border-slate-100 last:border-0 ${d === 'Sex' ? 'bg-blue-600 text-white' : 'bg-slate-100/50'}`}>
              {d === 'Sex' ? 'Hoje (Sex)' : d}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between bg-emerald-50/45 p-3 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <div>
                <p className="font-semibold text-slate-800">João Albuquerque (12h - Dia)</p>
                <p className="text-[10px] text-slate-400">Dra. Maria Santos • Entrada regular dás 07:00</p>
              </div>
            </div>
            <span className="font-bold text-emerald-700">ATIVO</span>
          </div>

          <div className="flex items-center justify-between bg-emerald-50/45 p-3 rounded-xl border border-emerald-100 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <div>
                <p className="font-semibold text-slate-800">Maria Eduarda (24h)</p>
                <p className="text-[10px] text-slate-400">Enf. Juliana Silveira • Início das 08:00</p>
              </div>
            </div>
            <span className="font-bold text-emerald-700">ATIVO</span>
          </div>

          <div className="flex items-center justify-between bg-amber-50/45 p-3 rounded-xl border border-amber-100 text-xs">
            <div className="flex items-center space-x-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <div>
                <p className="font-semibold text-slate-800">Roberto Carlos Silva (Fisioterapia)</p>
                <p className="text-[10px] text-slate-400">Fis. Dra. Luciana Varela • Visita técnica domiciliar às 15:30</p>
              </div>
            </div>
            <span className="font-bold text-amber-700">AGENDADO</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 italic">
          *As escalas podem ser livremente editadas ou suspensas abrindo-se diretamente o prontuário individual do respectivo paciente corporativo.
        </p>
      </div>
    </div>
  );
};


/* ----------------------------------------------------
 * Tab 4: Financeiro, Plantões E Faturamento
 * ---------------------------------------------------- */
export const FinanceiroDashboard: React.FC<{ initialSubTab?: 'folhas' | 'debitos' }> = ({ initialSubTab = 'folhas' }) => {
  const { 
    pacientes, 
    profissionais, 
    debitosProfissionais, 
    addDebitoProfissional, 
    updateDebitoProfissional,
    deleteDebitoProfissional,
    faturasPacientes,
    addFaturaPaciente,
    folhasPagamento,
    addFolhaPagamento
  } = useFirebase();

  const activePacientes = pacientes.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  const activeProfissionais = profissionais.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  
  const [subTab, setSubTab] = useState<'folhas' | 'debitos' | 'historico'>(initialSubTab as any);

  React.useEffect(() => {
    setSubTab(initialSubTab as any);
  }, [initialSubTab]);
  const [financeTab, setFinanceTab] = useState<'fatura' | 'pagamento'>('fatura');
  const [dataInicial, setDataInicial] = useState('2026-06-01');
  const [dataFinal, setDataFinal] = useState('2026-06-30');
  const [pacienteSelecionado, setPacienteSelecionado] = useState('');
  const [profissionalSelecionado, setProfissionalSelecionado] = useState('');

  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [agendamentosGerados, setAgendamentosGerados] = useState<Agendamento[]>([]);
  const [debitosNoPeriodo, setDebitosNoPeriodo] = useState<DebitoProfissional[]>([]);
  const [empresa, setEmpresa] = useState<any>(null);

  React.useEffect(() => {
    const fetchEmpresa = async () => {
        const docRef = doc(db, 'configuracoes_empresa', 'empresa');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            setEmpresa(docSnap.data());
        }
    };
    fetchEmpresa();
  }, []);

  const getNextFaturaNumber = async () => {
    const counterRef = doc(db, 'contadores', 'faturas');
    const counterSnap = await getDoc(counterRef);
    let nextNum = 1;
    if (counterSnap.exists()) {
        nextNum = counterSnap.data().ultimoNumero + 1;
        await setDoc(counterRef, { ultimoNumero: nextNum });
    } else {
        await setDoc(counterRef, { ultimoNumero: 1 });
    }
    return String(nextNum).padStart(5, '0');
  };
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [newDebitProfId, setNewDebitProfId] = useState('');
  const [newDebitDate, setNewDebitDate] = useState(() => {
    const today = new Date();
    const yr = today.getFullYear();
    const mo = String(today.getMonth() + 1).padStart(2, '0');
    const dy = String(today.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  });
  const [newDebitValor, setNewDebitValor] = useState('');
  const [newDebitMotivo, setNewDebitMotivo] = useState<'Curinga' | 'Passagem' | 'Outros'>('Curinga');
  const [isInsertingDebit, setIsInsertingDebit] = useState(false);
  const [editingDebitId, setEditingDebitId] = useState<string | null>(null);
  const [newDebitPacienteId, setNewDebitPacienteId] = useState('');
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [isClearingDebits, setIsClearingDebits] = useState(false);

  const handleClearAllDebitos = async () => {
    setDeleteConfirmDialog({
      isOpen: true,
      title: 'Zerar Todos os Débitos (Testes)',
      message: 'ATENÇÃO: Você está prestes a excluir TODOS os registros de débitos de profissionais já lançados. Esta ação deletará todos os documentos do Firestore permanentemente e não poderá ser desfeita.',
      onConfirm: async () => {
        setIsClearingDebits(true);
        try {
          const q = collection(db, 'debitos_profissionais');
          const snap = await getDocs(q);
          
          if (snap.empty) {
            return;
          }

          const promises = snap.docs.map(docRef => deleteDoc(doc(db, 'debitos_profissionais', docRef.id)));
          await Promise.all(promises);
        } catch (err) {
          console.error("Erro ao zerar débitos:", err);
          alert("Erro ao zerar os débitos no Firestore.");
        } finally {
          setIsClearingDebits(false);
        }
      }
    });
  };

  const parseInputDateToDateObject = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const formatDebitDateDisplay = (val: any): string => {
    if (!val) return '';
    try {
      let dObj: Date;
      if (typeof val.toDate === 'function') {
        dObj = val.toDate();
      } else if (val instanceof Date) {
        dObj = val;
      } else if (val.seconds) {
        dObj = new Date(val.seconds * 1000);
      } else {
        dObj = new Date(val);
      }
      
      const day = String(dObj.getDate()).padStart(2, '0');
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const year = dObj.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (err) {
      return String(val);
    }
  };

  const handleGerarRelatorios = async () => {
    if (!dataInicial || !dataFinal) {
      alert('Por favor, preencha ambas as datas.');
      return;
    }
    
    if (financeTab === 'fatura' && !pacienteSelecionado) {
      alert('Por favor, selecione um paciente para gerar a fatura.');
      return;
    }

    if (financeTab === 'pagamento' && !profissionalSelecionado) {
      alert('Por favor, selecione um profissional para gerar a folha de pagamento.');
      return;
    }
    
    setIsGenerating(true);
    setHasGenerated(false);
    try {
      const agendamentosRef = collection(db, 'agendamentos');
      
      let q;
      if (financeTab === 'fatura') {
        if (pacienteSelecionado === 'ALL') {
          q = query(
            agendamentosRef,
            where('data', '>=', dataInicial),
            where('data', '<=', dataFinal)
          );
        } else {
          q = query(
            agendamentosRef,
            where('idPaciente', '==', pacienteSelecionado),
            where('data', '>=', dataInicial),
            where('data', '<=', dataFinal)
          );
        }
      } else {
        if (profissionalSelecionado === 'ALL') {
          q = query(
            agendamentosRef,
            where('data', '>=', dataInicial),
            where('data', '<=', dataFinal)
          );
        } else {
          q = query(
            agendamentosRef,
            where('idProfissional', '==', profissionalSelecionado),
            where('data', '>=', dataInicial),
            where('data', '<=', dataFinal)
          );
        }
      }
      
      const snapshot = await getDocs(q);
      const docs: Agendamento[] = [];
      let todasFechadas = true;

      snapshot.forEach(doc => {
        const data = doc.data() as Agendamento;
        if (data.status !== 'Cancelado') {
          if (!data.escalaCongelada && data.status !== 'Concluido') {
            todasFechadas = false;
          }
          docs.push({ ...data, id: doc.id });
        }
      });
      
      if (financeTab === 'fatura' && !todasFechadas) {
        alert('⚠️ Acesso Negado: A escala de um ou mais pacientes precisa de ser consolidada e fechada na aba de Agendamentos antes da emissão da faturação.');
        setIsGenerating(false);
        return; // Abort query result
      }

      // Query debitos_profissionais
      const debitosRef = collection(db, 'debitos_profissionais');
      const debSnap = await getDocs(debitosRef);
      const activeDebs: DebitoProfissional[] = [];
      
      debSnap.forEach(doc => {
        const d = doc.data() as DebitoProfissional;
        const dId = doc.id;
        
        // Parse date
        const parseDebitDateString = (val: any): string => {
          if (!val) return '';
          try {
            let dObj: Date;
            if (typeof val.toDate === 'function') {
              dObj = val.toDate();
            } else if (val instanceof Date) {
              dObj = val;
            } else if (val.seconds) {
              dObj = new Date(val.seconds * 1000);
            } else {
              dObj = new Date(val);
            }
            const yr = dObj.getFullYear();
            const mo = String(dObj.getMonth() + 1).padStart(2, '0');
            const dy = String(dObj.getDate()).padStart(2, '0');
            return `${yr}-${mo}-${dy}`;
          } catch (e) {
            return '';
          }
        };

        const debitDateStr = parseDebitDateString(d.data);
        const matchesDate = debitDateStr >= dataInicial && debitDateStr <= dataFinal;
        
        let matchesProf = true;
        if (profissionalSelecionado !== 'ALL' && d.idProfissional !== profissionalSelecionado) {
          matchesProf = false;
        }

        if (matchesDate && matchesProf) {
          activeDebs.push({ ...d, id: dId });
        }
      });
      
      setDebitosNoPeriodo(activeDebs);
      setAgendamentosGerados(docs);
      setHasGenerated(true);
    } catch (error) {
      console.error('Erro ao gerar relatórios:', error);
      alert('Ocorreu um erro ao buscar os dados.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSalvarFaturaDefinitiva = async (pacId: string, agends: Agendamento[]) => {
    setIsSaving(true);
    try {
      const pac = pacientes.find(p => p.id === pacId);
      const totalFatura = agends.reduce((acc, ag) => acc + getAgendamentoCalculatedValues(ag).cobradoDia, 0);
      const numero = await getNextFaturaNumber();

      await addFaturaPaciente({
        idPaciente: pacId,
        nomePaciente: pac?.nome || 'Paciente Desconhecido',
        numeroFatura: numero,
        dataEmissao: new Date().toISOString(),
        periodoApurado: { inicio: dataInicial, fim: dataFinal },
        valorTotal: totalFatura,
        status: 'Fechada',
        plantoesCongelados: agends
      });
      alert(`Fatura Nº ${numero} salva com sucesso!`);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar fatura.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFecharFolhaProfissional = async (profName: string, agends: Agendamento[]) => {
      setIsSaving(true);
      try {
        let somaRepasses = 0; let somaAjudas = 0;
        agends.forEach(ag => {
            const vals = getAgendamentoCalculatedValues(ag);
            somaRepasses += vals.valorRepasseFinal;
            somaAjudas += vals.ajudaCusto;
        });

        const profId = profissionais.find(p => p.nome === profName)?.id;
        const debDocsForProf = debitosNoPeriodo.filter(d => 
            (profId && d.idProfissional === profId) || 
            d.nomeProfissional.toLowerCase() === profName.toLowerCase()
        );
        const totalDebitos = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);
        const valorLiquidoReceber = (somaRepasses + somaAjudas) - totalDebitos;

        await addFolhaPagamento({
            idProfissional: profId || 'prof-desconhecido',
            nomeProfissional: profName,
            dataEmissao: new Date().toISOString(),
            periodoApurado: { inicio: dataInicial, fim: dataFinal },
            valorTotalPlantoes: somaRepasses + somaAjudas,
            valorTotalDebitos: totalDebitos,
            valorLiquidoReceber: valorLiquidoReceber,
            status: 'Fechada',
            historicoDebitos: debDocsForProf,
            plantoesCongelados: agends
        });
        alert(`Folha para ${profName} fechada com sucesso!`);
      } catch (err) {
        console.error(err);
        alert('Erro ao fechar folha.');
      } finally {
        setIsSaving(false);
      }
  };

  // Folha de Fatura (Por Paciente)
  const agendamentosPorPaciente = agendamentosGerados.reduce<Record<string, Agendamento[]>>((acc, ag) => {
    if (!acc[ag.idPaciente]) acc[ag.idPaciente] = [];
    acc[ag.idPaciente].push(ag);
    return acc;
  }, {});

  // Folha de Pagamento (Por Profissional)
  const agendamentosPorProfissional = agendamentosGerados.reduce<Record<string, Agendamento[]>>((acc, ag) => {
    const key = ag.nomeProfissional;
    if (!acc[key]) acc[key] = [];
    acc[key].push(ag);
    return acc;
  }, {});

  const getAgendamentoCalculatedValues = (ag: Agendamento) => {
    const basePlantao = ag.valorPlantao || 0;
    const baseRepasse = ag.valorRepasse || 0;
    const baseTaxaAdm = ag.taxaAdm || 0;
    const ajudaCusto = ag.ajudaCusto || 0;

    let multiplier = 1.0;
    if (ag.tipoDia === 'Feriado 20%') {
      multiplier = 1.2;
    } else if (ag.tipoDia === 'Feriado 50%') {
      multiplier = 1.5;
    }

    // Rule 1: % de acréscimo calculated and added exclusively to 'Valor Base do Plantão' and 'Taxa de Adm'.
    // Rule 2: 'Ajuda de Custo' is immutable (0% acréscimo).
    // Rule 3: Total do Plantão (Faturamento Paciente) = (Valor Base do Plantão + % de Acréscimo) + (Taxa de Administração + % de Acréscimo) + Ajuda de Custo Original
    const valorPlantaoFinal = basePlantao * multiplier;
    const taxaAdmFinal = baseTaxaAdm * multiplier;
    const cobradoDia = valorPlantaoFinal + taxaAdmFinal + ajudaCusto;

    // Rule 4: Total a Receber (Pagamento Profissional) = (Valor Base do Plantão + % de Acréscimo) + Ajuda de Custo Original
    const valorRepasseFinal = baseRepasse * multiplier;
    const totalReceber = valorRepasseFinal + ajudaCusto;

    return {
      valorPlantaoFinal,
      taxaAdmFinal,
      cobradoDia,
      valorRepasseFinal,
      totalReceber,
      ajudaCusto,
    };
  };

  const handlePrint = () => {
    window.print();
  };

  const exportExcel = () => {
    let csvContent = '\uFEFF'; // BOM for UTF-8 in Excel
    
    if (financeTab === 'fatura') {
      csvContent += 'Paciente;Data;Profissional;Horário;Tipo do Plantão;Mão de Obra (R$);Taxa Adm (R$);Ajuda Custo (R$);Cobrado Dia (R$)\n';
      
      const pData = Object.entries(agendamentosPorPaciente) as [string, Agendamento[]][];
      pData.forEach(([pacId, agends]) => {
        const pacNome = pacientes.find(p => p.id === pacId)?.nome || 'Paciente Desconhecido';
        agends.forEach(ag => {
          const vals = getAgendamentoCalculatedValues(ag);
          csvContent += `"${pacNome}";"${ag.data.split('-').reverse().join('/')}";"${ag.nomeProfissional}";"${ag.horario}";"${ag.tipoDia || 'Normal'}";${vals.valorPlantaoFinal.toFixed(2).replace('.', ',')};${vals.taxaAdmFinal.toFixed(2).replace('.', ',')};${vals.ajudaCusto.toFixed(2).replace('.', ',')};${vals.cobradoDia.toFixed(2).replace('.', ',')}\n`;
        });
      });
    } else {
      csvContent += 'Profissional;Data;Paciente;Repasse (R$);Ajuda Custo (R$);Feriado/Adicional\n';
      
      const pData = Object.entries(agendamentosPorProfissional) as [string, Agendamento[]][];
      pData.forEach(([profName, agends]) => {
        agends.forEach((ag) => {
          const pacId = ag.idPaciente;
          const paciente = pacientes.find((p) => p.id === pacId);
          const nomePac = paciente ? paciente.nome : 'Paciente Desconhecido';
          const vals = getAgendamentoCalculatedValues(ag);
          csvContent += `"${profName}";"${ag.data.split('-').reverse().join('/')}";"${nomePac}";${vals.valorRepasseFinal.toFixed(2).replace('.', ',')};${vals.ajudaCusto.toFixed(2).replace('.', ',')};"${ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}"\n`;
        });
        
        let somaRepasses = 0;
        let somaAjudas = 0;
        agends.forEach(ag => {
          const vals = getAgendamentoCalculatedValues(ag);
          somaRepasses += vals.valorRepasseFinal;
          somaAjudas += vals.ajudaCusto;
        });

        const profId = profissionais.find(p => p.nome === profName)?.id;
        const debDocsForProf = debitosNoPeriodo.filter(d => 
          (profId && d.idProfissional === profId) || 
          (d.nomeProfissional.toLowerCase() === profName.toLowerCase())
        );
        const totalDebs = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);
        const valorLiquido = (somaRepasses + somaAjudas) - totalDebs;
        
        csvContent += `""\n`;
        csvContent += `"${profName}";Soma Repasses (R$);Soma Ajuda Custo (R$);Total Débitos (R$);Líquido A Receber (R$)\n`;
        csvContent += `"${profName}";${somaRepasses.toFixed(2).replace('.', ',')};${somaAjudas.toFixed(2).replace('.', ',')};${totalDebs.toFixed(2).replace('.', ',')};${valorLiquido.toFixed(2).replace('.', ',')}\n`;
        csvContent += `""\n`;
      });
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${financeTab}_${dataInicial}_a_${dataFinal}.csv`;
    link.click();
  };

  const exportWord = () => {
    let htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Relatório</title></head>
      <body>
        <h1>Relatório - Folha de ${financeTab === 'fatura' ? 'Fatura (Pacientes)' : 'Pagamento (Profissionais)'}</h1>
        <p>Período: ${dataInicial.split('-').reverse().join('/')} a ${dataFinal.split('-').reverse().join('/')}</p>
    `;
    
    if (financeTab === 'fatura') {
      const pData = Object.entries(agendamentosPorPaciente) as [string, Agendamento[]][];
      pData.forEach(([pacId, agends]) => {
        const pacNome = pacientes.find(p => p.id === pacId)?.nome || 'Paciente Desconhecido';
        const totalFatura = agends.reduce((acc, ag) => {
          const vals = getAgendamentoCalculatedValues(ag);
          return acc + vals.cobradoDia;
        }, 0);
        htmlContent += `
          <h2>Paciente: ${pacNome}</h2>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px; font-family: sans-serif;">
            <tr style="background-color: #f1f5f9;">
              <th>Data</th><th>Profissional</th><th>Horário</th><th>Tipo</th><th>Mão de Obra</th><th>Taxa Adm</th><th>Ajuda Custo</th><th>Cobrado/Dia</th>
            </tr>
        `;
        agends.sort((a,b) => a.data.localeCompare(b.data)).forEach(ag => {
          const vals = getAgendamentoCalculatedValues(ag);
          htmlContent += `
            <tr>
              <td>${ag.data.split('-').reverse().join('/')}</td>
              <td>${ag.nomeProfissional}</td>
              <td>${ag.horario}</td>
              <td>${ag.tipoDia || 'Normal'}</td>
              <td>R$ ${vals.valorPlantaoFinal.toFixed(2)}</td>
              <td>R$ ${vals.taxaAdmFinal.toFixed(2)}</td>
              <td>R$ ${vals.ajudaCusto.toFixed(2)}</td>
              <td><strong>R$ ${vals.cobradoDia.toFixed(2)}</strong></td>
            </tr>
          `;
        });
        htmlContent += `
            <tr style="background-color: #e0f2fe;">
              <td colspan="7" align="right"><b>Total Fatura:</b></td>
              <td><b>R$ ${totalFatura.toFixed(2)}</b></td>
            </tr>
          </table><br/>
        `;
      });
    } else {
      const pData = Object.entries(agendamentosPorProfissional) as [string, Agendamento[]][];
      pData.forEach(([profName, agends]) => {
        let somaRepasses = 0;
        let somaAjudas = 0;
        agends.forEach(ag => {
          const vals = getAgendamentoCalculatedValues(ag);
          somaRepasses += vals.valorRepasseFinal;
          somaAjudas += vals.ajudaCusto;
        });

        const profId = profissionais.find(p => p.nome === profName)?.id;
        const debDocsForProf = debitosNoPeriodo.filter(d => 
          (profId && d.idProfissional === profId) || 
          (d.nomeProfissional.toLowerCase() === profName.toLowerCase())
        );
        const totalDebs = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);
        const valorLiquido = (somaRepasses + somaAjudas) - totalDebs;
        
        htmlContent += `
          <div style="border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; font-family: sans-serif; font-size: 14px;">
            <h3>Profissional: ${profName}</h3>
            <p>Total de Plantões: ${agends.length}</p>
            
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 15px;">
              <tr style="background-color: #f1f5f9;">
                <th>Data</th><th>Paciente</th><th>Repasse</th><th>Ajuda Custo</th><th>Feriado/Adicional</th>
              </tr>`;
              
        agends.sort((a,b) => a.data.localeCompare(b.data)).forEach(ag => {
          const pacId = ag.idPaciente;
          const paciente = pacientes.find((p) => p.id === pacId);
          const nomePac = paciente ? paciente.nome : 'Paciente Desconhecido';
          const vals = getAgendamentoCalculatedValues(ag);
          htmlContent += `
            <tr>
              <td>${ag.data.split('-').reverse().join('/')}</td>
              <td>${nomePac}</td>
              <td>R$ ${vals.valorRepasseFinal.toFixed(2)}</td>
              <td>R$ ${vals.ajudaCusto.toFixed(2)}</td>
              <td>${ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}</td>
            </tr>
          `;
        });
        
        htmlContent += `
            </table>
            
            <p>(+) Somatório de Repasses (Líquido Plantão): R$ ${somaRepasses.toFixed(2)}</p>
            <p>(+) Somatório Ajuda de Custo: R$ ${somaAjudas.toFixed(2)}</p>
            <p>(-) Total de Débitos: R$ ${totalDebs.toFixed(2)}</p>
            <h4>Total Líquido a Receber: R$ ${valorLiquido.toFixed(2)}</h4>
          </div>
        `;
      });
    }
    
    htmlContent += `</body></html>`;
    
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_${financeTab}_${dataInicial}_a_${dataFinal}.doc`;
    link.click();
  };

  const handleAddDebit = async () => {
    if (!newDebitProfId || !newDebitDate || !newDebitValor || !newDebitMotivo) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    const valNumber = parseFloat(newDebitValor);
    if (isNaN(valNumber) || valNumber <= 0) {
      alert('O valor deve ser um número maior que zero.');
      return;
    }

    const profSelected = activeProfissionais.find(p => p.id === newDebitProfId);
    if (!profSelected) {
      alert('Profissional selecionado inválido ou inativo.');
      return;
    }

    const patientSelected = activePacientes.find(p => p.id === newDebitPacienteId);
    const idPaciente = patientSelected ? patientSelected.id : '';
    const nomePaciente = patientSelected ? patientSelected.nome : '';

    setIsInsertingDebit(true);
    try {
      const dateObj = parseInputDateToDateObject(newDebitDate);
      
      const debitData: any = {
        idProfissional: newDebitProfId,
        nomeProfissional: profSelected.nome,
        data: dateObj,
        valor: valNumber,
        motivo: newDebitMotivo
      };

      if (idPaciente) {
        debitData.idPaciente = idPaciente;
        debitData.nomePaciente = nomePaciente;
      }

      if (editingDebitId) {
        debitData.id = editingDebitId;
        await updateDebitoProfissional(debitData);
      } else {
        await addDebitoProfissional(debitData);
      }
      
      // Reset and Close
      setEditingDebitId(null);
      setNewDebitProfId('');
      setNewDebitValor('');
      setNewDebitMotivo('Curinga');
      setNewDebitPacienteId('');
      setShowDebitModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao gravar débito.');
    } finally {
      setIsInsertingDebit(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in-30" id="financeiro-dashboard">
      
      {/* Upper Tab Navigation */}
      <div className="flex border-b border-slate-200 print:hidden">
        <button
          id="subtab-folhas"
          onClick={() => setSubTab('folhas')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            subTab === 'folhas'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          🗂️ Emissão de Folhas / Relatórios
        </button>
        <button
          id="subtab-debitos"
          onClick={() => setSubTab('debitos')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            subTab === 'debitos'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          💸 Gestão de Débitos dos Profissionais
        </button>
        <button
          id="subtab-historico"
          onClick={() => setSubTab('historico')}
          className={`px-5 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
            subTab === 'historico'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📜 Histórico Financeiro
        </button>
      </div>

      {subTab === 'folhas' ? (
        <>
          {/* Filters & Export */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm print:hidden">
            <div className="flex flex-col gap-5">
              {/* Top Options */}
              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                <h3 className="text-sm font-bold text-slate-800">Tipo de Relatório:</h3>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button
                    id="btn-report-type-fatura"
                    onClick={() => { setFinanceTab('fatura'); setHasGenerated(false); }}
                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      financeTab === 'fatura'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    🧾 Fatura (Paciente)
                  </button>
                  <button
                    id="btn-report-type-pagamento"
                    onClick={() => { setFinanceTab('pagamento'); setHasGenerated(false); }}
                    className={`px-4 py-2 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      financeTab === 'pagamento'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💸 Pagamento (Profissional)
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="flex flex-wrap items-end gap-4">
                  {financeTab === 'fatura' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Selecionar Paciente</label>
                      <select
                        id="select-finance-paciente"
                        value={pacienteSelecionado}
                        onChange={(e) => setPacienteSelecionado(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[200px]"
                      >
                        <option value="">Selecione um paciente...</option>
                        <option value="ALL">📋 TODOS OS PACIENTES</option>
                        {activePacientes.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Selecionar Profissional</label>
                      <select
                        id="select-finance-profissional"
                        value={profissionalSelecionado}
                        onChange={(e) => setProfissionalSelecionado(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[200px]"
                      >
                        <option value="">Selecione um profissional...</option>
                        <option value="ALL">📋 TODOS OS PROFISSIONAIS</option>
                        {activeProfissionais.map(p => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Data Inicial</label>
                    <input 
                      id="input-finance-data-inicial"
                      type="date"
                      value={dataInicial}
                      onChange={(e) => setDataInicial(e.target.value)}
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Data Final</label>
                    <input 
                      id="input-finance-data-final"
                      type="date"
                      value={dataFinal}
                      onChange={(e) => setDataFinal(e.target.value)}
                      className="p-2 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    id="btn-finance-gerar-relatorio"
                    onClick={handleGerarRelatorios}
                    disabled={isGenerating}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 h-[38px] cursor-pointer"
                  >
                    {isGenerating ? (
                      <>⏳ Aguarde...</>
                    ) : (
                      <>🔄 Gerar {financeTab === 'fatura' ? 'Fatura' : 'Folha de Pagamento'}</>
                    )}
                  </button>
                </div>
                
                {/* Buttons removed as requested */}
              </div>
            </div>
          </div>

          {/* Main spreadsheet display container */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
            
            {!hasGenerated ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center text-slate-500">
                <DollarSign size={48} className="text-slate-300 mx-auto" />
                <div>
                  <p className="font-bold text-slate-700 text-lg">Área de Faturamento</p>
                  <p className="text-sm">Selecione o período apurado e clique em "Gerar Relatórios" para visualizar a folha.</p>
                </div>
              </div>
            ) : (
              <>
                {financeTab === 'fatura' && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-4 mb-4 flex justify-between">
                      <div>
                        <h2 className="text-xl font-black text-slate-800">Folha de Fatura (Cobrança Clientes)</h2>
                        <p className="text-sm text-slate-500">Período Apurado: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>
                      </div>
                      {empresa && (
                        <div className="text-right text-xs text-slate-600">
                          <p className="font-bold">{empresa.razaoSocial}</p>
                          <p>CNPJ: {empresa.cnpj}</p>
                          <p>{empresa.endereco}</p>
                        </div>
                      )}
                    </div>

                    {Object.keys(agendamentosPorPaciente).length === 0 ? (
                      <p className="text-slate-500 italic text-sm">Nenhum plantão ativo neste período.</p>
                    ) : (
                      (Object.entries(agendamentosPorPaciente) as [string, Agendamento[]][]).map(([pacId, agends]) => {
                        const pacNome = pacientes.find(p => p.id === pacId)?.nome || 'Paciente Desconhecido';
                        const totalFatura = agends.reduce((acc, ag) => {
                          const vals = getAgendamentoCalculatedValues(ag);
                          return acc + vals.cobradoDia;
                        }, 0);

                        return (
                          <div key={pacId} className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300 print:mb-8">
                            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                              <div>
                                <h3 className="font-bold text-slate-800">{pacNome}</h3>
                                <p className="text-xs text-slate-500">Total de Plantões: {agends.length}</p>
                              </div>
                              <div className="flex gap-4 items-center">
                                <p className="text-xs font-black text-blue-700 bg-blue-50 px-2 py-1 rounded">Fatura Nº (Gerada ao salvar)</p>
                                <button
                                  onClick={() => handleSalvarFaturaDefinitiva(pacId, agends)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {isSaving ? 'Salvando...' : '💾 Salvar Fatura Definitiva'}
                                </button>
                              </div>
                            </div>
                            <table className="w-full text-left text-xs">
                              <thead className="bg-white border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="py-2.5 px-4">Data</th>
                                  <th className="py-2.5 px-4">Profissional</th>
                                  <th className="py-2.5 px-4">Horário</th>
                                  <th className="py-2.5 px-4">Tipo</th>
                                  <th className="py-2.5 px-4 text-right">Mão de Obra</th>
                                  <th className="py-2.5 px-4 text-right">Taxa Adm</th>
                                  <th className="py-2.5 px-4 text-right">Ajuda Custo</th>
                                  <th className="py-2.5 px-4 text-right font-bold">Cobrado/Dia</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {agends.sort((a,b) => a.data.localeCompare(b.data)).map(ag => {
                                  const vals = getAgendamentoCalculatedValues(ag);
                                  return (
                                    <tr key={ag.id} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-4">{ag.data.split('-').reverse().join('/')}</td>
                                      <td className="py-2.5 px-4">{ag.nomeProfissional}</td>
                                      <td className="py-2.5 px-4 font-mono text-[10px]">{ag.horario}</td>
                                      <td className="py-2.5 px-4">{ag.tipoDia || 'Normal'}</td>
                                      <td className="py-2.5 px-4 text-right">R$ {vals.valorPlantaoFinal.toFixed(2)}</td>
                                      <td className="py-2.5 px-4 text-right">R$ {vals.taxaAdmFinal.toFixed(2)}</td>
                                      <td className="py-2.5 px-4 text-right">R$ {vals.ajudaCusto.toFixed(2)}</td>
                                      <td className="py-2.5 px-4 text-right font-bold text-slate-700">R$ {vals.cobradoDia.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="bg-blue-50/50 border-t border-slate-200">
                                <tr>
                                  <td colSpan={7} className="py-3 px-4 text-right font-bold text-slate-600 uppercase text-[10px]">Total Fatura do Paciente:</td>
                                  <td className="py-3 px-4 text-right font-black text-blue-700 text-sm">R$ {totalFatura.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {financeTab === 'pagamento' && (
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-2 mb-4">
                      <h2 className="text-xl font-black text-slate-800">Folha de Pagamento (Profissionais)</h2>
                      <p className="text-sm text-slate-500">Período Apurado: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>
                    </div>

                    {Object.keys(agendamentosPorProfissional).length === 0 ? (
                      <p className="text-slate-500 italic text-sm">Nenhum plantão ativo neste período.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(Object.entries(agendamentosPorProfissional) as [string, Agendamento[]][]).map(([profName, agends]) => {
                          let somaRepasses = 0;
                          let somaAjudas = 0;
                          agends.forEach(ag => {
                            const vals = getAgendamentoCalculatedValues(ag);
                            somaRepasses += vals.valorRepasseFinal;
                            somaAjudas += vals.ajudaCusto;
                          });
                          
                          // Look up the professional and compute automatic deductions
                          const profId = profissionais.find(p => p.nome === profName)?.id;
                          const debDocsForProf = debitosNoPeriodo.filter(d => 
                            (profId && d.idProfissional === profId) || 
                            d.nomeProfissional.toLowerCase() === profName.toLowerCase()
                          );
                          const totalDebitos = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);
                          const valorLiquidoReceber = (somaRepasses + somaAjudas) - totalDebitos;

                          return (
                            <div key={profName} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm print:break-inside-avoid bg-white">
                              <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                                <div>
                                  <h3 className="font-bold text-indigo-900">{profName}</h3>
                                  <p className="text-xs text-indigo-700">Total de Plantões Relacionados: {agends.length}</p>
                                </div>
                                <button
                                  onClick={() => handleFecharFolhaProfissional(profName, agends)}
                                  disabled={isSaving}
                                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                                >
                                  {isSaving ? 'Salvando...' : '💾 Fechar Folha'}
                                </button>
                              </div>
                              
                              <div className="bg-white">
                                <table className="w-full text-left text-xs mb-4">
                                  <thead className="bg-slate-50 border-b border-indigo-50 text-slate-500 uppercase tracking-wider text-[10px]">
                                    <tr>
                                      <th className="py-2.5 px-4">Data</th>
                                      <th className="py-2.5 px-4">Paciente</th>
                                      <th className="py-2.5 px-4 text-right">Repasse</th>
                                      <th className="py-2.5 px-4 text-right">Ajuda Custo</th>
                                      <th className="py-2.5 px-4 text-right font-bold">Feriado/Adicional</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                    {agends.sort((a,b) => a.data.localeCompare(b.data)).map(ag => {
                                      const paciente = pacientes.find(p => p.id === ag.idPaciente);
                                      const nomePac = paciente ? paciente.nome : 'Paciente Desconhecido';
                                      const vals = getAgendamentoCalculatedValues(ag);
                                      return (
                                        <tr key={ag.id} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-4">{ag.data.split('-').reverse().join('/')}</td>
                                          <td className="py-2.5 px-4">{nomePac}</td>
                                          <td className="py-2.5 px-4 text-right">R$ {vals.valorRepasseFinal.toFixed(2)}</td>
                                          <td className="py-2.5 px-4 text-right">R$ {vals.ajudaCusto.toFixed(2)}</td>
                                          <td className="py-2.5 px-4 text-right text-slate-500">{ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                <div className="p-4 space-y-3 bg-slate-50/50 text-xs border-t border-slate-100">
                                  <div className="flex justify-between items-center text-slate-600">
                                    <span>(+) Somatório de Repasses (Líquido Plantões):</span>
                                    <span className="font-mono">R$ {somaRepasses.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-slate-600">
                                    <span>(+) Somatório Ajuda de Custo:</span>
                                    <span className="font-mono">R$ {somaAjudas.toFixed(2)}</span>
                                  </div>
                                  
                                  <div className="border-t border-slate-200 pt-3">
                                    <div className="flex justify-between items-start">
                                      <div className="space-y-1">
                                        <span className="text-slate-600 font-bold block">(-) Total de Débitos do Período:</span>
                                        {debDocsForProf.length > 0 ? (
                                          <div className="pl-3 space-y-0.5 text-[10px] text-red-600 font-semibold">
                                            {debDocsForProf.map(d => (
                                              <div key={d.id}>
                                                • {formatDebitDateDisplay(d.data)} - {d.motivo}: R$ {d.valor.toFixed(2)}
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-[10px] pl-3 text-slate-400 italic block">Nenhum débito no período apurado</span>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold text-red-600">
                                        R$ {totalDebitos.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-indigo-100">
                                    <span className="font-bold text-indigo-900 font-sans text-sm">Valor Líquido a Receber:</span>
                                    <span className="font-black text-indigo-700 text-base font-mono">
                                      R$ {valorLiquidoReceber.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : subTab === 'debitos' ? (
        <div className="space-y-5 animate-in fade-in-30">
          
          {/* Header Action Card */}
          <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-5 border border-slate-200 rounded-2xl shadow-sm gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Lançamento & Gestão de Débitos</h2>
              <p className="text-xs text-slate-500">Registre adiantamentos, vales de passagem, descontos ou despesas extras no perfil dos cuidadores para abatimento automático em folha.</p>
            </div>
            <div className="flex flex-wrap gap-2 self-start">
              <button
                onClick={handleClearAllDebitos}
                disabled={isClearingDebits}
                className="px-4 py-2 border border-orange-200 hover:bg-orange-50 text-orange-700 rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                title="Apagar todos os débitos da base para começar do zero"
              >
                {isClearingDebits ? 'Limpando...' : 'Zerar Dados (Testes)'}
              </button>
              <button
                onClick={() => {
                  setEditingDebitId(null);
                  setNewDebitProfId('');
                  setNewDebitValor('');
                  setNewDebitMotivo('Curinga');
                  setNewDebitPacienteId('');
                  setShowDebitModal(true);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus size={15} /> Lançar Débito
              </button>
            </div>
          </div>

          {/* Debits Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Info size={16} className="text-indigo-600" />
              <p className="text-xs text-slate-500 font-semibold">Consolidação de Débitos Ativos (Salvos na nuvem em tempo real)</p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-5">Profissional</th>
                    <th className="py-3 px-5">Data do Débito</th>
                    <th className="py-3 px-5">Motivo</th>
                    <th className="py-3 px-5 text-right font-bold">Valor</th>
                    <th className="py-3 px-5 text-right w-[100px]">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debitosProfissionais.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 italic">Nenhum débito registrado para profissionais cuidador.</td>
                    </tr>
                  ) : (
                    debitosProfissionais.sort((a, b) => {
                      const dateA = a.data?.seconds ? a.data.seconds : new Date(a.data).getTime();
                      const dateB = b.data?.seconds ? b.data.seconds : new Date(b.data).getTime();
                      return dateB - dateA;
                    }).map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/40">
                        <td className="py-3.5 px-5 font-semibold text-slate-800">
                          <div>{d.nomeProfissional}</div>
                          {d.nomePaciente && (
                            <div className="text-[10px] text-slate-400 font-normal">Paciente: {d.nomePaciente}</div>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-slate-500">{formatDebitDateDisplay(d.data)}</td>
                        <td className="py-3.5 px-5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            d.motivo === 'Curinga' ? 'bg-amber-100 text-amber-800' :
                            d.motivo === 'Passagem' ? 'bg-sky-100 text-sky-800' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {d.motivo}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-black text-red-600 text-sm font-mono">R$ {d.valor.toFixed(2)}</td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => {
                              setEditingDebitId(d.id);
                              setNewDebitProfId(d.idProfissional);
                              setNewDebitValor(d.valor.toString());
                              setNewDebitMotivo(d.motivo);
                              setNewDebitPacienteId(d.idPaciente || '');
                              
                              if (d.data) {
                                let dObj: Date;
                                if (typeof d.data.toDate === 'function') {
                                  dObj = d.data.toDate();
                                } else if (d.data.seconds) {
                                  dObj = new Date(d.data.seconds * 1000);
                                } else {
                                  dObj = new Date(d.data);
                                }
                                const yr = dObj.getFullYear();
                                const mo = String(dObj.getMonth() + 1).padStart(2, '0');
                                const dy = String(dObj.getDate()).padStart(2, '0');
                                setNewDebitDate(`${yr}-${mo}-${dy}`);
                              }
                              
                              setShowDebitModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-650 transition-colors cursor-pointer inline-flex items-center justify-center hover:bg-slate-100 rounded mr-2"
                            title="Editar débito"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteConfirmDialog({
                                isOpen: true,
                                title: 'Excluir Débito de Profissional',
                                message: `Tem certeza que deseja excluir o débito de R$ ${d.valor.toFixed(2)} de ${d.nomeProfissional}? Esta ação reajustará o balanço da folha de pagamento do profissional.`,
                                onConfirm: async () => {
                                  try {
                                    await deleteDebitoProfissional(d.id);
                                  } catch (err) {
                                    console.error("Erro ao deletar debito:", err);
                                  }
                                }
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer inline-flex items-center justify-center hover:bg-slate-100 rounded"
                            title="Remover débito"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <HistoricoFinanceiroDashboard />
      )}

      {/* Insert Debit Modal */}
      {showDebitModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setEditingDebitId(null);
                setShowDebitModal(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <h2 className="text-base font-black text-slate-900">
                {editingDebitId ? 'Editar Débito de Profissional' : 'Inserir Débito de Profissional'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {editingDebitId ? 'Atualize as informações do lançamento de débito do perfil do cuidador.' : 'Lançamento de desconto pontual para abatimento automático na folha apurada.'}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Profissional *</label>
                <select
                  value={newDebitProfId}
                  onChange={(e) => setNewDebitProfId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  required
                >
                  <option value="">Selecione o profissional...</option>
                  {activeProfissionais.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Paciente (Opcional)</label>
                <select
                  value={newDebitPacienteId}
                  onChange={(e) => setNewDebitPacienteId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">Nenhum paciente selecionado</option>
                  {activePacientes.map(p => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Data do Débito *</label>
                <input
                  type="date"
                  value={newDebitDate}
                  onChange={(e) => setNewDebitDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Valor do Débito *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm text-slate-400 font-bold font-mono">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={newDebitValor}
                    onChange={(e) => setNewDebitValor(e.target.value)}
                    className="w-full pl-9 pr-3 p-2.5 border border-slate-200 rounded-lg text-sm bg-white font-mono font-bold text-slate-800"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motivo do Débito *</label>
                <select
                  value={newDebitMotivo}
                  onChange={(e) => setNewDebitMotivo(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  required
                >
                  <option value="Curinga">Curinga</option>
                  <option value="Passagem">Passagem</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end transition-all">
                <button
                  type="button"
                  onClick={() => {
                    setEditingDebitId(null);
                    setShowDebitModal(false);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddDebit}
                  disabled={isInsertingDebit}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {isInsertingDebit ? 'Gravando...' : (editingDebitId ? 'Salvar Alterações' : 'Confirmar Lançamento')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmDialog && deleteConfirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-black text-slate-900 mb-2">{deleteConfirmDialog.title}</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">{deleteConfirmDialog.message}</p>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setDeleteConfirmDialog(null)}
                className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Não, Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteConfirmDialog.onConfirm();
                  } catch (e) {
                    console.error("Erro na confirmação:", e);
                  } finally {
                    setDeleteConfirmDialog(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Sim, Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export const HistoricoFinanceiroDashboard: React.FC = () => {
    const { faturasPacientes, folhasPagamento, deleteFaturaPaciente, deleteFolhaPagamento, pacientes } = useFirebase();
    const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, type: 'fatura' | 'folha' } | null>(null);
    const [viewDoc, setViewDoc] = useState<{data: any, type: 'fatura' | 'folha' } | null>(null);
    const [empresa, setEmpresa] = useState<any>(null);

    // Filter states
    const [searchFaturaPaciente, setSearchFaturaPaciente] = useState('');
    const [searchFaturaData, setSearchFaturaData] = useState('');
    const [searchFolhaProfissional, setSearchFolhaProfissional] = useState('');
    const [searchFolhaData, setSearchFolhaData] = useState('');

    // Dynamic Lists from Firestore
    const [dropdownPacientes, setDropdownPacientes] = useState<{ id: string; nome: string }[]>([]);
    const [dropdownProfissionais, setDropdownProfissionais] = useState<{ id: string; nome: string }[]>([]);

    React.useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                // Fetch patients map from 'pacientes' collection
                const pacSnap = await getDocs(collection(db, 'pacientes'));
                const pacs = pacSnap.docs.map(doc => ({
                    id: doc.id,
                    nome: doc.data().nome || ''
                })).filter(p => !!p.nome).sort((a, b) => a.nome.localeCompare(b.nome));
                setDropdownPacientes(pacs);

                // Fetch professionals map from 'profissionais' collection
                const profSnap = await getDocs(collection(db, 'profissionais'));
                const profs = profSnap.docs.map(doc => ({
                    id: doc.id,
                    nome: doc.data().nome || ''
                })).filter(p => !!p.nome).sort((a, b) => a.nome.localeCompare(b.nome));
                setDropdownProfissionais(profs);
            } catch (err) {
                console.error("Erro ao carregar dados dos selects:", err);
            }
        };

        const fetchEmpresa = async () => {
            const docRef = doc(db, 'configuracoes_empresa', 'empresa');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setEmpresa(docSnap.data());
            }
        };

        fetchFiltersData();
        fetchEmpresa();
    }, []);

    const filteredFaturas = faturasPacientes.filter(f => {
        const matchesPaciente = !searchFaturaPaciente || searchFaturaPaciente === 'all' || f.nomePaciente === searchFaturaPaciente;

        let matchesDate = true;
        if (searchFaturaData) {
            try {
                const docDate = new Date(f.dataEmissao);
                const yr = docDate.getFullYear();
                const mo = String(docDate.getMonth() + 1).padStart(2, '0');
                const dy = String(docDate.getDate()).padStart(2, '0');
                const docFormatted = `${yr}-${mo}-${dy}`;
                matchesDate = docFormatted === searchFaturaData;
            } catch (e) {
                matchesDate = false;
            }
        }

        return matchesPaciente && matchesDate;
    });

    const filteredFolhas = folhasPagamento.filter(f => {
        const matchesProfissional = !searchFolhaProfissional || searchFolhaProfissional === 'all' || f.nomeProfissional === searchFolhaProfissional;

        let matchesDate = true;
        if (searchFolhaData) {
            try {
                const docDate = new Date(f.dataEmissao);
                const yr = docDate.getFullYear();
                const mo = String(docDate.getMonth() + 1).padStart(2, '0');
                const dy = String(docDate.getDate()).padStart(2, '0');
                const docFormatted = `${yr}-${mo}-${dy}`;
                matchesDate = docFormatted === searchFolhaData;
            } catch (e) {
                matchesDate = false;
            }
        }

        return matchesProfissional && matchesDate;
    });

    return (
      <div className="space-y-6 animate-in fade-in-30">
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-md font-black text-slate-800">📜 Histórico de Faturas</h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={searchFaturaPaciente}
                onChange={(e) => setSearchFaturaPaciente(e.target.value)}
                className="border border-slate-200 rounded-md px-3 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 cursor-pointer"
              >
                <option value="all">Todos os Pacientes</option>
                {dropdownPacientes.map(p => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
              <input
                type="date"
                value={searchFaturaData}
                onChange={(e) => setSearchFaturaData(e.target.value)}
                className="border border-slate-200 rounded-md px-3 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
                <thead className="text-slate-500 uppercase border-b border-slate-100">
                    <tr>
                        <th className="p-3">Número</th>
                        <th className="p-3">Paciente</th>
                        <th className="p-3">Emissão</th>
                        <th className="p-3 text-right font-bold">Valor</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredFaturas.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold bg-slate-50/20">
                                Nenhum registro encontrado para estes filtros.
                            </td>
                        </tr>
                    ) : (
                        filteredFaturas.map(f => (
                            <tr key={f.id}>
                                <td className="p-3 font-mono">{f.numeroFatura}</td>
                                <td className="p-3">{f.nomePaciente}</td>
                                <td className="p-3">{new Date(f.dataEmissao).toLocaleDateString('pt-BR')}</td>
                                <td className="p-3 text-right font-bold text-slate-700">R$ {f.valorTotal.toFixed(2)}</td>
                                <td className="p-3 text-center"><span className="px-2 py-1 rounded-full text-[10px] bg-green-100 text-green-700 font-bold">{f.status}</span></td>
                                <td className="p-3 text-center flex gap-2">
                                    <button className="text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => setViewDoc({ data: f, type: 'fatura' })}>👁️</button>
                                    <button className="text-red-600 hover:text-red-800" onClick={() => setDeleteConfirm({ isOpen: true, id: f.id, type: 'fatura' })}>🗑️</button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h2 className="text-md font-black text-slate-800">📜 Histórico de Folhas de Pagamento</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={searchFolhaProfissional}
                  onChange={(e) => setSearchFolhaProfissional(e.target.value)}
                  className="border border-slate-200 rounded-md px-3 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 cursor-pointer"
                >
                  <option value="all">Todos os Profissionais</option>
                  {dropdownProfissionais.map(p => (
                    <option key={p.id} value={p.nome}>{p.nome}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={searchFolhaData}
                  onChange={(e) => setSearchFolhaData(e.target.value)}
                  className="border border-slate-200 rounded-md px-3 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                  <thead className="text-slate-500 uppercase border-b border-slate-100">
                      <tr>
                          <th className="p-3">Profissional</th>
                          <th className="p-3">Emissão</th>
                          <th className="p-3 text-right">Valor Líquido</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {filteredFolhas.length === 0 ? (
                          <tr>
                              <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold bg-slate-50/20">
                                  Nenhum registro encontrado para estes filtros.
                              </td>
                          </tr>
                      ) : (
                          filteredFolhas.map(f => (
                              <tr key={f.id}>
                                  <td className="p-3">{f.nomeProfissional}</td>
                                  <td className="p-3">{new Date(f.dataEmissao).toLocaleDateString('pt-BR')}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">R$ {f.valorLiquidoReceber.toFixed(2)}</td>
                                  <td className="p-3 text-center"><span className="px-2 py-1 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">{f.status}</span></td>
                                  <td className="p-3 text-center flex gap-2">
                                      <button className="text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => setViewDoc({ data: f, type: 'folha' })}>👁️</button>
                                      <button className="text-red-600 hover:text-red-800" onClick={() => setDeleteConfirm({ isOpen: true, id: f.id, type: 'folha' })}>🗑️</button>
                                  </td>
                              </tr>
                          ))
                      )}
                  </tbody>
              </table>
            </div>
        </div>

        {/* View Document Modal */}
        {viewDoc && (() => {
            const calculateRowValue = (p: any, type: 'fatura' | 'folha') => {
                const base = type === 'fatura' ? (p.valorPlantao || 0) : (p.valorRepasse || 0);
                const adm = type === 'fatura' ? (p.taxaAdm || 0) : 0;
                const ajuda = p.ajudaCusto || 0;
                let mult = 1.0;
                if (p.tipoDia === 'Feriado 20%') mult = 1.2;
                else if (p.tipoDia === 'Feriado 50%') mult = 1.5;
                return (base * mult) + (adm * mult) + ajuda;
            };
            const formatDateBR = (dateStr: string) => {
                if (!dateStr) return '';
                if (dateStr.includes('-')) {
                    return dateStr.split('-').reverse().join('/');
                }
                return dateStr;
            };

            return (
              <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 print:absolute print:inset-0 print:p-0 print:h-auto print:overflow-visible print:bg-white print:z-[999999]">
                  <div className="bg-white p-6 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto print:p-0 print:max-h-none print:max-w-none print:w-full print:bg-white print:static print:shadow-none print:rounded-none print:overflow-visible">
                      <div className="flex justify-between items-center mb-4 print:hidden">
                        <h3 className="font-black text-lg text-slate-800">Visualização de {viewDoc.type === 'fatura' ? 'Fatura' : 'Folha'}</h3>
                        <div className="flex gap-2">
                            <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors">Imprimir PDF</button>
                            <button 
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"
                                onClick={async () => {
                                    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } = await import('docx');
                                    
                                    const empName = empresa?.razaoSocial || 'RH CUIDADO DOMICILIAR';
                                    const empCnpj = empresa?.cnpj || '00.000.000/0000-00';
                                    const empEnd = empresa?.endereco || 'Endereço Comercial';
                                    const docTypeTitle = viewDoc.type === 'fatura' ? 'FATURA COMERCIAL' : 'FOLHA DE PAGAMENTO';
                                    const docNumber = viewDoc.data.numeroFatura || (viewDoc.type === 'folha' ? 'FOLHA-' + viewDoc.data.id.substring(0,6) : 'XXXX');
                                    
                                    const formattedEmission = new Date(viewDoc.data.dataEmissao).toLocaleDateString('pt-BR');
                                    const isFatura = viewDoc.type === 'fatura';
                                    
                                    // 1. Cabeçalho Corporativo
                                    const cmpHeader = new Paragraph({
                                        children: [
                                            new TextRun({ text: empName.toUpperCase(), bold: true, size: 28, color: "1A3C2E" }),
                                        ],
                                        spacing: { after: 60 }
                                    });
                                    const cmpDetails = new Paragraph({
                                        children: [
                                            new TextRun({ text: `CNPJ: ${empCnpj}  |  ${empEnd}`, size: 18, color: "666666" })
                                        ],
                                        spacing: { after: 200 }
                                    });
                                    
                                    // Divisor Dourado (B8860B)
                                    const goldDivider = new Paragraph({
                                        children: [
                                            new TextRun({ text: "=========================================================================", bold: true, color: "B8860B" })
                                        ],
                                        spacing: { after: 200 }
                                    });
                                    
                                    // 2. Metadados do Prontuário / Faturamento
                                    const docTitlePara = new Paragraph({
                                        children: [
                                            new TextRun({ text: docTypeTitle, bold: true, size: 24, color: "1A3C2E" }),
                                            new TextRun({ text: `  (Nº: ${docNumber})`, bold: true, size: 20, color: "B8860B" })
                                        ],
                                        spacing: { after: 120 }
                                    });
                                    
                                    const metaInfo = new Paragraph({
                                        children: [
                                            new TextRun({ text: `Emissão: `, bold: true, size: 18, color: "333333" }),
                                            new TextRun({ text: `${formattedEmission}    |    `, size: 18, color: "333333" }),
                                            new TextRun({ text: `Status: `, bold: true, size: 18, color: "333333" }),
                                            new TextRun({ text: `${viewDoc.data.status}    |    `, size: 18, color: "333333" }),
                                            new TextRun({ text: `${isFatura ? 'Paciente' : 'Profissional'}: `, bold: true, size: 18, color: "333333" }),
                                            new TextRun({ text: `${isFatura ? viewDoc.data.nomePaciente : viewDoc.data.nomeProfissional}`, bold: true, size: 18, color: "1A3C2E" })
                                        ],
                                        spacing: { after: 300 }
                                    });
                                    
                                    // 3. Tabela de Composição de Plantões
                                    const tableHeader = new TableRow({
                                        children: [
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: "Data", bold: true, color: "FFFFFF", size: 18 })] })],
                                                shading: { fill: "1A3C2E" }
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: isFatura ? "Profissional" : "Paciente", bold: true, color: "FFFFFF", size: 18 })] })],
                                                shading: { fill: "1A3C2E" }
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: "Serviço", bold: true, color: "FFFFFF", size: 18 })] })],
                                                shading: { fill: "1A3C2E" }
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: "Valor", bold: true, color: "FFFFFF", size: 18 })] })],
                                                shading: { fill: "1A3C2E" }
                                            })
                                        ]
                                    });
                                    
                                    const tableRows = (viewDoc.data.plantoesCongelados || []).map((p: any) => {
                                        const valorLinha = calculateRowValue(p, viewDoc.type);
                                        return new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatDateBR(p.data), size: 18 })] })] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: isFatura ? p.nomeProfissional : p.nomePaciente, size: 18 })] })] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: p.tipoDia || 'Plantão Normal', size: 18 })] })] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${valorLinha.toFixed(2)}`, size: 18 })] })] })
                                            ]
                                        });
                                    });
                                    
                                    const tableFooterRows: any[] = [];
                                    const totalGlobal = isFatura
                                        ? (viewDoc.data.valorTotal || 0)
                                        : (viewDoc.data.valorLiquidoReceber || 0);
                                        
                                    if (!isFatura && viewDoc.data.valorTotalDebitos > 0) {
                                        tableFooterRows.push(new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph("")] }),
                                                new TableCell({ children: [new Paragraph("")] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "SOMA DOS PLANTÕES:", bold: true, size: 18 })] })] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `R$ ${viewDoc.data.valorTotalPlantoes.toFixed(2)}`, size: 18 })] })] })
                                            ]
                                        }));
                                        tableFooterRows.push(new TableRow({
                                            children: [
                                                new TableCell({ children: [new Paragraph("")] }),
                                                new TableCell({ children: [new Paragraph("")] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "DESCONTOS (DÉBITOS):", bold: true, color: "FF0505", size: 18 })] })] }),
                                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `- R$ ${viewDoc.data.valorTotalDebitos.toFixed(2)}`, color: "FF0505", size: 18 })] })] })
                                            ]
                                        }));
                                    }
                                    
                                    tableFooterRows.push(new TableRow({
                                        children: [
                                            new TableCell({ children: [new Paragraph("")] }),
                                            new TableCell({ children: [new Paragraph("")] }),
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: isFatura ? "TOTAL DA FATURA:" : "VALOR LÍQUIDO A RECEBER:", bold: true, color: "1A3C2E", size: 18 })] })],
                                                shading: { fill: "F0F9F4" }
                                            }),
                                            new TableCell({
                                                children: [new Paragraph({ children: [new TextRun({ text: `R$ ${totalGlobal.toFixed(2)}`, bold: true, color: "1A3C2E", size: 18 })] })],
                                                shading: { fill: "F0F9F4" }
                                            })
                                        ]
                                    }));
                                    
                                    const plantoesTable = new Table({
                                        rows: [
                                            tableHeader,
                                            ...tableRows,
                                            ...tableFooterRows
                                        ],
                                        width: {
                                            size: 100,
                                            type: "pct" as any
                                        }
                                    });
                                    
                                    // 4. Termo de Veracidade e Assinaturas
                                    const spacer = new Paragraph({ children: [new TextRun({ text: "" })], spacing: { after: 400 } });
                                    
                                    const lgpdNotice = new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: "O documento acima compreende dados confidenciais e de uso restrito da coordenadoria do RH Cuidado Domiciliar em conformidade com as diretivas do CFM, COFEN e a Lei Geral de Proteção de Dados (LGPD). É de inteira obrigação das partes a confidencialidade.",
                                                italics: true,
                                                size: 16,
                                                color: "777777"
                                            })
                                        ],
                                        spacing: { after: 600 }
                                    });
                                    
                                    const signatureLinePara = new Paragraph({
                                        children: [
                                            new TextRun({ text: "___________________________                       ___________________________", bold: true, color: "999999" })
                                        ],
                                        spacing: { after: 100 }
                                    });
                                    
                                    const signatureLabelsPara = new Paragraph({
                                        children: [
                                            new TextRun({ text: "      Responsável Clínico / Direção                               Responsável de Enfermagem / Prestador", size: 16, color: "555555" })
                                        ]
                                    });
                                    
                                    const doc = new Document({
                                        sections: [{
                                            children: [
                                                cmpHeader,
                                                cmpDetails,
                                                goldDivider,
                                                docTitlePara,
                                                metaInfo,
                                                plantoesTable,
                                                spacer,
                                                lgpdNotice,
                                                signatureLinePara,
                                                signatureLabelsPara
                                            ]
                                        }]
                                    });
                                    
                                    const blob = await Packer.toBlob(doc);
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `${viewDoc.type === 'fatura' ? 'fatura' : 'folha_pagamento'}_${viewDoc.data.id.substring(0, 8)}.docx`;
                                    a.click();
                                }}
                            >Exportar DOCX</button>
                            <button 
                                 className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-emerald-700 transition-colors"
                                 onClick={() => {
                                     import('xlsx').then(XLSX => {
                                         const plantoes = viewDoc.data.plantoesCongelados || [];
                                         const rows = plantoes.map((p: any) => {
                                             const valorLinha = calculateRowValue(p, viewDoc.type);
                                             return {
                                                 'Data Início': formatDateBR(p.data),
                                                 'Paciente': p.nomePaciente || (viewDoc.type === 'fatura' ? viewDoc.data.nomePaciente : '---'),
                                                 'Profissional': p.nomeProfissional || (viewDoc.type === 'folha' ? viewDoc.data.nomeProfissional : '---'),
                                                 'Serviço': p.tipoDia || 'Plantão Normal',
                                                 'Valor': Number(valorLinha.toFixed(2))
                                             };
                                         });

                                         // Mapeamento e consolidação de rodapés
                                         const totalGlobal = viewDoc.type === 'fatura' 
                                             ? (viewDoc.data.valorTotal || 0) 
                                             : (viewDoc.data.valorLiquidoReceber || 0);

                                         if (viewDoc.type === 'folha' && viewDoc.data.valorTotalDebitos > 0) {
                                             rows.push({
                                                 'Data Início': '',
                                                 'Paciente': '',
                                                 'Profissional': '',
                                                 'Serviço': 'SOMA DOS PLANTÕES',
                                                 'Valor': Number((viewDoc.data.valorTotalPlantoes || 0).toFixed(2))
                                             });
                                             rows.push({
                                                 'Data Início': '',
                                                 'Paciente': '',
                                                 'Profissional': '',
                                                 'Serviço': 'DESCONTOS (DÉBITOS)',
                                                 'Valor': -Number((viewDoc.data.valorTotalDebitos || 0).toFixed(2))
                                             });
                                         }

                                         const labelTotal = viewDoc.type === 'fatura' ? 'TOTAL DA FATURA' : 'TOTAL DA FOLHA';
                                         rows.push({
                                             'Data Início': '',
                                             'Paciente': '',
                                             'Profissional': '',
                                             'Serviço': labelTotal,
                                             'Valor': Number(totalGlobal.toFixed(2))
                                         });

                                         const ws = XLSX.utils.json_to_sheet(rows);
                                         
                                         // Configuração de largura de colunas para melhor legibilidade
                                         ws['!cols'] = [
                                             { wch: 15 }, // Data Início
                                             { wch: 25 }, // Paciente
                                             { wch: 25 }, // Profissional
                                             { wch: 25 }, // Serviço
                                             { wch: 15 }  // Valor
                                         ];

                                         const wb = XLSX.utils.book_new();
                                         XLSX.utils.book_append_sheet(wb, ws, "Documento");
                                         XLSX.writeFile(wb, `${viewDoc.type}_${viewDoc.data.id.substring(0, 8)}.xlsx`);
                                     });
                                 }}
                            >Exportar XLSX</button>
                            <button onClick={() => setViewDoc(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors">Fechar</button>
                        </div>
                      </div>
                      <div id="print-area" className="w-[210mm] p-[10mm] bg-white text-black border border-slate-300 mx-auto print:w-full print:p-0 print:border-none print:shadow-none print:m-0">
                        {/* Header with Company Logo etc */}
                        <div className="flex justify-between items-start border-b-2 border-[#b8860b] pb-4 mb-6">
                            <div className="flex items-center gap-4">
                                 {empresa?.logoUrl && (
                                   <img src={empresa.logoUrl} alt="Logo" className="w-24 h-12 object-contain" />
                                 )}
                                 <div className="text-[#1a3c2e]">
                                   <h2 className="text-xl font-black">{empresa?.razaoSocial || 'EMPRESA PADRÃO'}</h2>
                                   <p className="text-[10px] font-bold">{empresa?.cnpj || '00.000.000/0000-00'} • {empresa?.endereco || 'Endereço Indisponível'}</p>
                                 </div>
                            </div>
                            <div className="text-right text-[#1a3c2e]">
                                 <h2 className="text-lg font-black">{viewDoc.type === 'fatura' ? 'FATURA' : 'FOLHA DE PAGAMENTO'}</h2>
                                 <p className="text-xs font-mono">Nº: {viewDoc.data.numeroFatura || (viewDoc.type === 'folha' ? 'FOLHA-' + viewDoc.data.id.substring(0,6) : 'XXXX')}</p>
                            </div>
                        </div>
                        {/* Data Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-6 text-[10px]">
                            <div><span className="font-bold">Emissão:</span> {new Date(viewDoc.data.dataEmissao).toLocaleDateString('pt-BR')}</div>
                            <div><span className="font-bold">Status:</span> {viewDoc.data.status}</div>
                            <div><span className="font-bold">{viewDoc.type === 'fatura' ? 'Paciente:' : 'Profissional:'}</span> {viewDoc.type === 'fatura' ? viewDoc.data.nomePaciente : viewDoc.data.nomeProfissional}</div>
                            <div><span className="font-bold">Valor Total:</span> R$ {viewDoc.type === 'fatura' ? (viewDoc.data.valorTotal || 0).toFixed(2) : (viewDoc.data.valorLiquidoReceber || 0).toFixed(2)}</div>
                        </div>
                        {/* Plantões Table */}
                        <table className="w-full text-[10px] border-collapse mb-6">
                          <thead>
                            <tr className="bg-[#1a3c2e] text-white border-b-2 border-[#b8860b]">
                              <th className="p-2 text-left">Data</th>
                              <th className="p-2 text-left">{viewDoc.type === 'fatura' ? 'Profissional' : 'Paciente'}</th>
                              <th className="p-2 text-left">Serviço</th>
                              <th className="p-2 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewDoc.data.plantoesCongelados && viewDoc.data.plantoesCongelados.map((p: any, i: number) => {
                              const valorLinha = calculateRowValue(p, viewDoc.type);
                              return (
                                <tr key={i} className="border-b border-[#b8860b]/30">
                                  <td className="p-2">{formatDateBR(p.data)}</td>
                                  <td className="p-2">{viewDoc.type === 'fatura' ? p.nomeProfissional : p.nomePaciente}</td>
                                  <td className="p-2">{p.tipoDia || 'Plantão Normal'}</td>
                                  <td className="p-2 text-right text-[#1a3c2e] font-bold font-mono">R$ {valorLinha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            {viewDoc.type === 'folha' && viewDoc.data.valorTotalDebitos > 0 && (
                              <>
                                <tr className="font-bold bg-slate-50 text-slate-600">
                                  <td colSpan={3} className="p-2 text-right uppercase text-[9px]">Soma dos Plantões:</td>
                                  <td className="p-2 text-right text-slate-700 font-mono">R$ {viewDoc.data.valorTotalPlantoes.toFixed(2)}</td>
                                </tr>
                                <tr className="font-bold bg-red-50 text-red-600">
                                  <td colSpan={3} className="p-2 text-right uppercase text-[9px]">Descontos (Débitos):</td>
                                  <td className="p-2 text-right font-mono">- R$ {viewDoc.data.valorTotalDebitos.toFixed(2)}</td>
                                </tr>
                              </>
                            )}
                            <tr className="font-bold bg-emerald-50 text-[#1a3c2e] text-xs">
                              <td colSpan={3} className="p-2 text-right uppercase">TOTAL</td>
                              <td className="p-2 text-right text-[#1a3c2e] font-black font-mono">
                                R$ {viewDoc.type === 'fatura' 
                                  ? (viewDoc.data.valorTotal || 0).toFixed(2) 
                                  : (viewDoc.data.valorLiquidoReceber || 0).toFixed(2)
                                }
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                  </div>
              </div>
            );
        })()}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4">
                <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
                    <p className="text-sm font-bold text-slate-800">⚠️ Tem certeza que deseja excluir esta Fatura/Folha do histórico? Esta ação não pode ser desfeita.</p>
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold">Não</button>
                        <button onClick={async () => {
                            if(deleteConfirm.type === 'fatura') await deleteFaturaPaciente(deleteConfirm.id);
                            else await deleteFolhaPagamento(deleteConfirm.id);
                            setDeleteConfirm(null);
                        }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold">Sim, Excluir</button>
                    </div>
                </div>
            </div>
        )}
      </div>
    )
  }

/* ----------------------------------------------------
 * Tab 5: Empresa e Configurações Corporativas
 * ---------------------------------------------------- */
import { GestaoAcessos } from './GestaoAcessos';

export const EmpresaDashboard: React.FC = () => {
  const { userRole, setNotification, uploadLogo } = useFirebase();
  const isAdmin = userRole?.toLowerCase() === 'administrador';

  const [razaoSocial, setRazaoSocial] = useState('CuidarHome Prestadora de Serviços Médicos S.A.');
  const [cnpj, setCnpj] = useState('12.345.678/0001-99');
  const [unidadeOperacao, setUnidadeOperacao] = useState('Rio de Janeiro - RJ (Zona Sul & Barra)');
  const [direcaoGeral, setDirecaoGeral] = useState('Renato B. Z.');
  const [logoUrl, setLogoUrl] = useState('');
  const [isEditingMatriz, setIsEditingMatriz] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // States to hold edits temporarily
  const [tempRazao, setTempRazao] = useState('');
  const [tempCnpj, setTempCnpj] = useState('');
  const [tempUnidade, setTempUnidade] = useState('');
  const [tempDirecao, setTempDirecao] = useState('');
  const [tempLogo, setTempLogo] = useState<File | null>(null);
  const [shouldClearLogo, setShouldClearLogo] = useState(false);

  // Diagnostic states
  const [uploadDiagnostics, setUploadDiagnostics] = useState<string[]>([]);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    const fetchMatrizConfig = async () => {
      try {
        const docRef = doc(db, 'configuracoes_empresa', 'empresa');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.razaoSocial) setRazaoSocial(data.razaoSocial);
          if (data.cnpj) setCnpj(data.cnpj);
          if (data.endereco) setUnidadeOperacao(data.endereco);
          if (data.logoUrl) setLogoUrl(data.logoUrl);
        }
      } catch (err) {
        console.error("Erro ao carregar dados da matriz:", err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchMatrizConfig();
  }, []);

  const startEditing = () => {
    setTempRazao(razaoSocial);
    setTempCnpj(cnpj);
    setTempUnidade(unidadeOperacao);
    setTempDirecao(direcaoGeral);
    setTempLogo(null);
    setShouldClearLogo(false);
    setUploadDiagnostics([]);
    setDiagnosticError(null);
    setIsEditingMatriz(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!isAdmin) {
      alert("Apenas administradores podem alterar as informações.");
      return;
    }
    setUploadDiagnostics([]);
    setDiagnosticError(null);
    setIsUploading(true);
    setUploadDiagnostics(prev => [...prev, `[LOG 1/4] Preparando arquivo "${file.name}" (Tamanho original: ${(file.size / 1024).toFixed(1)} KB)...`]);

    try {
      setUploadDiagnostics(prev => [...prev, `[LOG 1.5/4] Otimizando imagem para melhor desempenho...`]);
      const maxW = 180; // super optimized to keep the Firestore doc extremely light (<10KB) under any fallback
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(img.src);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxW) {
            height = (height * maxW) / width;
            width = maxW;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Erro na compressão do canvas'));
          }, 'image/png', 0.85);
        };
        img.onerror = () => reject(new Error('Erro ao carregar imagem para compressão'));
      });

      setUploadDiagnostics(prev => [...prev, `[LOG 2/4] Enviando bytes comprimidos para o Firebase Storage (${(compressedBlob.size / 1024).toFixed(1)} KB)...`]);
      
      let finalUrl = '';
      try {
        const compressedFile = new File([compressedBlob], `logo_${Date.now()}_${file.name}`, { type: 'image/png' });
        finalUrl = await uploadLogo(compressedFile);
        setUploadDiagnostics(prev => [...prev, `[LOG 3/4] Canal principal (Storage) concluído com sucesso.`]);
      } catch (storageErr: any) {
        console.warn("[Diagnóstico] Erro no Firebase Storage. Ativando contingência Base64...", storageErr);
        setUploadDiagnostics(prev => [
          ...prev, 
          `[LOG 2.5/4] ⚠️ Erro no Firebase Storage ou Storage não configurado no console.`,
          `[LOG 3/4] ✅ Ativando contingência Base64 de alta eficiência (imagem super compacta < 10KB)...`
        ]);
        
        const base64Url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(compressedBlob);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(new Error('Falha na conversão de Base64: ' + String(err)));
        });
        finalUrl = base64Url;
      }

      setUploadDiagnostics(prev => [...prev, `[LOG 4/4] Gravando URL da nova logotipo no Firestore...`]);
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      await setDoc(docRef, { logoUrl: finalUrl, updatedAt: new Date().toISOString() }, { merge: true });

      setLogoUrl(finalUrl);
      setTempLogo(null);
      setShouldClearLogo(false);
      setUploadDiagnostics(prev => [...prev, `[LOG SUCESSO] Logo gravada e renderizada imediatamente na tela!`]);
      setNotification('Logo da empresa atualizada e salva com sucesso.');
    } catch (err: any) {
      console.error("[Diagnóstico de Erro] Erro retornado no uploadLogo ou Firestore:", err);
      const errMsg = err.message || String(err);
      setDiagnosticError(`Falha ao salvar logo: ${errMsg}`);
      alert(`Erro ao fazer upload da logo da empresa: ${errMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveMatriz = async () => {
    if (!isAdmin) {
      alert("Apenas administradores podem alterar as informações.");
      return;
    }
    setUploadDiagnostics([]);
    setDiagnosticError(null);
    setIsUploading(true);

    try {
      setUploadDiagnostics(prev => [...prev, `[LOG 4/4] Atualizando dados cadastrais no Firestore: coleção "configuracoes_empresa"...`]);
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      await setDoc(docRef, {
        razaoSocial: tempRazao,
        cnpj: tempCnpj,
        endereco: tempUnidade,
        logoUrl: logoUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setRazaoSocial(tempRazao);
      setCnpj(tempCnpj);
      setUnidadeOperacao(tempUnidade);
      setIsEditingMatriz(false);
      setUploadDiagnostics([]);
      setShouldClearLogo(false);
      setNotification('Dados organizacionais salvos com sucesso.');
    } catch (err: any) {
      console.error("[Diagnóstico de Erro] Erro geral ao salvar dados da matriz:", err);
      setDiagnosticError(`Falha ao gravar no Firestore: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-30" id="empresa-dashboard">
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Configurações Empresa CuidarHome S.A.</h2>
          <p className="text-xs text-slate-400">Configure as políticas gerais de faturamento residencial de plantões e dados da unidade.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Dados da Unidade Matriz */}
          <div className="space-y-3 p-4 bg-slate-50/30 border border-slate-150 border-slate-200/90 rounded-xl flex flex-col justify-between">
            <div className="space-y-3 w-full">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-700">Dados da Unidade Matriz</h4>
                {isAdmin && !isEditingMatriz && (
                  <button 
                    onClick={startEditing}
                    className="px-2 py-0.5 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-white border border-slate-200 rounded-md shadow-sm"
                  >
                    Editar
                  </button>
                )}
              </div>
              
              {isEditingMatriz ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Logotipo da Empresa</label>
                    <div className="flex flex-col gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-4">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-16 h-12 object-contain border rounded bg-slate-50" />
                        ) : (
                          <div className="w-16 h-12 border-2 border-dashed border-slate-200 flex items-center justify-center text-[10px] text-slate-400 bg-slate-50 font-bold rounded">SEM LOGO</div>
                        )}
                        <div className="flex-1 flex flex-col gap-1">
                          <input 
                            type="file" 
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleLogoUpload(file);
                              }
                            }} 
                            accept="image/*" 
                            className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                            disabled={isUploading}
                          />
                          <p className="text-[10px] text-slate-400">O logotipo selecionado é otimizado e salvo imediatamente.</p>
                        </div>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm("Deseja realmente excluir o logotipo da empresa?")) {
                                try {
                                  setIsUploading(true);
                                  const docRef = doc(db, 'configuracoes_empresa', 'empresa');
                                  await setDoc(docRef, { logoUrl: '', updatedAt: new Date().toISOString() }, { merge: true });
                                  setLogoUrl('');
                                  setTempLogo(null);
                                  setShouldClearLogo(true);
                                  setNotification('Logotipo removido com sucesso.');
                                } catch (err: any) {
                                  alert(`Erro ao excluir logotipo: ${err.message || String(err)}`);
                                } finally {
                                  setIsUploading(false);
                                }
                              }
                            }}
                            className="px-2 py-1 text-[10px] font-bold text-red-600 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 rounded border border-red-200 cursor-pointer"
                            disabled={isUploading}
                          >
                            Excluir Logo
                          </button>
                        )}
                      </div>

                      {/* Diagnostic Log Panel */}
                      {(uploadDiagnostics.length > 0 || isUploading || diagnosticError) && (
                        <div className="mt-2 p-3 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-mono space-y-1">
                          <div className="flex justify-between items-center text-slate-400 border-b border-slate-850 pb-1 mb-1 font-bold">
                            <span>📡 DIAGNÓSTICO DE UPLOAD EM TEMPO REAL</span>
                            <span className={isUploading ? "animate-pulse text-yellow-500 font-bold" : diagnosticError ? "text-red-500 font-bold" : "text-green-500 font-bold"}>
                              {isUploading ? "PROCESSANDO..." : diagnosticError ? "FALHA" : "SUCESSO"}
                            </span>
                          </div>
                          
                          <div className="max-h-[120px] overflow-y-auto space-y-1">
                            {uploadDiagnostics.map((line, idx) => (
                              <div key={idx} className="text-emerald-400 py-0.5">{line}</div>
                            ))}
                            {diagnosticError && (
                              <div className="text-red-400 font-bold border border-red-900/50 p-1 rounded bg-red-950/40 mt-1 whitespace-pre-wrap">
                                🚫 {diagnosticError}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Razão Social</label>
                    <input 
                      value={tempRazao} 
                      onChange={e => setTempRazao(e.target.value)} 
                      type="text" 
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">CNPJ</label>
                    <input 
                      value={tempCnpj} 
                      onChange={e => setTempCnpj(e.target.value)} 
                      type="text" 
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Unidade de Operação</label>
                    <input 
                      value={tempUnidade} 
                      onChange={e => setTempUnidade(e.target.value)} 
                      type="text" 
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Direção Geral Regional</label>
                    <input 
                      value={tempDirecao} 
                      onChange={e => setTempDirecao(e.target.value)} 
                      type="text" 
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {logoUrl && <img src={logoUrl} alt="Logo" className="w-24 h-16 object-contain border rounded bg-white shadow-sm" />}
                  <p>Razão Social: <strong className="text-slate-700">{razaoSocial}</strong></p>
                  <p>CNPJ: <strong className="text-slate-700">{cnpj}</strong></p>
                  <p>Unidade de Operação: <strong className="text-slate-700 text-blue-600">{unidadeOperacao}</strong></p>
                  <p>Direção Geral Regional: <strong className="text-slate-700">{direcaoGeral}</strong></p>
                </div>
              )}
            </div>

            {isAdmin && isEditingMatriz && (
              <div className="flex items-center gap-2 pt-2 justify-end">
                <button 
                  onClick={() => setIsEditingMatriz(false)}
                  className="px-3 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-[11px] font-semibold transition-colors cursor-pointer bg-white"
                  disabled={isUploading}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveMatriz}
                  className="px-3 py-1.5 bg-[#1a3626] hover:bg-[#254a34] text-white rounded-full text-[11px] font-semibold shadow-sm transition-colors cursor-pointer"
                  disabled={isUploading}
                >
                  {isUploading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {isAdmin && <GestaoAcessos />}
    </div>
  );
};
