const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");
const https = require("https");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getInterAccessToken() {
  const cert = process.env.INTER_CERT;
  const key = process.env.INTER_KEY;
  const clientId = process.env.INTER_CLIENT_ID;
  const clientSecret = process.env.INTER_CLIENT_SECRET;

  if (!cert || !key || !clientId || !clientSecret) {
    throw new Error("Credenciais do Banco Inter incompletas no Secret Manager.");
  }

  const httpsAgent = new https.Agent({
    cert: cert,
    key: key,
    rejectUnauthorized: true,
  });

  const params = new URLSearchParams();
  params.append("client_id", clientId.trim());
  params.append("client_secret", clientSecret.trim());
  params.append("grant_type", "client_credentials");
  params.append("scope", "extrato.read cob.write cob.read boleto-cobranca.read boleto-cobranca.write");

  const response = await axios.post(
    "https://cdpj.partners.bancointer.com.br/oauth/v2/token",
    params,
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      httpsAgent: httpsAgent,
    }
  );

  return { token: response.data.access_token, httpsAgent };
}

exports.emitirBoletoInter = onCall(
  {
    secrets: ["INTER_CERT", "INTER_KEY", "INTER_CLIENT_ID", "INTER_CLIENT_SECRET"],
    region: "southamerica-east1",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const { faturaId, clienteNome, clienteDocumento, clienteEmail, valor, dataVencimento, descricao } = request.data;

    if (!faturaId || !clienteNome || !valor || !dataVencimento) {
      throw new HttpsError("invalid-argument", "Dados obrigatórios da fatura ausentes.");
    }

    try {
      const { token, httpsAgent } = await getInterAccessToken();

      const docLimpo = (clienteDocumento || "00000000000").replace(/\D/g, "");
      const tipoPessoa = docLimpo.length > 11 ? "JURIDICA" : "FISICA";
      const seuNumero = String(faturaId).substring(0, 15);

      const payload = {
        seuNumero: seuNumero,
        valorNominal: Number(valor),
        dataVencimento: dataVencimento,
        numDiasAgenda: 30,
        pagador: {
          cpfCnpj: docLimpo,
          tipoPessoa: tipoPessoa,
          nome: clienteNome,
          email: clienteEmail || "",
          endereco: "Rua Principal",
          numero: "SN",
          bairro: "Centro",
          cidade: "Rio de Janeiro",
          uf: "RJ",
          cep: "20000000"
        },
        mensagem: {
          linha1: descricao || "Prestação de Serviços de Home Care"
        }
      };

      // 1. Criar cobrança
      const response = await axios.post(
        "https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas",
        payload,
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          httpsAgent: httpsAgent,
        }
      );

      const codigoSolicitacao = response.data.codigoSolicitacao;
      console.log("Cobrança criada com sucesso. CodigoSolicitacao:", codigoSolicitacao);

      // 2. Polling para buscar detalhes (Linha Digitável, Código de Barras e Pix)
      let detalhes = {};
      for (let i = 0; i < 4; i++) {
        await sleep(2000);
        try {
          const detResp = await axios.get(
            `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}`,
            {
              headers: { "Authorization": `Bearer ${token}` },
              httpsAgent: httpsAgent,
            }
          );
          detalhes = detResp.data || {};
          if (detalhes.boleto?.linhaDigitavel || detalhes.pix?.pixCopiaECola) {
            console.log("Detalhes obtidos na tentativa", i + 1);
            break;
          }
        } catch (e) {
          console.warn(`Tentativa ${i + 1} detalhes:`, e.response?.data || e.message);
        }
      }

      // 3. Buscar PDF Base64
      let pdfBase64 = "";
      try {
        const pdfResp = await axios.get(
          `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
          {
            headers: { "Authorization": `Bearer ${token}` },
            httpsAgent: httpsAgent,
          }
        );
        pdfBase64 = pdfResp.data?.pdf || "";
      } catch (e) {
        console.warn("Aviso ao buscar PDF:", e.response?.data || e.message);
      }

      const dadosFatura = {
        codigoSolicitacao: codigoSolicitacao,
        nossoNumero: detalhes.cobranca?.nossoNumero || detalhes.boleto?.nossoNumero || codigoSolicitacao,
        codigoBarras: detalhes.boleto?.codigoBarras || "",
        linhaDigitavel: detalhes.boleto?.linhaDigitavel || "",
        pixCopiaECola: detalhes.pix?.pixCopiaECola || "",
        pdfBase64: pdfBase64,
        status: "pendente",
        formaPagamento: "boleto",
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("faturas").doc(faturaId).set(dadosFatura, { merge: true });

      return {
        sucesso: true,
        ...dadosFatura,
      };
    } catch (error) {
      console.error("Erro na emissão do boleto Inter:", error.response?.data || error.message);
      const msg = error.response?.data?.violacoes?.[0]?.razao || error.response?.data?.message || error.message;
      throw new HttpsError("internal", `Falha no Banco Inter: ${msg}`);
    }
  }
);

exports.obterPdfBoletoInter = onCall(
  {
    secrets: ["INTER_CERT", "INTER_KEY", "INTER_CLIENT_ID", "INTER_CLIENT_SECRET"],
    region: "southamerica-east1",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const { codigoSolicitacao } = request.data;
    if (!codigoSolicitacao) {
      throw new HttpsError("invalid-argument", "Código de solicitação obrigatório.");
    }

    try {
      const { token, httpsAgent } = await getInterAccessToken();
      const pdfResp = await axios.get(
        `https://cdpj.partners.bancointer.com.br/cobranca/v3/cobrancas/${codigoSolicitacao}/pdf`,
        {
          headers: { "Authorization": `Bearer ${token}` },
          httpsAgent: httpsAgent,
        }
      );

      return {
        sucesso: true,
        pdfBase64: pdfResp.data?.pdf || "",
      };
    } catch (error) {
      console.error("Erro ao obter PDF:", error.response?.data || error.message);
      throw new HttpsError("internal", "O PDF ainda está sendo gerado pelo banco. Tente novamente em 5 segundos.");
    }
  }
);
