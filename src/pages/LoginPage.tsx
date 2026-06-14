import React, { useState } from 'react';
import { useFirebase } from '../context/FirebaseContext';

export const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, forgotPassword, setNotification } = useFirebase();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login(email, password);
        } catch (err: any) {
            setNotification(`Erro: ${err.message}`);
        }
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setNotification('Por favor, informe seu email para recuperar a senha.');
            return;
        }
        try {
            await forgotPassword(email);
            setNotification('Email de redefinição de senha enviado.');
        } catch (err: any) {
            setNotification(`Erro: ${err.message}`);
        }
    };

    return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h1 className="text-2xl font-bold mb-4">Login</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 border rounded" required />
                    <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 border rounded" required />
                    <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">Entrar</button>
                </form>
                <div className="mt-4 text-sm text-center">
                    <div className="mt-2 space-y-1">
                        <button type="button" onClick={handleForgotPassword} className="block text-gray-500 text-xs text-center w-full">Esqueci minha senha</button>
                        <p className="text-gray-500 text-xs mt-2">Esqueceu seu login? Entre em contato com o administrador.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
