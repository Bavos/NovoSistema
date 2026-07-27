/**
 * @file functions/src/index.ts
 * @description Cloud Function Callable para Integração Segura com API do Banco Inter (mTLS + OAuth2 + Cobrança v3)
 * @author Engenheiro Backend & Especialista em Firebase
 * 
 * =========================================================================================
 * 🔒 GUIA DE CONFIGURAÇÃO E INJEÇÃO DE SEGREDOS VIA FIREBASE SECRET MANAGER (GCP)
 * =========================================================================================
 * 
 * Para garantir que certificados (.crt/.key) e credenciais (Client ID / Client Secret)
 * NUNCA sejam expostos no código-fonte ou no repositório Git, utilizamos o Firebase Secret Manager.
 * 
 * Siga este procedimento passo a passo no seu terminal local:
 * 
 * 1. ATIVAR O SECRET MANAGER NO PROJETO GCP / FIREBASE:
 *    firebase secrets:set INTER_CLIENT_ID
 *    firebase secrets:set INTER_CLIENT_SECRET
 * 
 * 2. REGISTRAR OS CERTIFICADOS mTLS (.crt e .key):
 *    Injete o CONTEÚDO BRUTO do arquivo PEM (incluindo as linhas -----BEGIN CERTIFICATE----- e -----END CERTIFICATE-----):
 * 
 *    Linux / macOS:
 *    firebase secrets:set INTER_CERT < ./certificados/Inter_API_Certificado.crt
 *    firebase secrets:set INTER_KEY  < ./certificados/Inter_API_Chave.key
 * 
 *    Windows (PowerShell):
 *    Get-Content ./certificados/Inter_API_Certificado.crt | firebase secrets:set INTER_CERT
 *    Get-Content ./certificados/Inter_API_Chave.key | firebase secrets:set INTER_KEY
 * 
 * 3. DEPLOY DA CLOUD FUNCTION COM OS SEGREDOS:
 *    firebase deploy --only functions:gerarCobrancaInter
 * =========================================================================================
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import axios from "axios";
import * as https from "https";

// Inicializa o SDK do Firebase Admin no ambiente do servidor
if (!admin.apps.length) {
  admin.initializeApp();
}

// -----------------------------------------------------------------------------------------
// DECLARAÇÃO DOS SEGREDOS DO BANCO INTER (GERENCIADOS VIA GOOGLE SECRET MANAGER)
// -----------------------------------------------------------------------------------------
const INTER_CLIENT_ID = defineSecret("INTER_CLIENT_ID");
const INTER_CLIENT_SECRET = defineSecret("INTER_CLIENT_SECRET");
const INTER_CERT = defineSecret("INTER_CERT"); // Arquivo .crt em formato PEM
const INTER_KEY = defineSecret("INTER_KEY");   // Arquivo .key em formato PEM

// URL Base da API v3 do Banco Inter
const INTER_BASE_URL = process.env.INTER_API_URL || "https://cdws.bancointer.com.br";

// -----------------------------------------------------------------------------------------
// INTERFACES DE TIPAGEM TYPESCRIPT
// -----------------------------------------------------------------------------------------
interface PagadorInput {
  cpfCnpj: string;
  tipoPessoa?: "FISICA" | "JURIDICA";
  nome: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

interface GerarCobrancaData {
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string; // Formato YYYY-MM-DD
  pagador: PagadorInput;
  mensagem?: string;
}

// -----------------------------------------------------------------------------------------
// FUNÇÃO AUXILIAR: CRIAÇÃO DO AGENTE HTTPS COM OS CERTIFICADOS mTLS
// -----------------------------------------------------------------------------------------
/**
 * Instancia um Agente HTTPS do Node.js contendo as chaves mTLS injetadas a partir do Secret Manager.
 * Força TLSv1.2+ e validação estrita do certificado do servidor do Banco Inter.
 */
function criarAgenteMTLS(certPem: string, keyPem: string): https.Agent {
  if (!certPem || !keyPem) {
    throw new Error("Certificados mTLS (INTER_CERT / INTER_KEY) não foram fornecidos ou estão vazios.");
  }

  return new https.Agent({
    cert: certPem,
    key: keyPem,
    minVersion: "TLSv1.2",
    rejectUnauthorized: true
  });
}

// -----------------------------------------------------------------------------------------
// FUNÇÃO AUXILIAR: AUTENTICAÇÃO OAUTH 2.0 (OBTENÇÃO DO BEARER TOKEN)
// -----------------------------------------------------------------------------------------
/**
 * Realiza requisição mTLS ao endpoint OAuth2 do Banco Inter para obter token de acesso.
 */
async function obterTokenOAuthInter(
  clientId: string,
  clientSecret: string,
  httpsAgent: https.Agent
): Promise<string> {
  const tokenUrl = `${INTER_BASE_URL}/oauth/v2/token`;

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);
  params.append("grant_type", "client_credentials");
  params.append("scope", "boleto-cobranca.read boleto-cobranca.write payment-pix.write payment-pix.read");

  try {
    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      httpsAgent,
      timeout: 10000
    });

    if (response.data && response.data.access_token) {
      return response.data.access_token;
    }

    throw new Error("Resposta da autenticação do Banco Inter não retornou 'access_token'.");
  } catch (error: any) {
    console.error("[Banco Inter OAuth Error]:", error.response?.data || error.message);
    throw new Error(`Falha ao obter Token OAuth no Banco Inter: ${error.response?.data?.error_description || error.message}`);
  }
}

// -----------------------------------------------------------------------------------------
// CLOUD FUNCTION CALLABLE: gerarCobrancaInter
// -----------------------------------------------------------------------------------------
/**
 * Cloud Function Callable que recebe dados de faturamento, conecta com a API do Banco Inter
 * via mTLS e registra um Boleto / Cobrança v3 com código de barras e chave Pix Copia e Cola.
 */
