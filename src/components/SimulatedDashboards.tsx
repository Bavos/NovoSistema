/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
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
  Clock
} from 'lucide-react';
import { INITIAL_PROFESSIONALS } from '../mockData';
import { useFirebase } from '../context/FirebaseContext';
import { Agendamento } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

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
export const FinanceiroDashboard: React.FC = () => {
  const { pacientes, profissionais } = useFirebase();
  const activePacientes = pacientes.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  const activeProfissionais = profissionais.filter(p => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo');
  
  const [financeTab, setFinanceTab] = useState<'fatura' | 'pagamento'>('fatura');
  const [dataInicial, setDataInicial] = useState('2026-06-01');
  const [dataFinal, setDataFinal] = useState('2026-06-30');
  const [pacienteSelecionado, setPacienteSelecionado] = useState('');
  const [profissionalSelecionado, setProfissionalSelecionado] = useState('');
  const [debitosProfissionais, setDebitosProfissionais] = useState<Record<string, number>>({});

  const [hasGenerated, setHasGenerated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [agendamentosGerados, setAgendamentosGerados] = useState<Agendamento[]>([]);

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
          if (!data.escalaCongelada) {
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
      
      setAgendamentosGerados(docs);
      setHasGenerated(true);
    } catch (error) {
      console.error('Erro ao gerar relatórios:', error);
      alert('Ocorreu um erro ao buscar os dados.');
    } finally {
      setIsGenerating(false);
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
          const cobradoDia = ag.valorPlantao + ag.taxaAdm + ag.ajudaCusto;
          csvContent += `"${pacNome}";"${ag.data.split('-').reverse().join('/')}";"${ag.nomeProfissional}";"${ag.horario}";"${ag.tipoDia || 'Normal'}";${ag.valorPlantao.toFixed(2).replace('.', ',')};${ag.taxaAdm.toFixed(2).replace('.', ',')};${ag.ajudaCusto.toFixed(2).replace('.', ',')};${cobradoDia.toFixed(2).replace('.', ',')}\n`;
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
          csvContent += `"${profName}";"${ag.data.split('-').reverse().join('/')}";"${nomePac}";${ag.valorRepasse.toFixed(2).replace('.', ',')};${ag.ajudaCusto.toFixed(2).replace('.', ',')};"${ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}"\n`;
        });
        
        const somaRepasses = agends.reduce((acc, ag) => acc + ag.valorRepasse, 0);
        const somaAjudas = agends.reduce((acc, ag) => acc + ag.ajudaCusto, 0);
        const debitos = debitosProfissionais[profName] || 0;
        const valorLiquido = (somaRepasses + somaAjudas) - debitos;
        
        csvContent += `""\n`;
        csvContent += `"${profName}";Total;Líquido A Receber (R$);${valorLiquido.toFixed(2).replace('.', ',')};""\n`;
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
        const totalFatura = agends.reduce((acc, ag) => acc + ag.valorPlantao + ag.taxaAdm + ag.ajudaCusto, 0);
        htmlContent += `
          <h2>Paciente: ${pacNome}</h2>
          <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px; font-family: sans-serif;">
            <tr style="background-color: #f1f5f9;">
              <th>Data</th><th>Profissional</th><th>Horário</th><th>Tipo</th><th>Mão de Obra</th><th>Taxa Adm</th><th>Ajuda Custo</th><th>Cobrado/Dia</th>
            </tr>
        `;
        agends.sort((a,b) => a.data.localeCompare(b.data)).forEach(ag => {
          const cobradoDia = ag.valorPlantao + ag.taxaAdm + ag.ajudaCusto;
          htmlContent += `
            <tr>
              <td>${ag.data.split('-').reverse().join('/')}</td>
              <td>${ag.nomeProfissional}</td>
              <td>${ag.horario}</td>
              <td>${ag.tipoDia || 'Normal'}</td>
              <td>R$ ${ag.valorPlantao.toFixed(2)}</td>
              <td>R$ ${ag.taxaAdm.toFixed(2)}</td>
              <td>R$ ${ag.ajudaCusto.toFixed(2)}</td>
              <td><strong>R$ ${cobradoDia.toFixed(2)}</strong></td>
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
        const somaRepasses = agends.reduce((acc, ag) => acc + ag.valorRepasse, 0);
        const somaAjudas = agends.reduce((acc, ag) => acc + ag.ajudaCusto, 0);
        const debitos = debitosProfissionais[profName] || 0;
        const valorLiquido = (somaRepasses + somaAjudas) - debitos;
        
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
          htmlContent += `
            <tr>
              <td>${ag.data.split('-').reverse().join('/')}</td>
              <td>${nomePac}</td>
              <td>R$ ${ag.valorRepasse.toFixed(2)}</td>
              <td>R$ ${ag.ajudaCusto.toFixed(2)}</td>
              <td>${ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}</td>
            </tr>
          `;
        });
        
        htmlContent += `
            </table>
            
            <p>(+) Somatório de Repasses (Líquido Plantão): R$ ${somaRepasses.toFixed(2)}</p>
            <p>(+) Somatório Ajuda de Custo: R$ ${somaAjudas.toFixed(2)}</p>
            <p>(-) Débitos: R$ ${debitos.toFixed(2)}</p>
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

  const handleDebitChange = (profName: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setDebitosProfissionais(prev => ({ ...prev, [profName]: numValue }));
  };

  return (
    <div className="space-y-5 animate-in fade-in-30" id="financeiro-dashboard">
      
      {/* Filters & Export */}
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm print:hidden">
        <div className="flex flex-col gap-5">
          {/* Top Options */}
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <h3 className="text-sm font-bold text-slate-800">Tipo de Relatório:</h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
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
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Data Final</label>
                <input 
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={handleGerarRelatorios}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 flex items-center gap-2 h-[38px]"
              >
                {isGenerating ? (
                  <>⏳ Aguarde...</>
                ) : (
                  <>🔄 Gerar {financeTab === 'fatura' ? 'Fatura' : 'Folha de Pagamento'}</>
                )}
              </button>
            </div>
            
            {hasGenerated && (
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  🖨️ Imprimir / PDF
                </button>
                <button
                  onClick={exportExcel}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  📊 Exportar Excel
                </button>
                <button
                  onClick={exportWord}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  📄 Exportar Word
                </button>
              </div>
            )}
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
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h2 className="text-xl font-black text-slate-800">Folha de Fatura (Cobrança Clientes)</h2>
              <p className="text-sm text-slate-500">Período Apurado: {dataInicial.split('-').reverse().join('/')} a {dataFinal.split('-').reverse().join('/')}</p>
            </div>

            {Object.keys(agendamentosPorPaciente).length === 0 ? (
              <p className="text-slate-500 italic text-sm">Nenhum plantão ativo neste período.</p>
            ) : (
              (Object.entries(agendamentosPorPaciente) as [string, Agendamento[]][]).map(([pacId, agends]) => {
                const pacNome = pacientes.find(p => p.id === pacId)?.nome || 'Paciente Desconhecido';
                const totalFatura = agends.reduce((acc, ag) => acc + ag.valorPlantao + ag.ajudaCusto + ag.taxaAdm, 0);

                return (
                  <div key={pacId} className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300 print:mb-8">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                      <h3 className="font-bold text-slate-800">{pacNome}</h3>
                      <p className="text-xs text-slate-500">Total de Plantões: {agends.length}</p>
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
                          const cobradoDia = ag.valorPlantao + ag.taxaAdm + ag.ajudaCusto;
                          return (
                            <tr key={ag.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-4">{ag.data.split('-').reverse().join('/')}</td>
                              <td className="py-2.5 px-4">{ag.nomeProfissional}</td>
                              <td className="py-2.5 px-4 font-mono text-[10px]">{ag.horario}</td>
                              <td className="py-2.5 px-4">{ag.tipoDia || 'Normal'}</td>
                              <td className="py-2.5 px-4 text-right">R$ {ag.valorPlantao.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right">R$ {ag.taxaAdm.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right">R$ {ag.ajudaCusto.toFixed(2)}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-slate-700">R$ {cobradoDia.toFixed(2)}</td>
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
                  const somaRepasses = agends.reduce((acc, ag) => acc + ag.valorRepasse, 0);
                  const somaAjudas = agends.reduce((acc, ag) => acc + ag.ajudaCusto, 0);
                  const debitos = debitosProfissionais[profName] || 0;
                  const valorLiquidoReceber = (somaRepasses + somaAjudas) - debitos;

                  return (
                    <div key={profName} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm print:break-inside-avoid">
                      <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
                        <h3 className="font-bold text-indigo-900">{profName}</h3>
                        <p className="text-xs text-indigo-700">Total de Plantões Relacionados: {agends.length}</p>
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
                              return (
                                <tr key={ag.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-4">{ag.data.split('-').reverse().join('/')}</td>
                                  <td className="py-2.5 px-4">{nomePac}</td>
                                  <td className="py-2.5 px-4 text-right">R$ {ag.valorRepasse.toFixed(2)}</td>
                                  <td className="py-2.5 px-4 text-right">R$ {ag.ajudaCusto.toFixed(2)}</td>
                                  <td className="py-2.5 px-4 text-right text-slate-500">{ag.tipoDia && ag.tipoDia !== 'Normal' ? ag.tipoDia : '-'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="p-4 space-y-3 bg-slate-50/50 text-sm border-t border-slate-100">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>(+) Somatório de Repasses (Líquido Plantões):</span>
                            <span className="font-mono">R$ {somaRepasses.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>(+) Somatório Ajuda de Custo:</span>
                            <span className="font-mono">R$ {somaAjudas.toFixed(2)}</span>
                          </div>
                          
                          <div className="flex justify-between items-center border-t border-slate-200 pt-3">
                            <span className="text-slate-600">(-) Débitos / Adiantamentos:</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-400">R$</span>
                              <input 
                                type="number" 
                                value={debitosProfissionais[profName] === 0 ? '' : debitosProfissionais[profName]}
                                onChange={(e) => handleDebitChange(profName, e.target.value)}
                                placeholder="0.00"
                                className="w-24 p-1 border border-slate-300 rounded text-right font-mono text-xs text-red-600 outline-none focus:border-red-500 print:border-none print:p-0 print:appearance-none print:w-auto bg-white"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center pt-3 mt-1 border-t-2 border-indigo-100">
                            <span className="font-bold text-indigo-900">Total Líquido a Receber:</span>
                            <span className="font-black text-indigo-700 text-lg font-mono">
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
    </div>
  );
};


/* ----------------------------------------------------
 * Tab 5: Empresa e Configurações Corporativas
 * ---------------------------------------------------- */
import { GestaoAcessos } from './GestaoAcessos';

export const EmpresaDashboard: React.FC = () => {
  const { userRole } = useFirebase();
  const isAdmin = userRole?.toLowerCase() === 'administrador';
  
  return (
    <div className="space-y-6 animate-in fade-in-30" id="empresa-dashboard">
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Configurações Empresa CuidarHome S.A.</h2>
          <p className="text-xs text-slate-400">Configure as políticas gerais de faturamento residencial de plantões e dados da unidade.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-3 p-4 bg-slate-50/30 border border-slate-150 border-slate-200/90 rounded-xl">
            <h4 className="font-bold text-slate-700">Dados da Unidade Matriz</h4>
            <div className="space-y-2">
              <p>Razão Social: <strong className="text-slate-700">CuidarHome Prestadora de Serviços Médicos S.A.</strong></p>
              <p>CNPJ: <strong className="text-slate-700">12.345.678/0001-99</strong></p>
              <p>Unidade de Operação: <strong className="text-slate-700 text-blue-600">Rio de Janeiro - RJ (Zona Sul & Barra)</strong></p>
              <p>Direção Geral Regional: <strong className="text-slate-700">Renato B. Z.</strong></p>
            </div>
          </div>

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
        
        {isAdmin && (
           <button className="px-4 py-2 bg-[#1A3626] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#254A34]">
             Salvar Alterações
           </button>
        )}
      </div>
      
      {isAdmin && <GestaoAcessos />}
    </div>
  );
};
