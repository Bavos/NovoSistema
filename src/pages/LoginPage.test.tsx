import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { FirebaseProvider } from '../context/FirebaseContext';

// 1. Mocks de Controle da Interface (O seu mock perfeito)
const mockLogin = vi.fn();
const mockSetNotification = vi.fn();

vi.mock('../context/FirebaseContext', () => ({
  FirebaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useFirebase: () => ({
    login: mockLogin,
    setNotification: mockSetNotification,
  }),
}));

// Mock da validação corporativa externa
vi.mock('../types', () => ({
  validarDominioCorporativo: vi.fn(() => Promise.resolve(true)),
}));

// Mock do asset de imagem para evitar falhas de resolução
vi.mock('../assets/images/rh_logo_v2_1781470281009.jpg', () => ({
  default: 'mock-logo-url',
}));

describe('LoginPage Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar o formulario de login com email, senha e botao entrar', () => {
    render(
      <FirebaseProvider>
        <LoginPage onNavigateToFirstAccess={() => {}} />
      </FirebaseProvider>
    );

    expect(screen.getByPlaceholderText('E-mail')).toBeDefined();
    expect(screen.getByPlaceholderText('Senha')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDefined();
  });

  it('deve simular o clique no botao Entrar e verificar se o estado de carregamento e ativado', async () => {
    // Controlamos o mock do contexto para simular sucesso com delay
    mockLogin.mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ user: { email: 'admin@system.com' } });
          }, 100);
        })
    );

    render(
      <FirebaseProvider>
        <LoginPage onNavigateToFirstAccess={() => {}} />
      </FirebaseProvider>
    );

    const emailInput = screen.getByPlaceholderText('E-mail');
    const passwordInput = screen.getByPlaceholderText('Senha');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    expect(screen.getByRole('button', { name: 'Carregando...' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Carregando...' }).hasAttribute('disabled')).toBe(true);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeDefined();
    }, { timeout: 150 });
  });

  it('deve simular erro do Firebase auth/invalid-credential', async () => {
    const errorMsg = 'auth/invalid-credential'; 
    
    // Forçamos o método do seu contexto customizado a lançar o erro esperado
    mockLogin.mockRejectedValue(new Error('auth/invalid-credential'));
    
    render(
      <FirebaseProvider>
        <LoginPage onNavigateToFirstAccess={() => {}} />
      </FirebaseProvider>
    );

    const emailInput = screen.getByPlaceholderText('E-mail');
    const passwordInput = screen.getByPlaceholderText('Senha');
    const submitButton = screen.getByRole('button', { name: 'Entrar' });

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpass' } });
    fireEvent.click(submitButton);

    // O catch da sua LoginPage vai capturar o erro do mock e setar no estado perfeitamente
    await waitFor(() => {
      const errorDiv = screen.queryByText(errorMsg);
      expect(errorDiv).not.toBeNull();
      expect(errorDiv?.textContent).toContain(errorMsg);
    });
  });
});
