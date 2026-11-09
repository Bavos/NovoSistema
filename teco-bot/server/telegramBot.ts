/**
 * Gerenciador da conexão com o Telegram usando Telegraf em modo Long Polling.
 * Inclui filtro estrito de ALLOWED_CHAT_ID, chunking de mensagens longas (>4.096 chars)
 * e tratamento defensivo para execução contínua.
 */

import { Telegraf } from 'telegraf';
import { auditLogger } from './auditLogger.ts';
import { splitTelegramMessage } from './dateUtils.ts';
import { processTecoMessage } from './tecoAgent.ts';

export interface TelegramBotStatus {
  ativo: boolean;
  modo: 'long_polling';
  botUsername?: string;
  allowedChatId?: string;
  totalMensagensProcessadas: number;
  mensagensBloqueadas: number;
  ultimoErro?: string;
  iniciadoEm?: string;
}

class TelegramBotManager {
  private bot: Telegraf | null = null;
  private isRunning = false;
  private botUsername: string | undefined = undefined;
  private totalMensagensProcessadas = 0;
  private mensagensBloqueadas = 0;
  private ultimoErro: string | undefined = undefined;
  private iniciadoEm: string | undefined = undefined;

  getStatus(): TelegramBotStatus {
    return {
      ativo: this.isRunning,
      modo: 'long_polling',
      botUsername: this.botUsername,
      allowedChatId: process.env.ALLOWED_CHAT_ID?.trim(),
      totalMensagensProcessadas: this.totalMensagensProcessadas,
      mensagensBloqueadas: this.mensagensBloqueadas,
      ultimoErro: this.ultimoErro,
      iniciadoEm: this.iniciadoEm
    };
  }

