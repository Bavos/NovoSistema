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
          const source = rawData.metricas || rawData;
          const pergunta = String(rawData.pergunta || '').trim();

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

          const pacientesRaw = Array.isArray(source.pacientes) ? source.pacientes : [];
          const profissionaisRaw = Array.isArray(source.profissionais) ? source.profissionais : [];
          const escalasRaw = Array.isArray(source.escalas || source.agendamentos || source.plantoes) 
            ? (source.escalas || source.agendamentos || source.plantoes) 
            : [];

          const metricasGerais = {
            totalPacientesCadastrados: pacientesRaw.length,
            pacientesAtivos: pacientesRaw.filter(p => (p.status || '').toLowerCase() === 'ativo').length,
            totalProfissionaisCadastrados: profissionaisRaw.length,
            profissionaisAtivos: profissionaisRaw.filter(p => (p.status || '').toLowerCase() !== 'inativo').length,
            totalEscalasRegistradas: escalasRaw.length,
            escalasSemProfissionalAlocado: escalasRaw.filter(e => !e.profissionalId && !e.profissionalNome && !e.idProfissional && !e.nomeProfissional).length,
            escalasConcluidas: escalasRaw.filter(e => (e.status || '').toLowerCase() === 'concluido' || (e.status || '').toLowerCase() === 'realizado').length,
            totaisConsolidados: source.totaisConsolidados || {
              faturamentoMensalConsolidado: Number(source.faturamentoConsolidado || 0),
              custoTotalFolhaConsolidado: Number(source.custoFolhaConsolidado || 0),
              totalDebitosProfissionais: Number(source.totalDebitos || 0)
            }
          };

          const dadosAnonimizados = {
            metadadosLGPD: {
              anonimizacaoAtiva: true,
              dadosSensíveisRemovidos: ["CPF", "Telefones", "Endereços", "E-mails", "Dados Bancários", "Nomes Reais"],
              dataProcessamento: new Date().toISOString()
            },
            metricasGerais,
            amostraPacientes: pacientesRaw.slice(0, 60).map(p => ({
              codigo: anonPac(p.id || p.nome),
              status: p.status || 'Ativo',
              bairro: p.endereco?.bairro || p.bairro || 'Não informado',
              cidade: p.endereco?.cidade || p.cidade || 'Não informado',
              grauDependencia: p.complexidade || p.grauComplexidade || p.grauDependencia || 'Média',
              planoCuidado: p.planoCuidado || p.tipoPlantao || 'Plantão 12h',
              especialidadeNecessaria: p.especialidade || 'Técnico de Enfermagem',
              incompatibilidades: (p.preferenciasInadequacoes?.inadequados || []).map((i: any) => anonProf(i.profissionalId || i.nomeProfissional)),
              preferenciais: (p.preferenciasInadequacoes?.preferenciais || []).map((pr: any) => anonProf(pr.profissionalId || pr.nomeProfissional)),
              valorPlantaoProfissional: Number(p.valorPlantaoProfissional || 0),
              valorAjudaCusto: Number(p.valorAjudaCusto || 0),
              taxaAdministrativa: Number(p.taxaAdministrativa || 0),
              valorTotalCobradoPlantao: Number(p.valorTotalCobradoPlantao || 0)
            })),
            amostraProfissionais: profissionaisRaw.slice(0, 50).map(p => ({
              codigo: anonProf(p.id || p.nome),
              categoria: p.categoria || p.funcao || 'Cuidador',
              especialidade: p.especialidade || 'Geral',
              bairroResidencia: p.endereco?.bairro || p.bairro || 'Não informado',
              cidadeResidencia: p.endereco?.cidade || p.cidade || 'Não informado',
              status: p.status || 'Disponível',
              dadosBancariosConciliacao: (p.dadosBancarios || p.chavePix) ? {
                banco: p.dadosBancarios?.banco || 'Não informado',
                temChavePix: !!(p.dadosBancarios?.chavePix || p.chavePix),
                tipoChavePix: p.dadosBancarios?.tipoChavePix || (p.chavePix ? 'Cadastrada' : 'Ausente')
              } : 'Pendente / Ausente',
              pacientesBloqueados: (p.pacientesBloqueados || []).map((pId: string) => anonPac(pId))
            })),
            amostraEscalas: escalasRaw.slice(0, 60).map(e => ({
              paciente: anonPac(e.pacienteId || e.pacienteNome || e.idPaciente),
              profissional: (e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) 
                ? anonProf(e.profissionalId || e.profissionalNome || e.idProfissional || e.nomeProfissional) 
                : 'NÃO_ALOCADO (GARGALO)',
              turno: e.tipoTurno || e.turno || e.horario || '12h Diurno',
              data: e.data || '',
              status: e.status || 'Agendado',
              valorRepasse: Number(e.valorRepasse || e.valorPlantao || 0),
              ajudaCusto: Number(e.ajudaCusto || 0),
              valorCobrado: Number(e.valorCobrado || 0)
            }))
          };

          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });

          const systemInstruction = `Você é a inteligência analítica e assistente de operações da RH Gestão Domiciliar.

1. AUTONOMIA TOTAL E ANÁLISE PROFUNDA (PACIENTES E PROFISSIONAIS):
- Tem total liberdade para examinar, cruzar e correlacionar todo o conjunto de dados operacionais, clínicos, cadastrais e financeiros do sistema:
  * PROFISSIONAIS: Histórico de plantões, disponibilidade, competências técnicas, restrições, preferências, conciliação de dados bancários (contas, chaves Pix para repasses) e bairros de residência/atuação.
  * PACIENTES/UTENTES: Grau de dependência, rotinas clínicas, horários de cobertura necessários e bairros de atendimento.
  * ESCALAS: Distribuição de turnos e plantões vagos.
- Realize diagnósticos geo-operacionais ativos: avalie a proximidade entre o bairro do profissional e o bairro do paciente para otimizar o tempo de deslocação, custos de ajuda de custo e reduzir o risco de atrasos ou faltas.
- Cruze as informações bancárias e de repasse com os plantões efetivamente cumpridos para apontar inconformidades antes dos pagamentos.

2. SEGURANÇA E AMBIENTE FECHADO:
- Todos os dados analisados (incluindo informações bancárias, cadastros de colaboradores e fichas clínicas) pertencem exclusivamente ao ecossistema interno deste sistema de gestão.
- Não exporte, não simule integrações externas e não direcione dados para serviços ou ferramentas fora desta plataforma. O tratamento decorre estritamente dentro deste contexto.

3. PERSONALIDADE E TOM DE VOZ:
- Mantenha uma postura enérgica, animada, acolhedora e proativa, aliada a um rigor analítico impecável.
- Seja direto, objetivo e focado em soluções operacionais acionáveis para o gestor.
- Não use respostas pré-formatadas ou repetitivas. Adapte cada análise à complexidade do caso concreto.

4. DIRETRIZES DE RESPOSTA:
- Quando sugerir substituições ou montagens de escala, apresente com clareza: a compatibilidade técnica do profissional, a viabilidade logística (bairro) e o impacto no custo/repasse.
- Se faltar algum dado relevante (como chave Pix, agência bancária, bairro ou escala em aberto), identifique explicitamente o campo em falta para que o gestor possa providenciar o ajuste.
- Responda sempre em português do Brasil, priorizando a excelência assistencial, o equilíbrio das escalas e a precisão administrativa.
- FORMATO DE RESPOSTA (OUTPUT FORMAT): Retorne exclusivamente texto corrido e fluido formatado em Markdown amigável (Plaintext). NUNCA retorne a resposta estruturada em JSON.`;

          const prompt = pergunta
            ? `O administrador do serviço de Home Care fez a seguinte consulta operacional:
"${pergunta}"

Por favor, responda de forma analítica, clara e estruturada em Markdown, fundamentando-se rigorosamente nos dados anonimizados abaixo:

<DADOS_OPERACIONAIS_ANONIMIZADOS>
${JSON.stringify(dadosAnonimizados, null, 2)}
</DADOS_OPERACIONAIS_ANONIMIZADOS>`
            : `Por favor, elabore um relatório executivo de inteligência e diagnóstico operacional para a diretoria do serviço de Home Care com base estritamente nos dados anonimizados abaixo:

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
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.75
            }
          });

          const resultadoDoModelo = response.text || '';

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            resposta: resultadoDoModelo
          }));

        } catch (err: any) {
          console.error('[API Server Error]:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            sucesso: false,
            erro: `Falha no processamento da consulta de inteligência operacional: ${err?.message || err}`
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

