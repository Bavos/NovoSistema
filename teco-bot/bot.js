import { Telegraf } from "telegraf";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const { TELEGRAM_BOT_TOKEN, GEMINI_API_KEY, AGENT_API_TOKEN, ALLOWED_TELEGRAM_ID } = process.env;

if (!TELEGRAM_BOT_TOKEN || !GEMINI_API_KEY) {
  console.error("❌ Faltam variáveis obrigatórias no .env");
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const CANDIDATE_MODELS = [
  "gemini-3.8-flash"
];

function sanitizarNomeArquivo(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

const tools = [
  {
    functionDeclarations: [
      {
        name: "buscarPaciente",
        description: "Busca pacientes pelo nome para retornar uma lista com os IDs e nomes correspondentes.",
        parameters: {
          type: "OBJECT",
          properties: {
            nome: { type: "STRING", description: "Nome ou parte do nome do paciente" }
          },
          required: ["nome"]
        }
      },
      {
        name: "dadosPaciente",
        description: "Obtém os dados cadastrais completos, endereço e ocorrências clínicas de um paciente através do ID exato.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "ID único do paciente" }
          },
          required: ["id"]
        }
      },
      {
        name: "buscarFuncionario",
        description: "Busca cuidadores, enfermeiros e profissionais da equipe pelo nome para retornar o ID, função/especialidade e paciente/setor vinculado.",
        parameters: {
          type: "OBJECT",
          properties: {
            nome: { type: "STRING", description: "Nome ou parte do nome do profissional/cuidador" }
          },
          required: ["nome"]
        }
      },
      {
        name: "baixarCracha",
        description: "Baixa o PDF do crachá de identificação funcional do cuidador/profissional e envia direto no chat do Telegram.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "ID do profissional no Firestore" },
            nomeProfissional: { type: "STRING", description: "Nome do profissional para nomear o arquivo PDF" }
          },
          required: ["id"]
        }
      },
      {
        name: "buscarFatura",
        description: "Localiza faturas na base de faturas_pacientes por nome do paciente, mês ou valor.",
        parameters: {
          type: "OBJECT",
          properties: {
            paciente: { type: "STRING", description: "Nome do paciente" },
            mes: { type: "STRING", description: "Mês numérico ou textual" },
            valor: { type: "NUMBER", description: "Valor aproximado se aplicável" }
          }
        }
      },
      {
        name: "dadosFatura",
        description: "Obtém o demonstrativo completo de uma fatura da RH Gestão Domiciliar: discriminação de plantões, cuidadores, turnos, datas e valor total.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "ID ou número da fatura no Firestore" }
          },
          required: ["id"]
        }
      },
      {
        name: "baixarFatura",
        description: "Baixa o arquivo PDF do Demonstrativo de Fatura de Serviços da RH Gestão Domiciliar e envia com o nome legível do paciente no chat.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "ID da fatura no Firestore" },
            paciente: { type: "STRING", description: "Nome do paciente para nomear o arquivo PDF" },
            mesAno: { type: "STRING", description: "Mês ou competência (ex: Outubro_2026)" }
          },
          required: ["id"]
        }
      },
      {
        name: "consultarBoletoVall",
        description: "Consulta a situação financeira e liquidação do boleto bancário de cobrança no Banco Inter.",
        parameters: {
          type: "OBJECT",
          properties: {
            faturaId: { type: "STRING", description: "ID da fatura interna" },
            nossoNumero: { type: "STRING", description: "Nosso Número do boleto bancário" },
            codigoSolicitacao: { type: "STRING", description: "UUID da cobrança no Inter" }
          }
        }
      },
      {
        name: "baixarBoleto",
        description: "Baixa o arquivo PDF do boleto bancário emitido no Banco Inter e envia com o nome legível do paciente no chat.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "ID da fatura ou nossoNumero do boleto" },
            paciente: { type: "STRING", description: "Nome do paciente para nomear o arquivo PDF" },
            mesAno: { type: "STRING", description: "Mês ou competência (ex: Outubro_2026)" }
          },
          required: ["id"]
        }
      }
    ]
  }
];

