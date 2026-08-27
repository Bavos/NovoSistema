/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Bell, LogOut } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface TopHeaderProps {
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
  pageTitle?: string;
  onSelectPatientRedirect?: (pac: any) => void;
  onSelectProfRedirect?: (profId: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarExpanded,
  setIsSidebarExpanded,
  pageTitle,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [empresa, setEmpresa] = useState<any>(null);

  const { user, userRole, usuariosSistema, logout, isQuotaExceeded, isTestMode, toggleTestMode } = useFirebase();

  useEffect(() => {
    if (!user || isQuotaExceeded || isTestMode) {
      setEmpresa(null);
      return;
    }
    const docRef = doc(db, 'configuracoes_empresa', 'empresa');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setEmpresa(docSnap.data());
      }
    }, (error) => {
      console.warn("TopHeader company settings subscription failed:", error);
    });
    return () => {
      unsub();
    };
  }, [user?.uid, isQuotaExceeded, isTestMode]);

  const currentUserProfile = (usuariosSistema || []).find(u => {
    const uEmail = u?.email;
    const userEmail = user?.email;
    return typeof uEmail === 'string' && typeof userEmail === 'string' && uEmail.toLowerCase() === userEmail.toLowerCase();
  });
  const displayName = currentUserProfile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Renato B. Z.';
  const displayEmail = user?.email || 'renatobz@gmail.com';
  const displayRole = currentUserProfile?.nivelAcesso || userRole || 'Colaborador';

  const notifications = [
    { id: 1, text: 'Plantão de atendimento foi confirmado.', time: 'há 10 min' },
    { id: 2, text: 'Escala médica de final de semana atualizada.', time: 'há 1 hora' },
    { id: 3, text: 'Nova solicitação de escala recebida.', time: 'há 2 horas' },
  ];

  const handleSair = async () => {
    await logout();
    setShowDropdown(false);
  };

  return (
    <header className="h-16 md:h-18 bg-off-white border-b border-forest-green/10 flex flex-nowrap items-center justify-between pl-4 pr-6 sm:px-6 md:px-8 lg:px-10 w-full sticky top-0 z-50 shadow-xs gap-2 sm:gap-3 md:gap-6" id="top-header">
      {/* Brand & Menu section */}
      <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 shrink-0 min-w-0">
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="w-11 h-11 flex items-center justify-center hover:bg-[#e8e4db] rounded-full text-forest-green transition-colors md:hidden shrink-0"
          title="Alternar Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        {pageTitle && (
          <div className="flex items-center gap-2 text-forest-green max-w-[80px] min-[380px]:max-w-[120px] min-[450px]:max-w-[180px] sm:max-w-xs md:max-w-sm lg:max-w-md truncate">
            <span className="hidden sm:inline-block text-[11px] font-mono font-bold uppercase tracking-wider text-mustard-gold shrink-0">Módulo:</span>
            <span className="text-xs sm:text-sm font-bold text-forest-green truncate">{pageTitle}</span>
          </div>
        )}
      </div>

      {/* Control Actions */}
      <div className="flex items-center max-md:pr-6 md:pr-0 space-x-2 sm:space-x-3 md:space-x-4 lg:space-x-5 shrink-0" id="control-actions-container">
        {/* Modo de Testes / Sandbox Toggle Switch */}
        <button
          type="button"
          id="sandbox-mode-toggle-container"
          onClick={() => toggleTestMode()}
          title={
            isTestMode
              ? 'Modo de Testes ATIVADO — Clique para alternar para o banco real'
              : 'Modo de Testes DESATIVADO — Clique para ativar o modo de testes local'
          }
          className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-1.5 rounded-full border transition-all duration-200 select-none cursor-pointer shrink-0 min-h-[44px] sm:min-h-0 ${
            isTestMode
              ? 'bg-amber-100/90 border-amber-400 text-amber-950 shadow-xs ring-2 ring-amber-400/30 hover:bg-amber-200/90'
              : 'bg-[#e8e4db]/60 border-forest-green/15 text-forest-green/80 hover:border-forest-green/30 hover:bg-[#e8e4db]'
          }`}
        >
          <span className="text-[11px] font-extrabold tracking-tight hidden sm:inline-block">
            Modo de Testes / Sandbox
          </span>
          <span className="text-[10px] font-extrabold tracking-tight hidden min-[420px]:inline-block sm:hidden">
            Sandbox
          </span>
          <div
            role="switch"
            aria-checked={isTestMode}
            id="toggle-sandbox-switch"
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              isTestMode ? 'bg-amber-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                isTestMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </button>

        {/* Notification Center */}
        <div className="relative shrink-0">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDropdown(false);
            }}
            className="w-11 h-11 md:w-10 md:h-10 flex items-center justify-center hover:bg-[#e8e4db] rounded-full text-forest-green transition-colors relative"
            title="Notificações"
            id="notification-bell-btn"
          >
            <Bell size={20} />
            <span className="absolute top-2.5 right-2.5 md:top-2 md:right-2 w-2 h-2 bg-mustard-gold rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-forest-green/10 rounded-2xl shadow-xl z-50 overflow-hidden" id="notification-dropdown">
              <div className="bg-[#e8e4db] py-2.5 px-4 border-b border-forest-green/10 flex justify-between items-center">
                <span className="text-xs font-semibold text-forest-green">Notificações Recentes</span>
                <span className="text-[10px] bg-mustard-gold text-white font-medium px-2 py-0.5 rounded-full">3 Novas</span>
              </div>
              <div className="divide-y divide-forest-green/5">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3.5 hover:bg-white transition-colors">
                    <p className="text-xs text-forest-green/80 line-clamp-2 leading-relaxed">{n.text}</p>
                    <span className="text-[9px] text-forest-green/40 mt-1 block">{n.time}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white py-2 text-center border-t border-forest-green/10">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-mustard-gold font-bold hover:underline"
                >
                  Marcar todas como lidas
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Info & Dropdown */}
        <div className="relative shrink-0 flex items-center space-x-1 sm:space-x-2">
          <div className="hidden lg:flex flex-col text-right mr-1.5">
            <span className="text-xs font-semibold text-forest-green leading-3">{displayName}</span>
            <span className="text-[10px] text-forest-green/60 mt-0.5">{displayEmail}</span>
          </div>

          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="w-11 h-11 md:w-9 md:h-9 rounded-full bg-white border border-mustard-gold/30 flex items-center justify-center text-forest-green hover:border-mustard-gold transition-all shadow-sm focus:outline-none overflow-hidden"
            id="user-menu-btn"
          >
            <div className={`w-full h-full flex items-center justify-center font-bold text-off-white text-xs select-none ${
              (displayRole || '').toLowerCase() === 'administrador' ? 'bg-mustard-gold' : 'bg-[#e2b888]'
            }`}>
              {displayRole.slice(0, 2).toUpperCase()}
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-forest-green/10 rounded-2xl shadow-xl z-50 overflow-hidden py-1" id="user-menu-dropdown">
              <div className="px-4 py-2.5 border-b border-forest-green/10 bg-off-white">
                <p className="text-xs font-semibold text-forest-green line-clamp-1">{displayName}</p>
                <p className="text-[9px] text-forest-green/60 truncate mt-0.5">{displayEmail}</p>
                <p className="text-[9px] text-forest-green font-bold truncate mt-0.5 capitalize">Nível: {displayRole}</p>
              </div>

              <div className="p-1 space-y-0.5">
                <div className="border-t border-forest-green/5 my-1"></div>
                <button
                  onClick={handleSair}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-700 hover:bg-red-50 rounded-lg transition-colors text-left font-medium"
                >
                  <LogOut size={14} />
                  <span>Sair do Sistema</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
