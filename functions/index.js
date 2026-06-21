/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * RH Cuidado Domiciliar - Cloud Functions
 * 
 * Lógica Administrativa Segura de Política de Retenção de Backups
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicialização com privilégios de administrador supremo no servidor GCP
admin.initializeApp();

/**
 * Cloud Function: backupRetentionPolicy
 * Gatilho: Firestore onCreate na coleção 'backups_prontuarios'
 * Objetivo: Limpeza automatizada de backups de prontuários excedentes.
 * Segurança: Roda exclusivamente em ambiente de servidor seguro (Sem acesso do cliente ao método de exclusão em lote).
 */
exports.backupRetentionPolicy = functions.firestore
  .document('backups_prontuarios/{backupId}')
  .onCreate(async (snap, context) => {
    const db = admin.firestore();
    const backupsCollectionRef = db.collection('backups_prontuarios');
    
    try {
      console.log('[RetentionPolicy] Nova checagem iniciada de forma segura pós-backup.');
      
      // Obtém todos os backups ordenados por timestamp decrescente
      const querySnap = await backupsCollectionRef.orderBy('timestamp', 'desc').get();
      const totalRecords = querySnap.size;
      
      console.log(`[RetentionPolicy] Histórico total de registros de backups no Firestore: ${totalRecords}`);
      
      // Limite seguro estabelecido: 15 registros. Se excedido, mantém os 10 mais recentes e deleta obsoletos.
      const LIMITE_ALERTA = 15;
      const RETENCAO_DESEJADA = 10;
      
      if (totalRecords > LIMITE_ALERTA) {
        console.log(`[RetentionPolicy] Limite seguro de ${LIMITE_ALERTA} excedido. Iniciando eliminação de obsoletos para retenção de ${RETENCAO_DESEJADA} registros.`);
        
        const docsToDelete = [];
        let index = 0;
        
        querySnap.forEach((doc) => {
          if (index >= RETENCAO_DESEJADA) {
            docsToDelete.push(doc);
          }
          index++;
        });
        
        console.log(`[RetentionPolicy] Total de registros a serem limpos fisicamente: ${docsToDelete.length}`);
        
        // Execução em batch administrativo
        const batch = db.batch();
        
        docsToDelete.forEach((doc) => {
          const docData = doc.data();
          console.log(`[RetentionPolicy] Removendo registro antigo ID: ${doc.id} | Timestamp: ${docData.timestamp}`);
          
          // Exclui o item obsoleto
          batch.delete(doc.ref);
          
          // Cria registro de auditoria do sistema para rastreabilidade
          const newAuditRef = db.collection('logs_auditoria').doc();
          batch.set(newAuditRef, {
            timestamp: new Date().toISOString(),
            userId: 'gcp-cloud-functions',
            action: 'DELETE',
            collection: 'backups_prontuarios',
            documentId: doc.id,
            description: `[Política de Retenção] Backup obsoleto (criado em ${docData.timestamp || 'data desconhecida'}) removido automaticamente via Cloud Function para manter apenas os ${RETENCAO_DESEJADA} mais recentes e otimizar custos.`
          });
        });
        
        await batch.commit();
        console.log(`[RetentionPolicy] Limpeza efetuada com sucesso. ${docsToDelete.length} backups obsoletos expurgados.`);
      } else {
        console.log('[RetentionPolicy] Quantidade de backups está dentro do limite operacional seguro. Nenhuma exclusão efetuada.');
      }
      
    } catch (err) {
      console.error('[RetentionPolicy] Falha crítica ao aplicar política de retenção administrativa:', err);
    }
  });
