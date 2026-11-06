import { Telegraf } from 'telegraf';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const {
  TELEGRAM_BOT_TOKEN,
  ALLOWED_CHAT_ID,
  GEMINI_API_KEY,
  AGENT_API_TOKEN
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !GEMINI_API_KEY || !AGENT_API_TOKEN) {
  console.error('❌ ERRO: Verifique TELEGRAM_BOT_TOKEN, GEMINI_API_KEY e AGENT_API_TOKEN no arquivo .env');
  process.exit(1);
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const tools = [
  {
    functionDeclarations: [
      {
        name: 'consultarBoletoVall',
        description: 'Verifica em tempo real se uma fatura ou boleto bancário foi pago e liquidado no Banco Inter.',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigoSolicitacao: {
              type: 'STRING',
              description: 'UUID da cobranca no Banco Inter (ex: cde0b933-cb39-43de-bb7f-d028871454b6)'
            },
            faturaId: {
              type: 'STRING',
              description: 'Identificador da fatura interna (ex: FAT-202610-8854)'
            },
            nossoNumero: {
              type: 'STRING',
              description: 'Nosso Numero bancario da cobranca'
            }
          }
        }
      }
    ]
  }
];

const SYSTEM_INSTRUCTIONS = `Você é o Teco, assistente operacional e financeiro inteligente da Vallidare Gestão Médica e RH Gestão Domiciliar.

### DIRETRIZES DE PERSONALIDADE E CONDUTA:
1. Tom de voz: Cordial, objetivo, profissional, prestativo e seguro.
2. Seja proativo ao detalhar dados financeiros, informando sempre o valor nominal, valor liquidado e data da conciliação.
3. Não invente dados financeiros. Sempre que questionado sobre boletos, quitações ou compensações, utilize a ferramenta oficial consultarBoletoVall.

### POLÍTICA DE SEGURANÇA:
- Você opera em modo estritamente consultivo para o módulo financeiro.
- Você não possui permissão para emitir cobranças, alterar valores de contratos ou cancelar boletos no Banco Inter.`;

async function executeTool(name, args) {
  if (name === 'consultarBoletoVall') {
    try {
      console.log('📡 Chamando Cloud Function com argumentos:', args);
      const url = 'https://southamerica-east1-gen-lang-client-0242962167.cloudfunctions.net/consultarBoletoVall';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AGENT_API_TOKEN}`
        },
        body: JSON.stringify(args)
      });

      const data = await response.json();
      console.log('📥 Resposta da Cloud Function:', data);
      return data;
    } catch (err) {
      console.error('❌ Erro na requisição HTTP da Tool:', err);
      return { erro: 'Falha de comunicação com o serviço bancário.' };
    }
  }

  return { erro: 'Ferramenta desconhecida.' };
}

bot.use((ctx, next) => {
  const chatId = ctx.chat?.id?.toString();
  if (ALLOWED_CHAT_ID && chatId !== ALLOWED_CHAT_ID.toString()) {
    console.warn(`[Segurança] Chat não autorizado: ${chatId}`);
    return ctx.reply('Acesso não autorizado.');
  }
  return next();
});

bot.start((ctx) => {
  ctx.reply('Olá! Sou o Teco, assistente operacional e financeiro da Vallidare e RH Gestão Domiciliar. Como posso ajudar com conciliações bancárias ou escalas hoje?');
});

bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  await ctx.sendChatAction('typing');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTIONS,
        tools
      }
    });

    const candidate = response.candidates?.[0];
    const functionCalls = candidate?.content?.parts?.filter(p => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0].functionCall;
      console.log(`[Tool Call detectada]: ${toolCall.name}`);
      
      const toolResult = await executeTool(toolCall.name, toolCall.args || {});

      const finalResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: userMessage }] },
          candidate.content,
          {
            role: 'user',
            parts: [{
              functionResponse: {
                name: toolCall.name,
                response: toolResult
              }
            }]
          }
        ],
        config: { systemInstruction: SYSTEM_INSTRUCTIONS }
      });

      return ctx.reply(finalResponse.text);
    }

    ctx.reply(response.text || 'Entendido!');
  } catch (err) {
    console.error('❌ Erro no processamento:', err);
    ctx.reply('Desculpe, tive um problema ao consultar as informações.');
  }
});

bot.launch().then(() => {
  console.log('🤖 [Teco] Operacional conectado e pronto para consultas bancárias!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
