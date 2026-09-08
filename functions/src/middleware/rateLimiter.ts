/**
 * @file functions/src/middleware/rateLimiter.ts
 * @description Middleware de Rate Limiting Transacional no Firestore para endpoints de IA (Gemini)
 * Mitiga OWASP LLM04: Model Denial of Service e OWASP LLM10: Unbounded Consumption
 */

import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

export interface LimiteConfig {
  maxPorMinuto: number;
  maxPorDia: number;
}

export const CONFIG_PADRAO: LimiteConfig = {
  maxPorMinuto: 10,  // Proteção contra ataques de rajada (burst DoS)
  maxPorDia: 100     // Proteção contra exaustão de orçamento mensal (Denial of Wallet)
};

/**
 * Valida de forma atômica se o usuário excedeu a cota de requisições por minuto ou por dia.
 * @param uid Identificador único do usuário no Firebase Auth
 * @param config Configurações de limites (opcional, defaults: 10/minuto e 100/dia)
 * @returns Quantidade de requisições restantes na janela atual do minuto
 */
export async function validarLimiteRequisicoesIA(
  uid: string, 
  config: LimiteConfig = CONFIG_PADRAO
): Promise<{ requisicoesRestantesMinuto: number }> {
  const agora = Date.now();
  const limiteRef = admin.firestore().collection("rate_limits_ia").doc(uid);

  return await admin.firestore().runTransaction(async (transaction) => {
    const doc = await transaction.get(limiteRef);
    const dados = doc.data();

    // Data de expiração para o TTL automático do Firestore (2 dias)
    const expiraEm = new Date(agora + 2 * 24 * 60 * 60 * 1000);

    // 1. Primeiro acesso do usuário
    if (!dados) {
      transaction.set(limiteRef, {
        contagemMinuto: 1,
        inicioJanelaMinuto: agora,
        contagemDia: 1,
        inicioJanelaDia: agora,
        expiraEm: admin.firestore.Timestamp.fromDate(expiraEm)
      });
      return { requisicoesRestantesMinuto: config.maxPorMinuto - 1 };
    }

    let contagemMinuto = dados.contagemMinuto || 0;
    let inicioJanelaMinuto = dados.inicioJanelaMinuto || agora;
    let contagemDia = dados.contagemDia || 0;
    let inicioJanelaDia = dados.inicioJanelaDia || agora;

    // 2. Avaliação da Janela de 1 Minuto (60.000 ms)
    const tempoDecorridoMinuto = agora - inicioJanelaMinuto;
    if (tempoDecorridoMinuto < 60000) {
      if (contagemMinuto >= config.maxPorMinuto) {
        const segundosRestantes = Math.ceil((60000 - tempoDecorridoMinuto) / 1000);
        throw new HttpsError(
          "resource-exhausted",
          `Limite de requisições de IA por minuto excedido. Por favor, aguarde ${segundosRestantes} segundos antes de tentar novamente.`
        );
      }
      contagemMinuto += 1;
    } else {
      // Reinicia a janela de 1 minuto
      inicioJanelaMinuto = agora;
      contagemMinuto = 1;
    }

    // 3. Avaliação da Janela de 24 Horas (86.400.000 ms)
    const tempoDecorridoDia = agora - inicioJanelaDia;
    if (tempoDecorridoDia < 86400000) {
      if (contagemDia >= config.maxPorDia) {
        const horasRestantes = Math.ceil((86400000 - tempoDecorridoDia) / (1000 * 60 * 60));
        throw new HttpsError(
          "resource-exhausted",
          `Limite diário de análises de IA atingido (máximo ${config.maxPorDia}/dia). Novas consultas estarão disponíveis em aproximadamente ${horasRestantes} horas.`
        );
      }
      contagemDia += 1;
    } else {
      // Reinicia a janela de 24 horas
      inicioJanelaDia = agora;
      contagemDia = 1;
    }

    // 4. Grava os contadores atualizados na mesma transação atômica
    transaction.set(limiteRef, {
      contagemMinuto,
      inicioJanelaMinuto,
      contagemDia,
      inicioJanelaDia,
      expiraEm: admin.firestore.Timestamp.fromDate(expiraEm)
    }, { merge: true });

    return {
      requisicoesRestantesMinuto: Math.max(0, config.maxPorMinuto - contagemMinuto)
    };
  });
}
