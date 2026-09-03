import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Logo } from '../components/Logo';
import { toast } from 'react-hot-toast';

interface FirstAccessPageProps {
  onNavigateToLogin?: () => void;
  onBack?: () => void;
  onBackToLogin?: () => void;
}

export const FirstAccessPage: React.FC<FirstAccessPageProps> = ({ onNavigateToLogin, onBack, onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleVoltar = () => {
    if (onBackToLogin) onBackToLogin();
    else if (onNavigateToLogin) onNavigateToLogin();
    else if (onBack) onBack();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailFormatado = email.trim().toLowerCase();
    if (!emailFormatado) {
      toast.error('Informe o seu e-mail cadastrado.');
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, emailFormatado);
      setEmailSent(true);
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
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8faf8] px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center">
        
        <div className="flex justify-center mb-2">
          <Logo />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#1e3a2b]">Recuperar Acesso</h2>
          <p className="mt-2 text-sm text-gray-600">
            Informe seu e-mail cadastrado para receber o link de acesso e redefinição de senha.
          </p>
        </div>

        {emailSent ? (
          <div className="w-full text-center space-y-4 mt-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
              Enviamos as instruções para <strong>{email}</strong>. Verifique sua caixa de entrada e pasta de spam.
            </div>
            <button
              type="button"
              onClick={handleVoltar}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#1e3a2b] hover:bg-[#15281e] transition-colors shadow-sm"
            >
              Voltar ao Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 w-full space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail Cadastrado
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1e3a2b] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-[#1e3a2b] hover:bg-[#15281e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1e3a2b] transition-colors shadow-sm disabled:opacity-50"
            >
              {isLoading ? 'Enviando link...' : 'Enviar Link de Acesso'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={handleVoltar}
                className="text-sm font-medium text-[#1e3a2b] hover:underline"
              >
                Voltar ao Login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default FirstAccessPage;
