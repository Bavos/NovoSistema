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
  TrendingUp,
  MapPin,
  Clock
} from 'lucide-react';
import { INITIAL_PROFESSIONALS } from '../mockData';
import { useFirebase } from '../context/FirebaseContext';

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
  const { plantoes, pacientes } = useFirebase();
  const [financeTab, setFinanceTab] = useState<'fatura' | 'pagamento'>('fatura');

  // Filter only Confirmed/active shifts to compute accurate financial details
  const confirmedShifts = plantoes.filter(p => p.status === 'Confirmado');

  // Calculates financial properties of a single scheduled shift
  const calculateShiftFinancials = (pl: any) => {
    const pac = pacientes.find(p => p.id === pl.pacienteId);

    const valorPlantaoBase = pl.valorPlantao ?? pac?.planoAtendimento?.valorSugeridoPlantao ?? 150;
    const valorRepasseBase = pl.valorRepasse ?? (valorPlantaoBase * 0.70);
    const taxaAdmBase = pl.taxaAdm ?? pac?.planoAtendimento?.taxaAdm ?? 0;
    const ajudaCustoBase = pl.ajudaCusto ?? pac?.planoAtendimento?.ajudaCusto ?? 0;

    let multiplier = 1.0;
    if (pl.feriado === '20%') {
      multiplier = 1.2;
    } else if (pl.feriado === '50%') {
      multiplier = 1.5;
    }

    // Billing / Faturado (add to valor do plantão, taxa de adm; NEVER on ajuda de custo)
    const valorPlantaoFaturado = valorPlantaoBase * multiplier;
    const taxaAdmFaturada = taxaAdmBase * multiplier;
    const ajudaCustoFaturada = ajudaCustoBase; // Remains unchanged
    const totalFaturado = valorPlantaoFaturado + taxaAdmFaturada + ajudaCustoFaturada;

    // Payroll / Repasse Pago (add to valor do repasse; NEVER on ajuda de custo)
    const valorRepassePago = valorRepasseBase * multiplier;
    const ajudaCustoPaga = ajudaCustoBase; // Remains unchanged
    const totalPago = valorRepassePago + ajudaCustoPaga;

    return {
      pacienteNome: pac?.nome || 'Paciente Cadastrado',
      valorPlantaoBase,
      valorRepasseBase,
      taxaAdmBase,
      ajudaCustoBase,
      multiplier,
      valorPlantaoFaturado,
      taxaAdmFaturada,
      totalFaturado,
      valorRepassePago,
      totalPago,
    };
  };

  const processedShifts = confirmedShifts.map(sh => ({
    ...sh,
    financials: calculateShiftFinancials(sh)
  })).sort((a, b) => b.data.localeCompare(a.data));

  // Compute stats
  const totalFaturamento = processedShifts.reduce((acc, curr) => acc + curr.financials.totalFaturado, 0);
  const totalPayroll = processedShifts.reduce((acc, curr) => acc + curr.financials.totalPago, 0);
  const totalShiftsCount = processedShifts.length;
  const mediaFaturamentoShift = totalShiftsCount > 0 ? totalFaturamento / totalShiftsCount : 0;
  const margemLiquidaOperacao = totalFaturamento > 0 ? ((totalFaturamento - totalPayroll) / totalFaturamento) * 100 : 0;

  return (
    <div className="space-y-5 animate-in fade-in-30" id="financeiro-dashboard">
      {/* Bento grid layout for statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">Faturamento Real do Mês</span>
          <p className="text-xl font-black text-slate-905 font-mono">
            R$ {totalFaturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-emerald-600 font-bold flex items-center space-x-0.5">
            <TrendingUp size={10} />
            <span>Baseado em {totalShiftsCount} plantões confirmados</span>
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">Folha de Pagamento Total</span>
          <p className="text-xl font-black text-slate-905 font-mono">
            R$ {totalPayroll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-indigo-600 font-bold block">Repasse + ajudas de custo prestadores</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">Média por Plantão</span>
          <p className="text-xl font-black text-slate-905 font-mono">
            R$ {mediaFaturamentoShift.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-[9px] text-slate-400 block font-medium">Médias de faturamento residencial</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-sm space-y-1">
          <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400 font-bold block">Margem Líquida da Operação</span>
          <p className="text-xl font-black text-emerald-600 font-mono">
            {margemLiquidaOperacao.toFixed(1)}%
          </p>
          <span className="text-[9px] text-slate-400 block font-medium">Margem de recebimentos de adm</span>
        </div>
      </div>

      {/* Main spreadsheet display container */}
      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-25 border-slate-100 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Lançamentos & Demonstrativo Auditável</h3>
            <p className="text-xs text-slate-404 text-slate-400 font-normal">Audite os dados escolares integrados aos prontuários e atualizados em tempo real.</p>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg self-start sm:self-center">
            <button
              onClick={() => setFinanceTab('fatura')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                financeTab === 'fatura'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🧾 Folha de Fatura
            </button>
            <button
              onClick={() => setFinanceTab('pagamento')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                financeTab === 'pagamento'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              💸 Folha de Pagamento
            </button>
          </div>
        </div>

        {/* Tab 1: Folha de Fatura */}
        {financeTab === 'fatura' && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 text-amber-900 text-xs border border-amber-200/50 rounded-xl leading-relaxed">
              <strong>Regra de Cálculo Feriado (Fatura):</strong> Quando um plantão é marcado como feriado (20% ou 50%), o sistema acrescenta o percentual sobre o <strong>Valor do Plantão</strong> e sobre a <strong>Taxa de Administração (Tx Adm)</strong>. A <strong>Ajuda de Custo</strong> permanece intacta.
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mt-1.5 bg-slate-50/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-505 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Paciente</th>
                    <th className="py-2.5 px-3">Profissional</th>
                    <th className="py-2.5 px-3 text-right">Plantão Base</th>
                    <th className="py-2.5 px-3 text-right">Tx Adm Base</th>
                    <th className="py-2.5 px-3 text-right">Ajuda Custo</th>
                    <th className="py-2.5 px-3 text-center">Feriado</th>
                    <th className="py-2.5 px-3 text-right text-slate-800 font-bold">TOTAL FATURA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 divide-slate-100 font-sans">
                  {processedShifts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                        Nenhum plantão ativo confirmado programado no sistema.
                      </td>
                    </tr>
                  ) : (
                    processedShifts.map((sh) => {
                      const f = sh.financials;
                      return (
                        <tr key={sh.id} className="hover:bg-slate-50/60 transition-colors bg-white">
                          <td className="py-3 px-3 font-mono">
                            {sh.diaSemana} - {new Date(sh.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {f.pacienteNome}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {sh.profissional}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            R$ {f.valorPlantaoFaturado.toFixed(2)}
                            {sh.feriado && (
                              <span className="block text-[8px] text-slate-400">
                                (Base: R$ {f.valorPlantaoBase.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            R$ {f.taxaAdmFaturada.toFixed(2)}
                            {sh.feriado && f.taxaAdmBase > 0 && (
                              <span className="block text-[8px] text-slate-400">
                                (Base: R$ {f.taxaAdmBase.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500">
                            R$ {f.ajudaCustoBase.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sh.feriado ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                sh.feriado === '20%' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                +{sh.feriado}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-350">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700 bg-blue-50/10">
                            R$ {f.totalFaturado.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Folha de Pagamento */}
        {financeTab === 'pagamento' && (
          <div className="space-y-3">
            <div className="p-3 bg-indigo-50 text-indigo-900 text-xs border border-indigo-200/50 rounded-xl leading-relaxed">
              <strong>Regra de Cálculo Feriado (Pagamento/Repasse):</strong> Quando marcado como feriado (20% ou 50%), o profissional recebe o respectivo acréscimo calculado sobre seu <strong>Valor de Repasse</strong>. A <strong>Ajuda de Custo</strong> não sofre alteração sob nenhuma hipótese.
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden mt-1.5 bg-slate-50/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-505 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Profissional Cuidador</th>
                    <th className="py-2.5 px-3">Paciente Atendido</th>
                    <th className="py-2.5 px-3 text-right">Repasse Base Plantão</th>
                    <th className="py-2.5 px-3 text-right">Ajuda Custo</th>
                    <th className="py-2.5 px-3 text-center">Feriado</th>
                    <th className="py-2.5 px-3 text-right text-slate-800 font-bold">TOTAL A PAGAR (REPASSE)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 divide-slate-100 font-sans">
                  {processedShifts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                        Nenhum plantão ativo confirmado programado no sistema.
                      </td>
                    </tr>
                  ) : (
                    processedShifts.map((sh) => {
                      const f = sh.financials;
                      return (
                        <tr key={sh.id} className="hover:bg-slate-50/60 transition-colors bg-white">
                          <td className="py-3 px-3 font-mono">
                            {sh.diaSemana} - {new Date(sh.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {sh.profissional}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {f.pacienteNome}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            R$ {f.valorRepassePago.toFixed(2)}
                            {sh.feriado && (
                              <span className="block text-[8px] text-slate-400">
                                (Base: R$ {f.valorRepasseBase.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-500">
                            R$ {f.ajudaCustoBase.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {sh.feriado ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-extrabold ${
                                sh.feriado === '20%' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                +{sh.feriado}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-350">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                            R$ {f.totalPago.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


/* ----------------------------------------------------
 * Tab 5: Empresa e Configurações Corporativas
 * ---------------------------------------------------- */
export const EmpresaDashboard: React.FC = () => {
  return (
    <div className="space-y-4 animate-in fade-in-30" id="empresa-dashboard">
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
      </div>
    </div>
  );
};
