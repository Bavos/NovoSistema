import { useEffect, useRef } from "react";
import { getAuth, signOut } from "firebase/auth";

const TEMPO_LIMITE_MINUTOS = 30;
const TEMPO_LIMITE_MS = TEMPO_LIMITE_MINUTOS * 60 * 1000;

export function useAutoLogout() {
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    const auth = getAuth();

    const resetarTemporizador = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (auth.currentUser) {
        timeoutRef.current = setTimeout(async () => {
          try {
            await signOut(auth);
            window.location.href = "/";
          } catch (error) {
            console.error("Erro no logout automatico:", error);
          }
        }, TEMPO_LIMITE_MS);
      }
    };

    const eventos = ["touchstart", "touchmove", "scroll", "mousemove", "keydown", "click"];

    eventos.forEach((evento) => {
      window.addEventListener(evento, resetarTemporizador, { passive: true });
    });

    resetarTemporizador();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      eventos.forEach((evento) => {
        window.removeEventListener(evento, resetarTemporizador);
      });
    };
  }, []);
}
