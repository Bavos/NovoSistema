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

    const cleanDoc = (fatura.clienteDocumento || "").replace(/\D/g, "");
    if (!cleanDoc || cleanDoc.length < 11) {
      throw new Error("CPF/CNPJ do pagador é obrigatório para registro de boleto (mínimo 11 dígitos).");
    }

    const hojeIso = new Date().toISOString().split("T")[0];
    if (!fatura.dataVencimento || fatura.dataVencimento < hojeIso) {
      throw new Error("Data de Vencimento do boleto é obrigatória e deve ser hoje ou posterior.");
    }

    const functions = getFunctions(app, "southamerica-east1");
    const emitir = httpsCallable(functions, "emitirBoletoInter");
    
    const response = await emitir({
      faturaId: fatura.id,
      clienteNome: fatura.clienteNome.trim(),
      clienteDocumento: cleanDoc,
      clienteEmail: fatura.clienteEmail || "",
      valor: fatura.valor,
      dataVencimento: fatura.dataVencimento,
      descricao: fatura.descricao || "Prestação de Serviços de Home Care",
      mensagem: fatura.descricao || "Prestação de Serviços de Home Care",
      pagador: {
        cpfCnpj: cleanDoc,
        nome: fatura.clienteNome.trim(),
        tipoPessoa: cleanDoc.length > 11 ? "JURIDICA" : "FISICA"
      }
    });

    const resData: any = response.data;
    if (resData) {
      try {
        const { doc, updateDoc } = await import("firebase/firestore");
        const { db } = await import("../lib/firebase");
        const cobrancaInter = {
          nossoNumero: resData.nossoNumero || resData.codigoSolicitacao || "",
          codigoSolicitacao: resData.codigoSolicitacao || "",
          linhaDigitavel: resData.linhaDigitavel || "",
          pixCopiaECola: resData.pixCopiaECola || "",
          pdfBase64: resData.pdfBase64 || null,
          dataEmissao: new Date().toISOString(),
          valor: fatura.valor,
          status: 'EMITIDO'
        };
        await updateDoc(doc(db, "faturas", fatura.id), {
          status: "emitida",
          nossoNumero: cobrancaInter.nossoNumero,
          codigoSolicitacao: cobrancaInter.codigoSolicitacao,
          linhaDigitavel: cobrancaInter.linhaDigitavel,
          pixCopiaECola: cobrancaInter.pixCopiaECola,
          pdfBase64: cobrancaInter.pdfBase64,
          cobrancaInter
        });

        if (fatura.clienteNome) {
          try {
            const { collection, query, where, getDocs } = await import("firebase/firestore");
            const q = query(collection(db, "faturas_pacientes"), where("nomePaciente", "==", fatura.clienteNome.trim()));
            const snap = await getDocs(q);
            for (const d of snap.docs) {
              await updateDoc(doc(db, "faturas_pacientes", d.id), {
                cobrancaInter,
                nossoNumero: cobrancaInter.nossoNumero,
                codigoSolicitacao: cobrancaInter.codigoSolicitacao,
                linhaDigitavel: cobrancaInter.linhaDigitavel,
                pixCopiaECola: cobrancaInter.pixCopiaECola,
                pdfBase64: cobrancaInter.pdfBase64,
                statusPagamento: 'Pendente',
                situacaoInter: 'EMITIDO'
              });
            }
          } catch (syncErr) {
            console.warn("[useFaturas] Aviso ao sincronizar cobrancaInter na coleção faturas_pacientes:", syncErr);
          }
        }
      } catch (err) {
        console.warn("[useFaturas] Aviso ao salvar cobrancaInter na coleção faturas:", err);
      }
    }

    return response.data;
  };

  return {
    faturas,
    loading,
    error,
    emitirBoletoNoInter
  };
}
