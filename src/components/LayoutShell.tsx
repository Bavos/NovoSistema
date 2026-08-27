/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopHeader } from './TopHeader';
import { useFirebase } from '../context/FirebaseContext';
import { AlertCircle, X } from 'lucide-react';

interface LayoutShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pageTitle: string;
  onSelectPatientRedirect?: (pac: any) => void;
  onSelectProfRedirect?: (profId: string) => void;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  pageTitle,
  onSelectPatientRedirect,
  onSelectProfRedirect,
}) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const { notification, setNotification, isQuotaExceeded, isTestMode, toggleTestMode } = useFirebase();

  const effectiveExpanded = isSidebarExpanded || isSidebarHovered;

  return (
    <div className="min-h-screen bg-off-white text-forest-green font-sans flex overflow-x-clip relative" id="layout-shell-container">
      {/* 1. Mobile Backdrop Backdrop Overlay */}
      {isSidebarExpanded && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-45 md:hidden transition-opacity cursor-pointer duration-300"
          onClick={() => setIsSidebarExpanded(false)}
          id="sidebar-overlay-backdrop"
        />
      )}

      {/* 2. Responsive Global Sidebar */}
      <div className="print:hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            // Auto-close sidebar drawer on mobile after selection
            setIsSidebarExpanded(false);
          }}
          isSidebarExpanded={isSidebarExpanded}
          setIsSidebarExpanded={setIsSidebarExpanded}
          isHovered={isSidebarHovered}
          setIsHovered={setIsSidebarHovered}
        />
      </div>

      {/* 3. Main Viewport Area */}
      <div
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 w-full min-w-0 ${
          effectiveExpanded ? 'pl-0 md:pl-[240px]' : 'pl-0 md:pl-[64px]'
        }`}
        id="main-viewport-container"
      >
        {/* 4. Top Header with control of the menu */}
        <div className="sticky top-0 z-50 w-full print:hidden">
          <TopHeader
            isSidebarExpanded={isSidebarExpanded}
            setIsSidebarExpanded={setIsSidebarExpanded}
            pageTitle={pageTitle}
            onSelectPatientRedirect={onSelectPatientRedirect}
            onSelectProfRedirect={onSelectProfRedirect}
          />
        </div>

        {/* 6. Universal Content Container (100% Mobile, side-aligned on Desktop) */}
        <main className="w-full max-w-5xl md:max-w-7xl lg:max-w-[1600px] xl:max-w-[1750px] mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 lg:pl-8 xl:pl-10 py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 min-w-0 flex-1" id="global-content-container">
          {/* ⚠️ Modo de Testes / Sandbox Banner */}
          {isTestMode && (
            <div
              className="bg-amber-500/10 border-l-4 border-amber-500 text-amber-950 p-3.5 md:p-4 rounded-xl shadow-xs mb-4 flex items-center justify-between gap-3 print:hidden animate-in fade-in slide-in-from-top-2 border border-amber-200"
              id="sandbox-mode-active-banner"
            >
              <div className="flex items-center space-x-2 text-xs sm:text-sm font-semibold">
                <span className="text-amber-900 font-bold">⚠️ Modo de Testes Ativo — As alterações não afetarão o banco real</span>
              </div>
              <button
                type="button"
                onClick={() => toggleTestMode(false)}
                className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Sair do Modo de Testes
              </button>
            </div>
          )}

          {isQuotaExceeded && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-red-900 shadow-sm mb-4 print:hidden animate-in fade-in slide-in-from-top-4" id="quota-exceeded-contingency-banner">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5 sm:mt-0" size={20} />
              <div className="flex-1 text-sm leading-normal">
                <span className="font-bold">Modo de Contingência Ativo:</span> O banco de dados atingiu o limite de leitura gratuita diária do Firestore. Suas alterações e cadastros serão salvos localmente neste navegador de forma segura.
              </div>
              <a
                href="https://console.firebase.google.com/project/ec969b01-95ac-467f-b5b7-48efe433d663/firestore/databases/ai-studio-ec969b01-95ac-467f-b5b7-48efe433d663/data?openUpgradeDialog=true"
                target="_blank"
                rel="noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
              >
                Ver Banco de Dados
              </a>
            </div>
          )}
          {/* Dashboard Page Header block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 border-b border-slate-200 pb-4 md:pb-5 print:hidden" id="page-header-block">
            <div className="space-y-1 min-w-0 lg:w-auto">
              <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight flex items-center space-x-2 truncate">
                <span>{pageTitle}</span>
              </h1>
            </div>
          </div>

          {/* Render Active View Tab Content */}
          <div className="relative min-w-0" id="rendered-tab-content">
            {children}
          </div>
        </main>

        {/* 7. Global Footer Info Brand */}
        <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-500 select-none font-mono print:hidden mt-auto">
          <p>© 2026 RH Gestão Domiciliar • Todos os direitos reservados • Auditoria Integrada Firestore</p>
        </footer>
      </div>
    </div>
  );
};
