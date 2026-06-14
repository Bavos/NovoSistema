import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Profissional } from '../types';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';

export const Profissionais: React.FC = () => {
  const { profissionais, addProfissional, updateProfissional, deleteProfissional, plantoes } = useFirebase();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Profissional | null>(null);

  const profissionalPlantoes = editingProf ? plantoes.filter(p => p.profissional === editingProf.nome) : [];

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

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Especialidade</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Email</th>
              <th className="p-3">Status</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {(profissionais || []).map(prof => (
              <tr key={prof.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-medium">{prof.nome}</td>
                <td className="p-3">{prof.especialidade}</td>
                <td className="p-3">{prof.telefone}</td>
                <td className="p-3">{prof.email}</td>
                <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] ${prof.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {prof.status}
                    </span>
                </td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => handleOpenModal(prof)} className="text-blue-600 hover:text-blue-800"><Edit2 size={14} /></button>
                  <button onClick={() => deleteProfissional(prof.id)} className="text-red-600 hover:text-red-800"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg">{editingProf ? 'Editar ' : 'Novo '} Profissional</h3>
            <input type="text" placeholder="Nome" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-2 border rounded" required />
            <input type="text" placeholder="Especialidade" value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} className="w-full p-2 border rounded" required />
            <input type="text" placeholder="Telefone" value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full p-2 border rounded" required />
            <input type="email" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-2 border rounded" required />
            <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Banco" value={formData.dadosBancarios.banco} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, banco: e.target.value}})} className="w-full p-2 border rounded" />
                <input type="text" placeholder="Agência" value={formData.dadosBancarios.agencia} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, agencia: e.target.value}})} className="w-full p-2 border rounded" />
                <input type="text" placeholder="Conta" value={formData.dadosBancarios.conta} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, conta: e.target.value}})} className="w-full p-2 border rounded" />
                <input type="text" placeholder="Pix" value={formData.dadosBancarios.pix} onChange={e => setFormData({...formData, dadosBancarios: {...formData.dadosBancarios, pix: e.target.value}})} className="w-full p-2 border rounded" />
            </div>

            {editingProf && (
                <div className="mt-4">
                    <h4 className="font-bold text-sm">Agenda de Plantões</h4>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 text-xs">
                        {profissionalPlantoes.length === 0 ? <p className="text-gray-500">Nenhum plantão agendado.</p> :
                            profissionalPlantoes.map(p => (
                                <div key={p.id} className="border-b py-1">
                                    {p.data} - {p.diaSemana} - {p.status}
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
            <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
