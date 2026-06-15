import React, { useState, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional, Agendamento } from '../types';
import { Plus, Edit2, Trash2, X, Check, CalendarDays } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export const Profissionais: React.FC = () => {
  const { profissionais, addProfissional, updateProfissional, deleteProfissional, pacientes } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'agenda'>('dados');
  const [agendamentosProf, setAgendamentosProf] = useState<Agendamento[]>([]);

  useEffect(() => {
    if (editingProf && activeTab === 'agenda') {
      const q = query(
        collection(db, 'agendamentos'),
        where('idProfissional', '==', editingProf.id),
        orderBy('data', 'asc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const agList: Agendamento[] = [];
        snapshot.forEach(doc => {
          agList.push({ ...doc.data(), id: doc.id } as Agendamento);
        });
        setAgendamentosProf(agList);
      }, (err) => {
        console.error('Error fetching agendamentos for profissional:', err);
      });
      
      return () => unsubscribe();
    } else {
      setAgendamentosProf([]);
    }
  }, [editingProf, activeTab]);

  const [formData, setFormData] = useState({
    nome: '',
    especialidade: '',
    telefone: '',
    email: '',
    dadosBancarios: {
        banco: '',
        agencia: '',
        conta: '',
        pix: ''
    }
  });

  const handleOpenModal = (prof: Profissional | null = null) => {
    setEditingProf(prof);
    setActiveTab('dados');
    setFormData(prof ? {
        nome: prof.nome,
        especialidade: prof.especialidade,
        telefone: prof.telefone,
        email: prof.email,
        dadosBancarios: prof.dadosBancarios || { banco: '', agencia: '', conta: '', pix: '' }
    } : { nome: '', especialidade: '', telefone: '', email: '', dadosBancarios: { banco: '', agencia: '', conta: '', pix: '' } });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProf) {
      await updateProfissional({ ...editingProf, ...formData });
    } else {
      await addProfissional(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <h2 className="text-sm font-bold text-slate-800">Gerenciamento de Profissionais</h2>
        <button
          onClick={() => handleOpenModal()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={14} /> Novo Profissional
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
            <tr>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">Especialidade</th>
              <th className="p-3 text-left">Telefone</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-center">Status</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(profissionais || []).map(prof => (
              <tr key={prof.id} className="hover:bg-slate-50 transition-colors duration-150">
                <td className="p-3 font-medium text-slate-800 text-left">{prof.nome}</td>
                <td className="p-3 text-slate-600 text-left">{prof.especialidade}</td>
                <td className="p-3 text-slate-600 text-left">{prof.telefone}</td>
                <td className="p-3 text-slate-600 text-left">{prof.email}</td>
                <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${prof.status === 'Ativo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {prof.status}
                    </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2.5 justify-center">
                    <button onClick={() => handleOpenModal(prof)} className="text-blue-600 hover:text-blue-850 transition-colors p-1" title="Editar"><Edit2 size={14} /></button>
                    <button onClick={() => deleteProfissional(prof.id)} className="text-red-600 hover:text-red-850 transition-colors p-1" title="Deletar"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-xl w-full max-w-2xl space-y-4">
            <h3 className="font-bold text-lg">{editingProf ? 'Editar Profissional' : 'Novo Profissional'}</h3>
            
            {editingProf && (
               <div className="flex gap-4 border-b pb-2 mb-4">
                 <button type="button" onClick={() => setActiveTab('dados')} className={`font-bold pb-1 text-sm transition-colors ${activeTab === 'dados' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>Dados Pessoais</button>
                 <button type="button" onClick={() => setActiveTab('agenda')} className={`font-bold pb-1 text-sm transition-colors flex items-center gap-1 flex-row ${activeTab === 'agenda' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                   <CalendarDays size={14} /> Agenda do Profissional
                 </button>
               </div>
            )}

            {activeTab === 'dados' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input type="text" placeholder="Nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-2 border rounded text-sm" required />
                  <input type="text" placeholder="Especialidade" value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} className="w-full p-2 border rounded text-sm" required />
                  <input type="text" placeholder="Telefone" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full p-2 border rounded text-sm" required />
                  <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded text-sm" required />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 block uppercase">Dados Bancários</label>
                   <div className="grid grid-cols-2 gap-2">
                       <input type="text" placeholder="Banco" value={formData.dadosBancarios.banco} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                       <input type="text" placeholder="Agência" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                       <input type="text" placeholder="Conta" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                       <input type="text" placeholder="Pix" value={formData.dadosBancarios.pix} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})} className="w-full p-2 border rounded text-sm" />
                   </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                {agendamentosProf.length === 0 ? (
                  <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 text-center text-slate-500">
                    <CalendarDays size={24} className="mx-auto mb-2 text-slate-400" />
                    <p className="text-sm font-medium">Este profissional não possui plantões agendados no momento.</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border rounded-xl border-slate-200 bg-white">
                      <table className="w-full text-xs align-middle">
                         <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 shadow-sm z-10 text-slate-700 text-[10px] font-semibold uppercase tracking-wider">
                           <tr>
                             <th className="p-3 text-right">Data</th>
                             <th className="p-3 text-left">Paciente</th>
                             <th className="p-3 text-center">Horário</th>
                             <th className="p-3 text-left">Tipo de Plantão</th>
                             <th className="p-3 text-right">Valor a Receber</th>
                             <th className="p-3 text-center">Status</th>
                           </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                           {agendamentosProf.map(ag => {
                              const pacienteNome = pacientes.find(p => p.id === ag.idPaciente)?.nome || 'Paciente não encontrado';
                              const baseRepasse = Number(ag.valorRepasse || 0);
                              const ajudaCusto = Number(ag.ajudaCusto || 0);
                              
                              let multiplier = 1.0;
                              if (ag.tipoDia === 'Feriado 20%') {
                                multiplier = 1.2;
                              } else if (ag.tipoDia === 'Feriado 50%') {
                                multiplier = 1.5;
                              }
                              
                              const totalReceber = (baseRepasse * multiplier) + ajudaCusto;
                              return (
                                <tr key={ag.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-3 font-medium text-slate-800">{ag.data.split('-').reverse().join('/')}</td>
                                  <td className="p-3">{pacienteNome}</td>
                                  <td className="p-3 text-slate-500 font-mono text-[10px]">{ag.horario}</td>
                                  <td className="p-3">{ag.tipoDia || 'Normal'}</td>
                                  <td className="p-3 font-bold text-green-700">
                                    {totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </td>
                                  <td className="p-3">
                                     <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                       ag.status === 'Cancelado' ? 'bg-red-100 text-red-700 border border-red-200' 
                                       : ag.status === 'Concluido' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                       : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                     }`}>
                                       {ag.status}
                                     </span>
                                  </td>
                                </tr>
                              )
                           })}
                         </tbody>
                      </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t border-slate-100 mt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2 hover:bg-gray-100 font-medium text-sm text-slate-600 rounded-lg transition-colors cursor-pointer">Cancelar / Fechar</button>
                {activeTab === 'dados' && (
                  <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-2">
                    <Check size={16} /> Salvar Profissional
                  </button>
                )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
