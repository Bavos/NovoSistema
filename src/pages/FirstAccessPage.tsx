import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import logo from '../assets/images/rh_logo_v2_1781470281009.jpg';

interface FirstAccessPageProps {
  onBackToLogin: () => void;
}

export const FirstAccessPage: React.FC<FirstAccessPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { activateAccount, setNotification } = useFirebase();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setNotification('As senhas não coincidem.');
      return;
    }
    try {
      await activateAccount(email, password);
      // Wait a bit or let context handle notification, then go back
      onBackToLogin();
    } catch (err: any) {
      setNotification(err.message || 'Erro ao ativar conta.');
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <div className="flex justify-center mb-6">
                <img src={logo} alt="Logo" className="h-20 w-auto" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Ativar Conta</h1>
            <form onSubmit={handleActivate} className="space-y-4">
                <input 
                    type="email" 
                    placeholder="E-mail" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Nova Senha" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                    required 
                />
                <input 
                    type="password" 
                    placeholder="Confirmar Nova Senha" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                    required 
                />
                <button 
                    type="submit" 
                    className="w-full bg-[#1A3626] text-white p-3 rounded-xl font-semibold hover:bg-[#254A34] transition-colors shadow-lg shadow-[#1A3626]/20"
                >
                    🔐 Ativar Minha Conta
                </button>
                <button 
                    type="button" 
                    onClick={onBackToLogin}
                    className="w-full text-slate-500 hover:text-slate-800 text-xs text-center"
                >
                    Voltar ao Login
                </button>
            </form>
        </div>
    </div>
  );
};
