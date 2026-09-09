import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().length === 0 ? initializeApp({
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0242962167"
}) : getApps()[0];

// Suporte para a base nomeada do Firestore usada no projeto
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-ec969b01-95ac-467f-b5b7-48efe433d663";
const db = getFirestore(app, databaseId);

async function limparDuplicados() {
  console.log("Iniciando busca por débitos de MEI duplicados na base:", databaseId);
  const snapshot = await db.collection('debitos_profissionais').get();

  const vistos = new Map();
  let deletados = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const desc = (data.descricao || "").toLowerCase();
    const tipo = (data.tipo || "").toLowerCase();

    // Filtra apenas registros relacionados a MEI
    if (desc.includes("mei") || tipo.includes("mei")) {
      const profId = data.profissionalId || data.idProfissional;
      const chave = `${profId}_${data.mesReferencia || data.competencia || 'sem_mes'}`;

      if (vistos.has(chave)) {
        // Já existe um registro para esse profissional/competência: apaga o duplicado
        console.log(`Deletando duplicata: Doc ID ${doc.id} | Profissional: ${profId}`);
        await doc.ref.delete();
        deletados++;
      } else {
        vistos.set(chave, doc.id);
      }
    }
  }

  console.log(`Concluído! Total de débitos de MEI duplicados removidos: ${deletados}`);
}

limparDuplicados().catch(console.error);
