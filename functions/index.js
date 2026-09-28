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
    timeoutSeconds: 180,
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
      pacienteCodigo: e.pacienteCodigo || anonPac(e.pacienteId || e.pacienteNome || e.idPaciente || e.nomePaciente || e.paciente),
      paciente: e.pacienteCodigo || anonPac(e.pacienteId || e.pacienteNome || e.idPaciente || e.nomePaciente || e.paciente),
      profissional: (e.profissionalCodigo || e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional || e.cuidadorId || e.funcionarioId || e.idCuidador || e.idFuncionario || e.profissional) 
        ? anonProf(e.profissionalCodigo || e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional || e.cuidadorId || e.funcionarioId || e.idCuidador || e.idFuncionario || e.profissional) 
        : 'NÃO_ALOCADO (GARGALO)',
      data: e.data || e.dataPrevista || 'N/D',
      diaSemana: e.diaSemana || 'N/D',
      turno: e.turno || e.horario || e.tipoTurno || '12h Diurno',
      horario: e.turno || e.horario || e.tipoTurno || '12h Diurno',
      statusAlocacao: e.statusAlocacao || (e.profissionalCodigo || e.profissionalId || e.profissionalNome ? 'completa' : 'incompleta'),
      status: e.status || 'Agendado',
      curinga: Boolean(
        e.curinga === true ||
        e.isCuringa === true ||
        (e.tipoEscala && String(e.tipoEscala).toLowerCase().includes('curinga')) ||
        (e.observacao && String(e.observacao).toUpperCase().includes('CURINGA')) ||
        (e.motivoFalta && String(e.motivoFalta).toUpperCase().includes('CURINGA'))
      ),
      valorRepasseProfissional: Number(e.valorProfissional || e.valorRepasse || e.valorPlantao || 0),
      ajudaCusto: Number(e.ajudaCusto || e.valorTransporte || e.transporte || e.adicional || 0),
      taxaAdm: Number(e.taxaAdm || e.taxaAdministrativa || 0),
      valorCobradoCliente: Number(e.valorCobrado || e.valorFaturado || e.valorTotalCobradoPlantao || (Number(e.valorPlantao || e.valorProfissional || 0) + Number(e.ajudaCusto || e.valorTransporte || 0) + Number(e.taxaAdm || e.taxaAdministrativa || 0)) || 0)
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

    const resumoFinanceiroRaw = Array.isArray(source.resumoFinanceiro) ? source.resumoFinanceiro : [];
    const resumoFinanceiro = resumoFinanceiroRaw.map(rf => ({
      id: anonPac(rf.id || rf.codigo || rf.pacienteId),
      faturamento: Number(rf.faturamento ?? rf.faturamentoTotal ?? 0),
      custoProf: Number(rf.custoProf ?? rf.custoProfissionaisTotal ?? 0),
      ajudaCusto: Number(rf.ajudaCusto ?? rf.ajudaCustoTotal ?? 0),
      totalCustos: Number(rf.totalCustos ?? rf.custosTotais ?? 0),
      lucro: Number(rf.lucro ?? rf.lucroOperacional ?? 0),
      margem: Number(rf.margem ?? rf.margemPercentual ?? 0)
    }));

    const diasSemanaOrdem = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];

    // Agregações determinísticas (recebidas do frontend ou calculadas no backend)
    let escalasPorDiaSemana = source.escalasPorDiaSemana;
    let escalasFimDeSemana = source.escalasFimDeSemana;
    let gargalosEscala = source.gargalosEscala;
    let estatisticasCuringas = source.estatisticasCuringas;
    let financeiroConsolidado = source.financeiroConsolidado;
    let resumoGeral = source.resumoGeral;

    if (!escalasFimDeSemana || !gargalosEscala || !escalasPorDiaSemana) {
      const porDia = {};
      diasSemanaOrdem.forEach(d => { porDia[d] = { total: 0, completas: 0, vagas: 0, curingas: 0 }; });

      const sabadoPacientesMap = new Map();
      const domingoPacientesMap = new Map();
      let sabCompletas = 0;
      let sabVagas = 0;
      let domCompletas = 0;
      let domVagas = 0;
      let totCuringas = 0;
      const curingasPorDia = {};
      diasSemanaOrdem.forEach(d => { curingasPorDia[d] = 0; });
      const vagasPorPac = {};

      escalasProcessadas.forEach(e => {
        const diaRaw = String(e.diaSemana || '').trim();
        let dia = 'N/D';
        if (diaRaw.includes('Seg')) dia = 'Segunda-feira';
        else if (diaRaw.includes('Ter')) dia = 'Terça-feira';
        else if (diaRaw.includes('Qua')) dia = 'Quarta-feira';
        else if (diaRaw.includes('Qui')) dia = 'Quinta-feira';
        else if (diaRaw.includes('Sex')) dia = 'Sexta-feira';
        else if (diaRaw.includes('Sáb') || diaRaw.includes('Sab')) dia = 'Sábado';
        else if (diaRaw.includes('Dom')) dia = 'Domingo';

        const isComp = e.statusAlocacao === 'completa';
        const isCur = Boolean(e.curinga);

        if (porDia[dia]) {
          porDia[dia].total++;
          if (isComp) porDia[dia].completas++;
          else porDia[dia].vagas++;
          if (isCur) porDia[dia].curingas++;
        }

        if (isCur) {
          totCuringas++;
          if (curingasPorDia[dia] !== undefined) curingasPorDia[dia]++;
        }

        if (!isComp) {
          const pCod = e.pacienteCodigo || e.paciente || 'PAC_ND';
          vagasPorPac[pCod] = (vagasPorPac[pCod] || 0) + 1;
        }

        if (dia === 'Sábado') {
          if (isComp) sabCompletas++;
          else sabVagas++;
          const pCod = e.pacienteCodigo || e.paciente || 'PAC_ND';
          const t = e.turno || e.horario || '12h Diurno';
          if (!sabadoPacientesMap.has(pCod)) sabadoPacientesMap.set(pCod, new Set());
          sabadoPacientesMap.get(pCod).add(t);
        } else if (dia === 'Domingo') {
          if (isComp) domCompletas++;
          else domVagas++;
          const pCod = e.pacienteCodigo || e.paciente || 'PAC_ND';
          const t = e.turno || e.horario || '12h Diurno';
          if (!domingoPacientesMap.has(pCod)) domingoPacientesMap.set(pCod, new Set());
          domingoPacientesMap.get(pCod).add(t);
        }
      });

      const sabadoPacientesAtendidos = [];
      sabadoPacientesMap.forEach((turnos, pac) => {
        turnos.forEach(t => sabadoPacientesAtendidos.push(`${pac} (${t})`));
      });
      sabadoPacientesAtendidos.sort();

      const domingoPacientesAtendidos = [];
      domingoPacientesMap.forEach((turnos, pac) => {
        turnos.forEach(t => domingoPacientesAtendidos.push(`${pac} (${t})`));
      });
      domingoPacientesAtendidos.sort();

      escalasPorDiaSemana = escalasPorDiaSemana || porDia;
      escalasFimDeSemana = escalasFimDeSemana || {
        sabado: {
          total: porDia['Sábado']?.total || 0,
          completas: sabCompletas,
          vagas: sabVagas,
          pacientesAtendidos: sabadoPacientesAtendidos
        },
        domingo: {
          total: porDia['Domingo']?.total || 0,
          completas: domCompletas,
          vagas: domVagas,
          pacientesAtendidos: domingoPacientesAtendidos
        }
      };

      const totComp = escalasProcessadas.filter(e => e.statusAlocacao === 'completa').length;
      const totVagas = escalasProcessadas.filter(e => e.statusAlocacao !== 'completa').length;
      const pacAfetados = Object.entries(vagasPorPac)
        .sort((a, b) => b[1] - a[1])
        .map(([p, q]) => `${p} (${q} ${q > 1 ? 'vagas em aberto' : 'vaga em aberto'})`);

      gargalosEscala = gargalosEscala || {
        escalasVagasTotal: totVagas,
        escalasCompletasTotal: totComp,
        taxaOcupacaoPercentual: escalasProcessadas.length > 0 ? Number(((totComp / escalasProcessadas.length) * 100).toFixed(1)) : 100,
        pacientesAfetados: pacAfetados
      };

      const distPerc = {};
      diasSemanaOrdem.forEach(d => {
        const q = curingasPorDia[d] || 0;
        distPerc[d] = totCuringas > 0 ? ((q / totCuringas) * 100).toFixed(1) + '%' : '0%';
      });

      estatisticasCuringas = estatisticasCuringas || {
        total: totCuringas,
        percentualDoTotal: escalasProcessadas.length > 0 ? Number(((totCuringas / escalasProcessadas.length) * 100).toFixed(1)) : 0,
        distribuicaoDias: curingasPorDia,
        distribuicaoPercentual: distPerc
      };

      resumoGeral = resumoGeral || {
        totalPacientes: pacientesRaw.length,
        totalProfissionais: profissionaisRaw.length,
        totalEscalas: escalasProcessadas.length
      };
    }

    if (!financeiroConsolidado) {
      const totDeb = financeiroProcessado.filter(f => f.tipo === 'debito').reduce((a, b) => a + Number(b.valor || 0), 0);
      const totCred = financeiroProcessado.filter(f => f.tipo === 'credito').reduce((a, b) => a + Number(b.valor || 0), 0);
      financeiroConsolidado = {
        totalDebitos: totDeb,
        totalCreditos: totCred,
        saldoOperacional: totCred - totDeb
      };
    }

    const metricasExatas = source.metricasExatas || source.metricasAuditadas || {
      total: source.totalEscalasMes ?? escalasProcessadas.length,
      preenchidas: source.concluidas ?? escalasProcessadas.filter(e => e.statusAlocacao === 'completa').length,
      vagas: source.vagas ?? escalasProcessadas.filter(e => e.statusAlocacao !== 'completa').length,
      curingas: source.curingas ?? escalasProcessadas.filter(e => e.curinga).length,
      pacientesAtivosTotal: source.pacientesAtivosTotal ?? pacientesRaw.length
    };
    const alertasCriticos = Array.isArray(source.alertasCriticos) ? source.alertasCriticos : [];
    const padroesDetectados = source.padroesDetectados || {};

    const dadosHigienizados = {
      periodo: source.periodo || source.periodoReferencia || 'Setembro/2026',
      periodoReferencia: source.periodoReferencia || source.periodo || 'Setembro/2026',
      metricasExatas,
      alertasCriticos,
      padroesDetectados,
      resumoFinanceiro,
      resumoGeral,
      escalasPorDiaSemana,
      escalasFimDeSemana,
      gargalosEscala,
      estatisticasCuringas,
      financeiroConsolidado,
      metricasGerais: {
        totalPacientes: pacientesRaw.length,
        pacientesAtivos: pacientesRaw.filter(p => (p.status || '').toLowerCase() === 'ativo').length,
        totalProfissionais: profissionaisRaw.length,
        profissionaisAtivos: profissionaisRaw.filter(p => (p.status || '').toLowerCase() !== 'inativo').length,
        totalEscalas: escalasRaw.length,
        escalasCuringa: escalasProcessadas.filter(e => e.curinga).length,
        escalasSemAlocacao: escalasRaw.filter(e => !e.profissionalId && !e.profissionalNome && !e.idProfissional && !e.nomeProfissional).length,
      },
      pacientes: pacientesRaw.slice(0, 30).map(p => ({
        codigo: anonPac(p.id || p.nome),
        status: p.status || 'Ativo',
        complexidade: p.complexidade || p.grauComplexidade || 'Média',
        planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h',
        valorPlantaoProfissional: Number(p.valorPlantaoProfissional || 0),
        valorAjudaCusto: Number(p.valorAjudaCusto || 0),
        taxaAdministrativa: Number(p.taxaAdministrativa || 0),
        valorTotalCobradoPlantao: Number(p.valorTotalCobradoPlantao || 0)
      })),
      profissionais: profissionaisRaw.slice(0, 30).map(p => ({
        codigo: anonProf(p.id || p.nome),
        categoria: p.categoria || p.funcao || 'Cuidador',
        especialidade: p.especialidade || 'Geral',
        status: p.status || 'Disponível'
      })),
      escalas: escalasProcessadas.slice(0, 60),
      financeiro: financeiroProcessado.slice(0, 30)
    };

    const prompt = `Você é o Diretor de Operações e Auditoria da Vallidare Home Care.
Sua missão é emitir diagnósticos operacionais de alta precisão baseando-se EXCLUSIVAMENTE nas 'metricasExatas' e 'alertasCriticos' fornecidos.

Diretrizes:
- Seja ultra conciso, direto e executivo. Responda em no máximo 3 parágrafos curtos ou tópicos objetivos com tabela resumida. Elimine saudações formais, introduções óbvias ou conclusões prolixas.
- Nunca altere ou estime os números de escalas e pacientes. Se a métrica informa ${metricasExatas.vagas ?? 0} vagas, aponte exatamente ${metricasExatas.vagas ?? 0} vagas. Se informa ${metricasExatas.total ?? 0} escalas no total, afirme exatamente ${metricasExatas.total ?? 0}.
- Se houver alertas críticos (escalas vagas ou alta taxa de curingas), priorize-os logo no primeiro parágrafo com ações recomendadas.
- Formate a resposta de forma executiva com listas em tópicos e tabelas claras em Markdown.
- Se o gestor perguntar sobre pacientes aos sábados ou escalas vagas, utilize diretamente os blocos 'escalasFimDeSemana', 'gargalosEscala' e 'alertasCriticos'.
- Identificadores de Profissionais e Pacientes: Ao citar colaboradores ou pacientes (ex: PAC-01, PAC-02, P-01), utilize SEMPRE e EXATAMENTE o código literal informado, para que a interface decodifique e restaure os nomes reais localmente no navegador do gestor.

Diagnóstico Estruturado de Auditoria:
${JSON.stringify({
  periodo: dadosHigienizados.periodo,
  metricasExatas: dadosHigienizados.metricasExatas,
  alertasCriticos: dadosHigienizados.alertasCriticos,
  padroesDetectados: dadosHigienizados.padroesDetectados
}, null, 2)}

${dadosHigienizados.resumoFinanceiro && dadosHigienizados.resumoFinanceiro.length > 0 ? `
DIRETRIZ DE RENTABILIDADE E MARGEM DE LUCRO (quando a consulta solicitar margem de lucro ou rentabilidade por paciente):
1. LEIA DIRETAMENTE o 'resumoFinanceiro'. Não tente recalcular ou alterar esses valores matemáticos consolidados.
2. RENDERIZE DIRETAMENTE a tabela em Markdown ordenada obrigatoriamente da MAIOR para a MENOR margem percentual, com a seguinte estrutura de colunas:
| Paciente | Faturamento Total | Custo Cuidadores | Ajuda de Custo | Custos Totais | Lucro Operacional (R$) | Margem (%) |
Formate os valores monetários como moeda brasileira (ex: R$ 4.480,00) e a margem com uma casa decimal e símbolo % (ex: 30,8%).
3. APRESENTE UM RESUMO EXECUTIVO CURTO logo após a tabela destacando:
   - Os 3 pacientes de maior rentabilidade (maior margem %).
   - Os 3 pacientes de menor margem (ou em prejuízo).
   - Conclusão rápida e objetiva (máximo 2 a 3 frases) com foco em tomada de decisão da diretoria, sem enrolação.
