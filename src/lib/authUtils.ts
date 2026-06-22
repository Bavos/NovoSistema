import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function validarDominioCorporativo(email: string): Promise<boolean> {
  const emailLower = email.trim().toLowerCase();
  
  // Exceção de superusuário/teste
  if (emailLower === 'renatobz@gmail.com') {
    return true;
  }

  let dominiosPermitidos = ['@vallidare.com.br', '@cuidarhome.com.br', '@rhcuidado.com.br']; // Fallback robusto

  try {
    const docRef = doc(db, 'configuracoes_empresa', 'empresa');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.dominiosAutorizados && Array.isArray(data.dominiosAutorizados)) {
        dominiosPermitidos = data.dominiosAutorizados.map((d: string) => d.trim().toLowerCase());
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar domínios whitelist do Firestore, usando fallbacks:", err);
  }

  return dominiosPermitidos.some(dom => emailLower.endsWith(dom));
}
