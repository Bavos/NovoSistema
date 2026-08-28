import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { Logo } from '../components/Logo';
import { getSanitizedAuthErrorMessage } from '../types';
import { toast } from 'react-hot-toast';

interface FirstAccessPageProps {
  onBackToLogin: () => void;
}

export const FirstAccessPage: React.FC<FirstAccessPageProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { activateAccount, setNotification } = useFirebase();

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      const msg = 'As senhas digitadas não coincidem. Verifique e tente novamente.';
      setError(msg);
      toast.error(msg);
      return;
    }
    try {
      await activateAccount(email, password);
      // Wait a bit or let context handle notification, then go back
      onBackToLogin();
    } catch (err: any) {
      const friendlyMsg = getSanitizedAuthErrorMessage(err);
      setError(friendlyMsg);
      toast.error(friendlyMsg);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-slate-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
            <div className="flex justify-center mb-4">
                <Logo className="w-full max-w-[250px] h-auto" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Ativar Conta</h1>
            {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-4 border border-red-100 text-center font-medium">
                    {error}
                </div>
            )}
            <form onSubmit={handleActivate} className="space-y-4">
                <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                    required 
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                    required 
                />
                <input 
                    type="password" 
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
