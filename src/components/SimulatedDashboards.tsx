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
  Pencil,
  Search,
  Printer,
  FileDown,
  ChevronDown
} from 'lucide-react';
import { INITIAL_PROFESSIONALS } from '../mockData';
import { useFirebase } from '../context/FirebaseContext';
import { Agendamento, DebitoProfissional } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { mascaraCNPJ } from '../lib/masks';
import { toast } from 'react-hot-toast';

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
  const [filtroStatus, setFiltroStatus] = useState<string>('Todos');
  const [busca, setBusca] = useState<string>('');

  const handlePrint = () => {
    window.print();
  };

  const escalasData = [
    { id: 1, profissional: 'João Albuquerque (12h - Dia)', detalhes: 'Dra. Maria Santos • Entrada regular às 07:00', status: 'ATIVO', cor: 'emerald' },
    { id: 2, profissional: 'Maria Eduarda (24h)', detalhes: 'Enf. Juliana Silveira • Início às 08:00', status: 'ATIVO', cor: 'emerald' },
    { id: 3, profissional: 'Roberto Carlos Silva (Fisioterapia)', detalhes: 'Fis. Dra. Luciana Varela • Visita técnica domiciliar às 15:30', status: 'AGENDADO', cor: 'amber' },
  ];

  const filteredEscalas = escalasData.filter(escala => {
    const matchesStatus = filtroStatus === 'Todos' || escala.status === filtroStatus;
    const matchesBusca = 
      escala.profissional.toLowerCase().includes(busca.toLowerCase()) || 
      escala.detalhes.toLowerCase().includes(busca.toLowerCase());
    return matchesStatus && matchesBusca;
  });

  return (
    <div className="space-y-4 animate-in fade-in-30" id="escalas-dashboard">
      {/* Visual Report Header ONLY during print */}
      <div className="hidden print:block border-b-2 border-[#1a3c2e] pb-4 mb-4">
        <h1 className="text-xl font-bold text-[#1a3c2e] uppercase">SISTEMA RH CUIDADO DOMICILIAR</h1>
        <h2 className="text-lg font-black text-slate-800">Relatório de Escala de Plantões Diária</h2>
        <p className="text-xs text-slate-500 mt-1">Visão integrada das escalas ativas para o dia 12/06/2026</p>
        <div className="flex gap-4 text-[10px] text-slate-400 mt-2">
          <span><strong>Filtro de Status:</strong> {filtroStatus}</span>
          {busca && <span><strong>Filtro de Pesquisa:</strong> "{busca}"</span>}
          <span><strong>Total Filtrado:</strong> {filteredEscalas.length} de {escalasData.length} escalas</span>
        </div>
      </div>

      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-sidebar-divider border-slate-100 pb-3 gap-3 print:border-slate-300">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Painel Consolidado de Escalas Diárias</h2>
            <p className="text-xs text-slate-400">Visão integrada de prestadores escalados para o dia de hoje (12/06/2026).</p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto print:hidden">
            <span className="text-xs bg-slate-100 px-3 py-1.5 rounded-lg font-bold text-slate-600">12/06/2026</span>
            <button
              onClick={handlePrint}
              className="text-xs bg-[#1a3c2e] text-[#b8860b] hover:bg-[#122b21] px-4 py-1.5 rounded-lg font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-[1.01]"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir Relatório
            </button>
          </div>
        </div>

        {/* Filters and search block - hidden when printing */}
        <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 print:hidden relative z-10">
          <div className="flex-1 relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              placeholder="Pesquisar por cuidador ou paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1a3c2e]"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 px-2 absolute right-2"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Filtrar Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="p-1.5 px-3 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1a3c2e] cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="ATIVO">Ativos</option>
              <option value="AGENDADO">Agendados</option>
            </select>
          </div>
        </div>

        {/* Calendar timeline visual placeholder */}
        <div className="grid grid-cols-7 gap-1 border border-slate-100 rounded-xl overflow-hidden bg-slate-50 text-center text-[10px] uppercase font-bold text-slate-500 select-none print:hidden">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
            <div key={d} className={`p-2 border-r border-slate-100 last:border-0 ${d === 'Sex' ? 'bg-blue-600 text-white' : 'bg-slate-100/50'}`}>
              {d === 'Sex' ? 'Hoje (Sex)' : d}
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {filteredEscalas.length === 0 ? (
            <div className="text-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
              <p className="text-xs text-slate-500 italic">Nenhuma escala encontrada com as configurações atuais de filtro.</p>
            </div>
          ) : (
            filteredEscalas.map(escala => (
              <div 
                key={escala.id} 
                className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                  escala.status === 'ATIVO' 
                    ? 'bg-emerald-50/45 border-emerald-100' 
                    : 'bg-amber-50/45 border-amber-100'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    escala.status === 'ATIVO' ? 'bg-emerald-500' : 'bg-amber-500'
                  } ${escala.id === 1 ? 'animate-ping print:animate-none' : ''}`}></span>
                  <div>
                    <p className="font-semibold text-slate-800">{escala.profissional}</p>
                    <p className="text-[10px] text-slate-400">{escala.detalhes}</p>
                  </div>
                </div>
                <span className={`font-bold uppercase tracking-wider ${
                  escala.status === 'ATIVO' ? 'text-emerald-700' : 'text-amber-700'
                }`}>{escala.status}</span>
              </div>
            ))
          )}
        </div>

        <p className="text-[10px] text-slate-400 italic print:hidden">
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
    addFolhaPagamento,
    setNotification
  } = useFirebase();

  const activePacientes = pacientes.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  const activeProfissionais = profissionais.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  
  const [subTab, setSubTab] = useState<'folhas' | 'debitos' | 'historico'>(initialSubTab as any);

  React.useEffect(() => {
    setSubTab(initialSubTab as any);
  }, [initialSubTab]);
  const [financeTab, setFinanceTab] = useState<'fatura' | 'pagamento' | 'mei' | 'valor_mei'>('fatura');
  const [meiProfissionaisSelecionados, setMeiProfissionaisSelecionados] = useState<string[]>([]);
  const [referenciaMes, setReferenciaMes] = useState<number>(() => new Date().getMonth() + 1);
  const [referenciaAno, setReferenciaAno] = useState<number>(() => new Date().getFullYear());
  const [meiResult, setMeiResult] = useState<{ profissionalId: string; nome: string; cnpj: string }[]>([]);
  const [showMeiDropdown, setShowMeiDropdown] = useState(false);
  const [meiSearch, setMeiSearch] = useState('');

  // States for Valor MEI configuration
  const [valorMei, setValorMei] = useState<number>(0);
  const [isEditingValorMei, setIsEditingValorMei] = useState(false);
  const [tempValorMei, setTempValorMei] = useState<string>('0');
  const [loadingValorMei, setLoadingValorMei] = useState(false);

  // States for Bulk Payroll Processing (Fechamento em Lote)
  const [selectedProfissionais, setSelectedProfissionais] = useState<string[]>([]);
  const [expandedProfissionais, setExpandedProfissionais] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const meiProfissionais = activeProfissionais.filter(p => p.temMei && !p.meiIrregular && p.cnpj && p.cnpj.trim() !== '');

  const getReferenciaMesNome = (m: number) => {
    const list = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return list[m - 1] || '';
  };

  const isEscalaFechada = async (id: string, type: 'paciente' | 'profissional', start: string, end: string): Promise<boolean> => {
    const agQuery = query(
      collection(db, 'agendamentos'),
      where(type === 'paciente' ? 'idPaciente' : 'idProfissional', '==', id),
      where('data', '>=', start),
      where('data', '<=', end)
    );
    const agSnap = await getDocs(agQuery);
    let closed = true;
    agSnap.forEach(d => {
      const agObj = d.data() as Agendamento;
      if (agObj.status !== 'Cancelado') {
        if (!agObj.escalaCongelada && agObj.status !== 'Concluido') {
          closed = false;
        }
      }
    });
    return closed;
  };

  const getMonthYearString = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parts[0];
      const month = String(parseInt(parts[1], 10)).padStart(2, '0');
      return `${month}/${year}`;
    }
    return '';
  };

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
    const fetchValorMei = async () => {
        setLoadingValorMei(true);
        try {
            const docRef = doc(db, 'configs', 'valor_mei');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setValorMei(data.valor || 0);
                setTempValorMei(String(data.valor || 0));
            }
        } catch (err) {
            console.error("Error loading valor_mei: ", err);
        } finally {
            setLoadingValorMei(false);
        }
    };
    fetchEmpresa();
    fetchValorMei();
  }, []);

  const handleSaveValorMei = async () => {
    const numericValue = parseFloat(tempValorMei || '0');
    if (isNaN(numericValue) || numericValue < 0) {
      alert("Por favor, digite um valor numérico válido maior ou igual a zero.");
      return;
    }
    setLoadingValorMei(true);
    try {
      const docRef = doc(db, 'configs', 'valor_mei');
      await setDoc(docRef, { valor: numericValue }, { merge: true });
      setValorMei(numericValue);
      setIsEditingValorMei(false);
      alert("Valor MEI salvo com sucesso!");
    } catch (err: any) {
      console.error("Error saving valor_mei: ", err);
      alert("Erro ao salvar o Valor MEI: " + err.message);
    } finally {
      setLoadingValorMei(false);
    }
  };

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
  const [newDebitMotivo, setNewDebitMotivo] = useState<string>('Curinga');
  const [isInsertingDebit, setIsInsertingDebit] = useState(false);
  const [editingDebitId, setEditingDebitId] = useState<string | null>(null);
  const [newDebitPacienteId, setNewDebitPacienteId] = useState('');
  const [debitFilterStartDate, setDebitFilterStartDate] = useState('');
  const [debitFilterEndDate, setDebitFilterEndDate] = useState('');
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

  const getDebitDateObj = (val: any): Date | null => {
    if (!val) return null;
    try {
      if (typeof val.toDate === 'function') {
        return val.toDate();
      } else if (val instanceof Date) {
        return val;
      } else if (val.seconds) {
        return new Date(val.seconds * 1000);
      } else {
        return new Date(val);
      }
    } catch (err) {
      return null;
    }
  };

  const handleGerarRelatorios = async () => {
    if (financeTab === 'mei') {
      if (meiProfissionaisSelecionados.length === 0) {
        alert('Por favor, selecione ao menos um profissional MEI para gerar a listagem.');
        return;
      }
    } else {
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
    }
    
    setIsGenerating(true);
    setHasGenerated(false);
    try {
      const agendamentosRef = collection(db, 'agendamentos');
      
      let q;
      if (financeTab === 'mei') {
        const startStr = `${referenciaAno}-${String(referenciaMes).padStart(2, '0')}-01`;
        const maxDays = new Date(referenciaAno, referenciaMes, 0).getDate();
        const endStr = `${referenciaAno}-${String(referenciaMes).padStart(2, '0')}-${String(maxDays).padStart(2, '0')}`;
        q = query(
          agendamentosRef,
          where('data', '>=', startStr),
          where('data', '<=', endStr)
        );
      } else if (financeTab === 'fatura') {
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

      if (financeTab === 'mei') {
        const selectedMEIProfs = activeProfissionais.filter(
          p => p.temMei && !p.meiIrregular && p.cnpj && p.cnpj.trim() !== '' && meiProfissionaisSelecionados.includes(p.id)
        );

        const profsWithPlantoes = selectedMEIProfs.filter(prof => {
          return docs.some(ag => ag.idProfissional === prof.id && ag.status !== 'Cancelado');
        });

        const resultList = profsWithPlantoes.map(p => ({
          profissionalId: p.id,
          nome: p.nome,
          cnpj: p.cnpj || ''
        }));

        setMeiResult(resultList);
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
        const matchesDate = financeTab === 'mei' ? false : (debitDateStr >= dataInicial && debitDateStr <= dataFinal);
        
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
      setSelectedProfissionais([]);
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
      // 1. Validação de Escala Fechada (Pré-requisito)
      const closed = await isEscalaFechada(pacId, 'paciente', dataInicial, dataFinal);
      if (!closed) {
        alert('Ação negada: A escala do período selecionado ainda não foi fechada pela coordenação.');
        setIsSaving(false);
        return;
      }

      // 2. Trava Anti-Duplicidade no Histórico
      const targetMonthYear = getMonthYearString(dataInicial);
      const faturasQuery = query(
        collection(db, 'faturas_pacientes'),
        where('idPaciente', '==', pacId)
      );
      const faturasSnap = await getDocs(faturasQuery);
      let faturaExists = false;
      faturasSnap.forEach(doc => {
        const fatObj = doc.data();
        if (fatObj.periodoApurado && fatObj.periodoApurado.inicio) {
          const existingMonthYear = getMonthYearString(fatObj.periodoApurado.inicio);
          if (existingMonthYear === targetMonthYear) {
            faturaExists = true;
          }
        }
      });
      if (faturaExists) {
        alert('Aviso: A fatura/folha para este período já foi emitida. Para gerar novamente, é necessário excluir o registro atual no Histórico Financeiro.');
        setIsSaving(false);
        return;
      }

      const pac = pacientes.find(p => p.id === pacId);
      const totalFatura = agends.reduce((acc, ag) => acc + getAgendamentoCalculatedValues(ag).cobradoDia, 0);

      // 3. Bloqueio de Emissão Zerada / Negativa
      if (totalFatura <= 0) {
        alert('Não é possível gerar uma fatura com valor zerado ou negativo.');
        setIsSaving(false);
        return;
      }

      const numero = await getNextFaturaNumber();

      await addFaturaPaciente({
        idPaciente: pacId,
        nomePaciente: pac?.nome || 'Paciente Desconhecido',
        numeroFatura: numero,
        dataEmissao: new Date().toISOString(),
        periodoApurado: { inicio: dataInicial, fim: dataFinal },
        valorTotal: totalFatura,
        status: 'Fechada',
        plantoesCongelados: agends.map(ag => ({
          ...ag,
          profissional: ag.nomeProfissional || 'Não atribuído',
          nomeProfissional: ag.nomeProfissional || 'Não atribuído'
        }))
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
        const profId = profissionais.find(p => p.nome === profName)?.id;
        const pId = profId || 'prof-desconhecido';

        // 1. Validação de Escala Fechada (Pré-requisito)
        const closed = await isEscalaFechada(pId, 'profissional', dataInicial, dataFinal);
        if (!closed) {
          alert('Ação negada: A escala do período selecionado ainda não foi fechada pela coordenação.');
          setIsSaving(false);
          return;
        }

        // 2. Trava Anti-Duplicidade no Histórico
        const targetMonthYear = getMonthYearString(dataInicial);
        const folhasQuery = query(
          collection(db, 'folhas_pagamento'),
          where('idProfissional', '==', pId)
        );
        const folhasSnap = await getDocs(folhasQuery);
        let folhaExists = false;
        folhasSnap.forEach(doc => {
          const folObj = doc.data();
          if (folObj.periodoApurado && folObj.periodoApurado.inicio) {
            const existingMonthYear = getMonthYearString(folObj.periodoApurado.inicio);
            if (existingMonthYear === targetMonthYear) {
              folhaExists = true;
            }
          }
        });
        if (folhaExists) {
          alert('Aviso: A fatura/folha para este período já foi emitida. Para gerar novamente, é necessário excluir o registro atual no Histórico Financeiro.');
          setIsSaving(false);
          return;
        }

        let somaRepasses = 0; let somaAjudas = 0;
        agends.forEach(ag => {
            const vals = getAgendamentoCalculatedValues(ag);
            somaRepasses += vals.valorRepasseFinal;
            somaAjudas += vals.ajudaCusto;
        });

        const profissional = profissionais.find(p => p.nome === profName || (profId && p.id === profId));
        
        const debDocsForProf = debitosNoPeriodo.filter(d => 
            ((profId && d.idProfissional === profId) || 
            d.nomeProfissional.toLowerCase() === profName.toLowerCase()) &&
            (d.status === 'pendente' || d.status === undefined)
        );

        let totalPlantoes = somaRepasses;
        let totalAjudaCusto = somaAjudas;
        let totalDebitos = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);

        let valorLiquido = totalPlantoes + totalAjudaCusto - totalDebitos;

        const valorMeiGlobal = parseFloat(String(valorMei || 0));

        const listDebs = [...debDocsForProf];
        let finalTotalDebitos = totalDebitos;

        const parts = dataInicial.split('-');
        const month = parts[1] ? parseInt(parts[1], 10) : referenciaMes;
        const year = parts[0] ? parseInt(parts[0], 10) : referenciaAno;

        let retroMonth = month - 1;
        let retroYear = year;
        if (retroMonth === 0) {
          retroMonth = 12;
          retroYear = year - 1;
        }
        const mesFormatado = String(retroMonth).padStart(2, '0');
        const anoFormatado = retroYear;
        const textoMotivo = `RETENÇÃO DE GUIA MEI - REF. ${mesFormatado}/${anoFormatado}`;

        // Deduct MEI value if temMei
        if (profissional && profissional.temMei && !profissional.meiIrregular && valorMeiGlobal > 0) {
            valorLiquido -= valorMeiGlobal;

            // Injetar o débito descritivo ("Retenção de Guia MEI")
            const autoDebit = {
              idProfissional: profId || 'prof-desconhecido',
              nomeProfissional: profName,
              data: new Date(),
              valor: valorMeiGlobal,
              motivo: textoMotivo,
              status: 'descontado' as const
            };
            const savedDebit = await addDebitoProfissional(autoDebit);
            listDebs.push(savedDebit);
            finalTotalDebitos += valorMeiGlobal;
        }

        // 3. Bloqueio de Emissão Zerada
        if (valorLiquido <= 0) {
          alert('Não é possível gerar uma folha com valor zerado ou negativo.');
          setIsSaving(false);
          return;
        }

        const savedFolha = await addFolhaPagamento({
            idProfissional: profId || 'prof-desconhecido',
            nomeProfissional: profName,
            dataEmissao: new Date().toISOString(),
            periodoApurado: { inicio: dataInicial, fim: dataFinal },
            valorTotalPlantoes: totalPlantoes + totalAjudaCusto,
            valorTotalDebitos: finalTotalDebitos,
            valorLiquidoReceber: valorLiquido,
            status: 'Fechada',
            historicoDebitos: listDebs,
            plantoesCongelados: agends
        });

        // 3. Liquidação (Baixa) Automática de débitos pendentes que entraram no cálculo
        for (const deb of debDocsForProf) {
          await updateDebitoProfissional({
            ...deb,
            status: 'descontado',
            folhaIdVinculada: savedFolha.id
          });
        }

        // Associa a folha ao débito MEI automático se existir no histórico
        const meiDebit = listDebs.find(d => d.id !== 'virtual-mei-debit' && d.motivo === textoMotivo);
        if (meiDebit && meiDebit.id) {
          await updateDebitoProfissional({
            ...meiDebit,
            status: 'descontado',
            folhaIdVinculada: savedFolha.id
          });
        }
        alert(`Folha para ${profName} fechada com sucesso!`);
      } catch (err) {
        console.error(err);
        alert('Erro ao fechar folha.');
      } finally {
        setIsSaving(false);
      }
  };

  const processBatchPayroll = async () => {
    setIsBatchProcessing(true);
    try {
      const parts = dataInicial.split('-');
      const month = parts[1] ? parseInt(parts[1], 10) : referenciaMes;
      const year = parts[0] ? parseInt(parts[0], 10) : referenciaAno;
      const refString = `${String(month).padStart(2, '0')}/${year}`;

      let retroMonth = month - 1;
      let retroYear = year;
      if (retroMonth === 0) {
        retroMonth = 12;
        retroYear = year - 1;
      }
      const mesFormatado = String(retroMonth).padStart(2, '0');
      const anoFormatado = retroYear;
      const textoMotivo = `RETENÇÃO DE GUIA MEI - REF. ${mesFormatado}/${anoFormatado}`;

      // Pre-checks for ALL selected professionals beforehand (Scale Fechada and Anti-duplex)
      const targetMonthYear = getMonthYearString(dataInicial);
      for (const pId of selectedProfissionais) {
        const pObj = profissionais.find(p => p.id === pId);
        const name = pObj?.nome || '';

        // Scale Closed Check
        const closed = await isEscalaFechada(pId, 'profissional', dataInicial, dataFinal);
        if (!closed) {
          alert(`Ação negada: A escala do período selecionado ainda não foi fechada pela coordenação para o profissional ${name}.`);
          setIsBatchProcessing(false);
          return;
        }

        // Anti-duplicity Check
        const folhasQuery = query(
          collection(db, 'folhas_pagamento'),
          where('idProfissional', '==', pId)
        );
        const folhasSnap = await getDocs(folhasQuery);
        let folhaExists = false;
        folhasSnap.forEach(doc => {
          const folObj = doc.data();
          if (folObj.periodoApurado && folObj.periodoApurado.inicio) {
            const existingMonthYear = getMonthYearString(folObj.periodoApurado.inicio);
            if (existingMonthYear === targetMonthYear) {
              folhaExists = true;
            }
          }
        });
        if (folhaExists) {
          alert(`Aviso: A fatura/folha para este período já foi emitida para o profissional ${name}. Para gerar novamente, é necessário excluir o registro atual no Histórico Financeiro.`);
          setIsBatchProcessing(false);
          return;
        }
      }

      await Promise.all(
        selectedProfissionais.map(async (pId) => {
          const profissional = profissionais.find(p => p.id === pId);
          if (!profissional) return;

          const profName = profissional.nome;
          const agends = agendamentosGerados.filter(ag => ag.nomeProfissional === profName);

          let somaRepasses = 0;
          let somaAjudas = 0;
          agends.forEach(ag => {
            const vals = getAgendamentoCalculatedValues(ag);
            somaRepasses += vals.valorRepasseFinal;
            somaAjudas += vals.ajudaCusto;
          });

          // Current debits in the period
          const debDocsForProf = debitosNoPeriodo.filter(d => 
            (d.idProfissional === pId || 
            d.nomeProfissional.toLowerCase() === profName.toLowerCase()) &&
            (d.status === 'pendente' || d.status === undefined)
          );
          let totalDebitos = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);

          let totalPlantoes = somaRepasses;
          let totalAjudaCusto = somaAjudas;

          let valorLiquido = totalPlantoes + totalAjudaCusto - totalDebitos;

          const valorMeiGlobal = parseFloat(String(valorMei || 0));

          const listDebs = [...debDocsForProf];
          let finalTotalDebitos = totalDebitos;

          // Deduct MEI value if temMei
          if (profissional && profissional.temMei && !profissional.meiIrregular && valorMeiGlobal > 0) {
            valorLiquido -= valorMeiGlobal;

            const autoDebit = {
              idProfissional: pId,
              nomeProfissional: profName,
              data: new Date(),
              valor: valorMeiGlobal,
              motivo: textoMotivo,
              status: 'descontado' as const
            };
            const savedDebit = await addDebitoProfissional(autoDebit);
            listDebs.push(savedDebit);
            finalTotalDebitos += valorMeiGlobal;
          }

          // Bloqueio de Emissão Zerada
          if (valorLiquido <= 0) {
            throw new Error(`Não é possível gerar uma folha com valor zerado ou negativo para ${profName}.`);
          }

          const savedFolha = await addFolhaPagamento({
            idProfissional: pId,
            nomeProfissional: profName,
            dataEmissao: new Date().toISOString(),
            periodoApurado: { inicio: dataInicial, fim: dataFinal },
            valorTotalPlantoes: totalPlantoes + totalAjudaCusto,
            valorTotalDebitos: finalTotalDebitos,
            valorLiquidoReceber: valorLiquido,
            status: 'Fechada',
            historicoDebitos: listDebs,
            plantoesCongelados: agends
          });

          // 3. Liquidação (Baixa) Automática de débitos pendentes que entraram no cálculo
          for (const deb of debDocsForProf) {
            await updateDebitoProfissional({
              ...deb,
              status: 'descontado',
              folhaIdVinculada: savedFolha.id
            });
          }

          // Associa a folha ao débito MEI automático se existir no histórico
          const meiDebit = listDebs.find(d => d.id !== 'virtual-mei-debit' && d.motivo === textoMotivo);
          if (meiDebit && meiDebit.id) {
            await updateDebitoProfissional({
              ...meiDebit,
              status: 'descontado',
              folhaIdVinculada: savedFolha.id
            });
          }
        })
      );

      setNotification('Folhas fechadas com sucesso!');
      setSelectedProfissionais([]);
      setShowBatchModal(false);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao fechar as folhas em lote: ' + err.message);
    } finally {
      setIsBatchProcessing(false);
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
    
    if (financeTab === 'mei') {
      csvContent += 'Nome do Profissional;CNPJ\n';
      meiResult.forEach(p => {
        csvContent += `"${p.nome}";"${p.cnpj}"\n`;
      });
    } else if (financeTab === 'fatura') {
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
          ((profId && d.idProfissional === profId) || 
          (d.nomeProfissional.toLowerCase() === profName.toLowerCase())) &&
          (d.status === 'pendente' || d.status === undefined)
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
    const downloadName = financeTab === 'mei'
      ? `Listagem_MEI_${getReferenciaMesNome(referenciaMes)}_${referenciaAno}.csv`
      : `Relatorio_${financeTab}_${dataInicial}_a_${dataFinal}.csv`;
    link.download = downloadName;
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
          ((profId && d.idProfissional === profId) || 
          (d.nomeProfissional.toLowerCase() === profName.toLowerCase())) &&
          (d.status === 'pendente' || d.status === undefined)
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
        motivo: newDebitMotivo,
        status: 'pendente'
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
          🗂️ Emissão de Folhas
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
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4 w-full min-w-0">
                <h3 className="text-sm font-bold text-slate-800 shrink-0">Tipo de Relatório:</h3>
                <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar gap-1 w-full sm:w-auto min-w-0 flex-1">
                  <button
                    id="btn-report-type-fatura"
                    onClick={() => { setFinanceTab('fatura'); setHasGenerated(false); }}
                    className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
                    className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      financeTab === 'pagamento'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💸 Pagamento (Profissional)
                  </button>
                  <button
                    id="btn-report-type-mei"
                    onClick={() => { setFinanceTab('mei'); setHasGenerated(false); }}
                    className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      financeTab === 'mei'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    📁 Listagem MEI
                  </button>
                  <button
                    id="btn-report-type-valor-mei"
                    onClick={() => { setFinanceTab('valor_mei'); setHasGenerated(false); }}
                    className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      financeTab === 'valor_mei'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    💰 Valor MEI
                  </button>
                </div>
              </div>

              {financeTab !== 'valor_mei' && (
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="flex flex-wrap items-end gap-4">
                    {financeTab === 'fatura' && (
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
                    )}

                    {financeTab === 'pagamento' && (
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

                    {financeTab === 'mei' && (
                      <div className="relative">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Selecionar Profissionais MEI</label>
                        <button
                          type="button"
                          onClick={() => setShowMeiDropdown(!showMeiDropdown)}
                          className="p-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[240px] text-left flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                        >
                          <span className="truncate max-w-[200px] block">
                            {meiProfissionaisSelecionados.length === 0
                              ? 'Nenhum selecionado'
                              : meiProfissionaisSelecionados.length === meiProfissionais.length
                              ? '✨ TODOS (' + meiProfissionais.length + ')'
                              : `${meiProfissionaisSelecionados.length} selecionado(s)`}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                        </button>

                        {showMeiDropdown && (
                          <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl p-3 min-w-[280px] max-h-[300px] overflow-y-auto z-[999] space-y-2">
                            <div className="flex gap-2 pb-2 border-b border-slate-100 justify-between items-center text-[10px]">
                              <button
                                type="button"
                                onClick={() => setMeiProfissionaisSelecionados(meiProfissionais.map(p => p.id))}
                                className="text-blue-600 font-bold hover:underline cursor-pointer"
                              >
                                Selecionar Todos
                              </button>
                              <button
                                type="button"
                                onClick={() => setMeiProfissionaisSelecionados([])}
                                className="text-slate-500 font-bold hover:underline cursor-pointer"
                              >
                                Limpar Todos
                              </button>
                            </div>
                            <div className="space-y-1 pt-1">
                              {meiProfissionais.map(p => {
                                const isChecked = meiProfissionaisSelecionados.includes(p.id);
                                return (
                                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 cursor-pointer text-xs text-slate-700 select-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setMeiProfissionaisSelecionados(meiProfissionaisSelecionados.filter(id => id !== p.id));
                                        } else {
                                          setMeiProfissionaisSelecionados([...meiProfissionaisSelecionados, p.id]);
                                        }
                                      }}
                                      className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                    />
                                    <span className="truncate">{p.nome}</span>
                                    {p.cnpj && <span className="text-[9px] text-slate-400 font-mono ml-auto">{p.cnpj}</span>}
                                  </label>
                                );
                              })}
                              {meiProfissionais.length === 0 && (
                                <p className="text-[11px] text-slate-400 italic text-center py-2">Nenhum profissional com MEI ativo no cadastro.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {financeTab !== 'mei' ? (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Data Inicial</label>
                          <input 
                            id="input-finance-data-inicial"
                            type="date"
                            value={dataInicial}
                            onChange={(e) => setDataInicial(e.target.value)}
                            className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Data Final</label>
                          <input 
                            id="input-finance-data-final"
                            type="date"
                            value={dataFinal}
                            onChange={(e) => setDataFinal(e.target.value)}
                            className="p-2 border border-slate-200 rounded-lg text-sm bg-white"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Mês de Referência</label>
                          <select
                            value={referenciaMes}
                            onChange={(e) => setReferenciaMes(Number(e.target.value))}
                            className="p-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[130px] cursor-pointer"
                          >
                            <option value="1">Janeiro</option>
                            <option value="2">Fevereiro</option>
                            <option value="3">Março</option>
                            <option value="4">Abril</option>
                            <option value="5">Maio</option>
                            <option value="6">Junho</option>
                            <option value="7">Julho</option>
                            <option value="8">Agosto</option>
                            <option value="9">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Ano</label>
                          <select
                            value={referenciaAno}
                            onChange={(e) => setReferenciaAno(Number(e.target.value))}
                            className="p-2 border border-slate-200 rounded-lg text-sm bg-white min-w-[90px] cursor-pointer"
                          >
                            <option value="2024">2024</option>
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                          </select>
                        </div>
                      </>
                    )}

                    <button
                      id="btn-finance-gerar-relatorio"
                      onClick={handleGerarRelatorios}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2 h-[38px] cursor-pointer"
                    >
                      {isGenerating ? (
                        <>⏳ Aguarde...</>
                      ) : (
                        <>🔄 Gerar {financeTab === 'fatura' ? 'Fatura' : financeTab === 'pagamento' ? 'Folha de Pagamento' : 'Listagem MEI'}</>
                      )}
                    </button>
                  </div>
                  
                  {/* Buttons removed as requested */}
                </div>
              )}
            </div>
          </div>

          {/* Main spreadsheet display container */}
          <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
            
            {financeTab === 'valor_mei' ? (
              <div className="max-w-md mx-auto py-10 space-y-6 font-sans">
                <div className="text-center space-y-2">
                  <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 shadow-sm border border-amber-100">
                    <DollarSign size={32} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">Configuração de Valor MEI</h3>
                    <p className="text-slate-500 text-xs">Defina o valor em reais (R$) de referência para profissionais MEI.</p>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200/80 p-6 rounded-2xl space-y-4 shadow-sm/50">
                  {loadingValorMei ? (
                    <div className="flex flex-col items-center justify-center py-6 space-y-2">
                      <div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin font-sans"></div>
                      <span className="text-[11px] text-slate-400 font-medium font-mono">Processando...</span>
                    </div>
                  ) : !isEditingValorMei ? (
                    <div className="space-y-5 text-center font-sans">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">VALOR DEFINIDO ATUALMENTE</span>
                        <p className="text-4xl font-black text-slate-800 tracking-tight">R$ {valorMei.toFixed(2)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTempValorMei(String(valorMei));
                          setIsEditingValorMei(true);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer font-sans"
                      >
                        <Pencil size={14} className="text-slate-500" />
                        Editar Valor
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 font-sans">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-600">Valor MEI (R$)</label>
                        <div className="relative rounded-xl shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400 text-xs font-bold">R$</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={tempValorMei}
                            onChange={(e) => setTempValorMei(e.target.value)}
                            placeholder="0,00"
                            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingValorMei(false)}
                          className="flex-1 py-2 px-4 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer font-sans"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveValorMei}
                          className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md shadow-amber-200 hover:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                        >
                          <CheckCircle size={14} />
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : !hasGenerated ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-16 text-center text-slate-500">
                <DollarSign size={48} className="text-slate-300 mx-auto" />
                <div>
                  <p className="font-bold text-slate-700 text-lg">Área de Faturamento</p>
                  <p className="text-sm">Selecione o período apurado e clique em "Gerar Relatórios" para visualizar a folha.</p>
                </div>
              </div>
            ) : (
              <>
                {/* Export Buttons bar using current filtered view */}
                {financeTab !== 'mei' && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60 print:hidden mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span className="text-xs font-bold text-slate-700">Relatório Consolidado Gerado com Sucesso</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handlePrint}
                        className="px-3.5 py-2 bg-[#1a3c2e] hover:bg-[#122b21] hover:scale-[1.01] active:scale-[0.99] text-[#b8860b] rounded-xl text-xs font-black tracking-tight transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" /> Imprimir Relatório
                      </button>
                      <button
                        onClick={exportExcel}
                        className="px-3.5 py-2 bg-[#f8fafc] hover:bg-slate-100 hover:scale-[1.01] text-slate-700 rounded-xl text-xs font-bold tracking-tight border border-slate-200 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileDown className="w-4 h-4 text-emerald-600" /> Exportar Planilha Excel
                      </button>
                      <button
                        onClick={exportWord}
                        className="px-3.5 py-2 bg-[#f8fafc] hover:bg-slate-100 hover:scale-[1.01] text-slate-700 rounded-xl text-xs font-bold tracking-tight border border-slate-200 shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Briefcase className="w-4 h-4 text-blue-600" /> Exportar Word
                      </button>
                    </div>
                  </div>
                )}

                {financeTab === 'mei' && (
                  <div className="space-y-6">
                    {/* Visual Report Header ONLY during print */}
                    <div className="hidden print:block border-b border-slate-300 pb-4 mb-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h1 className="text-xl font-bold text-slate-950 uppercase">SISTEMA RH CUIDADO DOMICILIAR</h1>
                          <h2 className="text-base font-black text-slate-800">Relatório de Listagem MEI</h2>
                          <p className="text-xs text-slate-500 mt-1">Período de Referência: {getReferenciaMesNome(referenciaMes)} de {referenciaAno}</p>
                        </div>
                        {empresa && (
                          <div className="text-right text-xs text-slate-600">
                            <p className="font-bold">{empresa.razaoSocial}</p>
                            <p>CNPJ: {empresa.cnpj}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 print:hidden animate-in fade-in slide-in-from-top-3">
                      <div>
                        <h2 className="text-lg font-black text-slate-800">Listagem MEI de Referência</h2>
                        <h3 className="text-xs font-bold text-slate-500 mt-0.5">
                          Referência: <span className="text-emerald-700 font-extrabold">{getReferenciaMesNome(referenciaMes)} de {referenciaAno}</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Mostrando profissionais MEI selecionados com pelo menos um plantão executado.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={exportExcel}
                          className="px-3 py-2 bg-[#f8fafc] hover:bg-slate-100 hover:scale-[1.01] text-slate-700 rounded-xl text-xs font-bold tracking-tight border border-slate-200 shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                        >
                          <FileDown className="w-4 h-4 text-emerald-600" /> Exportar Planilha Excel
                        </button>
                        <button
                          onClick={handlePrint}
                          className="px-3.5 py-2 bg-[#1a3c2e] hover:bg-[#122b21] hover:scale-[1.01] active:scale-[0.99] text-[#b8860b] rounded-xl text-xs font-black tracking-tight transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-4 h-4" /> Imprimir Relatório
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-sm animate-in fade-in duration-300">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold border-b border-slate-200/80">
                            <th className="p-4 font-black">Nome do Profissional</th>
                            <th className="p-4 font-black">CNPJ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {meiResult.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="p-10 text-center text-slate-400 italic bg-slate-50/20">
                                Nenhum profissional MEI selecionado executou plantões no mês de referência.
                              </td>
                            </tr>
                          ) : (
                            meiResult.map((p, index) => (
                              <tr key={p.profissionalId || index} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-bold text-slate-800">{p.nome}</td>
                                <td className="p-4 font-mono text-slate-600">{p.cnpj}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

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
                              <div className="flex gap-4 items-center print:hidden">
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
                    <div className="border-b border-slate-200 pb-2 mb-4 flex justify-between items-end flex-wrap gap-4">
                      <div>
                        <h2 className="text-xl font-black text-slate-800">Folha de Pagamento (Profissionais)</h2>
                        <p className="text-sm text-slate-500">Período Apurado: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>
                      </div>
                    </div>

                    {Object.keys(agendamentosPorProfissional).length === 0 ? (
                      <p className="text-slate-500 italic text-sm">Nenhum plantão ativo neste período.</p>
                    ) : (() => {
                      const calculatedProfs = (Object.entries(agendamentosPorProfissional) as [string, Agendamento[]][]).map(([profName, agends]) => {
                        let somaRepasses = 0;
                        let somaAjudas = 0;
                        agends.forEach(ag => {
                          const vals = getAgendamentoCalculatedValues(ag);
                          somaRepasses += vals.valorRepasseFinal;
                          somaAjudas += vals.ajudaCusto;
                        });
                        
                        const profObj = profissionais.find(p => p.nome === profName);
                        const profId = profObj?.id || `dummy-${profName.toLowerCase().replace(/\s/g, '-')}`;
                        const temMei = profObj?.temMei === true && profObj?.meiIrregular !== true;
                        const cnpj = profObj?.cnpj || '';
                        
                        const debDocsForProf = debitosNoPeriodo.filter(d => 
                          ((profId && d.idProfissional === profId) || 
                          d.nomeProfissional.toLowerCase() === profName.toLowerCase()) &&
                          (d.status === 'pendente' || d.status === undefined)
                        );
                        const totalDebitos = debDocsForProf.reduce((sum, d) => sum + d.valor, 0);
                        
                        const listDebs = [...debDocsForProf];
                        let finalTotalDebitos = totalDebitos;
                        let finalValorLiquidoReceber = (somaRepasses + somaAjudas) - totalDebitos;

                        const valorMeiGlobal = parseFloat(String(valorMei || 0));

                        if (temMei && valorMeiGlobal > 0) {
                          const parts = dataInicial.split('-');
                          const month = parts[1] ? parseInt(parts[1], 10) : referenciaMes;
                          const year = parts[0] ? parseInt(parts[0], 10) : referenciaAno;
                          let retroMonth = month - 1;
                          let retroYear = year;
                          if (retroMonth === 0) {
                            retroMonth = 12;
                            retroYear = year - 1;
                          }
                          const mesFormatado = String(retroMonth).padStart(2, '0');
                          const anoFormatado = retroYear;
                          const textoMotivo = `RETENÇÃO DE GUIA MEI - REF. ${mesFormatado}/${anoFormatado}`;

                          listDebs.push({
                            id: 'virtual-mei-debit',
                            idProfissional: profId,
                            nomeProfissional: profName,
                            data: new Date().toISOString(),
                            valor: valorMeiGlobal,
                            motivo: textoMotivo
                          } as any);

                          finalTotalDebitos += valorMeiGlobal;
                          finalValorLiquidoReceber -= valorMeiGlobal;
                        }
                        
                        return {
                          profId,
                          profName,
                          agends,
                          somaRepasses,
                          somaAjudas,
                          debDocsForProf: listDebs,
                          totalDebitos: finalTotalDebitos,
                          valorLiquidoReceber: finalValorLiquidoReceber,
                          temMei,
                          cnpj
                        };
                      });

                      const isAllSelected = calculatedProfs.length > 0 && selectedProfissionais.length === calculatedProfs.length;
                      const handleSelectAll = (checked: boolean) => {
                        if (checked) {
                          const allIds = calculatedProfs.map(p => p.profId);
                          setSelectedProfissionais(allIds);
                        } else {
                          setSelectedProfissionais([]);
                        }
                      };

                      const handleToggleSelectProfissional = (id: string) => {
                        if (selectedProfissionais.includes(id)) {
                          setSelectedProfissionais(selectedProfissionais.filter(x => x !== id));
                        } else {
                          setSelectedProfissionais([...selectedProfissionais, id]);
                        }
                      };

                      const numSelected = selectedProfissionais.length;
                      const numSelectedWithMei = selectedProfissionais.filter(pId => {
                        const profObj = profissionais.find(p => p.id === pId);
                        return profObj?.temMei === true && profObj?.meiIrregular !== true;
                      }).length;

                      return (
                        <div className="space-y-4">
                          {/* Bulk action toolbar */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl print:hidden">
                            <div>
                              <p className="text-xs font-bold text-indigo-900">Fechamento em Lote (Lançamento Coletivo)</p>
                              <p className="text-[11px] text-indigo-700">Selecione profissionais na tabela para consolidar e fechar suas folhas de uma só vez.</p>
                            </div>
                            <button
                              id="btn-batch-close-payroll"
                              onClick={() => setShowBatchModal(true)}
                              disabled={selectedProfissionais.length === 0}
                              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                selectedProfissionais.length > 0
                                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              💼 Fechar Folha em Lote ({selectedProfissionais.length} selecionados)
                            </button>
                          </div>

                          {/* Unified Modern Dashboard Table */}
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                                <tr>
                                  <th className="py-3 px-4 w-12 text-center select-none print:hidden">
                                    <input
                                      type="checkbox"
                                      checked={isAllSelected}
                                      onChange={(e) => handleSelectAll(e.target.checked)}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                    />
                                  </th>
                                  <th className="py-3 px-4">Profissional</th>
                                  <th className="py-3 px-4 text-center">Plantões</th>
                                  <th className="py-3 px-4 text-right">Repasses (Bruto)</th>
                                  <th className="py-3 px-4 text-right">Ajuda de Custo</th>
                                  <th className="py-3 px-4 text-right">Débitos</th>
                                  <th className="py-3 px-4 text-right font-black text-slate-700">Líquido a Receber</th>
                                  <th className="py-3 px-4 text-center print:hidden">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {calculatedProfs.map((p) => {
                                  const isSelected = selectedProfissionais.includes(p.profId);
                                  const isExpanded = expandedProfissionais.includes(p.profId);

                                  return (
                                    <React.Fragment key={p.profId}>
                                      <tr className={`hover:bg-slate-50/50 transition-colors ${isSelected ? 'bg-indigo-50/10' : ''}`}>
                                        <td className="py-4 px-4 text-center select-none print:hidden">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelectProfissional(p.profId)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                          />
                                        </td>
                                        <td className="py-4 px-4 font-bold text-slate-800">
                                          <div className="flex items-center gap-2">
                                            <span>{p.profName}</span>
                                            {p.temMei && (
                                              <span
                                                className="bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-200"
                                                title={`MEI Ativo: ${p.cnpj}`}
                                              >
                                                MEI
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="py-4 px-4 text-center font-mono font-bold text-slate-600">{p.agends.length}</td>
                                        <td className="py-4 px-4 text-right font-mono text-slate-600">R$ {p.somaRepasses.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-right font-mono text-slate-600">R$ {p.somaAjudas.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-right font-mono text-red-600 font-bold font-sans">R$ {p.totalDebitos.toFixed(2)}</td>
                                        <td className="py-4 px-4 text-right font-mono font-black text-indigo-700 text-sm">
                                          R$ {p.valorLiquidoReceber.toFixed(2)}
                                        </td>
                                        <td className="py-4 px-4 print:hidden">
                                          <div className="flex items-center justify-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (isExpanded) {
                                                  setExpandedProfissionais(expandedProfissionais.filter(id => id !== p.profId));
                                                } else {
                                                  setExpandedProfissionais([...expandedProfissionais, p.profId]);
                                                }
                                              }}
                                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                            >
                                              {isExpanded ? '🙈 Ocultar' : '👁️ Ver Plantões'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleFecharFolhaProfissional(p.profName, p.agends)}
                                              disabled={isSaving}
                                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                                            >
                                              {isSaving ? '⏳' : '💾 Fechar'}
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      
                                      {/* Expanded Shift Detail Sub-row */}
                                      {isExpanded && (
                                        <tr>
                                          <td colSpan={8} className="bg-slate-50/50 p-6 border-y border-slate-250 animate-in slide-in-from-top-1 duration-150">
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm max-w-4xl mx-auto">
                                              <div className="bg-indigo-50/40 px-4 py-2 border-b border-indigo-100/50 flex justify-between items-center select-none font-sans">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-900 block">Demonstrativo de Fechamento de {p.profName}</span>
                                                {p.temMei && p.cnpj && <span className="text-[10px] text-indigo-800 font-mono font-bold">CNPJ: {p.cnpj}</span>}
                                              </div>
                                              
                                              <table className="w-full text-left text-[11px] line-height-none">
                                                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider text-[9px] font-semibold">
                                                  <tr>
                                                    <th className="py-2 px-4">Data</th>
                                                    <th className="py-2 px-4">Paciente</th>
                                                    <th className="py-2 px-4 text-right">Repasse</th>
                                                    <th className="py-2 px-4 text-right">Ajuda Custo</th>
                                                    <th className="py-2 px-4 text-right">Tipo de Dia</th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                  {p.agends.sort((a,b) => a.data.localeCompare(b.data)).map(ag => {
                                                    const paciente = pacientes.find(pat => pat.id === ag.idPaciente);
                                                    const nomePac = paciente ? paciente.nome : 'Paciente Desconhecido';
                                                    const vals = getAgendamentoCalculatedValues(ag);
                                                    return (
                                                      <tr key={ag.id} className="hover:bg-slate-50/30">
                                                        <td className="py-2 px-4">{ag.data.split('-').reverse().join('/')}</td>
                                                        <td className="py-2 px-4">{nomePac}</td>
                                                        <td className="py-2 px-4 text-right">R$ {vals.valorRepasseFinal.toFixed(2)}</td>
                                                        <td className="py-2 px-4 text-right">R$ {vals.ajudaCusto.toFixed(2)}</td>
                                                        <td className="py-2 px-4 text-right text-slate-400 font-mono">
                                                          {ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>

                                              <div className="p-4 space-y-2 bg-slate-50/50 border-t border-slate-100 text-[11px] select-none font-sans">
                                                <div className="flex justify-between items-center text-slate-600">
                                                  <span>(+) Somatório de Repasses (Líquido Plantões):</span>
                                                  <span className="font-mono">R$ {p.somaRepasses.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-slate-600">
                                                  <span>(+) Somatório Ajuda de Custo:</span>
                                                  <span className="font-mono">R$ {p.somaAjudas.toFixed(2)}</span>
                                                </div>
                                                
                                                <div className="border-t border-slate-200/60 pt-2">
                                                  <div className="flex justify-between items-start">
                                                    <div className="space-y-1">
                                                      <span className="text-slate-600 font-bold block">(-) Total de Débitos do Período:</span>
                                                      {p.debDocsForProf.length > 0 ? (
                                                        <div className="pl-3 space-y-0.5 text-[10px] text-red-600 font-semibold font-mono">
                                                          {p.debDocsForProf.map(d => (
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
                                                      R$ {p.totalDebitos.toFixed(2)}
                                                    </span>
                                                  </div>
                                                </div>
                                                
                                                <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-indigo-100">
                                                  <span className="font-bold text-indigo-900 text-xs">Valor Líquido a Receber:</span>
                                                  <span className="font-black text-indigo-700 text-sm font-mono">
                                                    R$ {p.valorLiquidoReceber.toFixed(2)}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Batch Modal Rendered dynamically nested */}
                          {showBatchModal && (
                            <div className="fixed inset-0 bg-slate-900/60 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                              <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 select-none">
                                <button
                                  type="button"
                                  onClick={() => setShowBatchModal(false)}
                                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg hover:bg-slate-100"
                                  disabled={isBatchProcessing}
                                >
                                  <X size={18} />
                                </button>

                                <div className="mb-4">
                                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <span>💼 Fechamento de Folha em Lote</span>
                                  </h2>
                                  <p className="text-xs text-slate-450 mt-1">
                                    Resumo prévio dos valores a serem fechados coletivamente.
                                  </p>
                                </div>

                                <div className="space-y-4 font-sans text-xs">
                                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Total de profissionais selecionados:</span>
                                      <span className="font-bold text-slate-850 text-sm">{numSelected}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-500 font-medium">Profissionais identificados com MEI:</span>
                                      <span className="font-bold text-amber-700 text-sm">{numSelectedWithMei}</span>
                                    </div>
                                  </div>

                                  {numSelectedWithMei > 0 && (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex gap-2.5">
                                      <div className="shrink-0 mt-0.5">
                                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                                      </div>
                                      <div className="space-y-1">
                                        <p className="font-bold text-amber-900 text-[11px] uppercase tracking-wide">Atenção (Lançamento Automático):</p>
                                        <p className="leading-normal text-amber-800 font-medium font-sans">
                                          O valor padrão de <span className="font-extrabold underline">R$ {valorMei.toFixed(2)}</span> será descontado automaticamente da folha dos profissionais com MEI ativo, gerando o respectivo registro de débito.
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  <div className="flex gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowBatchModal(false)}
                                      disabled={isBatchProcessing}
                                      className="flex-1 py-2.5 px-4 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={processBatchPayroll}
                                      disabled={isBatchProcessing}
                                      className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-100 hover:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      {isBatchProcessing ? (
                                        <>
                                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          <span>Gravando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle size={14} />
                                          <span>Confirmar Fechamento</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
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
            <div className="flex flex-wrap gap-2 self-start print:hidden">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-[#1a3c2e] hover:bg-[#122b21] hover:scale-[1.01] text-[#b8860b] rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={15} /> Imprimir Relatório
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
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-indigo-600" />
                <p className="text-xs text-slate-500 font-semibold">Consolidação de Débitos Ativos (Salvos na nuvem em tempo real)</p>
              </div>
              
              {/* Filtro por Data */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filtrar por Data:</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={debitFilterStartDate}
                    onChange={(e) => setDebitFilterStartDate(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1a3c2e] focus:border-[#1a3c2e]"
                    placeholder="Início"
                  />
                  <span className="text-slate-400 text-[10px] font-bold">até</span>
                  <input
                    type="date"
                    value={debitFilterEndDate}
                    onChange={(e) => setDebitFilterEndDate(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1a3c2e] focus:border-[#1a3c2e]"
                    placeholder="Fim"
                  />
                  {(debitFilterStartDate || debitFilterEndDate) && (
                    <button
                      onClick={() => {
                        setDebitFilterStartDate('');
                        setDebitFilterEndDate('');
                      }}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      title="Limpar filtros"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-5">Profissional</th>
                    <th className="py-3 px-5">Data do Débito</th>
                    <th className="py-3 px-5">Motivo</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-right font-bold">Valor</th>
                    <th className="py-3 px-5 text-right w-[100px] print:hidden">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const filteredDebitos = (debitosProfissionais || []).filter(d => {
                      const dObj = getDebitDateObj(d.data);
                      if (!dObj) return true;
                      
                      const year = dObj.getFullYear();
                      const month = String(dObj.getMonth() + 1).padStart(2, '0');
                      const day = String(dObj.getDate()).padStart(2, '0');
                      const formattedDateStr = `${year}-${month}-${day}`;

                      if (debitFilterStartDate && formattedDateStr < debitFilterStartDate) {
                        return false;
                      }
                      if (debitFilterEndDate && formattedDateStr > debitFilterEndDate) {
                        return false;
                      }
                      return true;
                    });

                    if (filteredDebitos.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                            {debitosProfissionais.length === 0 
                              ? "Nenhum débito registrado para profissionais cuidador." 
                              : "Nenhum débito encontrado para o período selecionado."}
                          </td>
                        </tr>
                      );
                    }

                    return filteredDebitos.sort((a, b) => {
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
                        <td className="py-3.5 px-5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.status === 'descontado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {d.status === 'descontado' ? 'Descontado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-black text-red-600 text-sm font-mono">R$ {d.valor.toFixed(2)}</td>
                        <td className="py-3.5 px-5 text-right print:hidden">
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
                  })()}
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
                  <option value="MEI">MEI</option>
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

    const faturaRef = useRef<HTMLDivElement>(null);
    const [loadingExport, setLoadingExport] = useState(false);
    const [selectedHistorico, setSelectedHistorico] = useState<string[]>([]);

    const handleExportWord = () => {
        const dadosSelecionados = filteredFolhas
            .filter(f => selectedHistorico.includes(f.id))
            .map(f => {
                let mesRef = '';
                if (f.periodoApurado && f.periodoApurado.inicio) {
                    const parts = f.periodoApurado.inicio.split('-');
                    if (parts.length >= 2) {
                        mesRef = `${parts[1]}/${parts[0]}`;
                    }
                }
                return {
                    nomeProfissional: f.nomeProfissional,
                    mesReferencia: mesRef,
                    valorLiquido: f.valorLiquidoReceber
                };
            });

        const formatCurrency = (val: number) => {
            return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        let rows = dadosSelecionados.map(item => `
          <tr>
            <td style="border: 1px solid black; padding: 5px;">${item.nomeProfissional}</td>
            <td style="border: 1px solid black; padding: 5px; text-align: center;">${item.mesReferencia}</td>
            <td style="border: 1px solid black; padding: 5px; text-align: right;">${formatCurrency(item.valorLiquido)}</td>
          </tr>
        `).join('');

        const htmlStr = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Resumo de Pagamentos</title></head>
        <body style="font-family: Arial, sans-serif; background-color: #ffffff; color: #000000;">
          <h3 style="text-align: center;">RESUMO PARA AGENDAMENTO BANCÁRIO</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 5px; background-color: #ffffff;">Profissional</th>
                <th style="border: 1px solid black; padding: 5px; background-color: #ffffff;">Mês Referência</th>
                <th style="border: 1px solid black; padding: 5px; background-color: #ffffff;">Valor Líquido a Transferir</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
        </html>`;

        const blob = new Blob(['\ufeff' + htmlStr], { type: 'application/msword;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Resumo_Pagamentos.doc';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setSelectedHistorico([]);
    };

    const handleDownloadWordFromCanvas = async (docData: any, type: 'fatura' | 'folha') => {
        setLoadingExport(true);
        const printElement = document.getElementById('print-area') || faturaRef.current;
        if (printElement) {
            try {
                const html2canvas = (await import('html2canvas')).default;
                const canvas = await html2canvas(printElement, {
                    backgroundColor: '#fcf8f2',
                    scale: 2,
                    useCORS: true,
                    logging: false,
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
                
                // Gera a imagem final em altíssima qualidade (JPEG) para evitar o crash/limites do parser html do Word Mobile
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                // Construct dynamic name using requested rule and variable mapping
                const fatura = {
                    paciente: type === 'fatura' ? docData.nomePaciente : docData.nomeProfissional,
                    dataEmissao: docData.dataEmissao && docData.dataEmissao.includes('-')
                        ? docData.dataEmissao.split('-').reverse().join('/')
                        : docData.dataEmissao
                };

                // Cria o link de download direto para o JPEG (Funciona 100% no celular e PC)
                const link = document.createElement('a');
                link.href = imgData;
                link.download = `${type === 'fatura' ? 'Fatura' : 'Folha'}_${fatura?.paciente?.replace(/\s+/g, '_') || 'Paciente'}_${fatura?.dataEmissao?.replace(/\//g, '-') || 'Data'}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                console.log("[FaturaExporter] File downloaded successfully as JPEG.");
            } catch (err: any) {
                console.error("Erro na exportação:", err);
                alert("Houve um problema ao gerar a fatura.");
            }
        } else {
            alert("Referência do elemento do faturamento não encontrada.");
        }
        setLoadingExport(false);
    };

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
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-[#1a3c2e] hover:bg-[#122b21] hover:scale-[1.01] text-[#b8860b] rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Imprimir Relatório
              </button>
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
                        <th className="p-3 text-center print:hidden">Ações</th>
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
                                <td className="p-3 text-center print:hidden">
                                    <div className="flex justify-center items-center gap-2">
                                        <button className="text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => setViewDoc({ data: f, type: 'fatura' })}>👁️</button>
                                        <button className="text-red-600 hover:text-red-800 cursor-pointer" onClick={() => {
                                            setDeleteConfirm({ isOpen: true, id: f.id, type: 'fatura' });
                                        }}>🗑️</button>
                                    </div>
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
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <h2 className="text-md font-black text-slate-800">📜 Histórico de Folhas de Pagamento</h2>
                <button
                  id="btn-download-resumo-pagamento"
                  onClick={handleExportWord}
                  disabled={selectedHistorico.length === 0}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg text-xs font-black transition-colors cursor-pointer"
                >
                  Baixar Resumo para Pagamento
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-[#1a3c2e] hover:bg-[#122b21] hover:scale-[1.01] text-[#b8860b] rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Imprimir Relatório
                </button>
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
                          <th className="p-3 w-10 print:hidden">
                              <input 
                                  type="checkbox"
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={filteredFolhas.length > 0 && selectedHistorico.length === filteredFolhas.length}
                                  onChange={(e) => {
                                      if (e.target.checked) {
                                          setSelectedHistorico(filteredFolhas.map(f => f.id));
                                      } else {
                                          setSelectedHistorico([]);
                                      }
                                  }}
                              />
                          </th>
                          <th className="p-3">Profissional</th>
                          <th className="p-3">Emissão</th>
                          <th className="p-3 text-right">Valor Líquido</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center print:hidden">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {filteredFolhas.length === 0 ? (
                          <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold bg-slate-50/20">
                                  Nenhum registro encontrado para estes filtros.
                              </td>
                          </tr>
                      ) : (
                          filteredFolhas.map(f => (
                              <tr key={f.id}>
                                  <td className="p-3 w-10 print:hidden">
                                      <input 
                                          type="checkbox"
                                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                          checked={selectedHistorico.includes(f.id)}
                                          onChange={(e) => {
                                              if (e.target.checked) {
                                                  setSelectedHistorico(prev => [...prev, f.id]);
                                              } else {
                                                  setSelectedHistorico(prev => prev.filter(id => id !== f.id));
                                              }
                                          }}
                                      />
                                  </td>
                                  <td className="p-3">{f.nomeProfissional}</td>
                                  <td className="p-3">{new Date(f.dataEmissao).toLocaleDateString('pt-BR')}</td>
                                  <td className="p-3 text-right font-bold text-slate-700">R$ {f.valorLiquidoReceber.toFixed(2)}</td>
                                  <td className="p-3 text-center"><span className="px-2 py-1 rounded-full text-[10px] bg-blue-100 text-blue-700 font-bold">{f.status}</span></td>
                                  <td className="p-3 text-center print:hidden">
                                      <div className="flex justify-center items-center gap-2">
                                          <button className="text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => setViewDoc({ data: f, type: 'folha' })}>👁️</button>
                                          <button className="text-red-600 hover:text-red-800 cursor-pointer" onClick={() => {
                                              setDeleteConfirm({ isOpen: true, id: f.id, type: 'folha' });
                                          }}>🗑️</button>
                                      </div>
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
                            <button 
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-700 transition-colors"
                                onClick={async () => {
                                    await handleDownloadWordFromCanvas(viewDoc.data, viewDoc.type);
                                }}
                                disabled={loadingExport}
                            >
                                {loadingExport ? "Gerando..." : "Exportar Imagem (JPEG)"}
                            </button>
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
                      <div id="print-area" ref={faturaRef} className="w-[210mm] p-[10mm] bg-[#fcf8f2] text-black border border-slate-300 mx-auto print:w-full print:p-0 print:border-none print:shadow-none print:m-0">
                        {/* Header with Company Logo etc */}
                        <div className="flex justify-between items-start border-b-2 border-[#b8860b] pb-4 mb-6">
                            <div className="flex items-center gap-4">
                                 {empresa?.logoUrl && (
                                   <img src={empresa.logoUrl} alt="Logo" className="w-24 h-12 object-contain" />
                                 )}
                                 <div className="text-[#1a3c2e]">
                                   <h2 className="text-xl font-black">{empresa?.razaoSocial || 'EMPRESA PADRÃO'}</h2>
                                   <p className="text-sm text-gray-600 font-bold mt-1">CNPJ: {empresa?.cnpj || '00.000.000/0000-00'}</p>
                                   <p className="text-sm text-gray-600 mt-0.5">{empresa?.endereco || 'Endereço Indisponível'}</p>
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
                                  <td className="p-2">
                                    {viewDoc.type === 'fatura' 
                                      ? (p.profissional || p.nomeProfissional || 'A Definir') 
                                      : (p.nomePaciente || 'A Definir')
                                    }
                                  </td>
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
import { BackupProntuarios } from './BackupProntuarios';

export const EmpresaDashboard: React.FC = () => {
  const { userRole, setNotification, uploadLogo } = useFirebase();
  const isAdmin = userRole?.toLowerCase() === 'administrador';

  const [razaoSocial, setRazaoSocial] = useState('CuidarHome Prestadora de Serviços Médicos S.A.');
  const [cnpj, setCnpj] = useState('12.345.678/0001-99');
  const [unidadeOperacao, setUnidadeOperacao] = useState('Rio de Janeiro - RJ (Zona Sul & Barra)');
  const [direcaoGeral, setDirecaoGeral] = useState('Renato B. Z.');
  const [logoUrl, setLogoUrl] = useState('');
  const [dominiosAutorizados, setDominiosAutorizados] = useState('@vallidare.com.br, @cuidarhome.com.br, @rhcuidado.com.br');
  const [isEditingMatriz, setIsEditingMatriz] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // States to hold edits temporarily
  const [tempRazao, setTempRazao] = useState('');
  const [tempCnpj, setTempCnpj] = useState('');
  const [tempUnidade, setTempUnidade] = useState('');
  const [tempDirecao, setTempDirecao] = useState('');
  const [tempDominios, setTempDominios] = useState('');
  const [tempLogo, setTempLogo] = useState<File | null>(null);
  const [shouldClearLogo, setShouldClearLogo] = useState(false);
  const [isResettingDatabase, setIsResettingDatabase] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

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
          if (data.dominiosAutorizados) {
            setDominiosAutorizados(Array.isArray(data.dominiosAutorizados) ? data.dominiosAutorizados.join(', ') : data.dominiosAutorizados);
          }
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
    console.log("startEditing triggered");
    setTempRazao(razaoSocial);
    setTempCnpj(cnpj);
    setTempUnidade(unidadeOperacao);
    setTempDirecao(direcaoGeral);
    setTempDominios(dominiosAutorizados);
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
      toast.success('Logo da empresa atualizada e salva com sucesso.');
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
      toast.error("Apenas administradores podem alterar as informações.");
      return;
    }
    setUploadDiagnostics([]);
    setDiagnosticError(null);
    setIsUploading(true);
    const loadingToast = toast.loading("Salvando dados organizacionais...");

    const cleanDomains = tempDominios
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(d => d.length > 0)
      .map(d => d.startsWith('@') ? d : `@${d}`);

    try {
      setUploadDiagnostics(prev => [...prev, `[LOG 4/4] Atualizando dados cadastrais no Firestore: coleção "configuracoes_empresa"...`]);
      const docRef = doc(db, 'configuracoes_empresa', 'empresa');
      await setDoc(docRef, {
        razaoSocial: tempRazao,
        cnpj: tempCnpj,
        endereco: tempUnidade,
        logoUrl: logoUrl,
        dominiosAutorizados: cleanDomains,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setRazaoSocial(tempRazao);
      setCnpj(tempCnpj);
      setUnidadeOperacao(tempUnidade);
      setDominiosAutorizados(cleanDomains.join(', '));
      setIsEditingMatriz(false);
      
      toast.dismiss(loadingToast);
      toast.success('Dados organizacionais salvos com sucesso.');
    } catch (err: any) {
      console.error("[Diagnóstico de Erro] Erro geral ao salvar dados da matriz:", err);
      toast.dismiss(loadingToast);
      toast.error(`Falha ao gravar no Firestore: ${err.message || String(err)}`);
      setDiagnosticError(`Falha ao gravar no Firestore: ${err.message || String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleHardReset = () => {
    if (!isAdmin) {
      toast.error("Acesso negado. Apenas o administrador tem permissão para realizar o Hard Reset.");
      return;
    }
    setResetConfirmText('');
    setShowResetModal(true);
  };

  const executeHardReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'ZERAR') {
      toast.error("Para prosseguir, você deve digitar 'ZERAR'.");
      return;
    }

    setShowResetModal(false);
    setIsResettingDatabase(true);
    const loadingToast = toast.loading("Zerando banco de dados...");
    try {
      // 1. Coleções de Movimentação e Escalas
      
      // A. Faturas Pacientes
      const faturasSnap = await getDocs(collection(db, 'faturas_pacientes'));
      const fatDocRefs = faturasSnap.docs.map(d => deleteDoc(doc(db, 'faturas_pacientes', d.id)));
      await Promise.all(fatDocRefs);

      // B. Folhas Pagamento
      const folhasSnap = await getDocs(collection(db, 'folhas_pagamento'));
      const folDocRefs = folhasSnap.docs.map(d => deleteDoc(doc(db, 'folhas_pagamento', d.id)));
      await Promise.all(folDocRefs);

      // C. Escalas (agendamentos)
      const agSnap = await getDocs(collection(db, 'agendamentos'));
      const agDocRefs = agSnap.docs.map(d => deleteDoc(doc(db, 'agendamentos', d.id)));
      await Promise.all(agDocRefs);

      // D. Debitos (debitos_profissionais)
      const debSnap = await getDocs(collection(db, 'debitos_profissionais'));
      const debDocRefs = debSnap.docs.map(d => deleteDoc(doc(db, 'debitos_profissionais', d.id)));
      await Promise.all(debDocRefs);

      // E. Plantoes
      const plantoesSnap = await getDocs(collection(db, 'plantoes'));
      const plantoesDocRefs = plantoesSnap.docs.map(d => deleteDoc(doc(db, 'plantoes', d.id)));
      await Promise.all(plantoesDocRefs);

      // F. Backups Prontuários
      const backupsSnap = await getDocs(collection(db, 'backups_prontuarios'));
      const backupsDocRefs = backupsSnap.docs.map(d => deleteDoc(doc(db, 'backups_prontuarios', d.id)));
      await Promise.all(backupsDocRefs);

      // G. Logs de Auditoria
      const logs1Snap = await getDocs(collection(db, 'logs_auditoria'));
      const logs1DocRefs = logs1Snap.docs.map(d => deleteDoc(doc(db, 'logs_auditoria', d.id)));
      await Promise.all(logs1DocRefs);

      const logs2Snap = await getDocs(collection(db, 'audit_logs'));
      const logs2DocRefs = logs2Snap.docs.map(d => deleteDoc(doc(db, 'audit_logs', d.id)));
      await Promise.all(logs2DocRefs);

      const logs3Snap = await getDocs(collection(db, 'LogsAuditoria'));
      const logs3DocRefs = logs3Snap.docs.map(d => deleteDoc(doc(db, 'LogsAuditoria', d.id)));
      await Promise.all(logs3DocRefs);

      // H. Ocorrencias (subcoleção de profissionais)
      const profSnap = await getDocs(collection(db, 'profissionais'));
      for (const profDoc of profSnap.docs) {
        const occColl = collection(db, 'profissionais', profDoc.id, 'ocorrencias');
        const occSnap = await getDocs(occColl);
        const occDocRefs = occSnap.docs.map(d => deleteDoc(doc(db, 'profissionais', profDoc.id, 'ocorrencias', d.id)));
        await Promise.all(occDocRefs);
      }

      // 2. Coleções Base: profissionais, pacientes.
      const profDocRefs = profSnap.docs.map(d => deleteDoc(doc(db, 'profissionais', d.id)));
      await Promise.all(profDocRefs);

      const pacSnap = await getDocs(collection(db, 'pacientes'));
      const pacDocRefs = pacSnap.docs.map(d => deleteDoc(doc(db, 'pacientes', d.id)));
      await Promise.all(pacDocRefs);

      toast.success('Banco de dados zerado com sucesso!', { id: loadingToast });
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao resetar banco:", err);
      toast.error('Erro ao processar', { id: loadingToast });
    } finally {
      setIsResettingDatabase(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-30" id="empresa-dashboard">
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-5">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Dados da Unidade Matriz */}
          <div className="space-y-3 p-4 bg-slate-50/30 border border-slate-150 border-slate-200/90 rounded-xl flex flex-col justify-between">
            <div className="space-y-3 w-full">
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
                                  toast.success('Logotipo removido com sucesso.');
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
                      onChange={e => setTempCnpj(mascaraCNPJ(e.target.value))} 
                      type="text" 
                      maxLength={18}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Endereço:</label>
                    <input 
                      value={tempUnidade} 
                      onChange={e => setTempUnidade(e.target.value)} 
                      type="text" 
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[9px] uppercase font-bold text-slate-400">Domínios de E-mail Autorizados</label>
                    <input 
                      value={tempDominios} 
                      onChange={e => setTempDominios(e.target.value)} 
                      type="text" 
                      placeholder="@vallidare.com.br, @cuidarhome.com.br, @rhcuidado.com.br"
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-xs" 
                    />
                    <p className="text-[10px] text-slate-400">Separe os domínios por vírgula. Ex: @vallidare.com.br, @rhcuidado.com.br</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-6 mb-6">
                    {logoUrl && <img src={logoUrl} alt="Logo" className="w-24 h-16 object-contain border rounded bg-white shadow-sm" />}
                    {isAdmin && (
                      <button 
                        type="button"
                        onClick={() => {
                          console.log("Edit button clicked!");
                          startEditing();
                        }}
                        className="px-4 py-2 text-xs uppercase font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer bg-white border border-slate-200 rounded-md shadow-sm"
                      >
                        Editar
                      </button>
                    )}
                  </div>
                  <p>Razão Social: <strong className="text-slate-700">{razaoSocial}</strong></p>
                  <p>CNPJ: <strong className="text-slate-700">{cnpj}</strong></p>
                  <p>Endereço: <strong className="text-slate-700 text-blue-600">{unidadeOperacao}</strong></p>
                  <p>Domínios de E-mail Autorizados: <strong className="text-slate-700">{dominiosAutorizados || 'Nenhum domínio configurado'}</strong></p>
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
      
      {isAdmin && <BackupProntuarios />}

      {/* Danger Zone / Área de Risco */}
      {isAdmin && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm space-y-4 animate-in fade-in-30">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-red-800 font-sans">Danger Zone / Área de Risco</h3>
              <p className="text-xs text-red-600 mt-0.5">
                Cuidado! As ações abaixo são altamente destrutivas e irreversíveis. Utilize apenas para fins de manutenção ou limpeza completa de dados de teste.
              </p>
            </div>
          </div>
          
          <div className="border-t border-red-150 pt-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="max-w-xl">
              <h4 className="text-xs font-bold text-slate-800">Zerar Banco de Dados (Hard Reset)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Apaga de forma definitiva cadastros de profissionais, pacientes, escalas (agendamentos), faturas, folhas de pagamento, débitos e ocorrências na nuvem. Mantém as configurações organizacionais intactas.
              </p>
            </div>
            <button
              onClick={handleHardReset}
              disabled={isResettingDatabase}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:bg-red-300 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 self-start sm:self-center"
            >
              {isResettingDatabase ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Resetando Banco...</span>
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  <span>Zerar Banco de Dados (Hard Reset)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Hard Reset to avoid iframe sandbox prompt blocking */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-full text-red-600">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-sans">Ação Altamente Destrutiva</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed">
              Você está prestes a realizar um <strong className="text-red-600">Hard Reset</strong>. Isso apagará permanentemente todos os cadastros de pacientes, profissionais, escalas, faturas, folhas de pagamento, logs de auditoria e ocorrências.
            </p>
            
            <p className="text-xs text-slate-500 font-medium">
              Esta ação é <strong className="text-red-600">irreversível</strong>. Para ter certeza absoluta, digite exatamente a palavra <span className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold select-all">ZERAR</span> abaixo:
            </p>
            
            <input 
              type="text" 
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="Digite ZERAR para confirmar"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-center text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none transition-all"
            />
            
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full text-[11px] font-semibold transition-colors cursor-pointer bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeHardReset}
                disabled={resetConfirmText.trim().toUpperCase() !== 'ZERAR'}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-full text-[11px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Confirmar Hard Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
