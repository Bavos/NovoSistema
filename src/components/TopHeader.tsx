/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import logo from '../assets/images/rh_logo_v2_1781470281009.jpg';
import { Bell, LogOut, Shield, Settings, User, Check } from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

interface TopHeaderProps {
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarExpanded,
  setIsSidebarExpanded,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const { user, userRole, usuariosSistema, logout } = useFirebase();

  const currentUserProfile = (usuariosSistema || []).find(u => {
    const uEmail = u?.email;
    const userEmail = user?.email;
    return typeof uEmail === 'string' && typeof userEmail === 'string' && uEmail.toLowerCase() === userEmail.toLowerCase();
  });
  const displayName = currentUserProfile?.nome || user?.displayName || user?.email?.split('@')[0] || 'Renato B. Z.';
  const displayEmail = user?.email || 'renatobz@gmail.com';
  const displayRole = currentUserProfile?.nivelAcesso || userRole || 'Colaborador';

  const notifications = [
    { id: 1, text: 'Plantão do paciente João Albuquerque foi confirmado.', time: 'há 10 min' },
    { id: 2, text: 'Escala médica de final de semana atualizada.', time: 'há 1 hora' },
    { id: 3, text: 'Nova solicitação de escala para Roberto Carlos.', time: 'há 2 horas' },
  ];

  const handleSair = async () => {
    await logout();
    setShowDropdown(false);
  };

  return (
    <header className="h-16 bg-off-white border-b border-[#254A34]/20 flex items-center justify-between px-6 sticky top-0 z-40" id="top-header">
      {/* Brand & Menu section */}
      <div className="flex items-center space-x-4 flex-1 max-w-lg">
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="p-2 hover:bg-[#e8e4db] rounded-full text-forest-green transition-colors md:hidden"
          title="Alternar Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <img src={logo} alt="Logo" className="w-16 h-10 object-cover rounded-full border border-forest-green" />
        </div>
      </div>

      {/* Control Actions */}
      <div className="flex items-center space-x-4">
        {/* Notification Center */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowDropdown(false);
            }}
            className="p-2 hover:bg-[#e8e4db] rounded-full text-forest-green transition-colors relative"
            title="Notificações"
            id="notification-bell-btn"
          >
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-mustard-gold rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-forest-green/10 rounded-2xl shadow-xl z-50 overflow-hidden" id="notification-dropdown">
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
        <div className="relative flex items-center space-x-1">
          <div className="hidden lg:flex flex-col text-right mr-1">
            <span className="text-xs font-semibold text-forest-green leading-3">{displayName}</span>
            <span className="text-[10px] text-forest-green/60 mt-0.5">{displayEmail}</span>
          </div>

          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="w-9 h-9 rounded-full bg-white border border-mustard-gold/30 flex items-center justify-center text-forest-green hover:border-mustard-gold transition-all shadow-sm focus:outline-none overflow-hidden"
            id="user-menu-btn"
          >
            <div className={`w-full h-full flex items-center justify-center font-bold text-off-white text-xs select-none ${
              (displayRole || '').toLowerCase() === 'administrador' ? 'bg-mustard-gold' : 'bg-[#e2b888]'
            }`}>
              {displayRole.slice(0, 2).toUpperCase()}
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-11 w-52 bg-white border border-forest-green/10 rounded-2xl shadow-xl z-50 overflow-hidden py-1" id="user-menu-dropdown">
              <div className="px-4 py-2.5 border-b border-forest-green/10 bg-off-white">
                <p className="text-xs font-semibold text-forest-green line-clamp-1">{displayName}</p>
                <p className="text-[9px] text-forest-green/60 truncate mt-0.5">{displayEmail}</p>
                <p className="text-[9px] text-forest-green font-bold truncate mt-0.5 capitalize">Nível: {displayRole}</p>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    alert('Visualizando perfil simulado!');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-forest-green hover:bg-[#e8e4db] rounded-lg transition-colors text-left"
                >
                  <User size={14} className="text-mustard-gold" />
                  <span>Meu Perfil</span>
                </button>
                <button
                  onClick={() => {
                    alert('Configurações do sistema!');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-forest-green hover:bg-[#e8e4db] rounded-lg transition-colors text-left"
                >
                  <Settings size={14} className="text-mustard-gold" />
                  <span>Configurações</span>
                </button>
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