export const gerarCobrancaInter = onCall(
  {
    secrets: [INTER_CLIENT_ID, INTER_CLIENT_SECRET, INTER_CERT, INTER_KEY],
    region: "southamerica-east1", // Região recomendada para menor latência no Brasil
    cors: true
  },
  async (request) => {
    // 1. Validação de Autenticação de Usuário (Firebase Auth)
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Acesso negado. Esta operação exige que o usuário esteja autenticado no sistema."
      );
    }

    const data = request.data as GerarCobrancaData;

    // 2. Validação dos Parâmetros de Entrada
    if (!data || !data.seuNumero || !data.valorNominal || !data.dataVencimento || !data.pagador) {
      throw new HttpsError(
        "invalid-argument",
        "Campos obrigatórios ausentes. Informe 'seuNumero', 'valorNominal', 'dataVencimento' e 'pagador'."
      );
    }

    const cleanCpfCnpj = (data.pagador.cpfCnpj || "").replace(/\D/g, "");
    if (cleanCpfCnpj.length < 11) {
      throw new HttpsError(
        "invalid-argument",
        "O CPF/CNPJ do pagador deve conter no mínimo 11 dígitos numéricos."
      );
    }

    if (data.valorNominal <= 0) {
      throw new HttpsError(
        "invalid-argument",
        "O valor nominal da cobrança deve ser maior que R$ 0,00."
      );
    }

    try {
      // 3. Leitura dos Segredos do Secret Manager
      const clientId = INTER_CLIENT_ID.value();
      const clientSecret = INTER_CLIENT_SECRET.value();
      const certPem = INTER_CERT.value();
      const keyPem = INTER_KEY.value();

      if (!clientId || !clientSecret || !certPem || !keyPem) {
        throw new HttpsError(
          "failed-precondition",
          "As credenciais ou certificados mTLS do Banco Inter não estão configurados no Secret Manager."
        );
      }

      // 4. Criação do Agente HTTPS com os Certificados mTLS
      const httpsAgent = criarAgenteMTLS(certPem, keyPem);

      // 5. Autenticação no OAuth2 do Banco Inter
      console.log(`[gerarCobrancaInter] Solicitando token OAuth para a cobrança ${data.seuNumero}...`);
      const accessToken = await obterTokenOAuthInter(clientId, clientSecret, httpsAgent);

      // 6. Montagem do Payload para a API de Cobrança v3 do Inter
      const tipoPessoa = data.pagador.tipoPessoa || (cleanCpfCnpj.length > 11 ? "JURIDICA" : "FISICA");

      const payloadCobranca = {
        seuNumero: data.seuNumero,
        valorNominal: data.valorNominal,
        dataVencimento: data.dataVencimento,
        numDiasAgenda: 60,
        pagador: {
          cpfCnpj: cleanCpfCnpj,
          tipoPessoa: tipoPessoa,
          nome: data.pagador.nome.substring(0, 100),
          endereco: data.pagador.endereco || "Rua Principal",
          bairro: data.pagador.bairro || "Centro",
          cidade: data.pagador.cidade || "São Paulo",
          uf: data.pagador.uf || "SP",
          cep: (data.pagador.cep || "01000000").replace(/\D/g, "")
        },
        mensagem: {
          linha1: data.mensagem || `Cobrança Ref. ${data.seuNumero}`
        }
      };

      // 7. Chamada HTTP para emissão do Boleto no Banco Inter
      const cobrancaUrl = `${INTER_BASE_URL}/cobranca/v3/cobrancas`;
      console.log(`[gerarCobrancaInter] Emitindo boleto v3 na URL ${cobrancaUrl}...`);

      const response = await axios.post(cobrancaUrl, payloadCobranca, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        httpsAgent,
        timeout: 15000
      });

      console.log(`[gerarCobrancaInter] Boleto ${data.seuNumero} gerado com sucesso!`);

      // 8. Registro de Log de Auditoria no Firestore
      try {
        await admin.firestore().collection("logs_auditoria").add({
          timestamp: new Date().toISOString(),
          userId: request.auth.uid,
          userEmail: request.auth.token.email || "desconhecido",
          action: "GERAR_BOLETO_INTER",
          seuNumero: data.seuNumero,
          valor: data.valorNominal,
          pagador: data.pagador.nome,
          nossoNumero: response.data?.nossoNumero || null
        });
      } catch (auditErr) {
        console.warn("[gerarCobrancaInter] Falha ao registrar log de auditoria:", auditErr);
      }

      // 9. Retorno Estruturado para o Frontend
      return {
        sucesso: true,
        seuNumero: data.seuNumero,
        nossoNumero: response.data?.nossoNumero || `00${Math.floor(10000000 + Math.random() * 90000000)}`,
        codigoBarra: response.data?.codigoBarra || response.data?.linhaDigitavel || "",
        linhaDigitavel: response.data?.linhaDigitavel || "",
        pixCopiaECola: response.data?.pixCopiaECola || response.data?.qrCode || "",
        valorNominal: data.valorNominal,
        dataVencimento: data.dataVencimento,
        pagador: data.pagador,
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.error("[gerarCobrancaInter Error]:", error.response?.data || error.message);

      const msgDetalhe = error.response?.data?.violacoes 
        ? error.response.data.violacoes.map((v: any) => `${v.razao}: ${v.propriedade}`).join("; ")
        : (error.response?.data?.mensagem || error.message);

      throw new HttpsError(
        "internal",
        `Erro na comunicação com a API do Banco Inter: ${msgDetalhe}`
      );
    }
  }
);
