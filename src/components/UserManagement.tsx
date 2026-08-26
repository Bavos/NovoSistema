import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useFirebase } from '../context/FirebaseContext';
import { 
  UserPlus, 
  Users, 
  Edit, 
  Trash2, 
  ShieldCheck, 
  UserCheck, 
  Search, 
  X, 
  AlertCircle, 
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { validarDominioCorporativo } from '../types';

export interface UsuarioSistemaDoc {
  id: string;
  nome: string;
  email: string;
  nivelAcesso: 'Administrador' | 'Colaborador';
  status: 'Ativo' | 'Inativo';
}

export const UserManagement: React.FC = () => {
  const { userRole } = useFirebase();
  const [usuarios, setUsuarios] = useState<UsuarioSistemaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UsuarioSistemaDoc | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    email: string;
    nivelAcesso: 'Administrador' | 'Colaborador';
    status: 'Ativo' | 'Inativo';
  }>({
    nome: '',
    email: '',
    nivelAcesso: 'Colaborador',
    status: 'Ativo',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UsuarioSistemaDoc | null>(null);

  // Read collection usuarios_sistema in real-time (Strictly for Administrador)
  useEffect(() => {
    if (userRole?.toLowerCase() !== 'administrador') {
      setUsuarios([]);
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'usuarios_sistema');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const usersList: UsuarioSistemaDoc[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          nome: docSnap.data().nome || '',
          email: docSnap.data().email || '',
          nivelAcesso: docSnap.data().nivelAcesso || 'Colaborador',
          status: docSnap.data().status || 'Ativo',
        }));
        setUsuarios(usersList);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao buscar usuários do sistema:', error);
        toast.error('Erro ao sincronizar lista de usuários.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userRole]);

  // Strict role verification
  if (userRole?.toLowerCase() !== 'administrador') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-100 shadow-sm max-w-md mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Acesso Restrito</h3>
        <p className="text-xs text-slate-500">
          Você não possui privilégios de Administrador para gerenciar os operadores do sistema.
        </p>
      </div>
    );
  }

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      nome: '',
      email: '',
      nivelAcesso: 'Colaborador',
      status: 'Ativo',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: UsuarioSistemaDoc) => {
    setEditingUser(user);
    setFormData({
      nome: user.nome,
      email: user.email,
      nivelAcesso: user.nivelAcesso,
      status: user.status,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole?.toLowerCase() !== 'administrador') {
      toast.error('Ação não permitida: Apenas Administradores podem gerenciar usuários.');
      return;
    }

    const cleanNome = formData.nome.trim();
    const cleanEmail = formData.email.trim().toLowerCase();

    if (!cleanNome || !cleanEmail) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error('Formato de e-mail inválido.');
      return;
    }

    const domainAllowed = await validarDominioCorporativo(cleanEmail);
    if (!domainAllowed) {
      toast.error('O domínio do e-mail não pertence à whitelist corporativa autorizada.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser) {
        // Atualizar usuário existente
        const userRef = doc(db, 'usuarios_sistema', editingUser.id);
        await updateDoc(userRef, {
          nome: cleanNome,
          email: cleanEmail,
          nivelAcesso: formData.nivelAcesso,
          status: formData.status,
        });
        toast.success(`Usuário ${cleanNome} atualizado com sucesso!`);
      } else {
        // Cadastrar novo operador
        const colRef = collection(db, 'usuarios_sistema');
        await addDoc(colRef, {
          nome: cleanNome,
          email: cleanEmail,
          nivelAcesso: formData.nivelAcesso,
          status: formData.status,
        });
        toast.success(`Usuário ${cleanNome} cadastrado com sucesso!`);
      }
      handleCloseModal();
    } catch (err: any) {
      console.error('Erro ao salvar usuário:', err);
      toast.error('Erro ao salvar no Firestore: ' + (err.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (user: UsuarioSistemaDoc) => {
    if (userRole?.toLowerCase() !== 'administrador') {
      toast.error('Ação não permitida: Apenas Administradores podem alterar o status.');
      return;
    }
    const nextStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo';
    try {
      const userRef = doc(db, 'usuarios_sistema', user.id);
      await updateDoc(userRef, { status: nextStatus });
      toast.success(`Status de ${user.nome} alterado para ${nextStatus}.`);
    } catch (err: any) {
      toast.error('Erro ao alterar status: ' + (err.message || String(err)));
    }
  };

  const handleDeleteUser = async (user: UsuarioSistemaDoc) => {
    if (userRole?.toLowerCase() !== 'administrador') {
      toast.error('Ação não permitida: Apenas Administradores podem excluir usuários.');
      return;
    }
    try {
      const userRef = doc(db, 'usuarios_sistema', user.id);
      await deleteDoc(userRef);
      toast.success(`Usuário ${user.nome} excluído com sucesso!`);
      setDeleteConfirmUser(null);
    } catch (err: any) {
      toast.error('Erro ao excluir usuário: ' + (err.message || String(err)));
    }
  };

  const filteredUsers = usuarios.filter((u) => {
    const term = search.toLowerCase();
    return (
      u.nome.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.nivelAcesso.toLowerCase().includes(term) ||
      u.status.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header com Estatísticas e Botão de Novo Usuário */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-800">Gestão de Usuários do Sistema</h1>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 font-semibold text-xs rounded-full border border-emerald-200">
              {usuarios.length} operadores
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de níveis de permissão e ativação de acessos à plataforma.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1A3626] hover:bg-[#254A34] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#1A3626]/20 active:scale-95 cursor-pointer"
        >
          <UserPlus size={16} />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Barra de Pesquisa */}
      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
        <Search size={16} className="text-slate-400 ml-2 shrink-0" />
        <input
          type="text"
          placeholder="Buscar por nome, e-mail, perfil ou status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs text-slate-700 bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="p-1 hover:bg-slate-100 text-slate-400 rounded-md transition-colors mr-1"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">Nome</th>
                <th className="py-3.5 px-6">E-mail</th>
                <th className="py-3.5 px-6">Nível de Acesso</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    Carregando usuários do sistema...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    {search ? 'Nenhum usuário encontrado para esta busca.' : 'Nenhum usuário cadastrado no sistema.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-4 px-6 font-semibold text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {user.nome.slice(0, 2) || 'US'}
                        </div>
                        <span>{user.nome}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{user.email}</td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          user.nivelAcesso === 'Administrador'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/60'
                            : 'bg-blue-50 text-blue-800 border border-blue-200/60'
                        }`}
                      >
                        <ShieldCheck size={12} />
                        {user.nivelAcesso}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          user.status === 'Ativo'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {user.status === 'Ativo' ? (
                          <CheckCircle size={12} className="text-emerald-600" />
                        ) : (
                          <XCircle size={12} className="text-slate-400" />
                        )}
                        {user.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                            user.status === 'Ativo'
                              ? 'text-amber-700 border-amber-200 hover:bg-amber-50'
                              : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                          }`}
                          title={user.status === 'Ativo' ? 'Desativar acesso' : 'Ativar acesso'}
                        >
                          {user.status === 'Ativo' ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(user)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar dados"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmUser(user)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 border border-rose-100 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Excluir usuário"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro / Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#1A3626]/10 text-[#1A3626] rounded-xl">
                  {editingUser ? <Edit size={18} /> : <UserPlus size={18} />}
                </div>
                <h3 className="text-base font-bold text-slate-800">
                  {editingUser ? 'Editar Usuário do Sistema' : 'Novo Usuário do Sistema'}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mariana Silva"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] text-xs text-slate-800 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  E-mail Corporativo <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nome@empresa.com.br"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] text-xs text-slate-800 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nível de Acesso
                  </label>
                  <select
                    value={formData.nivelAcesso}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        nivelAcesso: e.target.value as 'Administrador' | 'Colaborador',
                      })
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] text-xs text-slate-800 transition-all"
                  >
                    <option value="Colaborador">Colaborador</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as 'Ativo' | 'Inativo',
                      })
                    }
                    className="w-full h-10 px-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] text-xs text-slate-800 transition-all"
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>
              </div>

              {/* Aviso Importante sobre Auth / Primeiro Acesso */}
              <div className="bg-amber-50/80 border border-amber-200/70 p-3 rounded-xl flex items-start gap-2.5">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  <span className="font-bold">Atenção:</span> Após salvar, oriente o colaborador a utilizar a opção <span className="font-semibold underline">Primeiro Acesso</span> na tela de login para gerar sua senha usando o e-mail cadastrado.
                </p>
              </div>

              {/* Botões de Ação do Modal */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#1A3626] hover:bg-[#254A34] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#1A3626]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Salvando...' : editingUser ? 'Atualizar Usuário' : 'Salvar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm border border-slate-100 p-6 space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={20} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Excluir Usuário do Sistema?</h3>
              <p className="text-xs text-slate-500">
                Tem certeza que deseja remover o usuário <span className="font-bold text-slate-700">{deleteConfirmUser.nome}</span> ({deleteConfirmUser.email})? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteUser(deleteConfirmUser)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;
