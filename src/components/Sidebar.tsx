/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Building2,
  ChevronRight,
  Menu,
  HeartPulse
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isSidebarExpanded,
  setIsSidebarExpanded,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const menuItems = [
    { id: 'pacientes', label: 'Pacientes', icon: Users, desc: 'Gestão de Planos & Prontuários' },
    { id: 'profissionais', label: 'Profissionais', icon: Briefcase, desc: 'Cuidadores & Enfermagem' },
    { id: 'escalas', label: 'Escalas', icon: Calendar, desc: 'Alocação diária' },
    { id: 'financeiro', label: 'Financeiro', icon: DollarSign, desc: 'Honorários & Plantões' },
    { id: 'empresa', label: 'Empresa', icon: Building2, desc: 'Configurações corporativas' },
  ];

  const effectiveExpanded = isSidebarExpanded || isHovered;

  return (
    <motion.aside
      className="fixed top-0 left-0 h-full bg-[#0F172A] text-slate-300 z-50 flex flex-col shadow-2xl overflow-hidden border-r border-[#1e293b]"
      animate={{ width: effectiveExpanded ? 240 : 64 }}
      transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="sidebar-main"
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center border-b border-[#1e293b] px-4 justify-between select-none bg-[#0F172A]">
        <div className="flex items-center space-x-3 overflow-hidden min-w-[150px]">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg flex-shrink-0 animate-pulse">
            <HeartPulse size={20} />
          </div>
          <motion.div
            animate={{ opacity: effectiveExpanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col whitespace-nowrap"
          >
            <span className="font-extrabold text-white text-sm tracking-wide uppercase">CuidarHome</span>
            <span className="text-[10px] text-blue-400 font-mono tracking-widest font-medium">SISTEMA</span>
          </motion.div>
        </div>
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="hidden md:flex p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
          title={isSidebarExpanded ? 'Recolher Menu' : 'Expandir Menu'}
        >
          <Menu size={16} />
        </button>
      </div>

      {/* Main Navigation Menu */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group text-left relative ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-lg shadow-blue-500/20'
                  : 'hover:bg-[#1e293b] text-slate-400 hover:text-slate-100'
              }`}
              id={`sidebar-item-${item.id}`}
            >
              <div className="flex items-center space-x-3 flex-shrink-0">
                <IconComponent
                  size={20}
                  className={`transition-transform duration-200 ${
                    isActive ? 'scale-110 text-white' : 'group-hover:scale-110 text-slate-400 group-hover:text-blue-400'
                  }`}
                />
              </div>

              {/* Text indicator */}
              <motion.div
                className="overflow-hidden whitespace-nowrap pl-3 flex flex-col justify-center"
                animate={{ opacity: effectiveExpanded ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-sm font-medium">{item.label}</span>
                {effectiveExpanded && (
                  <span className={`text-[9px] ${isActive ? 'text-blue-100' : 'text-slate-500'}`}>
                    {item.desc}
                  </span>
                )}
              </motion.div>

              {/* Active hover tooltip indicator */}
              {!effectiveExpanded && (
                <div className="absolute left-16 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer info */}
      <div className="p-4 border-t border-[#1e293b] bg-[#0F172A] select-none">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0 text-xs">
            AD
          </div>
          <motion.div
            animate={{ opacity: effectiveExpanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col whitespace-nowrap"
          >
            <span className="text-xs font-semibold text-slate-200 leading-none">Administrador</span>
            <span className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Unidade Rio</span>
          </motion.div>
        </div>
      </div>
    </motion.aside>
  );
};
