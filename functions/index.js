const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

const app = !admin.apps.length ? admin.initializeApp() : admin.app();
const db = getFirestore(app, "ai-studio-ec969b01-95ac-467f-b5b7-48efe433d663");
const BEARER_TOKEN = process.env.AGENT_API_TOKEN;

function norm(t) {
  if (!t || typeof t !== "string") return "";
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function formatarCPF(cpf) {
  if (!cpf) return "";
  const limpo = String(cpf).replace(/\D/g, "");
  if (limpo.length === 11) {
    return limpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return cpf;
}

function formatarMoeda(val) {
  const num = Number(val) || 0;
  const partes = num.toFixed(2).split(".");
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return "R$ " + partes.join(",");
}

function formatarDataBR(dt) {
  if (!dt) return "-";
  if (typeof dt === "string" && dt.includes("-")) {
    const p = dt.split("T")[0].split("-");
    if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  }
  return dt;
}

function calcularValorItem(item) {
  if (item.valorTotal !== undefined && item.valorTotal !== null && Number(item.valorTotal) > 0) {
    return Number(item.valorTotal);
  }
  const base = Number(item.valorPlantao || item.valorRepasse || 0);
  const taxa = Number(item.taxaAdm || 0);
  const ajuda = Number(item.ajudaCusto || 0);
  const soma = base + taxa + ajuda;

  if (item.tipoDia && item.tipoDia.toLowerCase().includes("feriado") && !item.valorTotal) {
    return Number((soma * 1.2).toFixed(2));
  }
  return soma;
}

// Extrai, filtra somente dias trabalhados (> 0) e ordena cronologicamente
function extrairListaItensTrabalhados(fat) {
  let lista = [];
  if (Array.isArray(fat.plantoesCongelados) && fat.plantoesCongelados.length > 0) lista = fat.plantoesCongelados;
  else if (Array.isArray(fat.itens) && fat.itens.length > 0) lista = fat.itens;
  else if (Array.isArray(fat.servicos) && fat.servicos.length > 0) lista = fat.servicos;
  else if (Array.isArray(fat.plantoes) && fat.plantoes.length > 0) lista = fat.plantoes;
  else if (Array.isArray(fat.itensFatura) && fat.itensFatura.length > 0) lista = fat.itensFatura;
  else if (Array.isArray(fat.detalhamento) && fat.detalhamento.length > 0) lista = fat.detalhamento;

  return lista
    .filter(item => {
      // Ignora faltas, cancelamentos e valores zerados
      if (item.status && (item.status.toLowerCase().includes("falta") || item.status.toLowerCase().includes("cancelado"))) {
        return false;
      }
      return calcularValorItem(item) > 0;
    })
    .sort((a, b) => {
      const da = String(a.data || "");
      const db = String(b.data || "");
      return da.localeCompare(db);
    });
}

function auth(req, res) {
  const h = req.headers.authorization;
  if (!h || h !== ("Bearer " + BEARER_TOKEN)) {
    res.status(401).json({ status: "erro", mensagem: "Nao autorizado" });
    return false;
  }
  return true;
}

// 1. buscarFuncionario
exports.buscarFuncionario = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const termo = norm(req.query.nome);
  if (!termo) return res.json({ status: "sucesso", resultados: [] });

  try {
    const snap = await db.collection("profissionais").get();
    const resultados = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (norm(d.nome).includes(termo)) {
        resultados.push({
          id: doc.id,
          nomeCompleto: d.nome || "Sem Nome",
          funcao: d.profissao || d.especialidade || "Cuidadora",
          pacienteOuSetor: d.pacienteOuSetor || d.setor || "Geral",
          temCracha: Boolean(d.foto && d.foto.trim())
        });
      }
      if (resultados.length >= 20) break;
    }
    return res.json({ status: "sucesso", resultados });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 2. baixarCracha
exports.baixarCracha = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const id = req.query.id;
  if (!id) return res.status(400).json({ status: "erro", mensagem: "id obrigatorio" });

  try {
    const docProf = await db.collection("profissionais").doc(id).get();
    if (!docProf.exists) return res.status(404).json({ status: "erro", mensagem: "Profissional nao encontrado" });

    const prof = docProf.data();
    if (!prof.foto || !prof.foto.trim()) return res.json({ status: "erro", mensagem: "Cracha ainda nao gerado" });

    const PDFDocument = require("pdfkit");
    let bLogo = null;
    try {
      const cfg = await db.collection("configuracoes_empresa").doc("empresa").get();
      if (cfg.exists && cfg.data().logoUrl) {
        bLogo = Buffer.from(cfg.data().logoUrl.replace(/^data:image\/\w+;base64,/, ""), "base64");
      }
    } catch (e) {}

    let bFoto = null;
    try {
      bFoto = Buffer.from(prof.foto.replace(/^data:image\/\w+;base64,/, ""), "base64");
    } catch (e) {}

    const docPdf = new PDFDocument({ size: [240, 380], margin: 15 });
    const chunks = [];
    docPdf.on("data", c => chunks.push(c));
    docPdf.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=cracha.pdf");
      res.status(200).send(Buffer.concat(chunks));
    });

    docPdf.rect(5, 5, 230, 370).lineWidth(2).strokeColor("#0d47a1").stroke();

    if (bLogo) {
      try { docPdf.image(bLogo, 20, 15, { fit: [200, 45], align: "center" }); }
      catch (e) { docPdf.rect(5, 5, 230, 50).fillColor("#0d47a1").fill(); }
    } else {
      docPdf.rect(5, 5, 230, 50).fillColor("#0d47a1").fill();
    }

    if (bFoto) {
      try { docPdf.image(bFoto, 70, 75, { fit: [100, 125], align: "center" }); }
      catch (e) { docPdf.rect(70, 75, 100, 125).strokeColor("#cccccc").stroke(); }
    } else {
      docPdf.rect(70, 75, 100, 125).strokeColor("#cccccc").stroke();
    }

    docPdf.fillColor("#1a1a1a").fontSize(13).font("Helvetica-Bold").text(prof.nome || "Colaborador", 10, 220, { align: "center", width: 220 });
    const funcao = prof.profissao || prof.especialidade || "CUIDADORA DE IDOSOS";
    docPdf.fillColor("#0d47a1").fontSize(10).font("Helvetica-Bold").text(funcao.toUpperCase(), 10, 245, { align: "center", width: 220 });

    const docIdentificacao = formatarCPF(prof.cpf || prof.documento || "");
    if (docIdentificacao) {
      docPdf.fillColor("#555555").fontSize(9).font("Helvetica").text("CPF: " + docIdentificacao, 10, 265, { align: "center", width: 220 });
    }

    docPdf.end();
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 3. buscarPaciente
exports.buscarPaciente = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const termo = norm(req.query.nome);
  if (!termo) return res.json({ status: "sucesso", resultados: [] });

  try {
    const snap = await db.collection("pacientes").get();
    const resultados = [];
    for (const doc of snap.docs) {
      const d = doc.data();
      if (norm(d.nome).includes(termo)) {
        resultados.push({
          id: doc.id,
          nomeCompleto: d.nome || "Sem Nome",
          dataNascimento: d.dataNascimento || d.nascimento || "Nao informada"
        });
      }
      if (resultados.length >= 20) break;
    }
    return res.json({ status: "sucesso", resultados });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 4. dadosPaciente
exports.dadosPaciente = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const id = req.query.id;
  if (!id) return res.status(400).json({ status: "erro", mensagem: "id obrigatorio" });

  try {
    const doc = await db.collection("pacientes").doc(id).get();
    if (!doc.exists) return res.status(404).json({ status: "erro", mensagem: "Nao encontrado" });

    const p = doc.data();
    const end = p.endereco || {};

    // 1. Campo informacoesChegada (Logística de Chegada)
    const informacoesChegada = String(end.logisticaChegada || p.logisticaChegada || "").trim();

    // 2. Histórico da aba "Inf. Clínica" (ocorrencias)
    const listaOcorrencias = Array.isArray(p.ocorrencias) ? p.ocorrencias : [];

    const informacoesClinicas = listaOcorrencias
      .map(item => {
        // Formatar data para DD/MM/AAAA se vier em YYYY-MM-DD
        let dataFmt = item.data || "";
        if (dataFmt.includes("-")) {
          const partes = dataFmt.split("T")[0].split("-");
          if (partes.length === 3) {
            dataFmt = `${partes[2].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[0]}`;
          }
        }

        const profNome = item.profissionalNome || item.nomeProfissional || "";
        const profissional = profNome.trim() ? profNome.trim() : "Nenhum";
        const descricao = String(item.descricao || item.relato || item.motivo || "").trim();
        const status = item.status || (item.bloquearProfissional ? "Bloqueado" : "Registrado");

        // Timestamp para ordenação decrescente
        let rawDate = item.data || "";
        let timeVal = new Date(rawDate).getTime();
        if (isNaN(timeVal)) timeVal = 0;

        return {
          data: dataFmt,
          profissional,
          descricao,
          status,
          _time: timeVal
        };
      })
      .sort((a, b) => b._time - a._time)
      .map(({ _time, ...resto }) => resto);

    return res.json({
      status: "sucesso",
      paciente: {
        id: doc.id,
        nomeCompleto: p.nome || "Sem Nome",
        dataNascimento: p.dataNascimento || p.nascimento || "Nao informada",
        endereco: {
          logradouro: end.rua || end.logradouro || "",
          numero: end.numero || "",
          complemento: end.complemento || "",
          bairro: end.bairro || p.bairro || "",
          cidade: end.cidade || "Rio de Janeiro",
          uf: end.estado || end.uf || "RJ",
          cep: end.cep || ""
        },
        informacoesChegada,
        informacoesClinicas
      }
    });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 5. buscarFatura
exports.buscarFatura = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const termoNumero = norm(req.query.numero);
  const termoPaciente = norm(req.query.paciente);
  const termoMes = req.query.mes ? String(req.query.mes).trim() : "";
  const termoValor = req.query.valor ? Number(req.query.valor) : null;

  try {
    const snap = await db.collection("faturas_pacientes").get();
    const resultados = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      const numFat = d.numeroFatura || doc.id;
      const pacNome = d.nomePaciente || d.pacienteNome || "";
      const dtEmissao = d.dataEmissao || "";
      const vlrTotal = Number(d.valorTotal ?? 0);
      const itens = extrairListaItensTrabalhados(d);

      let corresponde = true;
      if (termoNumero && !norm(numFat).includes(termoNumero)) corresponde = false;
      if (termoPaciente && !norm(pacNome).includes(termoPaciente)) corresponde = false;
      if (termoMes && !dtEmissao.includes(termoMes)) corresponde = false;
      if (termoValor !== null && Math.abs(vlrTotal - termoValor) > 1.0) corresponde = false;

      if (corresponde) {
        resultados.push({
          id: doc.id,
          numeroFatura: numFat,
          paciente: pacNome,
          dataEmissao: formatarDataBR(dtEmissao),
          valorTotal: vlrTotal,
          valorFormatado: formatarMoeda(vlrTotal),
          status: d.statusPagamento || d.status || "Aberta",
          quantidadePlantoes: itens.length
        });
      }
      if (resultados.length >= 20) break;
    }

    return res.json({ status: "sucesso", totalEncontrado: resultados.length, resultados });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 6. dadosFatura
exports.dadosFatura = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const id = req.query.id;
  if (!id) return res.status(400).json({ status: "erro", mensagem: "id obrigatorio" });

  try {
    let docFat = await db.collection("faturas_pacientes").doc(id).get();
    if (!docFat.exists) {
      const snap = await db.collection("faturas_pacientes").where("numeroFatura", "==", id).limit(1).get();
      if (!snap.empty) docFat = snap.docs[0];
    }

    if (!docFat || !docFat.exists) {
      return res.status(404).json({ status: "erro", mensagem: "Fatura nao encontrada" });
    }

    const d = docFat.data();
    const itens = extrairListaItensTrabalhados(d);

    return res.json({
      status: "sucesso",
      fatura: {
        id: docFat.id,
        numeroFatura: d.numeroFatura || docFat.id,
        paciente: d.nomePaciente || d.pacienteNome || "Paciente Geral",
        dataEmissao: formatarDataBR(d.dataEmissao),
        status: d.statusPagamento || d.status || "Aberta",
        valorTotal: Number(d.valorTotal ?? 0),
        valorFormatado: formatarMoeda(d.valorTotal),
        quantidadePlantoes: itens.length,
        itens: itens.map(i => {
          const vlr = calcularValorItem(i);
          let nomeServico = "Plantão 24h";
          if (i.tipoDia && i.tipoDia.toLowerCase().includes("feriado")) {
            nomeServico = "Plantão 24h - Feriado 20%";
          } else if (i.tipoDia && i.tipoDia !== "Normal") {
            nomeServico = `Plantão 24h - ${i.tipoDia}`;
          } else if (i.servico) {
            nomeServico = i.servico;
          }
          return {
            data: formatarDataBR(i.data),
            horario: i.horario || "08:00-08:00",
            profissional: i.nomeProfissional || i.profissional || "-",
            servico: nomeServico,
            valor: vlr,
            valorFormatado: formatarMoeda(vlr)
          };
        })
      }
    });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 7. baixarFatura (Dimensionada para caber em 1 página com até 31 plantões)
exports.baixarFatura = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const id = req.query.id;
  if (!id) return res.status(400).json({ status: "erro", mensagem: "id obrigatorio" });

  try {
    let docFat = await db.collection("faturas_pacientes").doc(id).get();
    if (!docFat.exists) {
      const snap = await db.collection("faturas_pacientes").where("numeroFatura", "==", id).limit(1).get();
      if (!snap.empty) docFat = snap.docs[0];
    }

    if (!docFat || !docFat.exists) {
      return res.status(404).json({ status: "erro", mensagem: "Fatura nao encontrada" });
    }

    const fat = docFat.data();
    const itens = extrairListaItensTrabalhados(fat);
    const PDFDocument = require("pdfkit");
    
    // Margens compactas para garantir folha única
    const docPdf = new PDFDocument({ size: "A4", margin: 28, bufferPages: true });
    const chunks = [];

    docPdf.on("data", c => chunks.push(c));
    docPdf.on("end", () => {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=Fatura_" + (fat.numeroFatura || id) + ".pdf");
      res.status(200).send(Buffer.concat(chunks));
    });

    const drawHeader = () => {
      docPdf.fontSize(9.5).font("Helvetica-Bold").fillColor("#1a1a1a").text("VALLIDARE GESTAO MEDICA E AUDITORIA EIRELI", 28, 24);
      docPdf.fontSize(7.5).font("Helvetica").fillColor("#444444").text("CNPJ: 27.770.797/0001-62", 28, 36);
      docPdf.text("Endereço: Rua Martins Ferreira, 71 Botafogo / Rio de Janeiro", 28, 46);

      // Bloco do Paciente
      docPdf.rect(28, 58, 539, 32).fillColor("#f4f7f6").fill();
      docPdf.fontSize(7).font("Helvetica-Bold").fillColor("#00695c").text("DADOS DA FATURA E PACIENTE", 34, 62);
      
      docPdf.fontSize(7.5).font("Helvetica").fillColor("#222222");
      docPdf.text("Emissão: " + formatarDataBR(fat.dataEmissao) + " | Status: " + (fat.statusPagamento || fat.status || "Aberta"), 34, 71);
      docPdf.text("Paciente: " + (fat.nomePaciente || fat.pacienteNome || "Paciente Geral") + " | Valor Total: " + formatarMoeda(fat.valorTotal), 34, 80);

      // Bloco da Fatura
      docPdf.rect(430, 58, 137, 32).fillColor("#e0f2f1").fill();
      docPdf.fontSize(7).font("Helvetica-Bold").fillColor("#00695c").text("FATURA", 436, 62);
      docPdf.fontSize(8.5).font("Helvetica-Bold").fillColor("#1a1a1a").text("Nº: " + (fat.numeroFatura || docFat.id), 436, 73);

      // Cabeçalho da Tabela
      let yHead = 96;
      docPdf.rect(28, yHead, 539, 16).fillColor("#004d40").fill();
      docPdf.fontSize(7.5).font("Helvetica-Bold").fillColor("#ffffff");
      docPdf.text("Data", 34, yHead + 4);
      docPdf.text("Profissional", 95, yHead + 4);
      docPdf.text("Serviço", 310, yHead + 4);
      docPdf.text("Valor", 485, yHead + 4, { align: "right", width: 75 });
    };

    drawHeader();
    let y = 117;
    const linhaAltura = 13.5; // Espaçamento compacto que cabe 31 plantões na folha 1

    for (const item of itens) {
      if (y > 780) {
        docPdf.addPage();
        drawHeader();
        y = 117;
      }

      docPdf.fontSize(7).font("Helvetica").fillColor("#2b2b2b");
      docPdf.text(formatarDataBR(item.data), 34, y);
      docPdf.text(item.nomeProfissional || item.profissional || "-", 95, y, { width: 210 });
      
      let serv = "Plantão 24h";
      if (item.tipoDia && item.tipoDia.toLowerCase().includes("feriado")) {
        serv = "Plantão 24h - Feriado 20%";
      } else if (item.tipoDia && item.tipoDia !== "Normal") {
        serv = `Plantão 24h - ${item.tipoDia}`;
      } else if (item.servico) {
        serv = item.servico;
      }
      docPdf.text(serv, 310, y, { width: 155 });

      const vlr = calcularValorItem(item);
      docPdf.text(formatarMoeda(vlr), 485, y, { align: "right", width: 75 });

      y += linhaAltura;
      docPdf.moveTo(28, y - 2).lineTo(567, y - 2).strokeColor("#eceff1").lineWidth(0.5).stroke();
    }

    // Bloco do Total
    y += 5;
    if (y > 770) { docPdf.addPage(); drawHeader(); y = 117; }
    docPdf.rect(387, y, 180, 22).fillColor("#004d40").fill();
    docPdf.fontSize(8.5).font("Helvetica-Bold").fillColor("#ffffff").text("TOTAL: " + formatarMoeda(fat.valorTotal), 392, y + 6, { align: "center", width: 170 });

    // Rodapé oficial
    const range = docPdf.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      docPdf.switchToPage(i);
      docPdf.fontSize(7).font("Helvetica").fillColor("#777777")
        .text(`VALLIDARE GESTAO MEDICA E AUDITORIA EIRELI   Página ${i + 1} de ${range.count}`, 28, 815, { align: "center", width: 539 });
    }

    docPdf.end();
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 8. solicitarCracha
exports.solicitarCracha = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  if (!auth(req, res)) return;
  const { nomeFuncionario } = req.body;
  if (!nomeFuncionario) return res.status(400).json({ erro: "Campo obrigatorio" });
  const ref = await db.collection("solicitacoes_cracha").add({
    nomeFuncionario,
    status: "pendente",
    criadoEm: admin.firestore.FieldValue.serverTimestamp()
  });
  return res.status(201).json({ status: "sucesso", idSolicitacao: ref.id });
});



// ==========================================
// FUNÇÕES DE ESCRITA - ASSISTENTE VAL
// ==========================================

// Helper para formatar a resposta no mesmo padrão de dadosPaciente
function formatarRespostaPaciente(id, p) {
  const end = p.endereco || {};
  const informacoesChegada = String(end.logisticaChegada || p.logisticaChegada || "").trim();
  const listaOcorrencias = Array.isArray(p.ocorrencias) ? p.ocorrencias : [];

  const informacoesClinicas = listaOcorrencias
    .map(item => {
      let dataFmt = item.data || "";
      if (dataFmt.includes("-")) {
        const partes = dataFmt.split("T")[0].split("-");
        if (partes.length === 3) {
          dataFmt = `${partes[2].padStart(2, "0")}/${partes[1].padStart(2, "0")}/${partes[0]}`;
        }
      }
      const profNome = item.profissionalNome || item.nomeProfissional || "";
      const profissional = profNome.trim() ? profNome.trim() : "Nenhum";
      const descricao = String(item.descricao || item.relato || item.motivo || "").trim();
      const status = item.status || (item.bloquearProfissional ? "Bloqueado" : "Registrado");
      let rawDate = item.data || "";
      let timeVal = new Date(rawDate).getTime();
      if (isNaN(timeVal)) timeVal = 0;
      return { data: dataFmt, profissional, descricao, status, _time: timeVal };
    })
    .sort((a, b) => b._time - a._time)
    .map(({ _time, ...resto }) => resto);

  return {
    id: id,
    nomeCompleto: p.nome || "Sem Nome",
    dataNascimento: p.dataNascimento || p.nascimento || "Nao informada",
    endereco: {
      logradouro: end.rua || end.logradouro || "",
      numero: end.numero || "",
      complemento: end.complemento || "",
      bairro: end.bairro || p.bairro || "",
      cidade: end.cidade || "Rio de Janeiro",
      uf: end.estado || end.uf || "RJ",
      cep: end.cep || ""
    },
    informacoesChegada,
    informacoesClinicas
  };
}

// 1. POST atualizarEnderecoPaciente
exports.atualizarEnderecoPaciente = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  if (!auth(req, res)) return;

  const body = req.body || {};
  const id = body.id;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ status: "erro", mensagem: "id é obrigatório" });
  }

  try {
    const docRef = db.collection("pacientes").doc(id.trim());
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ status: "erro", mensagem: "Paciente não encontrado" });
    }

    const p = doc.data();
    const endAtual = Object.assign({}, p.endereco || {});
    const alteracoes = [];

    // Tratar campos de endereço
    if (body.endereco && typeof body.endereco === "object") {
      const novosCampos = body.endereco;
      
      const mapaCampos = [
        { chaveCorpo: "logradouro", chaveBanco: "rua", label: "Logradouro" },
        { chaveCorpo: "numero", chaveBanco: "numero", label: "Número" },
        { chaveCorpo: "complemento", chaveBanco: "complemento", label: "Complemento" },
        { chaveCorpo: "bairro", chaveBanco: "bairro", label: "Bairro" },
        { chaveCorpo: "cidade", chaveBanco: "cidade", label: "Cidade" },
        { chaveCorpo: "uf", chaveBanco: "estado", label: "UF" },
        { chaveCorpo: "cep", chaveBanco: "cep", label: "CEP" }
      ];

      mapaCampos.forEach(({ chaveCorpo, chaveBanco, label }) => {
        if (novosCampos[chaveCorpo] !== undefined && novosCampos[chaveCorpo] !== null) {
          const valAntigo = String(endAtual[chaveBanco] || endAtual[chaveCorpo] || "").trim();
          const valNovo = String(novosCampos[chaveCorpo]).trim();
          if (valAntigo !== valNovo) {
            alteracoes.push(`${label}: "${valAntigo}" -> "${valNovo}"`);
            endAtual[chaveBanco] = valNovo;
            if (chaveBanco === "rua") endAtual.logradouro = valNovo;
            if (chaveBanco === "estado") endAtual.uf = valNovo;
          }
        }
      });
    }

    // Tratar informações de chegada / logística
    if (body.informacoesChegada !== undefined && body.informacoesChegada !== null) {
      const textoChegadaNovo = String(body.informacoesChegada).trim();
      const textoChegadaAtual = String(endAtual.logisticaChegada || p.logisticaChegada || "").trim();
      const modo = (body.modoChegada || "acrescentar").toLowerCase().trim();

      let textoFinal = "";
      if (modo === "substituir") {
        textoFinal = textoChegadaNovo;
        alteracoes.push(`Logística de Chegada (substituição): "${textoChegadaAtual}" -> "${textoFinal}"`);
      } else {
        textoFinal = textoChegadaAtual ? `${textoChegadaAtual}\\n${textoChegadaNovo}` : textoChegadaNovo;
        alteracoes.push(`Logística de Chegada (acrescentado): "${textoChegadaNovo}"`);
      }
      endAtual.logisticaChegada = textoFinal;
    }

    if (alteracoes.length === 0) {
      return res.json({
        status: "sucesso",
        mensagem: "Nenhuma alteração necessária",
        paciente: formatarRespostaPaciente(doc.id, p)
      });
    }

    // Atualizar no Firestore
    await docRef.update({
      endereco: endAtual,
      updatedAt: new Date().toISOString()
    });

    // Registrar auditoria
    await db.collection("LogsAuditoria").add({
      documentId: doc.id,
      collection: "pacientes",
      userId: "Val (assistente)",
      action: "UPDATE",
      description: `Atualização de Endereço/Logística: ${alteracoes.join("; ")}`,
      timestamp: new Date().toISOString()
    });

    // Buscar dados atualizados
    const docAtualizado = await docRef.get();
    return res.json({
      status: "sucesso",
      paciente: formatarRespostaPaciente(doc.id, docAtualizado.data())
    });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 2. POST adicionarInformacaoClinica
