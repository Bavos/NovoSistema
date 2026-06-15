/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './context/FirebaseContext';
import { LoginPage } from './pages/LoginPage';
import { FirstAccessPage } from './pages/FirstAccessPage';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { Pacientes } from './pages/Pacientes';
import { Profissionais } from './pages/Profissionais';
import {
  EscalasDashboard,
  FinanceiroDashboard,
  EmpresaDashboard
} from './components/SimulatedDashboards';
import { Dashboard } from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Award, ShieldAlert, Heart, Activity, AlertCircle, X } from 'lucide-react';

function DashboardContent() {
  const [activeSidebarTab, setActiveSidebarTab] = useState<string>('dashboard');
  const [financeiroSubTab, setFinanceiroSubTab] = useState<'folhas' | 'debitos'>('folhas');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);

  // Manage Pacientes page inner state routing overrides
  const [isBrowsingForm, setIsBrowsingForm] = useState<boolean>(false);
  const [pacientesTitleOverride, setPacientesTitleOverride] = useState<string>('Gestão Integrada de Pacientes');
  const [showFirstAccess, setShowFirstAccess] = useState(false);

  const { pacientes, loading, userRole, notification, setNotification, user, usuariosSistema } = useFirebase();

  const currentUserProfile = (usuariosSistema || []).find(u => {
    const uEmail = u?.email;
    const userEmail = user?.email;
    return typeof uEmail === 'string' && typeof userEmail === 'string' && uEmail.toLowerCase() === userEmail.toLowerCase();
  });
  const displayName = currentUserProfile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Renato B. Z.';

  // Redirect away from Empresa if role is Colaborador
  React.useEffect(() => {
    if (userRole?.toLowerCase() === 'colaborador' && activeSidebarTab === 'empresa') {
      setActiveSidebarTab('pacientes');
    }
  }, [userRole, activeSidebarTab]);

  // Title calculation based on view level
  const getPageTitle = () => {
    if (activeSidebarTab === 'dashboard') return `Bem-vindo, ${displayName}`;
    if (activeSidebarTab === 'pacientes') {
      return pacientesTitleOverride;
    }
    if (activeSidebarTab === 'profissionais') return 'Gestão de Cuidadores & Profissionais';
    if (activeSidebarTab === 'escalas') return 'Escalas Diárias de Plantões';
    if (activeSidebarTab === 'financeiro') return 'Faturamento & Honorários';
    if (activeSidebarTab === 'empresa') return 'Dados Organizacionais';
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
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800 font-sans flex">
      {/* 1. Collapsible/Expandable Sidebar */}
      <div className="print:hidden">
        <Sidebar
          activeTab={activeSidebarTab}
          setActiveTab={(tab) => {
            setActiveSidebarTab(tab);
            setFinanceiroSubTab('folhas');
            // Auto-reset state overrides
            setIsBrowsingForm(false);
            setPacientesTitleOverride('Gestão Integrada de Pacientes');
          }}
          isSidebarExpanded={isSidebarExpanded}
          setIsSidebarExpanded={setIsSidebarExpanded}
        />
      </div>

      {/* Main viewport area */}
      <div
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ paddingLeft: isSidebarExpanded ? 240 : 64 }}
      >
        {/* 2. Top Header with search/notifs/avatar dropdown */}
        <div className="print:hidden">
          <TopHeader
            isSidebarExpanded={isSidebarExpanded}
            setIsSidebarExpanded={setIsSidebarExpanded}
          />
        </div>
        
        {notification && (
          <div className="fixed top-24 right-6 bg-[#FEF3C7] border-l-4 border-amber-600 text-amber-900 p-4 rounded-xl shadow-xl z-50 animate-in slide-in-from-right-4 max-w-sm flex items-start gap-3 print:hidden border border-amber-200">
            <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="flex-1 space-y-1">
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-800">Aviso do Sistema</p>
              <p className="text-xs font-semibold leading-relaxed">{notification}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-amber-500 hover:text-amber-700 transition-colors p-0.5 rounded hover:bg-amber-100 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 3. Area de Conteúdo Main Body */}
        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          {/* Dashboard Page Header block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-widest font-mono">RH Cuidado Domiciliar</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
                <span>{getPageTitle()}</span>
              </h1>
            </div>

            {/* Quick KPIs badge for upper display context */}
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
          </div>

          {/* Main conditional tab navigator inside Area de Conteúdo */}
          <div className="relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSidebarTab}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.22 }}
              >
                {activeSidebarTab === 'dashboard' ? (
                  <Dashboard setActiveTab={(tab, extra) => {
                    setActiveSidebarTab(tab);
                    if (extra?.financeiroSubTab) {
                      setFinanceiroSubTab(extra.financeiroSubTab);
                    } else {
                      setFinanceiroSubTab('folhas');
                    }
                  }} />
                ) : activeSidebarTab === 'pacientes' ? (
                  <Pacientes
                    onViewChange={(isForm, title) => {
                      setIsBrowsingForm(isForm);
                      setPacientesTitleOverride(title);
                    }}
                  />
                ) : activeSidebarTab === 'profissionais' ? (
                  <Profissionais />
                ) : activeSidebarTab === 'escalas' ? (
                  <EscalasDashboard />
                ) : activeSidebarTab === 'financeiro' ? (
                  <FinanceiroDashboard initialSubTab={financeiroSubTab} />
                ) : activeSidebarTab === 'empresa' ? (
                  <EmpresaDashboard />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Footer info brand */}
        <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-400 select-none font-mono print:hidden">
          <p>© 2026 CuidarHome S.A. • Todos os direitos reservados • Auditoria Integrada Firestore</p>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <FirebaseProvider>
      <DashboardContent />
    </FirebaseProvider>
  );
}
