/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense, lazy } from 'react';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { LoginPage } from './pages/LoginPage';
import { FirstAccessPage } from './pages/FirstAccessPage';
import { LayoutShell } from './components/LayoutShell';
import { Dashboard } from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';

// Class-based ErrorBoundary for capturing async lazy rendering errors
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary capturou um erro de carregamento ou renderização:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50/50 border border-red-200 rounded-2xl max-w-md mx-auto my-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200" id="error-boundary-fallback">
          <div className="p-3 bg-red-100 text-red-600 rounded-full">
            <AlertTriangle size={36} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">Falha no Carregamento</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Ocorreu um erro ao carregar este módulo ou página. Verifique sua conexão e tente novamente.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={14} />
            Tentar Novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Carregamento preguiçoso (Lazy Loading) das páginas principais para otimização de bundle
const Pacientes = lazy(() => import('./pages/Pacientes').then(m => ({ default: m.Pacientes })));
const Profissionais = lazy(() => import('./pages/Profissionais').then(m => ({ default: m.Profissionais })));
const FinanceiroDashboard = lazy(() => import('./components/SimulatedDashboards').then(m => ({ default: m.FinanceiroDashboard })));
const EmpresaDashboard = lazy(() => import('./components/SimulatedDashboards').then(m => ({ default: m.EmpresaDashboard })));

const PageLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 space-y-3 min-h-[300px]">
    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <p className="text-xs font-semibold text-slate-500 font-mono tracking-wider">CARREGANDO MÓDULO...</p>
  </div>
);