  async start(): Promise<{ sucesso: boolean; mensagem: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

    if (!token) {
      this.ultimoErro = 'TELEGRAM_BOT_TOKEN não está definido no ambiente (.env).';
      console.warn(`[TecoBot] ${this.ultimoErro}`);
      return { sucesso: false, mensagem: this.ultimoErro };
    }

    if (this.isRunning && this.bot) {
      return { sucesso: true, mensagem: 'Bot já está em execução (Long Polling).' };
    }

    try {
      this.bot = new Telegraf(token);

      // Tratamento de erros do Telegraf
      this.bot.catch((err, ctx) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.ultimoErro = errorMsg;
        console.error(`[TecoBot] Erro no contexto do Telegram (Chat ${ctx.chat?.id}):`, errorMsg);
        auditLogger.addLog({
          channel: 'telegram',
          chatId: ctx.chat?.id.toString(),
          eventType: 'vpn_error',
          details: { error: `Erro no Telegraf: ${errorMsg}` }
        });
      });

      // Comando /start
      this.bot.start(async (ctx) => {
        const chatId = ctx.chat.id.toString();
        const allowedChatId = process.env.ALLOWED_CHAT_ID?.trim();

        if (allowedChatId && chatId !== allowedChatId) {
          this.mensagensBloqueadas++;
          auditLogger.addLog({
            channel: 'telegram',
            chatId,
            eventType: 'security_block',
            details: {
              messageSummary: `Tentativa de acesso não autorizada pelo Chat ID ${chatId} (${ctx.from?.first_name || 'Desconhecido'})`
            }
          });
          await ctx.reply('🔒 Acesso restrito. Este assistente é de uso corporativo da RH Gestão Domiciliar.');
          return;
        }

        const msg = `Olá! Sou o **Teco**, assistente administrativo da **RH Gestão Domiciliar**.\n\n` +
          `Posso consultar em tempo real:\n` +
          `• 📅 **Escalas**: "Quem está no plantão de hoje?", "Quais as escalas da Dona Helena?"\n` +
          `• 👤 **Cadastros**: "Consulte o cadastro da enfermeira Juliana", "Dados do convênio Bradesco"\n` +
          `• 💰 **Faturamento**: "Como está o faturamento da competência 10/2026?", "Quais faturas estão pendentes?"\n\n` +
          `Como posso te ajudar agora?`;

        await ctx.replyWithMarkdown(msg).catch(() => ctx.reply(msg.replace(/\*/g, '')));
      });

      // Comando /status
      this.bot.command('status', async (ctx) => {
        const chatId = ctx.chat.id.toString();
        const allowedChatId = process.env.ALLOWED_CHAT_ID?.trim();
        if (allowedChatId && chatId !== allowedChatId) return;

        const uptime = process.uptime();
        const mins = Math.floor(uptime / 60);
        await ctx.reply(`🟢 Teco Online\n• Modo: Long Polling\n• Uptime: ${mins} minutos\n• Chat ID Autorizado: ${chatId}\n• Conexão RH Gestão Domiciliar: Operacional`);
      });

      // Handler para todas as mensagens de texto
      this.bot.on('text', async (ctx) => {
        const chatId = ctx.chat.id.toString();
        const allowedChatId = process.env.ALLOWED_CHAT_ID?.trim();
        const userText = ctx.message.text;

        // FILTRO DE SEGURANÇA: Responde apenas ao CHAT_ID autorizado
        if (allowedChatId && chatId !== allowedChatId) {
          this.mensagensBloqueadas++;
          auditLogger.addLog({
            channel: 'telegram',
            chatId,
            eventType: 'security_block',
            details: {
              messageSummary: `Mensagem bloqueada do Chat ID ${chatId}: "${userText.slice(0, 80)}"`
            }
          });

          await ctx.reply('🔒 Acesso restrito. Seu Chat ID não tem permissão para consultar dados da RH Gestão Domiciliar.');
          return;
        }

        this.totalMensagensProcessadas++;

        // Envia ação de "digitando..." enquanto consulta o Gemini e a API
        await ctx.sendChatAction('typing').catch(() => {});

        try {
          const tecoRes = await processTecoMessage(userText, 'telegram', chatId);

          // TRATAMENTO DE LIMITE DE 4.096 CARACTERES DO TELEGRAM:
          // Divide a resposta em múltiplos blocos caso ultrapasse ~4.000 caracteres
          const chunks = splitTelegramMessage(tecoRes.texto, 4000);

          for (const chunk of chunks) {
            try {
              // Tenta enviar com markdown para boa legibilidade
              await ctx.replyWithMarkdown(chunk);
            } catch {
              // Se o Markdown contiver caracteres especiais desbalanceados do Telegram, faz fallback para texto puro
              await ctx.reply(chunk);
            }
          }
        } catch (procErr: unknown) {
          const errMsg = procErr instanceof Error ? procErr.message : String(procErr);
          this.ultimoErro = errMsg;
          console.error('[TecoBot] Falha ao processar mensagem:', errMsg);
          await ctx.reply(`Desculpe, ocorreu uma falha técnica ao consultar as informações: ${errMsg}`);
        }
      });

      // Valida o token e obtém as informações do bot antes de iniciar o polling
      console.log('[TecoBot] Validando credenciais do Telegram...');
      const me = await this.bot.telegram.getMe();
      this.botUsername = me.username;
      this.isRunning = true;
      this.iniciadoEm = new Date().toISOString();
      this.ultimoErro = undefined;

      // Inicia o loop de Long Polling em segundo plano (não bloqueia a thread do Express)
      this.bot.launch({
        dropPendingUpdates: true
      }).catch((launchErr: unknown) => {
        const errMsg = launchErr instanceof Error ? launchErr.message : String(launchErr);
        this.isRunning = false;
        this.ultimoErro = errMsg;
        console.error('[TecoBot] Erro no loop de polling do Telegram:', errMsg);
      });

      console.log(`[TecoBot] Conectado com sucesso como @${this.botUsername}! Polling ativo.`);
      return { sucesso: true, mensagem: `Bot conectado como @${this.botUsername}` };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.isRunning = false;
      this.ultimoErro = errMsg;
      console.error('[TecoBot] Erro ao conectar ao Telegram:', errMsg);
      return { sucesso: false, mensagem: errMsg };
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      try {
        this.bot.stop();
      } catch (e) {
        console.warn('[TecoBot] Erro ao interromper bot:', e);
      }
    }
    this.bot = null;
    this.isRunning = false;
  }
}

export const telegramBot = new TelegramBotManager();
