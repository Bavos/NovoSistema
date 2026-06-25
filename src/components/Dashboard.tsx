import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Users, UserPlus, Calendar, DollarSign, Receipt, Gift, Check, Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { DebitoProfissional } from '../types';

export const Dashboard: React.FC<{
  setActiveTab: (tab: string, extraOptions?: { financeiroSubTab?: 'folhas' | 'debitos' }) => void;
  onSelectPatientRedirect?: (paciente: any) => void;
}> = ({ setActiveTab, onSelectPatientRedirect }) => {
  const { pacientes, profissionais, updatePaciente } = useFirebase();
  const [debitosDoDia, setDebitosDoDia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isBirthdayToday = (birthVal: any): boolean => {
    if (!birthVal) return false;
    try {
      let date: Date;
      if (typeof birthVal.toDate === 'function') {
        date = birthVal.toDate();
      } else if (birthVal instanceof Date) {
        date = birthVal;
      } else if (birthVal.seconds) {
        date = new Date(birthVal.seconds * 1000);
      } else if (typeof birthVal === 'string') {
        // support YYYY-MM-DD
        const ymdMatch = birthVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (ymdMatch) {
          const [, , month, day] = ymdMatch;
          const today = new Date();
          const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
          const currentDay = String(today.getDate()).padStart(2, '0');
          return month === currentMonth && day === currentDay;
        }
        // support DD/MM/YYYY
        const dmyMatch = birthVal.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (dmyMatch) {
          const [, day, month] = dmyMatch;
          const today = new Date();
          const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
          const currentDay = String(today.getDate()).padStart(2, '0');
          return month === currentMonth && day === currentDay;
        }
        date = new Date(birthVal);
      } else {
        return false;
      }

      if (isNaN(date.getTime())) return false;
      const today = new Date();
      return date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    } catch {
      return false;
    }
  };

  const activePacientes = (pacientes || []).filter(
    (p) => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo'
  );

  const [searchQuery, setSearchQuery] = useState('');

  const filteredActivePacientes = searchQuery.trim() === ''
    ? []
    : activePacientes.filter((p) => {
        const queryClean = searchQuery.replace(/\D/g, '').trim();
        const cpfClean = (p.cpf || '').replace(/\D/g, '').trim();
        const nomeLower = (p.nome || '').toLowerCase();
        const queryLower = searchQuery.toLowerCase();

        const nameMatches = nomeLower.includes(queryLower);
        const cpfMatches = cpfClean && queryClean && cpfClean.includes(queryClean);
        const rawCpfMatches = p.cpf && p.cpf.toLowerCase().includes(queryLower);

        return nameMatches || cpfMatches || rawCpfMatches;
      });
  
  const activeProfissionais = (profissionais || []).filter(
    (p) => p.status === 'Ativo' || p.status?.toLowerCase() === 'ativo'
  );

  const pacBirthdayList = activePacientes
    .filter((p) => isBirthdayToday(p.dataNascimento))
    .map((p) => ({ nome: p.nome, type: 'Paciente' }));

  const profBirthdayList = activeProfissionais
    .filter((p) => isBirthdayToday((p as any).dataNascimento || (p as any).nascimento))
    .map((p) => ({ nome: p.nome, type: 'Profissional' }));

  const aniversariantes = [...pacBirthdayList, ...profBirthdayList];

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
    } catch {
      return null;
    }
  };

  const shouldShowDebit = (debit: any, today: Date): boolean => {
    const debitDate = getDebitDateObj(debit.data);
    if (!debitDate) return false;

    // Zerar as horas para comparação segura de datas por fuso horário/calendário
    const dDate = new Date(debitDate.getFullYear(), debitDate.getMonth(), debitDate.getDate());
    const tDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const motivoClean = (debit.motivo || '').toLowerCase().trim();

    if (motivoClean === 'curinga') {
      const todayDayOfWeek = today.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

      if (todayDayOfWeek >= 2 && todayDayOfWeek <= 5) {
        // Terça (2), Quarta (3), Quinta (4), Sexta (5) -> mostra Curingas de ontem (D-1)
        const yesterday = new Date(tDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return dDate.getTime() === yesterday.getTime();
      } else if (todayDayOfWeek === 1) {
        // Segunda-feira (1) -> mostra Curingas acumulados de Sexta, Sábado e Domingo
        const friday = new Date(tDate);
        friday.setDate(friday.getDate() - 3);

        const saturday = new Date(tDate);
        saturday.setDate(saturday.getDate() - 2);

        const sunday = new Date(tDate);
        sunday.setDate(sunday.getDate() - 1);

        const dTime = dDate.getTime();
        return dTime === friday.getTime() || dTime === saturday.getTime() || dTime === sunday.getTime();
      }
      // Fins de semana (Sábado/Domingo): não exibe Curingas (são acumulados na Segunda-feira)
      return false;
    } else {
      // Outros débitos comuns ('mei', 'passagem', 'outros', etc.) -> mostram em D+0 (hoje)
      return dDate.getTime() === tDate.getTime();
    }
  };

  const formatDebitDateDisplay = (val: any): string => {
    const dObj = getDebitDateObj(val);
    if (!dObj) return '';
    try {
      const weekday = dObj.toLocaleDateString('pt-BR', { weekday: 'long' });
      const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      const dateStr = dObj.toLocaleDateString('pt-BR');
      return `${weekdayCap}, ${dateStr}`;
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'debitos_profissionais'));

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      const today = new Date();
      
      snapshot.forEach((doc) => {
        const d = { id: doc.id, ...doc.data() };
        if (shouldShowDebit(d, today)) {
          list.push(d);
        }
      });
      
      // Ordenar por data decrescente
      list.sort((a, b) => {
        const tA = getDebitDateObj(a.data)?.getTime() || 0;
        const tB = getDebitDateObj(b.data)?.getTime() || 0;
        return tB - tA;
      });

      setDebitosDoDia(list);
      setLoading(false);
    }, (error) => {
      console.error("Erro na query de débitos do dia:", error);
      setLoading(false);
    });

    return unsub;
  }, []);

  const getTargetReadjustmentMonthYear = (): string => {
    const today = new Date();
    let nextMonth = today.getMonth() + 1;
    let nextYear = today.getFullYear();
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const mm = String(nextMonth + 1).padStart(2, '0');
    const yy = String(nextYear).slice(-2);
    return `${mm}/${yy}`;
  };

  const targetMonthYear = getTargetReadjustmentMonthYear();

  const pacientesComReajuste = activePacientes.filter((p) => {
    const rDate = p.dadosPagamento?.dataReajuste?.trim();
    if (!rDate) return false;

    const parts = rDate.split('/');
    if (parts.length !== 2) return false;

    const monthNum = parseInt(parts[0], 10);
    const yearPart = parseInt(parts[1], 10);
    if (isNaN(monthNum) || isNaN(yearPart)) return false;

    const yearNum = 2000 + yearPart;
    const readjustMonthIdx = monthNum - 1; // 0-11

    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth(); // 0-11

    // Do not show if the month of the readjustment has already passed.
    if (todayYear > yearNum || (todayYear === yearNum && todayMonth > readjustMonthIdx)) {
      return false;
    }

    // Assumindo o dia 1º do mês correspondente como data base.
    const readjustDate = new Date(yearNum, readjustMonthIdx, 1, 0, 0, 0, 0);

    // Calcule a diferença em dias entre a data de hoje e essa data de reajuste.
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const diffTime = readjustDate.getTime() - todayMidnight.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // O paciente deve aparecer se faltarem 45 dias ou menos para a data de reajuste.
    return diffDays <= 45;
  });

  const handleConcluirReajuste = async (p: any) => {
    try {
      const currentData = p.dadosPagamento?.dataReajuste || '';
      const parts = currentData.split('/');
      let nextData = '';
      if (parts.length === 2) {
        const month = parts[0];
        const yearNum = parseInt(parts[1], 10);
        if (!isNaN(yearNum)) {
          const nextYear = String(yearNum + 1).padStart(2, '0');
          nextData = `${month}/${nextYear}`;
        }
      }
      
      if (!nextData) {
        const today = new Date();
        const nextMonth = today.getMonth() + 1;
        const futureYear = today.getFullYear() + 1;
        const mm = String(nextMonth > 11 ? 1 : nextMonth + 1).padStart(2, '0');
        const yy = String(nextMonth > 11 ? futureYear + 1 : futureYear).slice(-2);
        nextData = `${mm}/${yy}`;
      }

      const updatedPaciente = {
        ...p,
        dadosPagamento: {
          ...(p.dadosPagamento || {}),
          dataReajuste: nextData,
        }
      };

      await updatePaciente(updatedPaciente, true);
      toast.success(`Reajuste do paciente ${p.nome} registrado com sucesso para ${nextData}!`, {
        icon: '✅',
      });
    } catch (err: any) {
      console.error('Erro ao registrar reajuste:', err);
      toast.error('Erro ao atualizar data de reajuste: ' + err.message);
    }
  };

  const quickActions = [
    { id: 'btn-dash-cadastrar-paciente', title: 'Cadastrar Paciente', icon: UserPlus, tab: 'pacientes' },
    { id: 'btn-dash-cadastrar-profissional', title: 'Cadastrar Profissional', icon: Users, tab: 'profissionais' },
    { id: 'btn-dash-cadastrar-debito', title: 'Cadastrar Débito', icon: Receipt, tab: 'financeiro', extra: { financeiroSubTab: 'debitos' } },
    { id: 'btn-dash-gerar-faturamento', title: 'Gerar Faturamento', icon: DollarSign, tab: 'financeiro' },
  ];

  return (
    <div className="space-y-6 font-sans" id="dashboard-container">
      {/* 🎂 Section: Aniversariantes do Dia */}
      <div className="bg-white p-6 rounded-2xl border border-forest-green/10 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="section-aniversariantes">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#e8e4db] text-mustard-gold rounded-2xl shrink-0">
            <Gift size={24} />
          </div>
          <div>
            <h4 className="text-sm font-serif font-bold text-forest-green" id="title-aniversariantes">Aniversariantes do Dia</h4>
            <p className="text-xs text-forest-green/70">Parabenize hoje os nossos assistidos e colaboradores!</p>
          </div>
        </div>
        <div className="flex-1 max-w-xl">
          {aniversariantes.length === 0 ? (
            <p className="text-xs text-forest-green/60 italic font-medium" id="txt-no-birthday-today">Nenhum aniversariante no dia de hoje.</p>
          ) : (
            <div className="flex flex-wrap gap-2" id="birthday-list">
              {aniversariantes.map((aniv, idx) => (
                <span
                  key={idx}
                  className="flex items-center gap-3 px-3 py-1.5 rounded-full text-xs font-medium text-forest-green"
                  id={`birthday-${aniv.type.toLowerCase()}-${idx}`}
                >
                  {aniv.nome}
                  <span 
                    className={aniv.type === 'Paciente' 
                      ? 'text-[#b8860b] font-semibold text-xs px-2.5 pt-0.5 pb-[3px] rounded-full bg-[#fdf8ec] border border-[#b8860b]/20 w-[85.76px] text-center' 
                      : 'text-[#1a3c2e] font-semibold text-xs px-2.5 pt-0.5 pb-[3px] rounded-full bg-[#e8f0ec] border border-[#1a3c2e]/20 w-[85.76px] text-center'}
                  >
                    {aniv.type === 'Paciente' ? 'Paciente' : 'Profissional'}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Débitos do Dia Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-forest-green/10 shadow-sm flex flex-col h-full" id="section-debitos-dia">
          <div className="flex items-center gap-4 border-b border-forest-green/5 pb-5 mb-5">
            <div className="p-3 bg-[#e8e4db] text-mustard-gold rounded-2xl">
              <Receipt size={24} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-forest-green" id="title-debitos-dia">Débitos do Dia</h3>
              <p className="text-xs text-forest-green/70">Monitoramento e validação operacional dos débitos programados para hoje</p>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="py-12 text-center text-forest-green/50 font-medium animate-pulse" id="debitos-loading">
                Carregando lançamentos...
              </div>
            ) : debitosDoDia.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-2xl border-2 border-dashed border-forest-green/5 bg-off-white flex flex-col items-center justify-center space-y-2 h-full" id="debitos-empty-state">
                <p className="text-xl">✅</p>
                <p className="text-forest-green font-bold text-sm">Nenhum débito programado para o dia de hoje</p>
                <p className="text-xs text-forest-green/60">Excelente! Toda a escala de hoje está operando em conformidade.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-forest-green/5 rounded-2xl" id="table-debitos-container">
                <table className="w-full border-collapse" id="table-debitos-hoje">
                  <thead>
                    <tr className="bg-[#e8e4db] text-forest-green text-xs font-semibold uppercase tracking-wider" id="table-debitos-header-row">
                      <th className="py-4 px-5 text-left">Nome do Profissional</th>
                      <th className="py-4 px-5 text-right">Data</th>
                      <th className="py-4 px-5 text-center">Motivo</th>
                      <th className="py-4 px-5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-forest-green/5 text-forest-green text-xs">
                    {debitosDoDia.map((d) => (
                      <tr key={d.id} className="hover:bg-off-white transition-all duration-150" id={`row-debito-${d.id}`}>
                        <td className="py-4 px-5 text-left font-semibold">{d.nomeProfissional}</td>
                        <td className="py-4 px-5 text-right text-forest-green/70 font-mono">{formatDebitDateDisplay(d.data)}</td>
                        <td className="py-4 px-5 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            d.motivo === 'Curinga' ? 'bg-mustard-gold/10 text-mustard-gold' :
                            d.motivo === 'Passagem' ? 'bg-[#e8e4db] text-forest-green' :
                            'bg-off-white text-forest-green'
                          }`}>
                            {d.motivo}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right font-black text-red-800 text-sm font-mono">
                          R$ {Number(d.valor).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Shortcuts / Quick Actions Section */}
        <div className="lg:col-span-1 flex flex-col space-y-4" id="section-quick-actions">
          {/* Avisos de Reajuste Section */}
          {pacientesComReajuste.length > 0 && (
            <div className="bg-white p-6 rounded-2xl border border-forest-green/10 shadow-sm flex flex-col" id="section-avisos-reajuste">
              <div className="flex items-center gap-4 border-b border-forest-green/5 pb-4 mb-4">
                <div className="p-3 bg-[#e8e4db] text-mustard-gold rounded-2xl shrink-0">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-forest-green" id="title-avisos-reajuste">Avisos de Reajuste</h3>
                  <p className="text-xs text-forest-green/70">Reajustes contratuais programados para os próximos 45 dias</p>
                </div>
              </div>

              <div className="space-y-3" id="readjustment-list">
                {pacientesComReajuste.map((pac) => (
                  <div key={pac.id} className="flex items-center justify-between p-3 rounded-xl bg-[#faf9f6] hover:bg-[#e8e4db]/40 border border-forest-green/5 transition-all duration-150" id={`readjustment-id-${pac.id}`}>
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-forest-green truncate">{pac.nome}</p>
                      <p className="text-[10px] text-forest-green/60 font-medium whitespace-nowrap">Reajuste em: <span className="font-bold text-red-800">{pac.dadosPagamento?.dataReajuste}</span></p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConcluirReajuste(pac)}
                      title="Concluir reajuste"
                      className="p-1.5 bg-[#e8f0ec] hover:bg-forest-green text-forest-green hover:text-white rounded-lg border border-forest-green/10 transition-all cursor-pointer flex items-center justify-center shrink-0"
                      id={`btn-concluir-reajuste-${pac.id}`}
                    >
                      <Check size={14} className="stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl border border-forest-green/10 shadow-sm flex flex-col h-full">
            <h3 className="text-md font-serif font-bold text-forest-green mb-5 border-b border-forest-green/5 pb-4" id="title-quick-actions">Ações Rápidas</h3>
            <div className="grid grid-cols-1 gap-4 flex-1">
              {quickActions.map(action => (
                <button
                  id={action.id}
                  key={action.title}
                  onClick={() => setActiveTab(action.tab, (action as any).extra)}
                  className="w-full text-left py-4 px-5 rounded-full border border-mustard-gold/20 hover:border-mustard-gold bg-white hover:bg-[#e8e4db] hover:shadow-md transition-all duration-300 flex items-center space-x-4 group cursor-pointer"
                >
                  <div className="p-2.5 bg-[#e8e4db] text-mustard-gold rounded-full transition-all flex items-center justify-center shrink-0">
                    <action.icon size={18} />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wider text-forest-green transition-all">{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
