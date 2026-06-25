/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { LoginPage } from './pages/LoginPage';
import { FirstAccessPage } from './pages/FirstAccessPage';
import { LayoutShell } from './components/LayoutShell';
import { Pacientes } from './pages/Pacientes';
import { Profissionais } from './pages/Profissionais';
import {
  FinanceiroDashboard,
  EmpresaDashboard
} from './components/SimulatedDashboards';
import { Dashboard } from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert } from 'lucide-react';

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
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>('dashboard');
  const [financeiroSubTab, setFinanceiroSubTab] = useState<'folhas' | 'debitos'>('folhas');

  // Manage Pacientes page inner state routing overrides
  const [isBrowsingForm, setIsBrowsingForm] = useState<boolean>(false);
  const [pacientesTitleOverride, setPacientesTitleOverride] = useState<string>('Gestão Integrada de Pacientes');
  const [showFirstAccess, setShowFirstAccess] = useState(false);
  const [initialSelectedPatient, setInitialSelectedPatient] = useState<any>(null);
  const [initialSelectedProfId, setInitialSelectedProfId] = useState<string>('');

  const { pacientes, loading, userRole, user, usuariosSistema } = useFirebase();

  const currentUserProfile = (usuariosSistema || []).find(u => {
    const uEmail = u?.email;
    const userEmail = user?.email;
    return typeof uEmail === 'string' && typeof userEmail === 'string' && uEmail.toLowerCase() === userEmail.toLowerCase();
  });
  const rawName = currentUserProfile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Renato B. Z.';
  const displayName = rawName.replace(/\s?\((Admin|Colaborador)\)/g, '');

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
        setActiveSidebarTab(tab);
        setFinanceiroSubTab('folhas');
        // Auto-reset state overrides
        setIsBrowsingForm(false);
        setPacientesTitleOverride('Gestão Integrada de Pacientes');

        // Clear hash and query parameters when switching tabs to prevent auto-opening
        try {
          const url = new URL(window.location.href);
          url.hash = '';
          if (url.searchParams.has('profId')) {
            url.searchParams.delete('profId');
          }
          window.history.replaceState({}, '', url.toString().replace(/#$/, ''));
        } catch (err) {
          console.warn('Erro ao limpar a URL:', err);
        }
      }}
      onSelectPatientRedirect={(pac) => {
        setInitialSelectedPatient(pac);
        setActiveSidebarTab('pacientes');
      }}
      onSelectProfRedirect={(profId) => {
        setInitialSelectedProfId(profId);
        setActiveSidebarTab('profissionais');
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
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSidebarTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.22 }}
          className="min-w-0 w-full"
        >
          {activeSidebarTab === 'dashboard' ? (
            <Dashboard 
              setActiveTab={(tab, extra) => {
                setActiveSidebarTab(tab);
                if (extra?.financeiroSubTab) {
                  setFinanceiroSubTab(extra.financeiroSubTab);
                } else {
                  setFinanceiroSubTab('folhas');
                }
              }} 
              onSelectPatientRedirect={(pac) => {
                setInitialSelectedPatient(pac);
                setActiveSidebarTab('pacientes');
              }}
            />
          ) : activeSidebarTab === 'pacientes' ? (
            <Pacientes
              initialSelectedPatient={initialSelectedPatient}
              clearInitialSelectedPatient={() => setInitialSelectedPatient(null)}
              onViewChange={(isForm, title) => {
                setIsBrowsingForm(isForm);
                setPacientesTitleOverride(title);
              }}
            />
          ) : activeSidebarTab === 'profissionais' ? (
            <Profissionais
              initialSelectedProfId={initialSelectedProfId}
              clearInitialSelectedProfId={() => setInitialSelectedProfId('')}
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
