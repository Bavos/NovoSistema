import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Trash2, Plus, Edit, AlertCircle } from 'lucide-react';
import { UsuarioSistema } from '../types';

export const GestaoAcessos: React.FC = () => {
  const { usuariosSistema, userRole, addUsuarioSistema, deleteUsuarioSistema, updateUsuarioSistema } = useFirebase();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nivel, setNivel] = useState<'Administrador' | 'Colaborador'>('Colaborador');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (userRole?.toLowerCase() !== 'administrador') {
    return <div className="p-4 text-xs text-red-500 bg-red-50 rounded-lg flex items-center gap-2">
      <AlertCircle size={16} /> Você não tem permissão para acessar esta área de gestão de acessos.
    </div>;
  }

  const handleAddOrEditUser = async () => {
    if (!nome || !email) return alert('Preencha nome e email!');
    try {
      if (editingId) {
        await updateUsuarioSistema({ id: editingId, nome, email, nivelAcesso: nivel, status: 'Ativo' });
      } else {
        await addUsuarioSistema({ nome, email, nivelAcesso: nivel, status: 'Ativo' });
      }
      setNome('');
      setEmail('');
      setEditingId(null);
    } catch (err) {
      alert('Erro ao salvar utilizador.');
    }
  };

  const startEdit = (user: UsuarioSistema) => {
    setEditingId(user.id);
    setNome(user.nome);
    setEmail(user.email);
    setNivel(user.nivelAcesso);
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteUsuarioSistema(id);
    } catch (err) {
      alert('Erro ao remover utilizador.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-30">
      
      {/* FORM CARD */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-800">Equipa e Acessos ao Sistema</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">Nome Colaborador</label>
            <input value={nome} onChange={e => setNome(e.target.value)} type="text" className="w-full p-2 border border-slate-200 rounded-lg text-xs" placeholder="Ex: João Silva" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-slate-400">E-mail</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="text" className="w-full p-2 border border-slate-200 rounded-lg text-xs" placeholder="Ex: joao@email.com" />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] uppercase font-bold text-slate-400">Nível de Acesso</label>
             <select value={nivel} onChange={e => setNivel(e.target.value as any)} className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white">
                <option value="Administrador">Administrador</option>
                <option value="Colaborador">Colaborador</option>
             </select>
          </div>
          <button
            onClick={handleAddOrEditUser}
            className="px-4 py-2 bg-[#1A3626] text-white hover:bg-[#254A34] rounded-full text-xs font-semibold shadow-md transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus size={16} /> {editingId ? 'Atualizar Utilizador' : 'Adicionar Utilizador'}
          </button>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100">
            <tr>
              <th className="py-3 px-4">Nome</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Acesso</th>
              <th className="py-3 px-4 text-right">Acções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {usuariosSistema.filter((user) => user.status !== 'Inativo').map((user) => (
              <tr key={user.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-bold text-slate-700">{user.nome}</td>
                <td className="py-3 px-4 text-slate-500">{user.email}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    user.nivelAcesso === 'Administrador' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.nivelAcesso}
                  </span>
                </td>
                <td className="py-3 px-4 text-right flex gap-2 justify-end items-center min-h-[36px]">
                  {confirmingDeleteId === user.id ? (
                    <div className="flex items-center gap-1.5 transition-all animate-in fade-in zoom-in-95">
                      <span className="text-[10px] text-red-600 font-bold uppercase select-none">Excluir?</span>
                      <button
                        onClick={async () => {
                          await deleteUser(user.id);
                          setConfirmingDeleteId(null);
                        }}
                        className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] font-bold uppercase cursor-pointer hover:bg-red-700 transition-colors"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase cursor-pointer hover:bg-slate-200 transition-colors border border-slate-200"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 justify-end items-center">
                      <button onClick={() => { setConfirmingDeleteId(null); startEdit(user); }} className="text-blue-500 hover:text-blue-700 cursor-pointer">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => setConfirmingDeleteId(user.id)} className="text-red-500 hover:text-red-700 cursor-pointer">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
