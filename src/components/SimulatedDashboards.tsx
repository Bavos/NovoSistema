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
  Info
} from 'lucide-react';
import { INITIAL_PROFESSIONALS } from '../mockData';
import { useFirebase } from '../context/FirebaseContext';
import { Agendamento, DebitoProfissional } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';

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
        const docRef = doc(db, 'configuracoes', 'empresa');
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
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

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
            historicoDebitos: debDocsForProf
        });
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

    setIsInsertingDebit(true);
    try {
      const dateObj = parseInputDateToDateObject(newDebitDate);
      await addDebitoProfissional({
        idProfissional: newDebitProfId,
        nomeProfissional: profSelected.nome,
        data: dateObj,
        valor: valNumber,
        motivo: newDebitMotivo
      });
      
      // Reset and Close
      setNewDebitProfId('');
      setNewDebitValor('');
      setNewDebitMotivo('Curinga');
      setShowDebitModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar débito.');
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
            <button
              onClick={() => {
                setNewDebitProfId('');
                setNewDebitValor('');
                setNewDebitMotivo('Curinga');
                setShowDebitModal(true);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5 self-start"
            >
              <Plus size={15} /> Lançar Débito
            </button>
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
                        <td className="py-3.5 px-5 font-semibold text-slate-800">{d.nomeProfissional}</td>
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
                              setDeleteConfirmDialog({
                                isOpen: true,
                                title: 'Excluir Registro de Débito',
                                message: `Tem certeza que deseja excluir o débito de R$ ${d.valor.toFixed(2)} de ${d.nomeProfissional}? Esta ação reajustará o balanço da folha de pagamento do profissional.`,
                                onConfirm: async () => {
                                  try {
                                    await deleteDebitoProfissional(d.id);
                                  } catch (err) {
                                    console.error("Erro ao deletar debito:", err);
                                    alert("Erro ao excluir o débito.");
                                  }
                                }
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer inline-flex items-center justify-center hover:bg-slate-100 rounded"
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
              onClick={() => setShowDebitModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>

            <div className="mb-4">
              <h2 className="text-base font-black text-slate-900">Inserir Débito de Profissional</h2>
              <p className="text-xs text-slate-400 mt-1">Lançamento de desconto pontual para abatimento automático na folha apurada.</p>
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
                  onClick={() => setShowDebitModal(false)}
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
                  {isInsertingDebit ? 'Gravando...' : 'Confirmar Lançamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export const HistoricoFinanceiroDashboard: React.FC = () => {
    const { faturasPacientes, folhasPagamento, deleteFaturaPaciente, deleteFolhaPagamento } = useFirebase();
    const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, type: 'fatura' | 'folha' } | null>(null);
    const [viewDoc, setViewDoc] = useState<{data: any, type: 'fatura' | 'folha' } | null>(null);
    const [empresa, setEmpresa] = useState<any>(null);

    React.useEffect(() => {
        const fetchEmpresa = async () => {
            const docRef = doc(db, 'configuracoes', 'empresa');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setEmpresa(docSnap.data());
            }
        };
        fetchEmpresa();
    }, []);

    return (
      <div className="space-y-6 animate-in fade-in-30">
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
          <h2 className="text-md font-black text-slate-800 mb-4">📜 Histórico de Faturas</h2>
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
                    {faturasPacientes.map(f => (
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
                    ))}
                </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm">
            <h2 className="text-md font-black text-slate-800 mb-4">📜 Histórico de Folhas de Pagamento</h2>
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
                      {folhasPagamento.map(f => (
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
                      ))}
                  </tbody>
              </table>
            </div>
        </div>

        {/* View Document Modal */}
        {viewDoc && (
          <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 print:hidden">
              <div className="bg-white p-6 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-lg text-slate-800">Visualização de {viewDoc.type === 'fatura' ? 'Fatura' : 'Folha'}</h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer">Imprimir PDF</button>
                        <button 
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                            onClick={async () => {
                                const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } = await import('docx');
                                const tableRows = viewDoc.data.plantoesCongelados.map((p: any) => new TableRow({
                                    children: [
                                        new TableCell({ children: [new Paragraph(p.data)] }),
                                        new TableCell({ children: [new Paragraph(viewDoc.type === 'fatura' ? p.nomeProfissional : p.nomePaciente)] }),
                                        new TableCell({ children: [new Paragraph(p.tipoDia || 'Plantão Normal')] }),
                                        new TableCell({ children: [new Paragraph((p.valorPlantao || p.valorRepasse || 0).toFixed(2))] }),
                                    ]
                                }));
                                const doc = new Document({
                                    sections: [{
                                        children: [
                                            new Paragraph({ text: viewDoc.type === 'fatura' ? 'FATURA' : 'FOLHA DE PAGAMENTO', heading: 'Heading1' }),
                                            new Paragraph({ children: [new TextRun(`Nome: ${viewDoc.type === 'fatura' ? viewDoc.data.nomePaciente : viewDoc.data.nomeProfissional}`)] }),
                                            new Table({ rows: [
                                                new TableRow({ children: ["Data", "Paciente/Profissional", "Serviço", "Valor"].map(h => new TableCell({ children: [new Paragraph({ text: h })] })) }),
                                                ...tableRows
                                            ] })
                                        ]
                                    }]
                                });
                                const blob = await Packer.toBlob(doc);
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `${viewDoc.type}.docx`;
                                a.click();
                            }}
                        >Exportar DOCX</button>
                        <button 
                             className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                             onClick={() => {
                                 import('xlsx').then(XLSX => {
                                     const ws = XLSX.utils.json_to_sheet(viewDoc.data.plantoesCongelados.map((p: any) => ({
                                         Data: p.data,
                                         Nome: viewDoc.type === 'fatura' ? p.nomeProfissional : p.nomePaciente,
                                         Tipo: p.tipoDia || 'Plantão Normal',
                                         Valor: p.valorPlantao || p.valorRepasse || 0
                                     })));
                                     const wb = XLSX.utils.book_new();
                                     XLSX.utils.book_append_sheet(wb, ws, "Documento");
                                     XLSX.writeFile(wb, `${viewDoc.type}_${viewDoc.data.id}.xlsx`);
                                 });
                             }}
                        >Exportar XLSX</button>
                        <button onClick={() => setViewDoc(null)} className="px-4 py-2 bg-slate-200 rounded-lg text-xs font-bold">Fechar</button>
                    </div>
                  </div>
                  <div id="print-area" className="w-[210mm] p-[10mm] bg-white text-black border border-slate-300 mx-auto">
                    {/* Header with Company Logo etc */}
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                        <div>
                             {empresa?.logoUrl ? (
                               <img src={empresa.logoUrl} alt="Logo" className="w-24 h-12 object-contain" />
                             ) : (
                               <div className="w-24 h-12 bg-slate-200 border-2 border-slate-800 flex items-center justify-center font-bold text-slate-700">LOGO</div>
                             )}
                             <h2 className="text-xl font-black">{empresa?.razaoSocial || 'EMPRESA PADRÃO'}</h2>
                             <p className="text-[10px]">{empresa?.cnpj || '00.000.000/0000-00'} • {empresa?.endereco || 'Endereço Indisponível'}</p>
                        </div>
                        <div className="text-right">
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
                        <tr className="bg-slate-100 border-b border-slate-300">
                          <th className="p-2 text-left">Data</th>
                          <th className="p-2 text-left">{viewDoc.type === 'fatura' ? 'Profissional' : 'Paciente'}</th>
                          <th className="p-2 text-left">Serviço</th>
                          <th className="p-2 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewDoc.data.plantoesCongelados && viewDoc.data.plantoesCongelados.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2">{p.data}</td>
                            <td className="p-2">{viewDoc.type === 'fatura' ? p.nomeProfissional : p.nomePaciente}</td>
                            <td className="p-2">{p.tipoDia || 'Plantão Normal'}</td>
                            <td className="p-2 text-right">R$ {(p.valorPlantao || p.valorRepasse || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-bold bg-slate-50">
                          <td colSpan={3} className="p-2 text-right">TOTAL</td>
                          <td className="p-2 text-right">R$ {viewDoc.type === 'fatura' ? (viewDoc.data.valorTotal || 0).toFixed(2) : (viewDoc.data.valorLiquidoReceber || 0).toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
              </div>
          </div>
        )}

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

  React.useEffect(() => {
    const fetchMatrizConfig = async () => {
      try {
        const docRef = doc(db, 'configuracoes', 'empresa');
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
    setIsEditingMatriz(true);
  };

  const handleSaveMatriz = async () => {
    if (!isAdmin) {
      alert("Apenas administradores podem alterar as informações.");
      return;
    }
    try {
      let finalLogoUrl = logoUrl;
      if (tempLogo) {
          finalLogoUrl = await uploadLogo(tempLogo);
      }
      
      const docRef = doc(db, 'configuracoes', 'empresa');
      await setDoc(docRef, {
        razaoSocial: tempRazao,
        cnpj: tempCnpj,
        endereco: tempUnidade,
        logoUrl: finalLogoUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setRazaoSocial(tempRazao);
      setCnpj(tempCnpj);
      setUnidadeOperacao(tempUnidade);
      setLogoUrl(finalLogoUrl);
      setIsEditingMatriz(false);
      setNotification('Dados organizacionais da Unidade Matriz alterados e salvos com sucesso.');
    } catch (err) {
      console.error("Erro ao salvar dados da matriz:", err);
      alert("Não foi possível salvar as alterações. Verifique sua conexão.");
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
                    <div className="flex items-center gap-4">
                      {logoUrl && !tempLogo && <img src={logoUrl} alt="Logo" className="w-16 h-12 object-contain border rounded" />}
                      {tempLogo && <img src={URL.createObjectURL(tempLogo)} alt="Novo Logo" className="w-16 h-12 object-contain border rounded" />}
                      <input 
                        type="file" 
                        onChange={e => setTempLogo(e.target.files?.[0] || null)} 
                        accept="image/*" 
                        className="text-xs"
                      />
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
                  {logoUrl && <img src={logoUrl} alt="Logo" className="w-24 h-16 object-contain border rounded" />}
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
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSaveMatriz}
                  className="px-3 py-1.5 bg-[#1a3626] hover:bg-[#254a34] text-white rounded-full text-[11px] font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            )}
          </div>

          {/* Parâmetros de Auditoria de Plantões */}
          <div className="space-y-3 p-4 bg-slate-50/30 border border-slate-150 border-slate-200/90 rounded-xl">
            <h4 className="font-bold text-slate-700">Parâmetros de Auditoria de Plantões</h4>
            <div className="space-y-2">
              <p>Motivos Cancelamento Homologados: <strong className="text-emerald-700 block mt-1">7 motivos cadastrados sob SLA institucional</strong></p>
              <p>Multa familiar por substituição tardia: <strong className="text-slate-700">15% do valor sugerido de plantão</strong></p>
              <p>Prazo padrão de contestação técnica: <strong className="text-slate-700">5 dias úteis</strong></p>
              <p>Integrador Firebase Estado: <strong className="text-slate-700 text-emerald-600 font-semibold font-mono">ATIVO (Simulação Offline-first)</strong></p>
            </div>
          </div>
        </div>
      </div>
      
      {isAdmin && <GestaoAcessos />}
    </div>
  );
};
