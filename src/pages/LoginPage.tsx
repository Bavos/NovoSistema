import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import logo from '../assets/images/rh_logo_v2_1781470281009.jpg';

export const LoginPage: React.FC<{ onNavigateToFirstAccess: () => void }> = ({ onNavigateToFirstAccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, setNotification } = useFirebase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
        } catch (err: any) {
            setNotification(`Erro: ${err.message}`);
        }
    };

    return (
        <div className="flex justify-center items-center h-screen bg-slate-50">
            <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-sm border border-slate-100">
                <div className="flex justify-center mb-6">
                    <img src={logo} alt="Logo" className="h-20 w-auto" />
                </div>
                <h1 className="text-2xl font-serif font-bold text-slate-800 mb-6 text-center">Login</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
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
                        placeholder="Senha" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A3626]/20 focus:border-[#1A3626] transition-all" 
                        required 
                    />
                    <button 
                        type="submit" 
                        className="w-full bg-[#1A3626] text-white p-3 rounded-xl font-semibold hover:bg-[#254A34] transition-colors shadow-lg shadow-[#1A3626]/20"
                    >
                        Entrar
                    </button>
                    <button 
                        type="button" 
                        onClick={onNavigateToFirstAccess}
                        className="w-full text-slate-500 hover:text-slate-800 text-xs text-center"
                    >
                        Primeiro Acesso? Crie sua senha
                    </button>
                </form>
            </div>
        </div>
    );
};
