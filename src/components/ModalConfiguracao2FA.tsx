import React, { useState, useEffect, useRef } from 'react';
import { 
  multiFactor, 
  PhoneAuthProvider, 
  PhoneMultiFactorGenerator, 
  RecaptchaVerifier, 
  MultiFactorInfo,
  PhoneMultiFactorInfo
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  ShieldCheck, 
  Smartphone, 
  Lock, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Trash2,
  Key
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getFriendlyErrorMessage } from '../utils/errorSanitizer';

interface ModalConfiguracao2FAProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalConfiguracao2FA: React.FC<ModalConfiguracao2FAProps> = ({ isOpen, onClose }) => {
  const [codigoPais, setCodigoPais] = useState('+55');
  const [numeroTelefone, setNumeroTelefone] = useState('');
  const [codigoSMS, setCodigoSMS] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isUnenrolling, setIsUnenrolling] = useState(false);
  const [enrolledFactors, setEnrolledFactors] = useState<MultiFactorInfo[]>([]);
  const [step, setStep] = useState<'info' | 'enter_phone' | 'verify_code' | 'enrolled'>('info');
  const [errorMessage, setErroMessage] = useState<string | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerId = 'mfa-enroll-recaptcha-container';

  // Carrega os fatores de autenticação ativos do utilizador atual
  const carregarFatoresAtivos = () => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const factors = multiFactor(currentUser).enrolledFactors;
        setEnrolledFactors(factors);
        if (factors && factors.length > 0) {
          setStep('enrolled');
        } else {
          setStep('info');
        }
      }
    } catch (err) {
      console.warn("Erro ao obter fatores de MFA:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setErroMessage(null);
      setCodigoSMS('');
      setVerificationId(null);
      carregarFatoresAtivos();
    } else {
      // Limpeza do reCAPTCHA ao fechar o modal
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {}
        recaptchaVerifierRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentUser = auth.currentUser;

  const initRecaptcha = (): RecaptchaVerifier => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch (e) {}
      recaptchaVerifierRef.current = null;
    }

    const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA resolvido invisivelmente
      },
      'expired-callback': () => {
        toast.error("Sessão reCAPTCHA expirada. Tente enviar o SMS novamente.");
      }
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  };

  // Formatação do número no formato internacional E.164 (ex: +5521999999999)
  const formatarParaE164 = (pais: string, num: string): string => {
    const limpo = num.replace(/\D/g, '');
    const codPaisLimpo = pais.replace(/[^\d+]/g, '');
    return `${codPaisLimpo}${limpo}`;
  };

  // 1. Início do Envio do Código SMS (verifyPhoneNumber)
  const handleEnviarSMS = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErroMessage(null);

    const telefoneCompleto = formatarParaE164(codigoPais, numeroTelefone);
    const apenasDigitos = numeroTelefone.replace(/\D/g, '');

    if (apenasDigitos.length < 8) {
      const msg = "Insira um número de telemóvel válido com DDD ou código de área.";
      setErroMessage(msg);
      toast.error(msg);
      return;
    }

    if (!currentUser) {
      toast.error("Utilizador não autenticado no sistema.");
      return;
    }

    setIsSendingSMS(true);

    try {
      // Passo A: Obter sessão de multifator do utilizador logado
      const multiFactorSession = await multiFactor(currentUser).getSession();

      // Passo B: Inicializar reCAPTCHA invisível
      const verifier = initRecaptcha();

      // Passo C: Disparar o SMS via PhoneAuthProvider
      const phoneProvider = new PhoneAuthProvider(auth);
      const vId = await phoneProvider.verifyPhoneNumber(
        {
          phoneNumber: telefoneCompleto,
          session: multiFactorSession
        },
        verifier
      );

      setVerificationId(vId);
      setStep('verify_code');
      toast.success(`Código de 6 dígitos enviado por SMS para ${telefoneCompleto}`);
    } catch (err: any) {
      console.error("Erro ao enviar SMS de 2FA:", err);
      let msg = "Falha ao enviar o código SMS de verificação.";

      if (err?.code === 'auth/invalid-phone-number') {
        msg = "Formato de número de telemóvel inválido. Utilize o padrão E.164 (ex: +5521999999999).";
      } else if (err?.code === 'auth/too-many-requests') {
        msg = "Muitas tentativas de envio. Aguarde alguns minutos antes de solicitar novo SMS.";
      } else if (err?.code === 'auth/captcha-check-failed') {
        msg = "Falha na verificação de segurança reCAPTCHA. Tente novamente.";
      } else if (err?.message) {
        msg = getFriendlyErrorMessage(err, msg);
      }

      setErroMessage(msg);
      toast.error(msg);
    } finally {
      setIsSendingSMS(false);
    }
  };

  // 2. Confirmação do Código e Inscrição (enroll)
  const handleConfirmarEAtivar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroMessage(null);

    const codigoLimpo = codigoSMS.trim().replace(/\D/g, '');

    if (codigoLimpo.length !== 6) {
      const msg = "O código SMS deve ter exatamente 6 dígitos numéricos.";
      setErroMessage(msg);
      toast.error(msg);
      return;
    }

    if (!verificationId || !currentUser) {
      toast.error("Sessão de verificação inválida. Solicite um novo código por SMS.");
      return;
    }

    setIsVerifyingCode(true);

    try {
      // Passo A: Criar credencial de autenticação por telefone
      const phoneAuthCredential = PhoneAuthProvider.credential(verificationId, codigoLimpo);

      // Passo B: Gerar asserção de segundo fator
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(phoneAuthCredential);

      // Passo C: Inscrever o segundo fator na conta do utilizador
      await multiFactor(currentUser).enroll(multiFactorAssertion, "Telemóvel Principal");

      toast.success("Autenticação em Duas Etapas (2FA via SMS) ATIVADA com sucesso!");
      carregarFatoresAtivos();
    } catch (err: any) {
      console.error("Erro ao ativar 2FA:", err);
      let msg = "Erro ao concluir a ativação do 2º Fator.";

      if (err?.code === 'auth/invalid-verification-code') {
        msg = "Código SMS incorreto. Verifique os 6 dígitos recebidos no telemóvel.";
      } else if (err?.code === 'auth/code-expired') {
        msg = "Código SMS expirado. Clique em 'Reenviar SMS' para receber um novo código.";
      } else if (err?.code === 'auth/second-factor-already-in-use') {
        msg = "Este número de telemóvel já está registado como segundo fator em outra conta.";
      } else if (err?.message) {
        msg = getFriendlyErrorMessage(err, msg);
      }

      setErroMessage(msg);
      toast.error(msg);
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 3. Desativação / Unenroll do Segundo Fator
  const handleDesativar2FA = async (factor: MultiFactorInfo) => {
    if (!currentUser) return;
    if (!window.confirm("Deseja realmente desativar a Autenticação em Duas Etapas para esta conta?")) {
      return;
    }

    setIsUnenrolling(true);
    try {
      await multiFactor(currentUser).unenroll(factor);
      toast.success("Autenticação em Duas Etapas desativada.");
      carregarFatoresAtivos();
    } catch (err: any) {
      console.error("Erro ao desativar 2FA:", err);
      toast.error(getFriendlyErrorMessage(err, "Falha ao desativar o 2º Fator."));
    } finally {
      setIsUnenrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden flex flex-col">
        {/* Container invisível necessário para o reCAPTCHA */}
        <div id={recaptchaContainerId}></div>

        {/* Cabeçalho do Modal */}
        <div className="bg-[#1c3829] px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Autenticação em 2 Etapas (2FA)</h3>
              <p className="text-xs text-emerald-200/80">Proteção por SMS no login</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-start gap-2 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ESTADO 1: Fator já inscrito/ativo */}
          {step === 'enrolled' && enrolledFactors.length > 0 && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-950">2FA Ativado e Protegido</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    A sua conta está protegida por verificação via código SMS no momento do login.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Dispositivos / Telefones Registados:
                </span>

                {enrolledFactors.map((factor) => {
                  const phoneFactor = factor as PhoneMultiFactorInfo;
                  return (
                    <div key={factor.uid} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-100/70 text-emerald-800 flex items-center justify-center">
                          <Smartphone size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            {factor.displayName || 'Telemóvel Principal'}
                          </p>
                          <p className="text-[11px] font-mono text-slate-500">
                            {phoneFactor.phoneNumber || 'Verificação via SMS'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDesativar2FA(factor)}
                        disabled={isUnenrolling}
                        className="px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Remover este 2º fator"
                      >
                        {isUnenrolling ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        <span>Desativar</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Concluído
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 2: Apresentação Inicial (Informações sobre 2FA) */}
          {step === 'info' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="flex items-center gap-3 p-3.5 bg-amber-50 border border-amber-200/70 rounded-2xl">
                <Lock size={20} className="text-amber-700 shrink-0" />
                <p className="text-xs text-amber-900 leading-relaxed">
                  Adicione uma camada extra de segurança à sua conta. Ao fazer login, ser-lhe-á solicitado um código de 6 dígitos enviado para o seu telemóvel por SMS.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Como Funciona:</h4>
                <ul className="text-xs text-slate-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1c3829] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <span>Insira o seu número de telemóvel com código do país (ex: +55).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1c3829] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <span>Receba um SMS oficial de verificação com código de 6 dígitos.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1c3829] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <span>Insira o código para ativar a proteção no seu utilizador.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Agora Não
                </button>
                <button
                  type="button"
                  onClick={() => setStep('enter_phone')}
                  className="px-5 py-2.5 bg-[#1c3829] hover:bg-[#152e21] text-white font-semibold rounded-xl text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone size={16} />
                  <span>Configurar Telemóvel</span>
                </button>
              </div>
            </div>
          )}

          {/* ESTADO 3: Inserção do Telemóvel (Inscrição) */}
          {step === 'enter_phone' && (
            <form onSubmit={handleEnviarSMS} className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Número de Telemóvel para Receber SMS
                </label>
                <div className="flex gap-2">
                  <select
                    value={codigoPais}
                    onChange={(e) => setCodigoPais(e.target.value)}
                    className="h-11 px-3 border border-slate-300 rounded-xl bg-slate-50 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#1c3829]/20 shrink-0"
                  >
                    <option value="+55">🇧🇷 Brasil (+55)</option>
                    <option value="+351">🇵🇹 Portugal (+351)</option>
                    <option value="+1">🇺🇸 EUA/Canadá (+1)</option>
                    <option value="+34">🇪🇸 Espanha (+34)</option>
                    <option value="+44">🇬🇧 Reino Unido (+44)</option>
                  </select>

                  <input
                    type="tel"
                    value={numeroTelefone}
                    onChange={(e) => setNumeroTelefone(e.target.value)}
                    placeholder="(21) 99999-9999"
                    className="flex-1 h-11 px-4 border border-slate-300 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-[#1c3829] focus:ring-2 focus:ring-[#1c3829]/20 transition-all"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">
                  Formato internacional E.164. Enviaremos um código SMS sem custos adicionais.
                </p>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setStep('info')}
                  disabled={isSendingSMS}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSendingSMS}
                  className="px-5 py-2.5 bg-[#1c3829] hover:bg-[#152e21] text-white font-semibold rounded-xl text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingSMS ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Enviando SMS...</span>
                    </>
                  ) : (
                    <span>Enviar Código por SMS</span>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ESTADO 4: Verificação do Código SMS e Conclusão */}
          {step === 'verify_code' && (
            <form onSubmit={handleConfirmarEAtivar} className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-900">
                SMS enviado para <strong>{formatarParaE164(codigoPais, numeroTelefone)}</strong>. Verifique o seu telemóvel.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Código de Verificação (6 Dígitos)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={codigoSMS}
                  onChange={(e) => setCodigoSMS(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full h-12 text-center tracking-[0.5em] text-xl font-mono font-bold border border-slate-300 rounded-xl text-slate-900 bg-slate-50 focus:bg-white focus:border-[#1c3829] focus:ring-2 focus:ring-[#1c3829]/20 outline-none transition-all"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <button
                  type="button"
                  onClick={() => handleEnviarSMS()}
                  disabled={isSendingSMS || isVerifyingCode}
                  className="text-xs text-[#1c3829] font-medium hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} />
                  <span>Reenviar SMS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep('enter_phone')}
                  className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Alterar Telemóvel
                </button>
              </div>

              <div className="pt-3 flex gap-2 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('enter_phone')}
                  disabled={isVerifyingCode}
                  className="px-4 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingCode || codigoSMS.length !== 6}
                  className="px-6 py-2.5 bg-[#1c3829] hover:bg-[#152e21] text-white font-semibold rounded-xl text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isVerifyingCode ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <span>Activar 2FA Agora</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
