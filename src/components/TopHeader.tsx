/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Bell, LogOut, Shield, Settings, User } from 'lucide-react';

interface TopHeaderProps {
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
  onSearchGlobal: (query: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  isSidebarExpanded,
  setIsSidebarExpanded,
  onSearchGlobal,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const notifications = [
    { id: 1, text: 'Plantão do paciente João Albuquerque foi confirmado.', time: 'há 10 min' },
    { id: 2, text: 'Escala médica de final de semana atualizada.', time: 'há 1 hora' },
    { id: 3, text: 'Nova solicitação de escala para Roberto Carlos.', time: 'há 2 horas' },
  ];

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchVal(val);
    onSearchGlobal(val);
  };

  const handleSair = () => {
    alert('Sessão encerrada com sucesso! (Simulação)');
    setShowDropdown(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40" id="top-header">
      {/* Search Bar section */}
      <div className="flex items-center space-x-4 flex-1 max-w-lg">
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors md:hidden"
          title="Alternar Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="relative w-full">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Pesquisa global de pacientes, cuidadores, bairros..."
            value={searchVal}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all duration-150 shadow-inner"
          />
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
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500 hover:text-blue-500 transition-colors relative"
            title="Notificações"
            id="notification-bell-btn"
          >
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden" id="notification-dropdown">
              <div className="bg-slate-50 py-2.5 px-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Notificações Recentes</span>
                <span className="text-[10px] bg-blue-100 text-blue-600 font-medium px-2 py-0.5 rounded-full">3 Novas</span>
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{n.text}</p>
                    <span className="text-[9px] text-slate-400 mt-1 block">{n.time}</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 py-2 text-center border-t border-slate-100">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-[11px] text-blue-600 font-medium hover:underline"
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
            <span className="text-xs font-semibold text-slate-800 leading-3">Renato B. Z.</span>
            <span className="text-[10px] text-slate-500 mt-0.5">renatobz@gmail.com</span>
          </div>

          <button
            onClick={() => {
              setShowDropdown(!showDropdown);
              setShowNotifications(false);
            }}
            className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 hover:border-blue-500 hover:text-blue-500 transition-all shadow-sm focus:outline-none overflow-hidden"
            id="user-menu-btn"
          >
            <div className="w-full h-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs select-none">
              RB
            </div>
          </button>

          {showDropdown && (
            <div className="absolute right-0 top-11 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden py-1" id="user-menu-dropdown">
              <div className="px-4 py-2.5 border-b border-light-200 bg-slate-50">
                <p className="text-xs font-semibold text-slate-800 line-clamp-1">Renato B. Z.</p>
                <p className="text-[9px] text-slate-500 truncate mt-0.5">Nível: Administrador Sênior</p>
              </div>

              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    alert('Visualizando perfil simulado!');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                >
                  <User size={14} className="text-slate-400" />
                  <span>Meu Perfil</span>
                </button>
                <button
                  onClick={() => {
                    alert('Configurações do sistema!');
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors text-left"
                >
                  <Settings size={14} className="text-slate-400" />
                  <span>Configurações</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={handleSair}
                  className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left font-medium"
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