const SYSTEM_INSTRUCTIONS = `Você é o Teco, assistente operacional e financeiro oficial da RH Gestão Domiciliar.

1. PROFISSIONAIS E CUIDADORES:
- Quando o operador perguntar sobre um cuidador ou profissional (ex: "quem é a cuidadora Maria", "buscar profissional"):
  • Execute buscarFuncionario pelo nome informado.
  • Apresente a lista de forma organizada:
    👩‍⚕️ *Profissional:* [nomeCompleto]
    • *Função:* [funcao]
    • *Alocação:* [pacienteOuSetor]
    • *Crachá Disponível:* [Sim / Não]
  • Se o profissional tiver crachá disponível (temCracha: true), pergunte:
    "Deseja que eu envie o PDF do crachá funcional deste profissional?"
- Se o operador pedir o crachá: execute baixarCracha com o ID e o nome do profissional.

2. PACIENTES:
- buscarPaciente -> dadosPaciente para ficha completa e endereço.

3. FATURAS E BOLETOS (DISTINÇÃO ESTRITA):
- Fatura (Demonstrativo): buscarFatura -> dadosFatura. Download via baixarFatura.
- Boleto (Banco Inter): consultarBoletoVall. Download via baixarBoleto.
- Sempre nomeie os arquivos PDF com o nome do paciente/profissional.


DIRETRIZES DE VALORES, PLANTOES E PRECIFICAÇÃO:
1. COMPOSICAO DE CUSTOS E VALORES:
   - Todo plantao possui 4 componentes:
     a) Valor do Profissional (diaria liquida / repasse da cuidadora/tecnica).
     b) Auxilio Transporte (pago ao profissional para deslocamento).
     c) Auxilio Alimentacao (refeicao paga ao profissional ou fornecida).
     d) Taxa Administrativa (gestao, supervisao e suporte da agencia RH).
   - O VALOR COBRADO DO CLIENTE/FATURA e o valor global acordado que engloba a operacao.

2. DIFERENCIACAO CLARA DE INTENCAO:
   - Se o usuario perguntar: "Quanto ganha a profissional?", "Qual o repasse?", ou "Qual o valor da cuidadora?":
     -> Informe estritamente os componentes de repasse (Diaria + Transporte + Alimentacao).
   - Se o usuario perguntar: "Qual o valor na fatura?", "Quanto cobra do cliente?", ou "Qual o valor cobrado?":
     -> Informe o valor total cobrado do cliente.
   - Se a pergunta for generica ("Qual e o valor do plantao na casa de X?"):
     -> NUNCA responda apenas um valor isolado. Discrimine a composicao no formato:

   "Na escala da paciente **[Nome]**, a estrutura de valores por plantao ([X]h) e:
   💰 **Repasse ao Profissional:**
   • Diaria do Profissional: R$ [Valor]
   • Auxilio Transporte: R$ [Valor]
   • Auxilio Alimentacao: R$ [Valor]
   *Total de Repasse:* R$ [Soma]

   🏢 **Gestao e Faturamento:**
   • Taxa Administrativa: R$ [Valor]
   • **Valor Total Cobrado (Cliente):** R$ [Valor Total]
   *(Valores referentes ao contrato ativo)*"
`;

async function executeGeminiWithFallback(requestParams) {
  let lastError = null;
  for (const modelName of CANDIDATE_MODELS) {
    try {
      requestParams.model = modelName;
      const resp = await ai.models.generateContent(requestParams);
      return resp;
    } catch (err) {
      lastError = err;
      const is503 = err?.status === 503 || err?.message?.includes("high demand") || err?.message?.includes("UNAVAILABLE");
      console.warn("⚠️ Modelo " + modelName + " falhou (" + (err?.status || err?.message) + "). Tentando próximo...");
      if (!is503) throw err;
      await new Promise(r => setTimeout(r, 600));
    }
  }
  throw lastError;
}

async function sendTelegramPdf(ctx, buffer, filename, caption) {
  const blob = new Blob([buffer], { type: "application/pdf" });
  const form = new FormData();
  form.append("chat_id", String(ctx.chat.id));
  form.append("document", blob, filename);
  if (caption) form.append("caption", caption);

  const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: form
  });

  const tgJson = await tgRes.json();
  if (!tgJson.ok) {
    throw new Error(tgJson.description || "Erro Telegram API");
  }
}

