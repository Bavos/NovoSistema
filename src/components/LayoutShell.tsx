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
  rightHeaderKpi?: React.ReactNode;
}

export const LayoutShell: React.FC<LayoutShellProps> = ({
  children,
  activeTab,
  setActiveTab,
  pageTitle,
  rightHeaderKpi,
}) => {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  const { notification, setNotification } = useFirebase();

  return (
    <div className="min-h-screen bg-off-white text-forest-green font-sans flex overflow-x-hidden relative" id="layout-shell-container">
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
        />
      </div>

      {/* 3. Main Viewport Area */}
      <div
        className={`flex-1 min-h-screen flex flex-col transition-all duration-300 w-full min-w-0 ${
          isSidebarExpanded ? 'pl-0 md:pl-[240px]' : 'pl-0 md:pl-[64px]'
        }`}
        id="main-viewport-container"
      >
        {/* 4. Top Header with control of the menu */}
        <div className="print:hidden">
          <TopHeader
            isSidebarExpanded={isSidebarExpanded}
            setIsSidebarExpanded={setIsSidebarExpanded}
          />
        </div>

        {/* 5. System Notifications overlay banner */}
        {notification && (
          <div className="fixed top-24 right-6 bg-[#FEF3C7] border-l-4 border-amber-600 text-amber-900 p-4 rounded-xl shadow-xl z-50 animate-in slide-in-from-right-4 max-w-sm flex items-start gap-3 print:hidden border border-amber-200" id="global-notification-banner">
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

        {/* 6. Universal Content Container (100% Mobile, side-aligned on Desktop) */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-6 min-w-0" id="global-content-container">
          {/* Dashboard Page Header block */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4 print:hidden" id="page-header-block">
            <div className="space-y-1 min-w-0">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2 truncate">
                <span>{pageTitle}</span>
              </h1>
            </div>

            {/* Quick KPIs badge or actions slot */}
            {rightHeaderKpi && (
              <div className="shrink-0" id="header-kpi-slot">
                {rightHeaderKpi}
              </div>
            )}
          </div>

          {/* Render Active View Tab Content */}
          <div className="relative min-w-0" id="rendered-tab-content">
            {children}
          </div>
        </main>

        {/* 7. Global Footer Info Brand */}
        <footer className="py-4 border-t border-slate-200 text-center text-xs text-slate-500 select-none font-mono print:hidden mt-auto">
          <p>© 2026 CuidarHome S.A. • Todos os direitos reservados • Auditoria Integrada Firestore</p>
        </footer>
      </div>
    </div>
  );
};
