/**
 * Servidor Express e ponto de entrada da aplicação Teco RH Gestão Domiciliar.
 * Executa o bot Telegraf em segundo plano (Long Polling) e fornece rotas de API
 * para o painel de controle administrativo e simulador web integrado.
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { auditLogger } from './server/auditLogger.ts';
import {
  consultarCadastro,
  consultarEscalas,
  consultarFaturamento,
  getMockMode,
  setMockMode
} from './server/internalApiGateway.ts';
import { processTecoMessage } from './server/tecoAgent.ts';
import { telegramBot } from './server/telegramBot.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

// ==========================================
// ROTAS DE API DO PAINEL ADMINISTRATIVO
// ==========================================

// 1. Status Geral do Sistema (Telegram, Gemini, API/VPN, Variáveis)
app.get('/api/status', (_req: Request, res: Response) => {
  const telegramStatus = telegramBot.getStatus();

  res.json({
    sucesso: true,
    timestamp: new Date().toISOString(),
    servicos: {
      telegram: {
        ...telegramStatus,
        tokenConfigurado: Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim()),
        allowedChatId: process.env.ALLOWED_CHAT_ID?.trim() || null
      },
      gemini: {
        modelo: 'gemini-3.8-flash',
        apiKeyConfigurada: Boolean(process.env.GEMINI_API_KEY?.trim()),
        status: process.env.GEMINI_API_KEY?.trim() ? 'operacional' : 'chave_ausente'
      },
      apiInterna: {
        baseUrl: process.env.API_BASE_URL?.trim() || null,
        bearerTokenConfigurado: Boolean(process.env.INTERNAL_BEARER_TOKEN?.trim()),
        modoSimuladorAtivo: getMockMode(),
        statusVPN: getMockMode()
          ? 'simulador_ativo'
          : (process.env.API_BASE_URL ? 'conectando_rede_corporativa' : 'url_nao_definida')
      }
    }
  });
});

// 2. Simulador Web de Conversa com o Teco (permite testar no navegador)
app.post('/api/chat/simulate', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ sucesso: false, erro: 'Campo "message" obrigatório.' });
      return;
    }

    const startTime = Date.now();
    const result = await processTecoMessage(message, 'web_simulator', 'simulador-admin-web');
    const latencyMs = Date.now() - startTime;

    res.json({
      sucesso: true,
      texto: result.texto,
      toolCallsExecuted: result.toolCallsExecuted,
      latencyMs
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[API /chat/simulate] Erro:', errMsg);
    res.status(500).json({ sucesso: false, erro: errMsg });
  }
});

// 3. Auditoria de Logs de Chamadas e Erros de VPN
app.get('/api/logs', (_req: Request, res: Response) => {
  res.json({
    sucesso: true,
    logs: auditLogger.getLogs()
  });
});

app.post('/api/logs/clear', (_req: Request, res: Response) => {
  auditLogger.clearLogs();
  res.json({ sucesso: true, mensagem: 'Logs limpos com sucesso.' });
});

// 4. Alternador de Modo Simulado vs API Real (para testes com ou sem VPN)
app.post('/api/config/toggle-mock', (req: Request, res: Response) => {
  const current = getMockMode();
  const nextMode = typeof req.body.active === 'boolean' ? req.body.active : !current;
  setMockMode(nextMode);

  auditLogger.addLog({
    channel: 'system',
    eventType: 'user_message',
    details: {
      messageSummary: `Modo Mock alterado para: ${nextMode ? 'ATIVADO (Simulador Local)' : 'DESATIVADO (API Real VPN)'}`
    }
  });

  res.json({
    sucesso: true,
    modoSimuladorAtivo: nextMode,
    mensagem: nextMode
      ? 'Simulador local ativado. Consultas usarão dados em memória da RH Gestão Domiciliar.'
      : 'API Real ativada. Consultas serão direcionadas para API_BASE_URL via VPN corporativa.'
  });
});

// 5. Reiniciar conexão do bot Telegram
app.post('/api/bot/restart', async (_req: Request, res: Response) => {
  await telegramBot.stop();
  const resultado = await telegramBot.start();
  res.json(resultado);
});

// 6. Teste Rápido direto das 3 Funções
app.get('/api/test/funcoes', async (req: Request, res: Response) => {
  const { funcao } = req.query;

  try {
    if (funcao === 'escalas') {
      const resp = await consultarEscalas({ data_inicio: '2026-11-06' });
      res.json(resp);
      return;
    }
    if (funcao === 'cadastros') {
      const resp = await consultarCadastro({ tipo: 'paciente', termo_busca: 'Helena' });
      res.json(resp);
      return;
    }
    if (funcao === 'faturamento') {
      const resp = await consultarFaturamento({ competencia: '2026-10' });
      res.json(resp);
      return;
    }

    res.status(400).json({ erro: 'Parâmetro "funcao" inválido. Use "escalas", "cadastros" ou "faturamento".' });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ erro: errMsg });
  }
});

// ==========================================
// VITE DEV MIDDLEWARE OU BUILD STATIC SERVER
// ==========================================
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {}
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[Servidor] Teco RH Gestão Domiciliar rodando na porta ${port}`);
    console.log(`[Servidor] Modo: ${isProd ? 'Produção' : 'Desenvolvimento'}`);

    // Inicia o bot do Telegram em segundo plano sem bloquear o servidor
    if (process.env.TELEGRAM_BOT_TOKEN?.trim()) {
      telegramBot.start().then((result) => {
        if (result.sucesso) {
          console.log(`[TecoBot] ${result.mensagem}`);
        } else {
          console.warn(`[TecoBot] Não foi possível iniciar o Telegram: ${result.mensagem}`);
        }
      });
    } else {
      console.log('[TecoBot] TELEGRAM_BOT_TOKEN não informado. O bot pode ser testado pelo Simulador Web.');
    }
  });
}

startServer().catch((err) => {
  console.error('[Servidor] Erro fatal na inicialização:', err);
  process.exit(1);
});
