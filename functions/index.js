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

exports.analisarMetricasHomeCare = onCall(
  {
    secrets: ["GEMINI_API_KEY"],
    region: "southamerica-east1",
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const uid = request.auth.uid;
    const userEmail = (request.auth.token.email || "").toLowerCase();
    const userRole = String(request.auth.token.role || request.auth.token.nivelAcesso || "").toLowerCase();
    const isMasterAdmin = userEmail === "renatobz@gmail.com" || userEmail === "rhgestaodomiciliar@gmail.com";

    if (!isMasterAdmin && userRole !== "administrador" && userRole !== "admin") {
      const userDoc = await db.collection("usuarios_sistema").doc(uid).get();
      const nivel = String(userDoc.data()?.nivelAcesso || userDoc.data()?.role || "").toLowerCase();
      if (nivel !== "administrador" && nivel !== "admin") {
        throw new HttpsError("permission-denied", "Acesso restrito exclusivamente a administradores.");
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "A chave GEMINI_API_KEY não está configurada no Secret Manager.");
    }

    const rawData = request.data || {};
    const source = rawData.metricas || rawData;
    const pergunta = String(rawData.pergunta || "").trim();
    
    // Sanitização e Anonimização LGPD
    const pacMap = new Map();
    const profMap = new Map();
    let pacNum = 1;
    let profNum = 1;

    const anonPac = (id) => {
      const k = String(id || '').trim();
      if (!k) return 'Paciente [PAC-000]';
      if (!pacMap.has(k)) pacMap.set(k, `Paciente [PAC-${String(pacNum++).padStart(3, '0')}]`);
      return pacMap.get(k);
    };

    const anonProf = (id) => {
      const k = String(id || '').trim();
      if (!k) return 'Profissional [P-00]';
      if (!profMap.has(k)) profMap.set(k, `Profissional [P-${String(profNum++).padStart(2, '0')}]`);
      return profMap.get(k);
    };

    const pacientesRaw = Array.isArray(source.pacientes) ? source.pacientes : [];
    const profissionaisRaw = Array.isArray(source.profissionais) ? source.profissionais : [];
    const escalasRaw = Array.isArray(source.escalas || source.agendamentos || source.plantoes) ? (source.escalas || source.agendamentos || source.plantoes) : [];

    const dadosHigienizados = {
      metricasGerais: {
        totalPacientes: pacientesRaw.length,
        pacientesAtivos: pacientesRaw.filter(p => (p.status || '').toLowerCase() === 'ativo').length,
        totalProfissionais: profissionaisRaw.length,
        profissionaisAtivos: profissionaisRaw.filter(p => (p.status || '').toLowerCase() !== 'inativo').length,
        totalEscalas: escalasRaw.length,
        escalasSemAlocacao: escalasRaw.filter(e => !e.profissionalId && !e.profissionalNome && !e.idProfissional && !e.nomeProfissional).length,
      },
      pacientesAmostra: pacientesRaw.slice(0, 40).map(p => ({
        codigo: anonPac(p.id || p.nome),
        status: p.status || 'Ativo',
        complexidade: p.complexidade || p.grauComplexidade || 'Média',
        planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h',
        especialidadeRequerida: p.especialidade || 'Técnico de Enfermagem'
      })),
      profissionaisAmostra: profissionaisRaw.slice(0, 40).map(p => ({
        codigo: anonProf(p.id || p.nome),
        categoria: p.categoria || p.funcao || 'Cuidador',
        especialidade: p.especialidade || 'Geral',
        status: p.status || 'Disponível'
      })),
      escalasAmostra: escalasRaw.slice(0, 50).map(e => ({
        paciente: anonPac(e.pacienteId || e.pacienteNome || e.idPaciente),
        profissional: (e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) ? anonProf(e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) : 'NÃO_ALOCADO (GARGALO)',
        turno: e.tipoTurno || e.turno || e.horario || '12h Diurno',
        status: e.status || 'Agendado'
      }))
    };

    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction =
      "Você é um assistente de análise de gestão e operações financeiras de home care. " +
      "Analise exclusivamente os dados anonimizados fornecidos, destacando gargalos de escalas, custos de plantões e projeções de demanda. " +
      "Nunca deduza nem tente solicitar dados de identificação pessoal.";

    const prompt = pergunta
      ? `O administrador do serviço de Home Care fez a seguinte consulta operacional:
"${pergunta}"

Por favor, responda de forma analítica, clara e estruturada em Markdown, fundamentando-se rigorosamente nos dados operacionais anonimizados abaixo:
<DADOS_ANONIMIZADOS>
${JSON.stringify(dadosHigienizados, null, 2)}
</DADOS_ANONIMIZADOS>`
      : `Analise os dados anonimizados da operação de home care e responda em Markdown:
<DADOS_ANONIMIZADOS>
${JSON.stringify(dadosHigienizados, null, 2)}
</DADOS_ANONIMIZADOS>

Estruture o relatório com os seguintes tópicos obrigatórios:
## Resumo Geral
## Eficiência de Escalas
## Riscos Financeiros
## Recomendações`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: { systemInstruction, temperature: 0.2 }
      });

      await db.collection("logs_auditoria").add({
        acao: "IA_ANALISE_OPERACOES_HOMECARE",
        pergunta: pergunta ? pergunta.substring(0, 200) : "DIAGNOSTICO_COMPLETO",
        executadoPorUid: uid,
        executadoPorEmail: userEmail,
        timestamp: new Date().toISOString()
      });

      const relTexto = response.text || "";

      return {
        sucesso: true,
        resposta: relTexto,
        relatorio: relTexto,
        relatorioMarkdown: relTexto,
        metricasGerais: dadosHigienizados.metricasGerais,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error("Erro ao processar consulta:", err);
      throw new HttpsError("internal", `Falha no processamento: ${err.message}`);
    }

  }
);

