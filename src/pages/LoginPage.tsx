import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import logo from '../assets/images/rh_logo_v2_1781470281009.jpg';
import { validarDominioCorporativo } from '../types';
import { toast } from 'react-hot-toast';

export const LoginPage: React.FC<{ onNavigateToFirstAccess: () => void }> = ({ onNavigateToFirstAccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, setNotification } = useFirebase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const domainAllowed = await validarDominioCorporativo(email);
        if (!domainAllowed) {
            toast.error('Acesso restrito. O domínio do seu e-mail não está autorizado nas configurações da empresa.');
            setIsLoading(false);
            return;
        }

        try {
            await login(email, password);
        } catch (err: any) {
            setError(err.message || 'auth/invalid-credential');
            setNotification(`Erro: ${err.message || 'auth/invalid-credential'}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex justify-center items-center h-screen bg-slate-50">
            <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
                <div className="flex justify-center mb-6">
                    <img src={logo} alt="Logo" className="h-20 w-auto" />
                </div>
                <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Login</h1>
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-4 border border-red-100 text-center font-medium" id="login-error-message">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 tracking-wide">
                            E-mail
                        </label>
                        <input 
                            id="login-email"
                            type="email" 
                            placeholder="E-mail" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full h-12 px-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all text-sm text-slate-800" 
                            required 
                        />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 tracking-wide">
                            Senha
                        </label>
                        <input 
                            id="login-password"
                            type="password" 
                            placeholder="Senha" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full h-12 px-4 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all text-sm text-slate-800" 
                            required 
                        />
                    </div>
                    <button 
                        id="login-submit-btn"
                        type="submit" 
                        disabled={isLoading}
                        className="w-full h-12 bg-[#1A3626] text-white rounded-xl font-semibold hover:bg-[#254A34] transition-all active:scale-[0.98] shadow-lg shadow-[#1A3626]/20 disabled:opacity-50 flex items-center justify-center text-sm cursor-pointer"
                    >
                        {isLoading ? 'Carregando...' : 'Entrar'}
                    </button>
                    <button 
                        id="login-register-link-btn"
                        type="button" 
                        onClick={onNavigateToFirstAccess}
                        className="w-full h-12 text-slate-600 hover:text-[#1A3626] text-xs font-semibold text-center hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                    >
                        Primeiro Acesso? Crie sua senha
                    </button>
                </form>
            </div>
        </div>
    );
};
