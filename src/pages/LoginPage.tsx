import React, { useState, useRef, useEffect } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import rhLogo from '../assets/images/rh_logo_1781469900395.jpg';
import { validarDominioCorporativo } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorSanitizer';
import { toast } from 'react-hot-toast';
import { auth } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  sendEmailVerification, 
  signOut, 
  sendPasswordResetEmail,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  MultiFactorResolver
} from 'firebase/auth';
import { ShieldCheck, Smartphone, Lock, RefreshCw, Loader2, X, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC<{ onNavigateToFirstAccess: () => void }> = ({ onNavigateToFirstAccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
    const [showResendVerification, setShowResendVerification] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Estados do Desafio de 2º Fator (2FA/MFA via SMS)
    const [showMfaModal, setShowMfaModal] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [mfaVerificationId, setMfaVerificationId] = useState<string | null>(null);
    const [mfaPhoneNumberHint, setMfaPhoneNumberHint] = useState<string>('');
    const [mfaCode, setMfaCode] = useState('');
    const [isVerifyingMfa, setIsVerifyingMfa] = useState(false);
    const [isSendingMfaSms, setIsSendingMfaSms] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);

    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const { login } = useFirebase();

    useEffect(() => {
        return () => {
            if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear(); } catch(e){}
                recaptchaVerifierRef.current = null;
            }
        };
    }, []);

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
            const rawCode = err?.code || '';
            const rawMsg = err?.message || '';

            // Interceptar desafio obrigatorio de Autenticação em Duas Etapas (2FA/MFA)
            if (rawCode === 'auth/multi-factor-auth-required' || rawCode === 'auth/mfa-required') {
                try {
                    const resolver = getMultiFactorResolver(auth, err);
                    const hints = resolver.hints;
                    const phoneHint = hints[0]; // PhoneMultiFactorInfo

                    if (recaptchaVerifierRef.current) {
                        try { recaptchaVerifierRef.current.clear(); } catch(e){}
                    }

                    const verifier = new RecaptchaVerifier(auth, 'mfa-login-recaptcha-container', {
                        size: 'invisible'
                    });
                    recaptchaVerifierRef.current = verifier;

                    const phoneInfoOptions = {
                        multiFactorHint: phoneHint,
                        session: resolver.session
                    };
                    const phoneProvider = new PhoneAuthProvider(auth);
                    const vId = await phoneProvider.verifyPhoneNumber(phoneInfoOptions, verifier);

                    setMfaResolver(resolver);
                    setMfaVerificationId(vId);
                    setMfaPhoneNumberHint((phoneHint as any).phoneNumber || 'Telemóvel Registado');
                    setShowMfaModal(true);
                    toast.success("Desafio de 2º Fator necessário: Código SMS enviado para o seu telemóvel.");
                    return;
                } catch (mfaInitErr: any) {
                    console.error("Erro ao iniciar desafio 2FA SMS:", mfaInitErr);
                    toast.error(getFriendlyErrorMessage(mfaInitErr, "Falha ao enviar código SMS de verificação do 2º fator."));
                    return;
                }
            }

            if ((rawCode + ' ' + rawMsg).toLowerCase().includes('email-not-verified')) {
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

    // Submissão do código de 6 dígitos no modal de desafio 2FA
    const handleVerifyMfaCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const codigoLimpo = mfaCode.trim().replace(/\D/g, '');

        if (codigoLimpo.length !== 6) {
            setMfaError("O código SMS deve ter exatamente 6 dígitos.");
            toast.error("O código SMS deve ter exatamente 6 dígitos.");
            return;
        }

        if (!mfaResolver || !mfaVerificationId) {
            toast.error("Sessão de verificação expirada. Tente fazer login novamente.");
            return;
        }

        setIsVerifyingMfa(true);
        setMfaError(null);

        try {
            const cred = PhoneAuthProvider.credential(mfaVerificationId, codigoLimpo);
            const assertion = PhoneMultiFactorGenerator.assertion(cred);
            
            // Concluir autenticação com o 2º Fator validado
            await mfaResolver.resolveSignIn(assertion);
            toast.success("Autenticação em duas etapas realizada com sucesso!");
            setShowMfaModal(false);

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
            } catch (e) {}
        } catch (err: any) {
            console.error("Erro na validação do código 2FA SMS:", err);
            let msg = "Código SMS incorreto ou expirado.";

            if (err?.code === 'auth/invalid-verification-code') {
                msg = "Código SMS incorreto. Verifique os 6 dígitos recebidos no telemóvel.";
            } else if (err?.code === 'auth/code-expired') {
                msg = "Código SMS expirado. Solicite um novo código abaixo.";
            } else if (err?.message) {
                msg = getFriendlyErrorMessage(err, msg);
            }

            setMfaError(msg);
            toast.error(msg);
        } finally {
            setIsVerifyingMfa(false);
        }
    };

    // Reenvio do código SMS no modal de 2FA
    const handleResendMfaSms = async () => {
        if (!mfaResolver) return;
        setIsSendingMfaSms(true);
        setMfaError(null);

        try {
            if (recaptchaVerifierRef.current) {
                try { recaptchaVerifierRef.current.clear(); } catch(e){}
            }

            const verifier = new RecaptchaVerifier(auth, 'mfa-login-recaptcha-container', {
                size: 'invisible'
            });
            recaptchaVerifierRef.current = verifier;

            const phoneHint = mfaResolver.hints[0];
            const phoneInfoOptions = {
                multiFactorHint: phoneHint,
                session: mfaResolver.session
            };
            const phoneProvider = new PhoneAuthProvider(auth);
            const vId = await phoneProvider.verifyPhoneNumber(phoneInfoOptions, verifier);

            setMfaVerificationId(vId);
            toast.success("Novo código SMS enviado para o seu telemóvel!");
        } catch (err: any) {
            console.error("Erro ao reenviar SMS 2FA:", err);
            toast.error(getFriendlyErrorMessage(err, "Falha ao reenviar SMS de verificação."));
        } finally {
            setIsSendingMfaSms(false);
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
            {/* Elemento reCAPTCHA invisível para login 2FA */}
            <div id="mfa-login-recaptcha-container"></div>

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

            {/* MODAL DE DESAFIO DE 2º FATOR (2FA VIA SMS NO LOGIN) */}
            {showMfaModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full border border-slate-100 overflow-hidden flex flex-col">
                        <div className="bg-[#1c3829] px-6 py-5 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                                    <ShieldCheck size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-base leading-tight">Verificação de 2º Fator</h3>
                                    <p className="text-xs text-emerald-200/80">Segurança por SMS</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMfaModal(false)}
                                className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleVerifyMfaCode} className="p-6 space-y-4">
                            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-950 flex items-start gap-2.5">
                                <Smartphone size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">Código Enviado por SMS</p>
                                    <p className="text-[11px] text-emerald-800 leading-snug mt-0.5">
                                        Um SMS com código de 6 dígitos foi enviado para <strong>{mfaPhoneNumberHint}</strong>.
                                    </p>
                                </div>
                            </div>

                            {mfaError && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>{mfaError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Código de Verificação (6 Dígitos)
                                </label>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={mfaCode}
                                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123456"
                                    className="w-full h-12 text-center tracking-[0.5em] text-xl font-mono font-bold border border-slate-300 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:border-[#1c3829] focus:ring-2 focus:ring-[#1c3829]/20 outline-none transition-all"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <button
                                    type="button"
                                    onClick={handleResendMfaSms}
                                    disabled={isSendingMfaSms || isVerifyingMfa}
                                    className="text-xs text-[#1c3829] font-medium hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                    <RefreshCw size={12} />
                                    <span>{isSendingMfaSms ? 'Enviando...' : 'Reenviar SMS'}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowMfaModal(false)}
                                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                    Cancelar
                                </button>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={isVerifyingMfa || mfaCode.length !== 6}
                                    className="w-full h-11 bg-[#1c3829] hover:bg-[#152e21] text-white rounded-xl font-semibold transition-all shadow-md disabled:opacity-50 flex items-center justify-center text-sm cursor-pointer"
                                >
                                    {isVerifyingMfa ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin mr-2" />
                                            <span>Validando 2FA...</span>
                                        </>
                                    ) : (
                                        <span>Confirmar e Entrar</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
