import React from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, UserPlus, Calendar, DollarSign, Activity } from 'lucide-react';

export const Dashboard: React.FC<{
  setActiveTab: (tab: string) => void;
}> = ({ setActiveTab }) => {
  const { pacientes, profissionais, agendamentos } = useFirebase();

  const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo').length;
  const profissionaisAtivos = profissionais.filter(p => p.status === 'Ativo').length;

  const month = new Date().getMonth();
  const year = new Date().getFullYear();

  const plantoesMes = agendamentos.filter(a => {
    const d = new Date(a.data);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const faturamentoMes = plantoesMes.reduce((acc, a) => {
    return acc + (a.valorPlantao || 0) + (a.ajudaCusto || 0) + (a.taxaAdm || 0);
  }, 0);

  const especialidadeData = profissionais.reduce((acc: any, p) => {
    const esp = p.funcao || 'Outros';
    acc[esp] = (acc[esp] || 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(especialidadeData).map(([name, value]) => ({ name, value }));
  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B'];

  const quickActions = [
    { title: 'Cadastrar Paciente', icon: UserPlus, tab: 'pacientes' },
    { title: 'Cadastrar Profissional', icon: Users, tab: 'profissionais' },
    { title: 'Novo Agendamento', icon: Calendar, tab: 'escalas' },
    { title: 'Gerar Faturamento', icon: DollarSign, tab: 'financeiro' },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Pacientes Ativos</p>
          <p className="text-3xl font-black text-forest-green">{pacientesAtivos}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Profissionais Ativos</p>
          <p className="text-3xl font-black text-forest-green">{profissionaisAtivos}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Plantões (Mês)</p>
          <p className="text-3xl font-black text-forest-green">{plantoesMes.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Faturamento (Mês)</p>
          <p className="text-3xl font-black text-mustard-gold">R$ {faturamentoMes.toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-serif font-bold text-forest-green mb-4">Equipa por Especialidade</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Shortcuts */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quickActions.map(action => (
            <button
              key={action.title}
              onClick={() => setActiveTab(action.tab)}
              className="bg-white p-6 rounded-full border border-slate-200 shadow-sm hover:border-mustard-gold transition-all flex items-center space-x-4 text-left group cursor-pointer"
            >
              <div className="p-3 bg-[#e8e4db] text-forest-green rounded-full group-hover:bg-mustard-gold transition-all">
                <action.icon size={24} />
              </div>
              <span className="font-bold text-forest-green group-hover:text-mustard-gold">{action.title}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
