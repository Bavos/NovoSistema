import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Trash2, Plus, Edit, AlertCircle } from 'lucide-react';
import { UsuarioSistema } from '../types';
import { auth } from '../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'react-hot-toast';

export const GestaoAcessos: React.FC = () => {
  const { usuariosSistema, userRole, addUsuarioSistema, deleteUsuarioSistema, updateUsuarioSistema, forgotPassword } = useFirebase();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [nivel, setNivel] = useState<'Administrador' | 'Colaborador'>('Colaborador');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [sendingResetId, setSendingResetId] = useState<string | null>(null);

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
    
    // Smooth scroll to form element
    const formElement = document.getElementById('gestao-acessos-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNome('');
    setEmail('');
    setNivel('Colaborador');
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
      <div 
        id="gestao-acessos-form" 
        className={`p-6 rounded-xl border transition-all duration-300 space-y-4 bg-white ${
          editingId ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-md' : 'border-slate-200 shadow-sm'
        }`}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-800">
            {editingId ? '📝 Editar Colaborador e Nível de Acesso' : 'Equipa e Acessos ao Sistema'}
          </h2>
          {editingId && (
            <button 
              onClick={cancelEdit}
              className="text-[10px] font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-200 transition-colors uppercase"
            >
              Cancelar Edição
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label htmlFor="gestao-nome" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Nome Colaborador</label>
            <input id="gestao-nome" value={nome} onChange={e => setNome(e.target.value)} type="text" className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all" placeholder="Ex: João Silva" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="gestao-email" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">E-mail</label>
            <input id="gestao-email" value={email} onChange={e => setEmail(e.target.value)} type="text" className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all" placeholder="Ex: joao@email.com" />
          </div>
          <div className="space-y-1.5">
             <label htmlFor="gestao-nivel" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Nível de Acesso</label>
             <select id="gestao-nivel" value={nivel} onChange={e => setNivel(e.target.value as any)} className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all">
                <option value="Administrador">Administrador</option>
                <option value="Colaborador">Colaborador</option>
             </select>
          </div>
          <div>
            <button
              type="button"
              id="gestao-submit-user-btn"
              onClick={handleAddOrEditUser}
              className="w-full h-12 bg-[#1A3626] text-white hover:bg-[#254A34] active:scale-[0.98] rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus size={16} /> {editingId ? 'Atualizar Utilizador' : 'Adicionar Utilizador'}
            </button>
          </div>
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
                <td className="py-3 px-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-slate-500">{user.email}</span>
                     <button
                      type="button"
                      disabled={sendingResetId !== null}
                      onClick={async () => {
                        if (window.confirm('Deseja enviar um link de redefinição de senha para o e-mail deste colaborador?')) {
                          setSendingResetId(user.id);
                          const loadingToast = toast.loading('Enviando e-mail de redefinição...');
                          try {
                            const emailDoColaborador = user.email;
                            await sendPasswordResetEmail(auth, emailDoColaborador);
                            toast.success('E-mail enviado!', { id: loadingToast });
                          } catch (error: any) {
                            console.error("Erro ao enviar redefinição de senha:", error);
                            toast.error('Erro ao processar', { id: loadingToast });
                          } finally {
                            setSendingResetId(null);
                          }
                        }
                      }}
                      className="inline-flex items-center justify-center px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#1a3c2e] hover:bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-md transition-all duration-150 cursor-pointer select-none whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      id={`reset-${user.id}`}
                    >
                      {sendingResetId === user.id ? '⏳ Enviando...' : '🔑 Enviar Redefinição de Senha'}
                    </button>
                  </div>
                </td>
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
