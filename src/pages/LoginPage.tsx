import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import logo from '../assets/images/rh_logo_v2_1781470281009.jpg';
import { validarDominioCorporativo } from '../types';
import { toast } from 'react-hot-toast';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';

export const LoginPage: React.FC<{ onNavigateToFirstAccess: () => void }> = ({ onNavigateToFirstAccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login, setNotification } = useFirebase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setShowResendVerification(false);

        const domainAllowed = await validarDominioCorporativo(email);
        if (!domainAllowed) {
            toast.error('Acesso restrito. O domínio do seu e-mail não está autorizado nas configurações da empresa.');
            setIsLoading(false);
            return;
        }

        try {
            await login(email, password);
        } catch (err: any) {
            if (err.message === 'auth/email-not-verified' || err.code === 'auth/email-not-verified') {
                setShowResendVerification(true);
            } else {
                setError(err.message || 'auth/invalid-credential');
                setNotification(`Erro: ${err.message || 'auth/invalid-credential'}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        try {
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
            } else if (email && password) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                if (userCredential.user) {
                    await sendEmailVerification(userCredential.user);
                    await signOut(auth);
                }
            } else {
                toast.error('Informe o e-mail e a senha para reenviar o link de confirmação.');
                return;
            }
            toast.success('Novo link de confirmação enviado para o seu e-mail!');
            setShowResendVerification(false);
        } catch (err: any) {
            console.error('Erro ao reenviar confirmação de e-mail:', err);
            toast.error('Erro ao reenviar o e-mail. Verifique suas credenciais.');
        } finally {
            setIsResending(false);
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
                            value={email} 
                            onChange={e => {
                                setEmail(e.target.value);
                                setShowResendVerification(false);
                            }} 
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
                            value={password} 
                            onChange={e => {
                                setPassword(e.target.value);
                                setShowResendVerification(false);
                            }} 
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

                    {showResendVerification && (
                        <div className="text-center pt-1 animate-in fade-in duration-200">
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={isResending}
                                className="text-xs font-medium text-emerald-700 hover:text-emerald-900 hover:underline transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                                {isResending ? 'Enviando...' : 'Não recebeu o e-mail de confirmação? Reenviar link'}
                            </button>
                        </div>
                    )}

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
