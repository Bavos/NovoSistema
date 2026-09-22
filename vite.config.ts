import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiServerPlugin(): Plugin {
  return {
    name: 'api-gemini-server',
    configureServer(server) {
      server.middlewares.use('/api/analisar-metricas', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ erro: 'Método não permitido. Use POST.' }));
          return;
        }

        try {
          const authHeader = req.headers['authorization'] || '';
          const token = authHeader.replace(/^Bearer\s+/i, '').trim();

          let bodyBuffer = '';
          for await (const chunk of req) {
            bodyBuffer += chunk;
          }

          const rawData = bodyBuffer ? JSON.parse(bodyBuffer) : {};

          // Validação de Usuário Administrador
          let callerEmail = '';
          let callerRole = '';
          if (token) {
            try {
              const parts = token.split('.');
              if (parts.length >= 2) {
                const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8');
                const parsedToken = JSON.parse(payloadStr);
                callerEmail = (parsedToken.email || '').toLowerCase();
                callerRole = String(parsedToken.role || parsedToken.nivelAcesso || '').toLowerCase();
              }
            } catch (e) {
              console.warn('[API Gemini] Erro ao decodificar token JWT:', e);
            }
          }

          const userObj = rawData.user || {};
          const fallbackEmail = (userObj.email || '').toLowerCase();
          const fallbackRole = String(userObj.role || userObj.userRole || '').toLowerCase();

          const finalEmail = callerEmail || fallbackEmail;
          const finalRole = callerRole || fallbackRole;

          const isMasterAdmin = finalEmail === 'renatobz@gmail.com' || finalEmail === 'rhgestaodomiciliar@gmail.com';
          const isAdmin = isMasterAdmin || finalRole === 'administrador' || finalRole === 'admin';

          if (!isAdmin) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              sucesso: false, 
              erro: 'Acesso negado. Apenas administradores têm permissão para executar a Análise de Inteligência Operacional.' 
            }));
            return;
          }

          const apiKey = process.env.GEMINI_API_KEY;
          if (!apiKey) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              sucesso: false, 
              erro: 'Chave GEMINI_API_KEY não configurada nas variáveis de ambiente do servidor.' 
            }));
            return;
          }

          // Higienização e Anonimização de Dados (LGPD)
          const pacMap = new Map();
          const profMap = new Map();
          let pacCount = 1;
          let profCount = 1;

          const anonPac = (idOrName) => {
            const k = String(idOrName || '').trim();
            if (!k) return 'Paciente [PAC-000]';
            if (!pacMap.has(k)) pacMap.set(k, `Paciente [PAC-${String(pacCount++).padStart(3, '0')}]`);
            return pacMap.get(k);
          };

          const anonProf = (idOrName) => {
            const k = String(idOrName || '').trim();
            if (!k) return 'Profissional [P-00]';
            if (!profMap.has(k)) profMap.set(k, `Profissional [P-${String(profCount++).padStart(2, '0')}]`);
            return profMap.get(k);
          };

          const pacientesRaw = Array.isArray(rawData.pacientes) ? rawData.pacientes : [];
          const profissionaisRaw = Array.isArray(rawData.profissionais) ? rawData.profissionais : [];
          const escalasRaw = Array.isArray(rawData.escalas || rawData.agendamentos || rawData.plantoes) 
            ? (rawData.escalas || rawData.agendamentos || rawData.plantoes) 
            : [];

          const metricasGerais = {
            totalPacientesCadastrados: pacientesRaw.length,
            pacientesAtivos: pacientesRaw.filter(p => (p.status || '').toLowerCase() === 'ativo').length,
            totalProfissionaisCadastrados: profissionaisRaw.length,
            profissionaisAtivos: profissionaisRaw.filter(p => (p.status || '').toLowerCase() !== 'inativo').length,
            totalEscalasRegistradas: escalasRaw.length,
            escalasSemProfissionalAlocado: escalasRaw.filter(e => !e.profissionalId && !e.profissionalNome).length,
            escalasConcluidas: escalasRaw.filter(e => (e.status || '').toLowerCase() === 'concluido' || (e.status || '').toLowerCase() === 'realizado').length,
            totaisConsolidados: rawData.totaisConsolidados || {
              faturamentoMensalConsolidado: Number(rawData.faturamentoConsolidado || 0),
              custoTotalFolhaConsolidado: Number(rawData.custoFolhaConsolidado || 0),
              totalDebitosProfissionais: Number(rawData.totalDebitos || 0)
            }
          };

          const dadosAnonimizados = {
            metadadosLGPD: {
              anonimizacaoAtiva: true,
              dadosSensíveisRemovidos: ["CPF", "Telefones", "Endereços", "E-mails", "Dados Bancários", "Nomes Reais"],
              dataProcessamento: new Date().toISOString()
            },
            metricasGerais,
            amostraPacientes: pacientesRaw.slice(0, 40).map(p => ({
              codigo: anonPac(p.id || p.nome),
              status: p.status || 'Ativo',
              complexidade: p.complexidade || p.grauComplexidade || 'Média',
              planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h',
              especialidadeNecessaria: p.especialidade || 'Técnico de Enfermagem'
            })),
            amostraProfissionais: profissionaisRaw.slice(0, 40).map(p => ({
              codigo: anonProf(p.id || p.nome),
              categoria: p.categoria || p.funcao || 'Cuidador',
              especialidade: p.especialidade || 'Geral',
              status: p.status || 'Disponível'
            })),
            amostraEscalas: escalasRaw.slice(0, 50).map(e => ({
              paciente: anonPac(e.pacienteId || e.pacienteNome),
              profissional: (e.profissionalId || e.profissionalNome) ? anonProf(e.profissionalId || e.profissionalNome) : 'NÃO_ALOCADO (GARGALO)',
              turno: e.tipoTurno || e.turno || '12h Diurno',
              status: e.status || 'Agendado'
            }))
          };

          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          const systemInstruction =
            "Você é um assistente de análise de gestão e operações financeiras de home care. " +
            "Analise exclusivamente os dados anonimizados fornecidos, destacando gargalos de escalas, custos de plantões e projeções de demanda. " +
            "Nunca deduza nem tente solicitar dados de identificação pessoal.";

          const prompt = `Por favor, elabore um relatório executivo de inteligência e diagnóstico operacional para a diretoria do serviço de Home Care com base estritamente nos dados anonimizados abaixo:

<DADOS_OPERACIONAIS_ANONIMIZADOS>
${JSON.stringify(dadosAnonimizados, null, 2)}
</DADOS_OPERACIONAIS_ANONIMIZADOS>

O relatório DEVE ser retornado em formato Markdown fluido, legível e altamente profissional, estruturado obrigatoriamente com os 4 tópicos abaixo:

## Resumo Geral
- Panorama executivo da operação, relação entre volume de pacientes e quadro de profissionais ativos.
- Análise da capacidade de atendimento e densidade de cuidado.

## Eficiência de Escalas
- Gargalos críticos de escala e turnos sem profissional alocado (pontos de vulnerabilidade).
- Equilíbrio na distribuição de plantões e prevenção de sobrecarga em cuidadores e técnicos.
- Aderência de especialidades às necessidades dos planos de cuidado.

## Riscos Financeiros
- Análise da relação de custos operacionais com folha/repasses versus faturamento estimado.
- Impacto de ocorrências, desfalques emergenciais e débitos pendentes.
- Previsibilidade e controle de despesas diretas.

## Recomendações
- Ações táticas e imediatas para sanar desfalques em escalas pendentes.
- Estratégias para retenção e atração de profissionais para especialidades mais demandadas.
- Recomendações de governança operacional e melhoria contínua.`;

          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.2
            }
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            sucesso: true,
            relatorioMarkdown: response.text || '',
            metricasGerais,
            timestamp: new Date().toISOString()
          }));

        } catch (err: any) {
          console.error('[API Gemini Server Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            sucesso: false,
            erro: `Falha no processamento da análise com Gemini: ${err?.message || err}`
          }));
        }
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

