import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Users, UserPlus, Calendar, DollarSign, Receipt, Gift } from 'lucide-react';
import { DebitoProfissional } from '../types';

export const Dashboard: React.FC<{
  setActiveTab: (tab: string, extraOptions?: { financeiroSubTab?: 'folhas' | 'debitos' }) => void;
}> = ({ setActiveTab }) => {
  const { pacientes, profissionais } = useFirebase();
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
      return dObj.toLocaleDateString('pt-BR');
    } catch {
      return '';
    }
  };

  useEffect(() => {
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const q = query(
      collection(db, 'debitos_profissionais'),
      where('data', '==', todayMidnight)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setDebitosDoDia(list);
      setLoading(false);
    }, (error) => {
      console.error("Erro na query de débitos do dia (Firestore query):", error);
      
      // Fallback: Query all and filter by current local date string to stay timezone-agnostic and robust
      const fallbackQuery = query(collection(db, 'debitos_profissionais'));
      onSnapshot(fallbackQuery, (snapshot) => {
        const list: any[] = [];
        const todayStr = today.toLocaleDateString('pt-BR');
        snapshot.forEach((doc) => {
          const data = doc.data();
          const formatted = formatDebitDateDisplay(data.data);
          if (formatted === todayStr) {
            list.push({ id: doc.id, ...data });
          }
        });
        setDebitosDoDia(list);
        setLoading(false);
      }, (err) => {
        console.error("Erro no fallback de débitos do dia:", err);
        setLoading(false);
      });
    });

    return unsub;
  }, []);

  const quickActions = [
    { id: 'btn-dash-cadastrar-paciente', title: 'Cadastrar Paciente', icon: UserPlus, tab: 'pacientes' },
    { id: 'btn-dash-cadastrar-profissional', title: 'Cadastrar Profissional', icon: Users, tab: 'profissionais' },
    { id: 'btn-dash-novo-agendamento', title: 'Novo Agendamento', icon: Calendar, tab: 'escalas' },
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
