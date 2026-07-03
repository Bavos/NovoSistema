/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Middleware de Integração Segura com API Banco Inter (Inter Developers)
 * Projetado para rodar em Node.js (compatível com Google Cloud Functions, Cloud Run ou Express)
 * 
 * Autor: Engenheiro de Software Sênior / Especialista em Cibersegurança e Integrações Bancárias
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURAÇÕES DE AMBIENTE & SEGURANÇA
// ==========================================
// ATENÇÃO: Nunca salve segredos em texto plano no código.
// Utilize o Google Secret Manager no GCP e injete as variáveis abaixo.
const INTER_ENV = {
  // URLs da API do Banco Inter
  baseUrl: process.env.INTER_API_URL || 'https://cdws.bancointer.com.br',
  
  // Credenciais OAuth obtidas no portal de desenvolvedor
  clientId: process.env.INTER_CLIENT_ID,
  clientSecret: process.env.INTER_CLIENT_SECRET,
  
  // Caminhos locais dos certificados (se aplicável para ambiente local ou volume montado)
  certPath: process.env.INTER_CERT_PATH || path.join(__dirname, 'certs', 'inter.crt'),
  keyPath: process.env.INTER_KEY_PATH || path.join(__dirname, 'certs', 'inter.key'),
  
  // Alternativa altamente segura: injetar certificados diretamente como string Base64 em variáveis de ambiente
  certBase64: process.env.INTER_CERT_BASE64,
  keyBase64: process.env.INTER_KEY_BASE64,
  
  // Escopos requeridos para transações de faturamento e pagamentos
  scopes: process.env.INTER_SCOPES || 'payment-pix.write payment-pix.read transfers.write'
};

// ==========================================
// CONFIGURAÇÃO DO AGENTE mTLS (HTTPS)
// ==========================================
/**
 * Inicializa o agente HTTPS injetando as chaves criptográficas para autenticação mTLS.
 * Prioriza chaves carregadas via Base64 (Secret Manager) para evitar escrita em disco.
 */
function obterMTLSAgent() {
  let certBuffer;
  let keyBuffer;

  try {
    if (INTER_ENV.certBase64 && INTER_ENV.keyBase64) {
      // Carregamento de forma extremamente segura direto da memória (GCP Secret Manager)
      certBuffer = Buffer.from(INTER_ENV.certBase64, 'base64');
      keyBuffer = Buffer.from(INTER_ENV.keyBase64, 'base64');
      console.log('[Inter API] Certificados mTLS carregados com sucesso a partir de variáveis Base64.');
    } else {
      // Fallback para leitura de arquivos físicos protegidos
      if (!fs.existsSync(INTER_ENV.certPath) || !fs.existsSync(INTER_ENV.keyPath)) {
        throw new Error(`Certificados não encontrados em: \nCert: ${INTER_ENV.certPath}\nKey: ${INTER_ENV.keyPath}`);
      }
      certBuffer = fs.readFileSync(INTER_ENV.certPath);
      keyBuffer = fs.readFileSync(INTER_ENV.keyPath);
      console.log('[Inter API] Certificados mTLS carregados com sucesso a partir do sistema de arquivos.');
    }

    // Criando o agente com os certificados mTLS e garantindo TLS 1.2 ou superior (Segurança Bancária)
    return new https.Agent({
      cert: certBuffer,
      key: keyBuffer,
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true // Garante a validação estrita da cadeia de confiança do Inter
    });
  } catch (error) {
    console.error('[Inter API Critical] Erro fatal ao configurar agente mTLS:', error.message);
    throw error;
  }
}

// Instanciação única do agente (Singleton) para otimizar conexões TCP (HTTP Keep-Alive)
let mtlsAgentInstance = null;
function getMtlsAgent() {
  if (!mtlsAgentInstance) {
    mtlsAgentInstance = obterMTLSAgent();
  }
  return mtlsAgentInstance;
}

// ==========================================
// INTEGRAÇÃO OAUTH 2.0 (AUTENTICAÇÃO)
// ==========================================
/**
 * Realiza a chamada mTLS para buscar o token de acesso de curta duração (Bearer Token)
 * @returns {Promise<string>} Access Token válido
 */