exports.adicionarInformacaoClinica = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ erro: "Use POST" });
  if (!auth(req, res)) return;

  const body = req.body || {};
  const id = body.id;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ status: "erro", mensagem: "id é obrigatório" });
  }

  const descricao = body.descricao;
  if (!descricao || typeof descricao !== "string" || !descricao.trim()) {
    return res.status(400).json({ status: "erro", mensagem: "descricao é obrigatória e não pode ser vazia" });
  }

  try {
    const docRef = db.collection("pacientes").doc(id.trim());
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ status: "erro", mensagem: "Paciente não encontrado" });
    }

    const p = doc.data();
    const ocorrenciasAtuais = Array.isArray(p.ocorrencias) ? [...p.ocorrencias] : [];

    // Tratar data (padrão hoje no fuso America/Sao_Paulo)
    let dataFormatada = "";
    if (body.data && typeof body.data === "string" && body.data.trim()) {
      dataFormatada = body.data.trim();
    } else {
      const agoraSP = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(new Date());
      dataFormatada = agoraSP;
    }

    // Converter para formato YYYY-MM-DD para salvar no array de ocorrencias mantendo padrão do banco
    let dataIso = "";
    if (dataFormatada.includes("/")) {
      const [dia, mes, ano] = dataFormatada.split("/");
      dataIso = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    } else {
      dataIso = dataFormatada;
    }

    const profissional = (body.profissional && String(body.profissional).trim())
      ? String(body.profissional).trim()
      : "Administrativa / Geral";

    const novoIdOcorrencia = `oco-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const novoRegistroBanco = {
      id: novoIdOcorrencia,
      data: dataIso,
      profissionalId: "",
      profissionalNome: profissional,
      descricao: descricao.trim(),
      bloquearProfissional: false,
      status: "Registrado"
    };

    ocorrenciasAtuais.push(novoRegistroBanco);

    // Gravar no paciente
    await docRef.update({
      ocorrencias: ocorrenciasAtuais,
      updatedAt: new Date().toISOString()
    });

    // Registrar na coleção LogsAuditoria
    const resumoDescricao = descricao.trim().length > 60 
      ? descricao.trim().substring(0, 60) + "..." 
      : descricao.trim();

    await db.collection("LogsAuditoria").add({
      documentId: doc.id,
      collection: "pacientes",
      userId: "Val (assistente)",
      action: "UPDATE",
      description: `Nova Informação Clínica adicionada (Data: ${dataFormatada}, Profissional: ${profissional}): "${resumoDescricao}"`,
      timestamp: new Date().toISOString()
    });

    return res.json({
      status: "sucesso",
      registro: {
        data: dataFormatada,
        profissional: profissional,
        descricao: descricao.trim(),
        status: "Registrado"
      }
    });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});


// =====================================================================
// FUNÇÕES DE LEITURA ESTRITA DE BOLETOS (AGENTE)
// =====================================================================

// 8. buscarBoleto
exports.buscarBoleto = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const termoPaciente = norm(req.query.paciente);
  const faturaId = req.query.faturaId ? String(req.query.faturaId).trim() : "";

  try {
    let faturasDocs = [];

    if (faturaId) {
      const docDirect = await db.collection("faturas_pacientes").doc(faturaId).get();
      if (docDirect.exists) {
        faturasDocs.push(docDirect);
      }
    } else {
      const snap = await db.collection("faturas_pacientes").get();
      faturasDocs = snap.docs;
    }

    // Cache simples de pacientes para enriquecer com responsavelFinanceiro
    const pacientesSnap = await db.collection("pacientes").get();
    const pacientesMap = new Map();
    pacientesSnap.forEach(pDoc => {
      pacientesMap.set(pDoc.id, pDoc.data());
    });

    const resultados = [];

    for (const doc of faturasDocs) {
      const d = doc.data();
      const pacNome = d.nomePaciente || d.pacienteNome || "";

      // Filtro por paciente se fornecido
      if (termoPaciente && !norm(pacNome).includes(termoPaciente)) {
        continue;
      }

      const cobranca = d.cobrancaInter || {};
      const nossoNum = d.nossoNumero || cobranca.nossoNumero || "";
      const codSol = d.codigoSolicitacao || cobranca.codigoSolicitacao || "";
      const linhaDig = d.linhaDigitavel || cobranca.linhaDigitavel || "";

      // Considera boleto se tiver nossoNumero, codigoSolicitacao ou linha digitavel
      if (!nossoNum && !codSol && !linhaDig) {
        continue;
      }

      // Formatacao do vencimento (DD/MM/AAAA)
      const rawVenc = d.dataVencimento || cobranca.dataVencimento || d.vencimento || "";
      let vencimentoFormatado = formatarDataBR(rawVenc);

      // Status
      const statusBoleto = d.situacaoInter || cobranca.status || d.statusPagamento || d.status || "Pendente";

      // Valor
      const valorTotal = Number(d.valorTotalFatura ?? d.valorTotal ?? 0);

      // Dados do Responsavel Financeiro do Paciente (se houver)
      const pacId = d.idPaciente || d.pacienteId || "";
      const pacData = pacientesMap.get(pacId) || Array.from(pacientesMap.values()).find(p => norm(p.nome) === norm(pacNome));

      let responsavelFinanceiro = null;
      if (pacData) {
        const respNome = pacData.nomeResponsavel || pacData.responsavelFinanceiro?.nome;
        const respTel = pacData.telefoneResponsavel || pacData.telefoneResponsavel2 || pacData.responsavelFinanceiro?.whatsapp || pacData.telefone;

        if (respNome || respTel) {
          const telLimpo = respTel ? String(respTel).replace(/\D/g, "") : "";
          responsavelFinanceiro = {
            nome: respNome || "Não informado",
            tratamento: "Sr./Sra.",
            whatsapp: telLimpo || ""
          };
        }
      }

      const itemBoleto = {
        id: doc.id,
        paciente: pacNome,
        faturaId: doc.id,
        numeroFatura: d.numeroFatura || doc.id,
        mesReferencia: d.mesReferencia || (d.dataEmissao ? String(d.dataEmissao).slice(0, 7) : ""),
        valor: valorTotal,
        vencimento: vencimentoFormatado,
        status: statusBoleto,
        linhaDigitavel: linhaDig,
        nossoNumero: nossoNum,
        codigoSolicitacao: codSol
      };

      if (responsavelFinanceiro) {
        itemBoleto.responsavelFinanceiro = responsavelFinanceiro;
      }

      resultados.push(itemBoleto);
    }

    // Ordenar do mais recente para o mais antigo pelo mesReferencia ou id
    resultados.sort((a, b) => {
      const mesA = String(a.mesReferencia || "");
      const mesB = String(b.mesReferencia || "");
      if (mesA !== mesB) return mesB.localeCompare(mesA);
      return String(b.numeroFatura).localeCompare(String(a.numeroFatura));
    });

    return res.json({ status: "sucesso", resultados });
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});

// 9. baixarBoleto
exports.baixarBoleto = functions.region("southamerica-east1").https.onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ erro: "Use GET" });
  if (!auth(req, res)) return;

  const id = req.query.id ? String(req.query.id).trim() : "";
  if (!id) return res.status(400).json({ status: "erro", mensagem: "id obrigatorio" });

  try {
    let faturaDoc = await db.collection("faturas_pacientes").doc(id).get();

    // Se nao achou por ID direto, tenta por nossoNumero ou codigoSolicitacao
    if (!faturaDoc.exists) {
      const qNosso = await db.collection("faturas_pacientes").where("nossoNumero", "==", id).limit(1).get();
      if (!qNosso.empty) {
        faturaDoc = qNosso.docs[0];
      } else {
        const qCod = await db.collection("faturas_pacientes").where("codigoSolicitacao", "==", id).limit(1).get();
        if (!qCod.empty) {
          faturaDoc = qCod.docs[0];
        }
      }
    }

    if (!faturaDoc || !faturaDoc.exists) {
      return res.status(404).json({ status: "erro", mensagem: "Boleto ainda não gerado" });
    }

    const d = faturaDoc.data();
    const pdfBase64 = d.pdfBase64 || d.cobrancaInter?.pdf || d.pdfBoleto || "";

    if (!pdfBase64) {
      return res.status(404).json({ status: "erro", mensagem: "Boleto ainda não gerado" });
    }

    const pdfBuffer = Buffer.from(pdfBase64.replace(/^data:application\/pdf;base64,/, ""), "base64");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="boleto_${d.nossoNumero || d.numeroFatura || id}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ status: "erro", mensagem: err.message });
  }
});


// =========================================================================
// SINCRONIZACAO ATIVA DE BOLETO (BANCO INTER V3)


// =========================================================================
// SINCRONIZACAO ATIVA DE BOLETO (BANCO INTER V3) - 2ND GEN
// =========================================================================
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { obterBearerToken, chamadaApiInter } = require("./inter-api");

exports.consultarStatusBoletoInter = onCall({ region: "southamerica-east1", secrets: ["INTER_CERT", "INTER_KEY", "INTER_CLIENT_ID", "INTER_CLIENT_SECRET"] }, async (request) => {
  const { codigoSolicitacao, nossoNumero, faturaId } = request.data || {};
  let codSol = (codigoSolicitacao || "").trim();
  let fatDocRef = null;

  try {
    // 1. Localizar o documento da fatura se faturaId foi enviado
    if (faturaId) {
      const doc = await db.collection("faturas_pacientes").doc(faturaId).get();
      if (doc.exists) {
        fatDocRef = doc.ref;
        const d = doc.data() || {};
        if (!codSol) {
          codSol = (d.codigoSolicitacao || d.cobrancaInter?.codigoSolicitacao || "").trim();
        }
      }
    }

    // 2. Se ainda nao temos o codigoSolicitacao mas temos o nossoNumero, buscar no Firestore
    if (!codSol && nossoNumero) {
      const q = await db.collection("faturas_pacientes").where("cobrancaInter.nossoNumero", "==", String(nossoNumero)).limit(1).get();
      if (!q.empty) {
        fatDocRef = q.docs[0].ref;
        codSol = (q.docs[0].data().codigoSolicitacao || q.docs[0].data().cobrancaInter?.codigoSolicitacao || "").trim();
      }
    }

    if (!codSol) {
      throw new HttpsError("invalid-argument", "Codigo de solicitacao (UUID) nao localizado para esta cobranca.");
    }

    // 3. Autenticar no Inter via mTLS e consultar cobranca v3
    const token = await obterBearerToken();
    const dadosInter = await chamadaApiInter("GET", `/cobranca/v3/cobrancas/${codSol}`, null, token);

    // 4. Mapear status retornado pelo Inter
    // Normalização aprofundada da API v3 do Inter
    const payloadReal = dadosInter.data || dadosInter;
    const cobranca = payloadReal.cobranca || payloadReal;

    const situacao = (cobranca.situacao || payloadReal.situacao || "").toUpperCase();
    const valorRecebido = Number(cobranca.valorTotalRecebido || payloadReal.valorTotalRecebido || 0);
    const temPagamento = Array.isArray(cobranca.pagamentos || payloadReal.pagamentos) && (cobranca.pagamentos || payloadReal.pagamentos).length > 0;

    let statusNormalizado = "pendente";

    if (["PAGO", "RECEBIDO", "LIQUIDADO", "COMPENSADO", "MARCADO_RECEBIDO"].includes(situacao) || valorRecebido > 0 || temPagamento) {
      statusNormalizado = "pago";
    } else if (["EXPIRADO", "CANCELADO", "BAIXADO"].includes(situacao)) {
      statusNormalizado = "vencido";
    }

    // 5. Atualizar Firestore de forma atomica
    if (fatDocRef && statusNormalizado === "pago") {
      await fatDocRef.update({
        status: "Pago",
        situacaoBoleto: situacao,
        dataPagamento: dadosInter.dataHoraSituacao || new Date().toISOString(),
        valorPago: dadosInter.valorTotalRecebido || dadosInter.cobranca?.valorTotalRecebido || null,
        atualizadoEm: new Date().toISOString()
      });
    } else if (fatDocRef) {
      await fatDocRef.update({
        situacaoBoleto: situacao,
        atualizadoEm: new Date().toISOString()
      });
    }

    return {
      sucesso: true,
      status: statusNormalizado,
      situacaoInter: situacao,
      codigoSolicitacao: codSol,
      dados: dadosInter
    };

  } catch (err) {
    console.error("[consultarStatusBoletoInter] Erro:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "Erro ao consultar Banco Inter.");
  }
});
