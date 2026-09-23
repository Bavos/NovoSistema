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
    region: "southamerica-east1",
    secrets: ["GEMINI_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB",
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
      throw new HttpsError("failed-precondition", "GEMINI_API_KEY não configurada no servidor.");
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
      if (!k) return 'PAC_00';
      if (/^PAC[_-]\d+/i.test(k)) return k;
      if (!pacMap.has(k)) pacMap.set(k, `PAC_${String(pacNum++).padStart(2, '0')}`);
      return pacMap.get(k);
    };

    const anonProf = (id) => {
      const k = String(id || '').trim();
      if (!k) return 'NÃO_ALOCADO (GARGALO)';
      if (/^PROF[_-]\d+/i.test(k) || /^P-\d+/i.test(k)) return k;
      if (!profMap.has(k)) profMap.set(k, `PROF_${String(profNum++).padStart(2, '0')}`);
      return profMap.get(k);
    };

    const pacientesRaw = Array.isArray(source.pacientes) ? source.pacientes : [];
    const profissionaisRaw = Array.isArray(source.profissionais) ? source.profissionais : [];
    const escalasRaw = Array.isArray(source.escalas || source.agendamentos || source.plantoes) ? (source.escalas || source.agendamentos || source.plantoes) : [];
    const financeiroRaw = Array.isArray(source.financeiro) ? source.financeiro : [];

    const escalasProcessadas = escalasRaw.map(e => ({
      paciente: anonPac(e.pacienteId || e.pacienteNome || e.idPaciente),
      profissional: (e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) ? anonProf(e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) : 'NÃO_ALOCADO (GARGALO)',
      data: e.data || e.dataPrevista || 'N/D',
      diaSemana: e.diaSemana || 'N/D',
      horario: e.horario || e.tipoTurno || e.turno || '12h Diurno',
      status: e.status || 'Agendado',
      curinga: Boolean(
        e.curinga === true ||
        e.isCuringa === true ||
        (e.tipoEscala && String(e.tipoEscala).toLowerCase().includes('curinga')) ||
        (e.observacao && String(e.observacao).toUpperCase().includes('CURINGA')) ||
        (e.motivoFalta && String(e.motivoFalta).toUpperCase().includes('CURINGA'))
      )
    }));

    const financeiroProcessado = financeiroRaw.map(f => ({
      tipo: f.tipo || 'debito',
      valor: Number(f.valor || 0),
      data: f.data || 'N/D',
      diaSemana: f.diaSemana || 'N/D',
      motivo: f.motivo || f.numeroFatura || f.descricao || '',
      paciente: f.pacienteId ? anonPac(f.pacienteId) : undefined,
      profissional: f.profissionalId ? anonProf(f.profissionalId) : undefined,
      curinga: Boolean(f.curinga || (f.motivo && String(f.motivo).toLowerCase().includes('curinga'))),
      status: f.status || 'concluido'
    }));

    const dadosHigienizados = {
      metricasGerais: {
        totalPacientes: pacientesRaw.length,
        pacientesAtivos: pacientesRaw.filter(p => (p.status || '').toLowerCase() === 'ativo').length,
        totalProfissionais: profissionaisRaw.length,
        profissionaisAtivos: profissionaisRaw.filter(p => (p.status || '').toLowerCase() !== 'inativo').length,
        totalEscalas: escalasRaw.length,
        escalasCuringa: escalasProcessadas.filter(e => e.curinga).length,
        escalasSemAlocacao: escalasRaw.filter(e => !e.profissionalId && !e.profissionalNome && !e.idProfissional && !e.nomeProfissional).length,
      },
      pacientes: pacientesRaw.map(p => ({
        codigo: anonPac(p.id || p.nome),
        status: p.status || 'Ativo',
        complexidade: p.complexidade || p.grauComplexidade || 'Média',
        planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h'
      })),
      profissionais: profissionaisRaw.map(p => ({
        codigo: anonProf(p.id || p.nome),
        categoria: p.categoria || p.funcao || 'Cuidador',
        especialidade: p.especialidade || 'Geral',
        status: p.status || 'Disponível'
      })),
      escalas: escalasProcessadas,
      financeiro: financeiroProcessado
    };

    const prompt = `Você é um assistente operacional de gestão de home care. Responda à dúvida do administrador com base estritamente nas seguintes métricas e dados operacionais anonimizados:

Dicionário de Regras de Negócio:
- 'Curinga': Identificado pelo campo booleano 'curinga: true' nos registros de escalas (plantão de cobertura/reserva emergencial) ou em débitos de motivo 'Curinga'.
- 'Escalas/Plantões': Contêm a data exata da execução ('data' em formato YYYY-MM-DD), turno ('horario') e dia da semana ('diaSemana').
- 'Financeiro': Contém registros de débito e crédito vinculados aos atendimentos dos pacientes e aos profissionais.
- 'Identificadores de Profissionais e Pacientes': Os colaboradores e pacientes são identificados por pseudônimos no formato PROF_01, PROF_02, etc. (e pacientes por PAC_01, PAC_02). Ao citar colaboradores, rankings de plantões/curingas, escalas ou faltas, utilize SEMPRE e EXATAMENTE o código literal do profissional (ex.: PROF_01, PROF_02), para que a interface decodifique os nomes localmente.

Orientações para o cálculo:
Analise com precisão os dados filtrando pelo mês de agosto (ou o período solicitado na pergunta) e realize os cálculos estatísticos, contagem de curingas, ordenação crescente dos dias da semana com mais dias e porcentagem mensal de cada dia solicitados pelo administrador. Apresente os resultados detalhados com clareza, valores e porcentagens exatas.

Dados Operacionais Anonimizados:
${JSON.stringify(dadosHigienizados, null, 2)}

Pergunta do Administrador:
${pergunta || 'Apresente um resumo geral da operação, gargalos de escalas e capacidade assistencial.'}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        console.error('Falha na chamada da API Gemini', response.status);
        throw new HttpsError('internal', `Erro da API Gemini: ${response.status}`);
      }

      const data = await response.json();
      const respostaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nenhuma resposta gerada.';

      // Efemeridade estrita: Nenhuma conversa, pergunta ou resposta é persistida no banco de dados.

      return {
        resposta: respostaTexto
      };
    } catch (err) {
      if (err instanceof HttpsError) {
        throw err;
      }
      console.error('Falha na chamada da API Gemini', err?.status || 500);
      throw new HttpsError('internal', 'Falha no processamento.');
    }

  }
);

