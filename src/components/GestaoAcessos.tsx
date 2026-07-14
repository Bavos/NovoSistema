import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Trash2, Plus, Edit, AlertCircle, Key } from 'lucide-react';
import { UsuarioSistema, validarDominioCorporativo } from '../types';
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
  const [confirmingResetId, setConfirmingResetId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  if (userRole?.toLowerCase() !== 'administrador') {
    return <div className="p-4 text-xs text-red-500 bg-red-50 rounded-lg flex items-center gap-2">
      <AlertCircle size={16} /> Você não tem permissão para acessar esta área de gestão de acessos.
    </div>;
  }

  const handleAddOrEditUser = async () => {
    const cleanNome = nome.trim();
    const cleanEmail = email.trim();

    if (!cleanNome || !cleanEmail) {
      toast.error('Preencha todos os campos!');
      return;
    }

    // Validation against malformed/malicious emails
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;
    if (!emailRegex.test(cleanEmail) || cleanEmail.includes('<') || cleanEmail.includes('>')) {
      toast.error('E-mail inválido ou malicioso!');
      return;
    }

    const domainAllowed = await validarDominioCorporativo(cleanEmail);
    if (!domainAllowed) {
      toast.error('Acesso restrito. O domínio do seu e-mail não está autorizado nas configurações da empresa.');
      return;
    }

    try {
      if (editingId) {
        await updateUsuarioSistema({ id: editingId, nome: cleanNome, email: cleanEmail, nivelAcesso: nivel, status: 'Ativo' });
        toast.success(`Acesso do colaborador ${cleanNome} atualizado com sucesso!`);
      } else {
        await addUsuarioSistema({ nome: cleanNome, email: cleanEmail, nivelAcesso: nivel, status: 'Ativo' });
        toast.success(`Acesso de ${cleanNome} cadastrado com sucesso!`);
      }
      setNome('');
      setEmail('');
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      toast.error('Erro ao salvar acesso.');
    }
  };

  const startEdit = (user: UsuarioSistema) => {
    setEditingId(user.id);
    setNome(user.nome);
    setEmail(user.email);
    setNivel(user.nivelAcesso);
    setShowForm(true);
    setIsOpen(true);
    
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
    setShowForm(false);
  };

  const deleteUser = async (id: string) => {
    try {
      await deleteUsuarioSistema(id);
    } catch (err) {
      alert('Erro ao remover utilizador.');
    }
  };

  if (!isOpen) {
    return (
      <div className="flex justify-center py-2 animate-in fade-in-30">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
        >
          <Key size={14} className="text-[#1A3626]" />
          <span>Informações sobre Acessos</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-30">
      
      {/* INTEGRATED CARD FOR ACESSO AO SISTEMA */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-850">Acesso ao Sistema</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Gerencie os colaboradores e níveis de acesso autorizados na plataforma.</p>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && !editingId && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/40 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={15} /> + Adicionar Acesso
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              Recolher
            </button>
          </div>
        </div>

        {/* FORM (COLLAPSED BY DEFAULT, INLINE DRAWER INDENTED) */}
        {(showForm || editingId) && (
          <form
            onSubmit={(e) => { e.preventDefault(); handleAddOrEditUser(); }}
            id="gestao-acessos-form"
            className={`p-6 border-b border-slate-100 transition-all duration-300 space-y-4 bg-slate-50/50 animate-in slide-in-from-top-4 duration-300 ${
              editingId ? 'border-amber-400 ring-2 ring-amber-400/20 shadow-inner bg-amber-50/10' : ''
            }`}
          >
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {editingId ? '📝 Editar Configurações de Acesso' : '🔑 Preencha os Dados de Acesso'}
              </h3>
              <button 
                type="button"
                onClick={cancelEdit}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="gestao-nome" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Nome</label>
                <input
                  id="gestao-nome"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  type="text"
                  required
                  className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all placeholder:text-slate-400"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="gestao-email" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Email</label>
                <input
                  id="gestao-email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all placeholder:text-slate-400"
                  placeholder="Ex: joao@email.com"
                />
              </div>
              <div className="space-y-1.5">
                 <label htmlFor="gestao-nivel" className="text-[10px] uppercase font-bold text-slate-700 tracking-wider">Nível de acesso</label>
                 <select
                   id="gestao-nivel"
                   value={nivel}
                   onChange={e => setNivel(e.target.value as any)}
                   className="w-full h-11 px-3 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:outline-none transition-all"
                 >
                    <option value="Administrador">Administrador</option>
                    <option value="Colaborador">Colaborador</option>
                 </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                id="gestao-submit-user-btn"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/40 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={15} /> {editingId ? 'Salvar Alterações' : 'Salvar Acesso'}
              </button>
            </div>
          </form>
        )}

        {/* TABLE AREA */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1A3626]/5 text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-5">Nome</th>
                <th className="py-3 px-5">Email</th>
                <th className="py-3 px-5">Acesso</th>
                <th className="py-3 px-5 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {usuariosSistema.filter((user) => user.status !== 'Inativo').map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-5 font-bold text-slate-700">{user.nome}</td>
                  <td className="py-3 px-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-slate-500 font-medium select-all">{user.email}</span>
                      {sendingResetId === user.id ? (
                        <span className="inline-flex items-center gap-1 text-[9px] text-slate-400 font-bold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200">
                          <span className="animate-pulse">⏳</span> Enviando...
                        </span>
                      ) : confirmingResetId === user.id ? (
                        <div className="inline-flex items-center gap-1.5 transition-all animate-in fade-in zoom-in-95 bg-amber-50 p-1 px-1.5 rounded-lg border border-amber-200">
                          <span className="text-[9px] text-amber-800 font-black uppercase select-none px-1">Enviar link de redefinição?</span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              setSendingResetId(user.id);
                              setConfirmingResetId(null);
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
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-0.5 bg-emerald-500 text-white font-bold rounded text-[9px] shadow shadow-emerald-500/30 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                          >
                            Sim
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingResetId(null);
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 font-bold rounded text-[9px] hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={sendingResetId !== null}
                          onClick={() => setConfirmingResetId(user.id)}
                          className="inline-flex items-center justify-center px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          id={`reset-${user.id}`}
                        >
                          🔑 Enviar Redefinição de Senha
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      user.nivelAcesso === 'Administrador' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.nivelAcesso}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right flex gap-2 justify-end items-center min-h-[36px]">
                    {confirmingDeleteId === user.id ? (
                      <div className="flex items-center gap-1.5 transition-all animate-in fade-in zoom-in-95">
                        <span className="text-[10px] text-red-600 font-bold uppercase select-none">Excluir?</span>
                        <button
                          onClick={async () => {
                            await deleteUser(user.id);
                            setConfirmingDeleteId(null);
                          }}
                          className="flex items-center justify-center gap-1 px-2 py-0.5 bg-red-500 text-white font-bold rounded text-[10px] shadow shadow-red-500/30 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="flex items-center justify-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 font-bold rounded text-[10px] hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
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
    </div>
  );
};
