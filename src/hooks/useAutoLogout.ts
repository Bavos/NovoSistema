import { useEffect, useRef } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { toast } from 'react-hot-toast';

// Tempo limite de inatividade padrão: 15 minutos (em milissegundos)
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Hook de monitoramento de inatividade do usuário com auto-logout automático.
 * Monitora eventos globais da janela e encerra a sessão caso não haja interação.
 */
export function useAutoLogout(timeoutMs: number = INACTIVITY_TIMEOUT_MS) {
  const { user, logout } = useFirebase();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    // Se não houver usuário logado, não precisa monitorar inatividade
    if (!user) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const performAutoLogout = async () => {
      try {
        console.warn(`[Auto-Logout] Sessão expirada por inatividade (${timeoutMs / 60000} minutos).`);
        
        // Limpar parâmetros de rota/URL para retornar à tela inicial limpa
        try {
          const url = new URL(window.location.href);
          url.search = '';
          url.hash = '';
          window.history.replaceState({}, '', url.toString());
        } catch (e) {
          console.warn('Erro ao limpar URL no auto-logout:', e);
        }

        // Limpar dados de sessão temporários se houver
        try {
          sessionStorage.clear();
        } catch (e) {
          console.warn('Erro ao limpar sessionStorage:', e);
        }

        // Executar signOut do Firebase Auth
        await logout();

        // Exibir toast amigável na tela de login
        toast.error('Sua sessão expirou por inatividade. Faça login novamente para continuar.', {
          duration: 6000,
          id: 'auto-logout-expired-toast',
          position: 'top-center',
          icon: '⏱️',
        });
      } catch (error) {
        console.error('Erro ao executar auto-logout por inatividade:', error);
      }
    };

    const resetTimer = () => {
      const now = Date.now();
      // Throttle de 500ms para evitar resets excessivos em movimentos contínuos de mouse
      if (now - lastActivityRef.current < 500) {
        return;
      }
      lastActivityRef.current = now;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        performAutoLogout();
      }, timeoutMs);
    };

    // Inicializar o temporizador
    lastActivityRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      performAutoLogout();
    }, timeoutMs);

    // Eventos de interação do usuário para monitorar
    const activityEvents = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel',
    ];

    const handleUserActivity = () => {
      resetTimer();
    };

    // Adicionar event listeners com passive: true para otimizar performance
    activityEvents.forEach((eventType) => {
      window.addEventListener(eventType, handleUserActivity, { passive: true });
    });

    // Cleanup completo ao desmontar ou deslogar
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      activityEvents.forEach((eventType) => {
        window.removeEventListener(eventType, handleUserActivity);
      });
    };
  }, [user, logout, timeoutMs]);
}
