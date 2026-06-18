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
  HeartPulse,
  Activity
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';

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
  const { userRole } = useFirebase();

  const allMenuItems = [
    { id: 'dashboard', label: 'Início', icon: Activity, desc: 'Visão Executiva 360º' },
    { id: 'pacientes', label: 'Pacientes', icon: Users, desc: 'Gestão de Planos & Prontuários' },
    { id: 'profissionais', label: 'Profissionais', icon: Briefcase, desc: 'Cuidadores & Enfermagem' },
    { id: 'escalas', label: 'Escalas', icon: Calendar, desc: 'Alocação diária' },
    { id: 'financeiro', label: 'Faturas & Pagamentos', icon: DollarSign, desc: 'Gestão Financeira' },
    { id: 'empresa', label: 'Empresa', icon: Building2, desc: 'Configurações corporativas' },
  ];

  // Restrict access for 'colaborador' role to 'financeiro' and 'empresa' tabs
  const menuItems = allMenuItems.filter(item => {
    if (userRole?.toLowerCase() === 'colaborador' && (item.id === 'empresa' || item.id === 'financeiro')) {
      return false;
    }
    return true;
  });

  const effectiveExpanded = isSidebarExpanded || isHovered;

  return (
    <motion.aside
      className="fixed top-0 left-0 h-full bg-forest-green text-off-white z-50 flex flex-col shadow-2xl overflow-hidden border-r border-[#254A34]"
      animate={{ width: effectiveExpanded ? 240 : 64 }}
      transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      id="sidebar-main"
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center border-b border-[#254A34] px-4 justify-between select-none bg-forest-green">
        <div className="flex items-center space-x-3 overflow-hidden min-w-[150px]">
          <div className="p-2 bg-hover-green text-mustard-gold rounded-full flex-shrink-0">
            <HeartPulse size={20} />
          </div>
          <motion.div
            animate={{ opacity: effectiveExpanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col whitespace-nowrap"
          >
            <span className="font-extrabold text-off-white text-sm tracking-wide uppercase">RH CS</span>
            <span className="text-[10px] text-mustard-gold font-mono tracking-widest font-medium">SISTEMA</span>
          </motion.div>
        </div>
        <button
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          className="hidden md:flex p-1 hover:bg-hover-green rounded-full text-slate-400 hover:text-mustard-gold transition-colors"
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
                  ? 'bg-hover-green text-mustard-gold font-medium'
                  : 'hover:bg-hover-green text-slate-300 hover:text-off-white'
              }`}
              id={`sidebar-item-${item.id}`}
            >
              <div className="flex items-center space-x-3 flex-shrink-0">
                <IconComponent
                  size={20}
                  className={`transition-transform duration-200 ${
                    isActive ? 'scale-110 text-mustard-gold' : 'group-hover:scale-110 text-slate-400 group-hover:text-mustard-gold'
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
                  <span className={`text-[9px] ${isActive ? 'text-mustard-gold/80' : 'text-slate-500'}`}>
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
      <div className="p-4 border-t border-[#254A34] bg-[#162d20] select-none">
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-off-white font-bold flex-shrink-0 text-xs ${
            userRole?.toLowerCase() === 'administrador' ? 'bg-mustard-gold' : 'bg-[#e2b888]'
          }`}>
            {userRole?.toLowerCase() === 'administrador' ? 'AD' : 'CO'}
          </div>
          <motion.div
            animate={{ opacity: effectiveExpanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center whitespace-nowrap"
          >
            <span className="text-xs font-semibold text-off-white capitalize">
              {userRole}
            </span>
          </motion.div>
        </div>
      </div>
    </motion.aside>
  );
};
