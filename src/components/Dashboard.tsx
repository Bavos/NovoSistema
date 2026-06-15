import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Users, UserPlus, Calendar, DollarSign, Receipt } from 'lucide-react';
import { DebitoProfissional } from '../types';

export const Dashboard: React.FC<{
  setActiveTab: (tab: string) => void;
}> = ({ setActiveTab }) => {
  const [debitosDoDia, setDebitosDoDia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    { id: 'btn-dash-gerar-faturamento', title: 'Gerar Faturamento', icon: DollarSign, tab: 'financeiro' },
  ];

  return (
    <div className="space-y-6" id="dashboard-container">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Débitos do Dia Section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full" id="section-debitos-dia">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-5">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <Receipt size={24} />
            </div>
            <div>
              <h3 className="text-lg font-serif font-bold text-slate-800" id="title-debitos-dia">Débitos do Dia</h3>
              <p className="text-xs text-slate-500">Monitoramento e validação operacional dos débitos programados para hoje</p>
            </div>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="py-12 text-center text-slate-400 font-medium" id="debitos-loading">
                Carregando lançamentos...
              </div>
            ) : debitosDoDia.length === 0 ? (
              <div className="py-12 px-4 text-center rounded-lg border-2 border-dashed border-slate-100 bg-slate-50/50 flex flex-col items-center justify-center space-y-2 h-full" id="debitos-empty-state">
                <p className="text-xl">✅</p>
                <p className="text-slate-600 font-bold text-sm">Nenhum débito programado para o dia de hoje</p>
                <p className="text-xs text-slate-400">Excelente! Toda a escala de hoje está operando em conformidade.</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-100 rounded-lg" id="table-debitos-container">
                <table className="w-full text-left border-collapse" id="table-debitos-hoje">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Nome do Profissional</th>
                      <th className="py-3 px-4">Data</th>
                      <th className="py-3 px-4">Motivo</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                    {debitosDoDia.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/40 transition-colors" id={`row-debito-${d.id}`}>
                        <td className="py-3 px-4 font-semibold text-slate-800">{d.nomeProfissional}</td>
                        <td className="py-3 px-4 text-slate-500">{formatDebitDateDisplay(d.data)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            d.motivo === 'Curinga' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            d.motivo === 'Passagem' ? 'bg-sky-100 text-sky-800 border border-sky-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {d.motivo}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-red-600 text-sm font-mono">
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
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h3 className="text-md font-serif font-bold text-slate-800 mb-4 border-b border-slate-100 pb-3" id="title-quick-actions">Ações Rápidas</h3>
            <div className="grid grid-cols-1 gap-3 flex-1 justify-center align-middle">
              {quickActions.map(action => (
                <button
                  id={action.id}
                  key={action.title}
                  onClick={() => setActiveTab(action.tab)}
                  className="w-full text-left p-4 rounded-xl border border-slate-100 hover:border-amber-400 bg-slate-50/30 hover:bg-amber-50/20 transition-all flex items-center space-x-4 group cursor-pointer"
                >
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl group-hover:bg-[#e8e4db] group-hover:text-amber-800 transition-all flex items-center justify-center">
                    <action.icon size={20} />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-700 group-hover:text-amber-900 transition-all">{action.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