async function obterBearerToken() {
  const agent = getMtlsAgent();
  
  if (!INTER_ENV.clientId || !INTER_ENV.clientSecret) {
    throw new Error('Configuração incompleta: INTER_CLIENT_ID e/ou INTER_CLIENT_SECRET ausentes no ambiente.');
  }

  const payload = new URLSearchParams({
    client_id: INTER_ENV.clientId,
    client_secret: INTER_ENV.clientSecret,
    grant_type: 'client_credentials',
    scope: INTER_ENV.scopes
  }).toString();

  const options = {
    method: 'POST',
    hostname: new URL(INTER_ENV.baseUrl).hostname,
    port: 443,
    path: '/oauth/v2/token',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(payload)
    },
    agent: agent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json.access_token);
          } catch (e) {
            reject(new Error(`Erro ao parsear resposta do token: ${e.message}`));
          }
        } else {
          reject(new Error(`Falha no OAuth: HTTP ${res.statusCode} - Resposta: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Erro de rede na requisição OAuth: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

// ==========================================
// FUNÇÕES AUXILIARES DE EXECUÇÃO DE APIS
// ==========================================
/**
 * Helper genérico para chamadas seguras de API utilizando mTLS e Bearer Token.
 */
async function chamadaApiInter(method, pathUrl, body, token) {
  const agent = getMtlsAgent();
  const payloadStr = body ? JSON.stringify(body) : '';

  const options = {
    method: method,
    hostname: new URL(INTER_ENV.baseUrl).hostname,
    port: 443,
    path: pathUrl,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    agent: agent
  };

  if (body) {
    options.headers['Content-Length'] = Buffer.byteLength(payloadStr);
  }

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsedData = {};
        try {
          if (data) parsedData = JSON.parse(data);
        } catch (e) {
          parsedData = { rawResponse: data };
        }

        resolve({
          statusCode: res.statusCode,
          success: res.statusCode >= 200 && res.statusCode < 300,
          data: parsedData
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        success: false,
        error: err.message
      });
    });

    if (body) {
      req.write(payloadStr);
    }
    req.end();
  });
}

// ==========================================
// MOTOR DE PAGAMENTO (PIX & TED)
// ==========================================

/**
 * Dispara uma transação Pix na API do Inter
 * Endpoint correspondente: /pague/v2/pix
 */
async function dispararPix(profissional, token) {
  // Higienização e sanitização da chave Pix
  const chavePixClean = (profissional.chavePix || '').trim();
  
  // Montagem do payload conforme especificações do manual do Inter Developers V2
  const payloadPix = {
    valor: parseFloat(profissional.valor).toFixed(2),
    chave: chavePixClean,
    infoAdicional: `Pagamento Servicos - ${profissional.nome.substring(0, 30)}`,
    // Identificador único (EndToEndId ou txId opcional) pode ser gerado dinamicamente
    recorrencia: {
      frequencia: 'UNICA'
    }
  };

  const response = await chamadaApiInter('POST', '/pague/v2/pix', payloadPix, token);
  return {
    profissionalId: profissional.id,
    nome: profissional.nome,
    tipo: 'PIX',
    sucesso: response.success,
    statusHttp: response.statusCode,
    resposta: response.data,
    msgErro: response.success ? null : (response.data?.mensagem || response.error || 'Erro desconhecido na API do Inter')
  };
}

/**
 * Dispara uma transferência via TED na API do Inter
 * Endpoint correspondente: /pague/v2/transferencias
 */
async function dispararTed(profissional, token) {
  const bancoDados = profissional.dadosBancarios || {};
  
  // Higieniza dados de agência, conta e CPF/CNPJ
  const cpfCnpjClean = (profissional.cpf || bancoDados.cpfCnpj || '').replace(/\D/g, '');
  const agenciaClean = (bancoDados.agencia || '').replace(/\D/g, '');
  const contaClean = (bancoDados.conta || '').replace(/\D/g, '');
  const contaDigito = (bancoDados.digito || '').trim();

  const payloadTed = {
    valor: parseFloat(profissional.valor).toFixed(2),
    tipoTransferencia: 'TED',
    favorecido: {
      nome: profissional.nome.substring(0, 80),
      cpfCnpj: cpfCnpjClean,
      instituicaoFinanceira: bancoDados.codigoBanco || '077', // Default 077 Inter se vazio
      agencia: agenciaClean,
      conta: contaClean,
      digitoConta: contaDigito || '0',
      tipoConta: bancoDados.tipoConta === 'Poupança' ? 'POUPANCA' : 'CORRENTE'
    },
    descricao: `Pagamento Servicos - ${profissional.nome.substring(0, 30)}`
  };

  const response = await chamadaApiInter('POST', '/pague/v2/transferencias', payloadTed, token);
  return {
    profissionalId: profissional.id,
    nome: profissional.nome,
    tipo: 'TED',
    sucesso: response.success,
    statusHttp: response.statusCode,
    resposta: response.data,
    msgErro: response.success ? null : (response.data?.mensagem || response.error || 'Erro desconhecido na API do Inter')
  };
}

// ==========================================
// ENDPOINT EXPRESS / HANDLER CLOUD FUNCTION
// ==========================================

/**
 * Handler principal para processamento em lote da folha de pagamento de profissionais.
 * Recebe o payload do frontend React e orquestra as chamadas com resiliência.
 * 
 * Exemplo de Payload recebido:
 * {
 *   "profissionais": [
 *     { "id": "1", "nome": "Dr. Silva", "valor": 1250.00, "chavePix": "12345678901", "formaPagamento": "PIX" },
 *     { "id": "2", "nome": "Enf. Maria", "valor": 850.50, "dadosBancarios": { "codigoBanco": "341", "agencia": "1234", "conta": "56789", "digito": "0", "tipoConta": "Corrente" }, "formaPagamento": "TED", "cpf": "98765432100" }
 *   ]
 * }
 */
async function processarFolhaPagamento(req, res) {
  // Proteção contra requisições sem corpo válido
  if (!req.body || !Array.isArray(req.body.profissionais)) {
    return res.status(400).json({
      erro: 'Payload inválido. É esperado um objeto com uma lista em "profissionais".'
    });
  }

  const { profissionais } = req.body;
  console.log(`[Inter API] Iniciando lote de faturamento para ${profissionais.length} profissionais.`);

  try {
    // 1. Obtenção do Bearer Token OAuth 2.0 mTLS
    const token = await obterBearerToken();
    console.log('[Inter API] Token OAuth obtido com sucesso. Processando lote de transferências...');

    const resultados = [];
    let totalSucesso = 0;
    let totalErro = 0;
    let valorTotalProcessado = 0;

    // 2. Processamento resiliente de cada item (Processamento em série/paralelo controlado para evitar rate-limits)
    for (const profissional of profissionais) {
      if (!profissional.valor || parseFloat(profissional.valor) <= 0) {
        resultados.push({
          profissionalId: profissional.id,
          nome: profissional.nome,
          sucesso: false,
          msgErro: 'Valor de pagamento nulo ou inválido.'
        });
        totalErro++;
        continue;
      }

      try {
        let resultadoItem;
        const formaPagamento = (profissional.formaPagamento || '').toUpperCase();

        if (formaPagamento === 'PIX' && profissional.chavePix) {
          resultadoItem = await dispararPix(profissional, token);
        } else if (formaPagamento === 'TED' || (profissional.dadosBancarios && profissional.dadosBancarios.conta)) {
          resultadoItem = await dispararTed(profissional, token);
        } else if (profissional.chavePix) {
          // Fallback inteligente para Pix se houver chave cadastrada mas sem forma explicitada
          resultadoItem = await dispararPix(profissional, token);
        } else {
          resultadoItem = {
            profissionalId: profesional.id,
            nome: profissional.nome,
            sucesso: false,
            msgErro: 'Método de pagamento indisponível ou dados de transferência ausentes (sem Chave Pix ou Conta Bancária).'
          };
        }

        if (resultadoItem.sucesso) {
          totalSucesso++;
          valorTotalProcessado += parseFloat(profissional.valor);
        } else {
          totalErro++;
        }

        resultados.push(resultadoItem);

      } catch (errItem) {
        console.error(`[Inter API] Falha crítica de execução no profissional ${profissional.nome}:`, errItem.message);
        resultados.push({
          profissionalId: profissional.id,
          nome: profissional.nome,
          sucesso: false,
          msgErro: `Exceção de Execução: ${errItem.message}`
        });
        totalErro++;
      }
    }

    // 3. Log de Auditoria consolidado
    console.log(`[Inter API] Lote finalizado. Sucessos: ${totalSucesso} | Falhas: ${totalErro} | Valor Total: R$ ${valorTotalProcessado.toFixed(2)}`);

    // Retorna resposta estruturada para o frontend React
    return res.status(200).json({
      status: 'PROCESSADO',
      timestamp: new Date().toISOString(),
      resumo: {
        totalProcessado: profissionais.length,
        sucessos: totalSucesso,
        falhas: totalErro,
        valorTotalLiquidado: valorTotalProcessado.toFixed(2)
      },
      detalhes: resultados
    });

  } catch (error) {
    console.error('[Inter API Critical] Erro grave durante processamento do lote:', error.message);
    return res.status(500).json({
      erro: 'Falha interna crítica ao integrar com o Banco Inter.',
      detalhes: error.message
    });
  }
}

// Exportações dos módulos e Handlers seguros
module.exports = {
  obterBearerToken,
  dispararPix,
  dispararTed,
  processarFolhaPagamento
};
