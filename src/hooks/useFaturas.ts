import { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  serverTimestamp 
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../lib/firebase";
import { Fatura } from "../types/fatura";

export function useFaturas() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const faturasRef = collection(db, "faturas");
      const q = query(faturasRef, orderBy("dataEmissao", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const lista: Fatura[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<Fatura, "id">),
          }));
          setFaturas(lista);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("Erro ao escutar faturas do Firestore:", err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  const emitirBoletoNoInter = async (fatura: Fatura) => {
    if (!fatura.id) throw new Error("Fatura sem ID cadastrado.");
    const functions = getFunctions(app, "southamerica-east1");
    const emitir = httpsCallable(functions, "emitirBoletoInter");
    
    const response = await emitir({
      faturaId: fatura.id,
      clienteNome: fatura.clienteNome,
      clienteDocumento: fatura.clienteDocumento,
      clienteEmail: fatura.clienteEmail,
      valor: fatura.valor,
      dataVencimento: fatura.dataVencimento,
      descricao: fatura.descricao
    });

    return response.data;
  };

  return {
    faturas,
    loading,
    error,
    emitirBoletoNoInter
  };
}
