/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  Building2,
  UserCheck,
  ChevronRight,
  Menu,
  Activity
} from 'lucide-react';
import { useFirebase } from '../context/FirebaseContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VallidareIcon } from './VallidareLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarExpanded: boolean;
  setIsSidebarExpanded: (expanded: boolean) => void;
  isHovered?: boolean;
  setIsHovered?: (hovered: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isSidebarExpanded,
  setIsSidebarExpanded,
  isHovered,
  setIsHovered,
}) => {
  const [localHovered, setLocalHovered] = useState(false);
  const hoverActive = isHovered !== undefined ? isHovered : localHovered;
  const setHoverActive = setIsHovered !== undefined ? setIsHovered : setLocalHovered;
  const [empresa, setEmpresa] = useState<any>(null);
  const { userRole, user, isQuotaExceeded, isTestMode } = useFirebase();

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
      console.warn("Sidebar company settings subscription failed:", error);
    });
    return () => {
      unsub();
    };
  }, [user?.uid, isQuotaExceeded, isTestMode]);

  const allMenuItems = [
    { id: 'dashboard', label: 'Início', icon: Activity },
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'profissionais', label: 'Profissionais', icon: Briefcase },
    { id: 'financeiro', label: 'Faturas & Pagamentos', icon: DollarSign },
    { id: 'usuarios', label: 'Usuários', icon: UserCheck },
    { id: 'empresa', label: 'Empresa', icon: Building2 },
  ];

  // Restrict access for 'colaborador' role: Empresa and Usuários are exclusively for 'Administrador'
  const menuItems = allMenuItems.filter(item => {
    if (userRole?.toLowerCase() === 'colaborador' && (item.id === 'empresa' || item.id === 'usuarios')) {
      return false;
    }
    return true;
  });

  const effectiveExpanded = isSidebarExpanded || hoverActive;

  return (
    <motion.aside
      className={`fixed top-0 left-0 h-full bg-forest-green text-off-white z-55 flex flex-col shadow-2xl overflow-hidden border-r border-[#254A34] transition-transform duration-300 ease-in-out ${
        isSidebarExpanded ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
      animate={{ width: effectiveExpanded ? 240 : 64 }}
      transition={{ duration: 0.3, ease: [0.25, 0.8, 0.25, 1] }}
      onMouseEnter={() => setHoverActive(true)}
      onMouseLeave={() => setHoverActive(false)}
      id="sidebar-main"
    >
      {/* Sidebar Header */}
      <div className="h-16 flex items-center border-b border-[#254A34] px-4 justify-between select-none bg-forest-green">
        <div className="flex items-center space-x-3 overflow-hidden min-w-[150px]">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#254A34]/20 shadow-xs p-1">
            {empresa?.logoUrl ? (
              <img 
                src={empresa.logoUrl} 
                alt="Logo Vallidare" 
                className="w-full h-full object-contain max-w-full" 
                style={{ imageRendering: '-webkit-optimize-contrast' }}
              />
            ) : (
              <VallidareIcon className="w-full h-full object-contain" />
            )}
          </div>
          <motion.div
            animate={{ opacity: effectiveExpanded ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col whitespace-nowrap pl-3"
          >
            <span className="font-extrabold text-off-white text-sm tracking-wide uppercase">VALLIDARE</span>
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
            <a
              key={item.id}
              href={`?tab=${item.id}`}
              onClick={(e) => {
                // If it was clicked with modifier keys or middle button, let the browser handle it natively
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
                  return;
                }
                e.preventDefault();
                setActiveTab(item.id);
              }}
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
                className="overflow-hidden whitespace-nowrap pl-3 flex items-center"
                animate={{ opacity: effectiveExpanded ? 1 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-sm font-medium">{item.label}</span>
              </motion.div>

              {/* Active hover tooltip indicator */}
              {!effectiveExpanded && (
                <div className="absolute left-16 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              )}
            </a>
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
