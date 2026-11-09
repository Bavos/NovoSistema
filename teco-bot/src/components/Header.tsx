import React from 'react';
import { Activity, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';

interface HeaderProps {
  activeTab: 'chat' | 'services' | 'logs' | 'data';
  setActiveTab: (tab: 'chat' | 'services' | 'logs' | 'data') => void;
  isMockActive: boolean;
  onToggleMock: () => void;
  isTogglingMock: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isMockActive,
  onToggleMock,
  isTogglingMock
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-sky-700 flex items-center justify-center text-white font-bold text-base shadow-xs">
            RH
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              RH Gestão Domiciliar
            </span>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              Central Teco · Assistente Administrativo
            </span>
          </div>
        </div>

        {/* Zone 2: Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'chat'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Simulador Teco
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'services'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Serviços & Conexão
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'logs'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Auditoria de Chamadas
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'data'
                ? 'bg-slate-100 text-slate-900 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Base de Dados Home Care
          </button>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleMock}
            disabled={isTogglingMock}
            title={isMockActive ? 'Clique para direcionar consultas à API Real via VPN' : 'Clique para usar o simulador local sem VPN'}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 border ${
              isMockActive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
            }`}
          >
            {isMockActive ? (
              <>
                <ToggleRight className="w-4 h-4 text-emerald-600" />
                <span>Simulador Local Ativo</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-slate-400" />
                <span>API Real (VPN)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
