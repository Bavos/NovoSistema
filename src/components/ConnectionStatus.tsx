import React, { useState, useEffect } from 'react';

export const ConnectionStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const syncTimer = setTimeout(() => {
      setIsSyncing(false);
    }, 1800);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(syncTimer);
    };
  }, []);

  if (!isOnline) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-[11px] font-medium shadow-xs shrink-0"
        title="Sem conexão de rede ou banco offline"
      >
        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
        <span className="hidden sm:inline">Desconectado</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div 
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium shadow-xs shrink-0"
        title="Sincronizando dados com o banco..."
      >
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
        <span className="hidden sm:inline">Conectando...</span>
      </div>
    );
  }

  return (
    <div 
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-medium shadow-xs shrink-0"
      title="Conectado ao banco de dados"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span className="hidden sm:inline">Online</span>
    </div>
  );
};