const AccessDeniedView: React.FC = () => (
  <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-red-200 shadow-sm max-w-lg mx-auto text-center space-y-4 animate-in fade-in zoom-in-95 duration-200" id="access-denied-view">
    <div className="p-4 bg-red-50 text-red-650 rounded-full">
      <ShieldAlert size={48} className="text-red-600 animate-bounce" />
    </div>
    <h2 className="text-xl font-extrabold text-slate-800">403 - Acesso Restrito</h2>
    <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
      Esta seção contém dados financeiros e configurações corporativas sensíveis. Seu perfil de acesso atual <strong>(Colaborador)</strong> não possui permissões necessárias para visualizar este conteúdo.
    </p>
    <div className="pt-2">
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-[#b8860b] bg-[#fdfaf2] border border-[#f5ebcf] px-3.5 py-1.5 rounded-full select-none shadow-xs font-mono">
        🛡️ Segurança Sistêmica CuidarHome
      </span>
    </div>
  </div>
);

function DashboardContent() {
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['dashboard', 'pacientes', 'profissionais', 'financeiro', 'empresa'].includes(tabParam)) {
        return tabParam;
      }
    } catch (e) {
      console.warn(e);
    }
    return 'dashboard';
  });
  const [financeiroSubTab, setFinanceiroSubTab] = useState<'folhas' | 'debitos'>('folhas');

  // Manage Pacientes page inner state routing overrides
  const [isBrowsingForm, setIsBrowsingForm] = useState<boolean>(false);
  const [pacientesTitleOverride, setPacientesTitleOverride] = useState<string>('Gestão Pacientes');
  const [showFirstAccess, setShowFirstAccess] = useState(false);
  const [initialSelectedPatient, setInitialSelectedPatient] = useState<any>(null);
  const [initialSelectedProfId, setInitialSelectedProfId] = useState<string>('');
  const [resetKey, setResetKey] = useState<number>(0);

  const handlePacientesViewChange = React.useCallback((isForm: boolean, title: string) => {
    setIsBrowsingForm(isForm);
    setPacientesTitleOverride(title);
  }, []);

  const handleClearInitialSelectedPatient = React.useCallback(() => {
    setInitialSelectedPatient(null);
  }, []);

  const handleClearInitialSelectedProfId = React.useCallback(() => {
    setInitialSelectedProfId('');
  }, []);

  const { pacientes, profissionais, loading, userRole, user, usuariosSistema, isQuotaExceeded, seedDatabase } = useFirebase();

  const currentUserProfile = (usuariosSistema || []).find(u => {
    const uEmail = u?.email;
    const userEmail = user?.email;
    return typeof uEmail === 'string' && typeof userEmail === 'string' && uEmail.toLowerCase() === userEmail.toLowerCase();
  });
  const rawName = currentUserProfile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Renato B. Z.';
  const displayName = rawName.replace(/\s?\((Admin|Colaborador)\)/g, '');

  // Handle browser back/forward buttons (popstate event)
  React.useEffect(() => {
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get('tab');
        if (tabParam && ['dashboard', 'pacientes', 'profissionais', 'financeiro', 'empresa'].includes(tabParam)) {
          setActiveSidebarTab(tabParam);
        } else {
          setActiveSidebarTab('dashboard');
        }
      } catch (e) {
        console.warn(e);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Redirect away from Empresa and Financeiro if role is Colaborador
  React.useEffect(() => {
    if (userRole?.toLowerCase() === 'colaborador' && (activeSidebarTab === 'empresa' || activeSidebarTab === 'financeiro')) {
      setActiveSidebarTab('dashboard');
    }
  }, [userRole, activeSidebarTab]);

  // Title calculation based on view level
  const getPageTitle = () => {
    if (activeSidebarTab === 'dashboard') return `Bem-vindo, ${displayName}`;
    if (activeSidebarTab === 'pacientes') {
      return pacientesTitleOverride;
    }
    if (activeSidebarTab === 'profissionais') return 'Gestão de Profissionais';
    if (activeSidebarTab === 'financeiro') return 'Financeiro';
    if (activeSidebarTab === 'empresa') return 'Informações Gerais';
    return 'CuidarHome';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-mono tracking-widest font-bold">CARREGANDO BANCO FIRESTORE...</p>
      </div>
    );
  }

  if (!user) {
    if (showFirstAccess) return <FirstAccessPage onBackToLogin={() => setShowFirstAccess(false)} />;
    return <LoginPage onNavigateToFirstAccess={() => setShowFirstAccess(true)} />;
  }

  return (
    <LayoutShell
      activeTab={activeSidebarTab}
      setActiveTab={(tab) => {
        setResetKey(prev => prev + 1);
        setActiveSidebarTab(tab);
        setFinanceiroSubTab('folhas');
        // Auto-reset state overrides
        setIsBrowsingForm(false);
        setInitialSelectedPatient(null);
        setInitialSelectedProfId('');
        setPacientesTitleOverride('Gestão Pacientes');

        // Update tab search parameters when switching tabs
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          if (url.searchParams.has('profId')) {
            url.searchParams.delete('profId');
          }
          url.searchParams.set('tab', tab);
          window.history.pushState({}, '', url.toString());
        } catch (err) {
          console.warn('Erro ao atualizar a URL:', err);
        }
      }}
      onSelectPatientRedirect={(pac) => {
        setInitialSelectedPatient(pac);
        setActiveSidebarTab('pacientes');
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'pacientes');
          window.history.pushState({}, '', url.toString());
        } catch (err) {
          console.warn(err);
        }
      }}
      onSelectProfRedirect={(profId) => {
        setInitialSelectedProfId(profId);
        setActiveSidebarTab('profissionais');
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('tab', 'profissionais');
          window.history.pushState({}, '', url.toString());
        } catch (err) {
          console.warn(err);
        }
      }}
      pageTitle={getPageTitle()}
      rightHeaderKpi={
        <div className="hidden sm:flex items-center space-x-3.5 text-xs text-slate-500 select-none bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase">Pacientes Ativos</span>
            <span className="text-sm font-extrabold text-blue-600">
              {pacientes.filter((p) => p.status === 'Ativo').length}
            </span>
          </div>
          <div className="w-px h-6 bg-slate-25 bg-slate-200"></div>
          <div className="text-center px-2">
            <span className="block text-[10px] text-slate-400 font-mono font-bold uppercase">Escalas Hoje</span>
            <span className="text-sm font-extrabold text-slate-700">3 Plantões</span>
          </div>
        </div>
      }
    >
      {pacientes.length === 0 && profissionais.length === 0 && !loading && !isQuotaExceeded && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 rounded-xl shadow-lg border border-indigo-100 flex flex-col md:flex-row items-center justify-between gap-3 mb-6 animate-in fade-in duration-300" id="firestore-empty-seed-banner">
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <span>✨ Banco de dados Firestore Vazio</span>
            </h3>
            <p className="text-xs text-indigo-100">
              Seu banco de dados do Firestore está conectado, mas atualmente não contém dados de demonstração. Deseja popular o banco agora com pacientes, profissionais e plantões de teste?
            </p>
          </div>
          <button
            onClick={() => {
              if (seedDatabase) {
                seedDatabase();
              }
            }}
            className="bg-white text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg font-bold text-xs shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
          >
            Popular Banco de Dados
          </button>
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeSidebarTab}-${resetKey}`}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.22 }}
          className="min-w-0 w-full"
        >
          <ErrorBoundary key={`${activeSidebarTab}-${resetKey}`}>
            <Suspense fallback={<PageLoadingFallback />}>
              {activeSidebarTab === 'dashboard' ? (
                <Dashboard 
                  setActiveTab={(tab, extra) => {
                    setResetKey(prev => prev + 1);
                    setActiveSidebarTab(tab);
                    if (extra?.financeiroSubTab) {
                      setFinanceiroSubTab(extra.financeiroSubTab);
                    } else {
                      setFinanceiroSubTab('folhas');
                    }
                    try {
                      const url = new URL(window.location.href);
                      url.searchParams.set('tab', tab);
                      window.history.pushState({}, '', url.toString());
                    } catch (err) {
                      console.warn(err);
                    }
                  }} 
                  onSelectPatientRedirect={(pac) => {
                    setInitialSelectedPatient(pac);
                    setActiveSidebarTab('pacientes');
                    try {
                      const url = new URL(window.location.href);
                      url.searchParams.set('tab', 'pacientes');
                      window.history.pushState({}, '', url.toString());
                    } catch (err) {
                      console.warn(err);
                    }
                  }}
                />
              ) : activeSidebarTab === 'pacientes' ? (
                <Pacientes
                  initialSelectedPatient={initialSelectedPatient}
                  clearInitialSelectedPatient={handleClearInitialSelectedPatient}
                  onViewChange={handlePacientesViewChange}
                />
              ) : activeSidebarTab === 'profissionais' ? (
                <Profissionais
                  initialSelectedProfId={initialSelectedProfId}
                  clearInitialSelectedProfId={handleClearInitialSelectedProfId}
                />
              ) : activeSidebarTab === 'financeiro' ? (
                userRole?.toLowerCase() === 'colaborador' ? (
                  <AccessDeniedView />
                ) : (
                  <FinanceiroDashboard initialSubTab={financeiroSubTab} />
                )
              ) : activeSidebarTab === 'empresa' ? (
                userRole?.toLowerCase() === 'colaborador' ? (
                  <AccessDeniedView />
                ) : (
                  <EmpresaDashboard />
                )
              ) : null}
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </LayoutShell>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <DashboardContent />
    </FirebaseProvider>
  );
}