async function executeTool(name, args, ctx) {
  const baseUrl = "https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net";
  const headers = { "Authorization": "Bearer " + AGENT_API_TOKEN };

  if (name === "buscarPaciente") {
    console.log("🔍 [Tool] buscarPaciente:", args.nome);
    const res = await fetch(baseUrl + "/buscarPaciente?nome=" + encodeURIComponent(args.nome || ""), { headers });
    return await res.json();
  }

  if (name === "dadosPaciente") {
    console.log("🔍 [Tool] dadosPaciente ID:", args.id);
    const res = await fetch(baseUrl + "/dadosPaciente?id=" + encodeURIComponent(args.id || ""), { headers });
    return await res.json();
  }

  if (name === "buscarFuncionario") {
    console.log("👩‍⚕️ [Tool] buscarFuncionario:", args.nome);
    const res = await fetch(baseUrl + "/buscarFuncionario?nome=" + encodeURIComponent(args.nome || ""), { headers });
    return await res.json();
  }

  if (name === "baixarCracha") {
    console.log("🪪 [Tool] baixarCracha:", JSON.stringify(args));
    try {
      const res = await fetch(baseUrl + "/baixarCracha?id=" + encodeURIComponent(args.id || ""), { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { status: "erro", mensagem: errJson.mensagem || "Falha ao baixar crachá" };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("image/") || contentType.includes("application/pdf")) {
        const arrayBuffer = await res.arrayBuffer();
        const nomeClean = sanitizarNomeArquivo(args.nomeProfissional || args.id);
        const isJpg = contentType.includes("image/");
    const nomeArquivo = `Cracha_${nomeClean}.${isJpg ? "jpg" : "pdf"}`;

        console.log(`📄 [Tool] Enviando Crachá ao Telegram como "${nomeArquivo}" (${arrayBuffer.byteLength} bytes)...`);
        await sendTelegramPdf(ctx, arrayBuffer, nomeArquivo, `🪪 Crachá Funcional - ${args.nomeProfissional || args.id}`);
        console.log("✅ [Tool] Crachá PDF enviado com sucesso!");
        return { status: "sucesso", mensagem: `PDF do crachá funcional (${nomeArquivo}) enviado com sucesso.` };
      }
      return await res.json().catch(() => ({ status: "erro" }));
    } catch (err) {
      console.error("❌ Exceção em baixarCracha:", err);
      return { status: "erro", mensagem: err.message };
    }
  }

  if (name === "buscarFatura") {
    console.log("📑 [Tool] buscarFatura:", JSON.stringify(args));
    const q = new URLSearchParams();
    if (args.paciente) q.append("paciente", args.paciente);
    if (args.mes) q.append("mes", args.mes);
    if (args.valor) q.append("valor", String(args.valor));
    const res = await fetch(baseUrl + "/buscarFatura?" + q.toString(), { headers });
    return await res.json();
  }

  if (name === "dadosFatura") {
    console.log("📋 [Tool] dadosFatura ID:", args.id);
    const res = await fetch(baseUrl + "/dadosFatura?id=" + encodeURIComponent(args.id || ""), { headers });
    return await res.json();
  }

  if (name === "baixarFatura") {
    console.log("📥 [Tool] baixarFatura:", JSON.stringify(args));
    try {
      const res = await fetch(baseUrl + "/baixarFatura?id=" + encodeURIComponent(args.id || ""), { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { status: "erro", mensagem: errJson.mensagem || "Falha ao baixar demonstrativo da fatura" };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("image/") || contentType.includes("application/pdf")) {
        const arrayBuffer = await res.arrayBuffer();
        const pacClean = sanitizarNomeArquivo(args.paciente || "Paciente");
        const mesClean = sanitizarNomeArquivo(args.mesAno || "");
        const nomeFinal = mesClean 
          ? `Fatura_${pacClean}_${mesClean}.pdf`
          : `Fatura_${pacClean}_${args.id}.pdf`;

        console.log(`📄 [Tool] Enviando Fatura ao Telegram como "${nomeFinal}" (${arrayBuffer.byteLength} bytes)...`);
        await sendTelegramPdf(ctx, arrayBuffer, nomeFinal, `📋 Demonstrativo da Fatura - ${args.paciente || args.id}`);
        console.log("✅ [Tool] Fatura PDF enviada com sucesso!");
        return { status: "sucesso", mensagem: `PDF do demonstrativo de fatura (${nomeFinal}) enviado com sucesso.` };
      }
      return await res.json().catch(() => ({ status: "erro" }));
    } catch (err) {
      console.error("❌ Exceção em baixarFatura:", err);
      return { status: "erro", mensagem: err.message };
    }
  }

  if (name === "consultarBoletoVall") {
    console.log("💳 [Tool] consultarBoletoVall:", JSON.stringify(args));
    const res = await fetch(baseUrl + "/consultarBoletoVall", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
    return await res.json();
  }

  if (name === "baixarBoleto") {
    console.log("📥 [Tool] baixarBoleto:", JSON.stringify(args));
    try {
      const res = await fetch(baseUrl + "/baixarBoleto?id=" + encodeURIComponent(args.id || ""), { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { status: "erro", mensagem: errJson.mensagem || "Falha ao baixar boleto bancário" };
      }

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/pdf")) {
        const arrayBuffer = await res.arrayBuffer();
        const pacClean = sanitizarNomeArquivo(args.paciente || "Paciente");
        const mesClean = sanitizarNomeArquivo(args.mesAno || "");
        const nomeFinal = mesClean 
          ? `Boleto_${pacClean}_${mesClean}.pdf`
          : `Boleto_${pacClean}_${args.id}.pdf`;

        console.log(`📄 [Tool] Enviando Boleto ao Telegram como "${nomeFinal}" (${arrayBuffer.byteLength} bytes)...`);
        await sendTelegramPdf(ctx, arrayBuffer, nomeFinal, `📄 Boleto Bancário Banco Inter - ${args.paciente || args.id}`);
        console.log("✅ [Tool] Boleto PDF enviado com sucesso!");
        return { status: "sucesso", mensagem: `Arquivo PDF do boleto bancário (${nomeFinal}) enviado com sucesso.` };
      }
      return await res.json().catch(() => ({ status: "erro" }));
    } catch (err) {
      console.error("❌ Exceção em baixarBoleto:", err);
      return { status: "erro", mensagem: err.message };
    }
  }

  return { status: "erro", mensagem: "Ferramenta não reconhecida." };
}

bot.use(async (ctx, next) => {
  if (ALLOWED_TELEGRAM_ID && String(ctx.from?.id) !== String(ALLOWED_TELEGRAM_ID)) return;
  return next();
});

bot.start((ctx) => {
  ctx.reply("Olá! Sou o Teco, assistente operacional e financeiro da RH Gestão Domiciliar.");
});

bot.on("text", async (ctx) => {
  const userMessage = ctx.message.text;
  console.log("\n💬 [Mensagem recebida]: \"" + userMessage + "\"");

  try {
    const chatHistory = [{ role: "user", parts: [{ text: userMessage }] }];

    let response = await executeGeminiWithFallback({
      contents: chatHistory,
      config: { systemInstruction: SYSTEM_INSTRUCTIONS, tools }
    });

    let candidate = response.candidates?.[0];
    let functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

    while (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0].functionCall;
      console.log("⚙️ [Tool Call]: Executando " + call.name + "(" + JSON.stringify(call.args) + ")");

      const toolResult = await executeTool(call.name, call.args, ctx);
      console.log("📥 [Tool Result]:", JSON.stringify(toolResult));

      chatHistory.push(candidate.content);
      chatHistory.push({
        role: "user",
        parts: [{ functionResponse: { name: call.name, response: toolResult } }]
      });

      response = await executeGeminiWithFallback({
        contents: chatHistory,
        config: { systemInstruction: SYSTEM_INSTRUCTIONS, tools }
      });

      candidate = response.candidates?.[0];
      functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);
    }

    const replyText = response.text || "Operação realizada com sucesso.";
    console.log("📤 Enviando resposta ao Telegram...");
    return ctx.reply(replyText, { parse_mode: "Markdown" }).catch(() => ctx.reply(replyText));

  } catch (err) {
    console.error("❌ Erro no processamento:", err);
    ctx.reply("Desculpe, ocorreu uma instabilidade temporária. Tente novamente em instantes.");
  }
});


bot.command("imagem", async (ctx) => {
  const prompt = ctx.message.text.replace(/^\/imagem\s*/i, "").trim();
  if (!prompt) return ctx.reply("💡 Envie uma descrição: /imagem idoso jogando xadrez");
  const statusMsg = await ctx.reply("🎨 Gerando imagem, aguarde...");
  await ctx.sendChatAction("upload_photo");
  try {
    const response = await ai.models.generateImages({
      model: "imagen-3.0-generate-002",
      prompt,
      config: { numberOfImages: 1, aspectRatio: "1:1", outputMimeType: "image/jpeg" }
    });
    const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, "base64");
    await ctx.replyWithPhoto({ source: buffer }, { caption: "🖼 " + prompt });
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(()=>{});
  } catch (err) {
    ctx.reply("❌ Erro: " + err.message);
  }
});

bot.launch().then(() => {
  console.log("🤖 [Teco] Conectado e com suporte a Profissionais e Crachás!");
});