` : `
Dicionário Financeiro e Operacional de Pacientes:
- Cada paciente possui sua estrutura de custos unitários por plantão: [valorPlantaoProfissional], [valorAjudaCusto] e [taxaAdministrativa].
- Fórmulas de cálculo:
  * Custos Totais = Custo Profissionais + Ajuda de Custo.
  * Lucro Operacional = Faturamento Total - Custos Totais.
  * Margem (%) = (Lucro Operacional / Faturamento Total) * 100.
- Formate em Markdown com colunas:
  | Paciente | Faturamento Total | Custo Cuidadores | Ajuda de Custo | Custos Totais | Lucro Operacional (R$) | Margem (%) |
- Ordene os pacientes da maior para a menor margem de lucro percentual.
`}

Dados Operacionais Detalhados e Agrupamentos:
${JSON.stringify({
  periodoReferencia: dadosHigienizados.periodoReferencia,
  resumoGeral: dadosHigienizados.resumoGeral,
  escalasPorDiaSemana: dadosHigienizados.escalasPorDiaSemana,
  escalasFimDeSemana: dadosHigienizados.escalasFimDeSemana,
  gargalosEscala: dadosHigienizados.gargalosEscala,
  estatisticasCuringas: dadosHigienizados.estatisticasCuringas,
  financeiroConsolidado: dadosHigienizados.financeiroConsolidado,
  resumoFinanceiro: dadosHigienizados.resumoFinanceiro,
  pacientes: dadosHigienizados.pacientes,
  profissionais: dadosHigienizados.profissionais
}, null, 2)}

Pergunta do Gestor Operacional:
${pergunta || 'Apresente uma análise operacional detalhada das escalas, cobertura dos plantões e distribuição operacional.'}`;

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
          generationConfig: {
            maxOutputTokens: 600,
            temperature: 0.2
          }
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

