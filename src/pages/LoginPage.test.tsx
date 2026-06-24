import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import { FirebaseProvider } from '../context/FirebaseContext';

// Define mocks first to intercept Firebase modules
const mockSignInWithEmailAndPassword = vi.fn();

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return () => {};
  }),
  signOut: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendEmailVerification: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  addDoc: vi.fn(() => Promise.resolve({ id: 'mock-id' })),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  })),
  onSnapshot: vi.fn((colRef, onNext) => {
    onNext({
      forEach: () => {},
    });
    return () => {};
  }),
  getDocs: vi.fn(() => Promise.resolve({
    empty: true,
    forEach: () => {},
    docs: [],
  })),
  getDocFromServer: vi.fn(() => Promise.resolve({
    exists: () => false,
  })),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
}));

vi.mock('firebase/storage', () => ({
  getStorage: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  uploadBytes: vi.fn(() => Promise.resolve({ metadata: {} })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://mock-url.com')),
}));

// Mock logo asset to prevent resolution failures during testing
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
    mockSignInWithEmailAndPassword.mockImplementation(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ user: { email: 'admin@system.com', emailVerified: true } });
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
    const errorMsg = 'E-mail ou senha incorretos'; 
    
    // Configura o mock para lançar o erro técnico do Firebase
    mockSignInWithEmailAndPassword.mockRejectedValue(new Error('auth/invalid-credential'));
    
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

    // Valida se a frase amigável em português foi impressa na tela
    await waitFor(() => {
      const errorDiv = screen.queryByText(errorMsg);
      expect(errorDiv).not.toBeNull();
      expect(errorDiv?.textContent).toContain(errorMsg);
    });
  });
});
