import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import rhLogo from '../assets/images/rh_logo_1781469900395.jpg';
import { validarDominioCorporativo } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorSanitizer';
import { toast } from 'react-hot-toast';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, sendEmailVerification, signOut, sendPasswordResetEmail } from 'firebase/auth';

export const LoginPage: React.FC<{ onNavigateToFirstAccess: () => void }> = ({ onNavigateToFirstAccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { login } = useFirebase();

    const handleForgotPassword = async () => {
        const emailFormatado = email.trim().toLowerCase();
        if (!emailFormatado) {
            toast.error("Informe seu e-mail no campo acima para receber o link de recuperação.");
            return;
        }

        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, emailFormatado);
            toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada e o spam.");
        } catch (err: any) {
            console.error("Erro Firebase sendPasswordResetEmail:", err?.code, err?.message);

            if (err?.code === 'auth/user-not-found') {
                toast.error("Nenhum usuário cadastrado com este e-mail.");
            } else if (err?.code === 'auth/invalid-email') {
                toast.error("Formato de e-mail inválido.");
            } else if (err?.code === 'auth/missing-continue-uri') {
                toast.error("Configuração de redirecionamento ausente no Firebase.");
            } else if (err?.code === 'auth/too-many-requests') {
                toast.error("Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.");
            } else {
                toast.error(`Falha ao enviar: [${err?.code || 'erro'}] ${err?.message || 'Erro desconhecido'}`);
            }
        } finally {
            setIsSendingReset(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setShowResendVerification(false);

        const emailFormatado = email.trim().toLowerCase();
        const domainAllowed = await validarDominioCorporativo(emailFormatado);
        if (!domainAllowed) {
            const domainMsg = 'Acesso restrito. O domínio do seu e-mail não está autorizado nas configurações da empresa.';
            setError(domainMsg);
            toast.error(domainMsg);
            setIsLoading(false);
            return;
        }

        try {
            await login(emailFormatado, password);
            try {
                const routeKeys = [
                    'last_visited_tab',
                    'lastTab',
                    'activeTab',
                    'currentTab',
                    'ultima_aba',
                    'lastRoute',
                    'activeSidebarTab',
                    'selectedTab',
                    'initialTab'
                ];
                routeKeys.forEach(k => {
                    window.localStorage.removeItem(k);
                    window.sessionStorage.removeItem(k);
                });
                if (window.location.search || window.location.hash || window.location.pathname !== '/') {
                    window.history.replaceState({}, '', '/');
                }
            } catch (storageErr) {
                console.warn('Erro ao resetar rotas pós-login:', storageErr);
            }
        } catch (err: any) {
            const raw = ((err?.code || '') + ' ' + (err?.message || '')).toLowerCase();
            if (raw.includes('email-not-verified')) {
                setShowResendVerification(true);
                const friendlyMsg = 'Acesso negado: Você precisa confirmar o link que enviamos para o seu e-mail antes de acessar o sistema.';
                setError(friendlyMsg);
                toast.error(friendlyMsg);
            } else {
                const friendlyMessage = getFriendlyErrorMessage(err, 'E-mail ou senha incorretos. Verifique os dados digitados.');
                setError(friendlyMessage);
                toast.error(friendlyMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setIsResending(true);
        try {
            const emailFormatado = email.trim().toLowerCase();
            if (auth.currentUser) {
                await sendEmailVerification(auth.currentUser);
            } else if (emailFormatado && password) {
                const userCredential = await signInWithEmailAndPassword(auth, emailFormatado, password);
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
            const friendlyMsg = getFriendlyErrorMessage(err, 'Erro ao reenviar o e-mail. Verifique suas credenciais.');
            toast.error(friendlyMsg);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="flex justify-center items-center min-h-screen bg-[#f1f5f9] p-4">
            <div className="bg-white px-8 pt-8 pb-10 rounded-[28px] shadow-2xl w-full max-w-[400px] border border-slate-100">
                <div className="flex justify-center mb-5">
                    <img 
                        src={rhLogo} 
                        alt="RH Gestão Domiciliar" 
                        className="w-full max-w-[240px] h-auto object-contain select-none"
                    />
                </div>
                <h1 className="text-2xl font-bold text-[#1e293b] mb-6 text-center">Login</h1>
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl text-xs mb-4 border border-red-100 text-center font-medium" id="login-error-message">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="login-email" className="block text-xs font-medium text-slate-700 mb-1.5">
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
                            className="w-full h-11 px-4 border border-amber-200/50 rounded-xl bg-[#fef9c3] focus:bg-[#fef9c3] focus:border-[#1c3829] focus:ring-2 focus:ring-[#1c3829]/20 transition-all text-sm text-slate-800 placeholder-slate-400 outline-none" 
                            required 
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                                Senha
                            </label>
                            <button
                                id="login-forgot-password-btn"
                                type="button"
                                onClick={handleForgotPassword}
                                disabled={isSendingReset}
                                className="text-[11px] text-slate-500 hover:text-slate-800 font-normal hover:underline cursor-pointer disabled:opacity-50"
                            >
                                {isSendingReset ? 'Enviando...' : 'Esqueceu a senha?'}
                            </button>
                        </div>
                        <input 
                            id="login-password"
                            type="password" 
                            value={password} 
                            onChange={e => {
                                setPassword(e.target.value);
                                setShowResendVerification(false);
                            }} 
                            className="w-full h-11 px-4 border border-amber-200/50 rounded-xl bg-[#fef9c3] focus:bg-[#fef9c3] focus:border-[#1c3829] focus:ring-2 focus:ring-[#1c3829]/20 transition-all text-sm text-slate-800 placeholder-slate-400 outline-none" 
                            required 
                        />
                    </div>
                    <div className="pt-2">
                        <button 
                            id="login-submit-btn"
                            type="submit" 
                            disabled={isLoading}
                            className="w-full h-11 bg-[#1c3829] text-white rounded-xl font-semibold hover:bg-[#152e21] transition-all active:scale-[0.99] shadow-md shadow-[#1c3829]/20 disabled:opacity-50 flex items-center justify-center text-sm cursor-pointer"
                        >
                            {isLoading ? 'Carregando...' : 'Entrar'}
                        </button>
                    </div>

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

                    <div className="pt-3 text-center">
                        <button 
                            id="login-register-link-btn"
                            type="button" 
                            onClick={onNavigateToFirstAccess}
                            className="text-xs text-slate-600 hover:text-[#1c3829] hover:underline font-normal text-center transition-colors cursor-pointer inline-block"
                        >
                            Primeiro Acesso? Crie sua senha
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
