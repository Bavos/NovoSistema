import { addDoc, collection } from 'firebase/firestore';

export interface DiagnosticLog {
  timestamp: string;
  context: string;
  errorMessage: string;
  errorStack?: string;
  userAgent: string;
  href: string;
  extraData?: Record<string, any>;
}

const LOCAL_STORAGE_KEY = 'ia_diagnostics_logs';
const MAX_LOGS = 50;

/**
 * Registra um erro de forma persistente no Firestore, no localStorage e no console estruturado.
 */
export async function logError(
  error: Error | unknown,
  context: string,
  extraData?: Record<string, any>
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  const timestamp = new Date().toISOString();
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server';
  const href = typeof window !== 'undefined' ? window.location.href : 'Server';

  const logEntry: DiagnosticLog = {
    timestamp,
    context,
    errorMessage,
    errorStack,
    userAgent,
    href,
    extraData,
  };

  // 1. Console estruturado (Estilizado para melhor diagnóstico em desenvolvimento)
  console.groupCollapsed(
    `%c[DIAGNOSTIC LOGGER] ${context}: ${errorMessage.substring(0, 60)}...`,
    'color: #dc2626; font-weight: bold; font-family: monospace;'
  );
  console.log('%cTimestamp:', 'color: #718096; font-weight: bold;', timestamp);
  console.log('%cOrigem/Contexto:', 'color: #718096; font-weight: bold;', context);
  console.error('Objeto do Erro:', error);
  if (extraData) {
    console.log('%cDados Adicionais:', 'color: #718096; font-weight: bold;', extraData);
  }
  console.groupEnd();

  // 2. Persistência local (LocalStorage) - Garante sobrevivência a reloads e crashes
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
      const logs: DiagnosticLog[] = existing ? JSON.parse(existing) : [];
      logs.unshift(logEntry);
      
      // Limita ao número máximo de logs
      if (logs.length > MAX_LOGS) {
        logs.splice(MAX_LOGS);
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
      console.warn('[DIAGNOSTIC LOGGER] Erro ao gravar no localStorage:', e);
    }
  }

  // 3. Persistência remota (Firestore) - Logs agregados na nuvem para monitoramento remoto
  try {
    const { db } = await import('./firebase');
    if (db) {
      const logsCollection = collection(db, 'system_errors');
      await addDoc(logsCollection, {
        ...logEntry,
        timestamp: new Date(), // usa objeto Date para facilidade de query/ordenamento no Firestore
      });
    }
  } catch (firestoreErr) {
    // Tratamento silencioso de falha do Firestore (importante para evitar loops se o erro for de conexão)
    console.warn('[DIAGNOSTIC LOGGER] Não foi possível persistir no Firestore (Modo offline ativo):', firestoreErr);
  }
}

/**
 * Retorna todos os logs armazenados localmente.
 */
export function getLocalDiagnostics(): DiagnosticLog[] {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const existing = localStorage.getItem(LOCAL_STORAGE_KEY);
      return existing ? JSON.parse(existing) : [];
    } catch (e) {
      console.error('Erro ao ler logs de diagnóstico do localStorage:', e);
    }
  }
  return [];
}

/**
 * Limpa os logs de diagnósticos armazenados localmente.
 */
export function clearLocalDiagnostics(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      console.log('%c[DIAGNOSTIC LOGGER] Logs locais limpos com sucesso.', 'color: #10b981;');
    } catch (e) {
      console.error('Erro ao limpar logs de diagnóstico:', e);
    }
  }
}

// Expõe auxiliares no escopo global para acesso fácil via DevTools do navegador
if (typeof window !== 'undefined') {
  (window as any).getDiagnostics = getLocalDiagnostics;
  (window as any).clearDiagnostics = clearLocalDiagnostics;
  (window as any).testDiagnosticLog = () => {
    logError(new Error('Log de teste manual acionado pelo desenvolvedor'), 'DevTools Test Entry', { test: true });
    return 'Log de teste enviado. Execute "getDiagnostics()" para verificar.';
  };
}
