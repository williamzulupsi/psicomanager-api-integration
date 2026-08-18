// =====================================================================
// Psicomanager API Integration - Servidor Node.js (v3.0.0)
// Servidor proxy que autentica via JWT na API do Psicomanager e
// expõe endpoints REST para clientes, sessoes, financeiro e profissionais.
//
// v3.0.0 - Robustez: retry automático, diagnóstico da API, logs detalhados
// =====================================================================

// Importações
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Variáveis de ambiente
const CLIENT_ID = process.env.CLIENT_ID;
const SECRET_TOKEN = process.env.SECRET_TOKEN;
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Endpoints da API Psicomanager
const PSICOMANAGER_API = 'http://apip.psicomanager.com/v1/1003/psico/pv-sinc';
const AUTH_ENDPOINT = 'http://apip.psicomanager.com/v1/1003/psico/psico-auth/autenticar-api';

// Configuração de retry (a API do Psicomanager tem instabilidades)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// Armazenar JWT em cache
let cachedJWT = null;
let jwtExpiresAt = null;
let authAttemptLog = [];

// Função para obter JWT com retry
async function getJWT(retryCount = 0) {
  // Verificar se JWT em cache ainda é válido
  if (cachedJWT && jwtExpiresAt && Date.now() < jwtExpiresAt) {
    console.log('📝 Usando JWT em cache');
    return cachedJWT;
  }

  console.log('🔐 Gerando novo JWT (tentativa ' + (retryCount + 1) + ')...');
  try {
    const response = await axios.post(AUTH_ENDPOINT, {
      client_id: CLIENT_ID,
      secret_id: SECRET_TOKEN,
      sol_orig: '6'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 25000
    });

    if (!response.data || !response.data.records || !response.data.records.token) {
      throw new Error('Resposta de autenticação inesperada: ' + JSON.stringify(response.data).substring(0, 200));
    }

    cachedJWT = response.data.records.token;
    // JWT válido por ~24 horas, renovar a cada 12 horas
    jwtExpiresAt = Date.now() + (12 * 60 * 60 * 1000);
    console.log('✅ JWT gerado com sucesso');
    authAttemptLog.push({ time: new Date().toISOString(), ok: true });
    authAttemptLog = authAttemptLog.slice(-10);
    return cachedJWT;
  } catch (error) {
    const status = error.response ? error.response.status : null;
    console.error('❌ Erro ao gerar JWT (status ' + status + '):', error.message);
    authAttemptLog.push({ time: new Date().toISOString(), ok: false, status: status, error: error.message });
    authAttemptLog = authAttemptLog.slice(-10);

    // Se for falha de rede/servidor (5xx), tentar novamente
    if (status >= 500 && retryCount < MAX_RETRIES) {
      console.log('🔄 Aguardando ' + RETRY_DELAY_MS + 'ms e tentando novamente...');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return getJWT(retryCount + 1);
    }
    throw error;
  }
}

// Função auxiliar para fazer requisições à API Psicomanager com retry
async function psicomanagerRequest(endpoint, method = 'GET', params = null, retryCount = 0) {
  try {
    const jwt = await getJWT();
    const config = {
      method,
      url: PSICOMANAGER_API + endpoint,
      headers: {
        'Authorization': 'Bearer ' + jwt,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    };

    if (params) {
      if (method === 'GET') {
        config.params = params;
      } else {
        config.data = params;
      }
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    const status = error.response ? error.response.status : null;
    console.error('❌ Erro na requisição ' + method + ' ' + endpoint + ' (status ' + status + '):', error.message);

    // Se for falha de servidor (5xx), tentar novamente
    if (status >= 500 && retryCount < MAX_RETRIES) {
      console.log('🔄 Retry ' + (retryCount + 1) + '/' + MAX_RETRIES + ' para ' + endpoint + '...');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return psicomanagerRequest(endpoint, method, params, retryCount + 1);
    }
    throw error;
  }
}

// =====================================================================
// Endpoints da API

// GET / - Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Psicomanager API Integration',
    version: '3.0.0',
    description: 'Servidor de integração com a API do Psicomanager (JWT + retry)',
    endpoints: {
      health: '/health',
      'api-status': '/api/status',
      clientes: '/api/clientes',
      sessoes: '/api/sessoes',
      financeiro: '/api/financeiro',
      profissionais: '/api/profissionais'
    }
  });
});

// GET /health - Health check (status do próprio servidor)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '3.0.0',
    credentials: {
      clientId: !!CLIENT_ID,
      secretToken: !!SECRET_TOKEN
    }
  });
});

// GET /api/status - Diagnóstico da conexão com a API Psicomanager
app.get('/api/status', async (req, res) => {
  const status = {
    timestamp: new Date().toISOString(),
    server: 'ok',
    credentials: {
      clientId: !!CLIENT_ID,
      secretToken: !!SECRET_TOKEN
    }
  };

  try {
    // Tenta autenticar para verificar se a API está acessível
    const jwt = await getJWT();
    status.psicomanagerApi = 'online';
    status.jwtValid = true;

    // Testa rapidamente um endpoint de leitura
    try {
      const data = await psicomanagerRequest('/listar-pacientes-dinamico');
      status.testeEndpoint = 'ok';
      status.qtdPacientes = data && data.records ? data.records.length : (Array.isArray(data) ? data.length : 'n/d');
    } catch (e2) {
      status.testeEndpoint = 'erro';
      status.testeEndpointStatus = e2.response ? e2.response.status : null;
      status.testeEndpointMessage = e2.message;
    }
  } catch (error) {
    status.psicomanagerApi = 'offline ou indisponível';
    status.authStatus = error.response ? error.response.status : null;
    status.authMessage = error.message;
  }

  status.historicoAuth = authAttemptLog;
  res.json(status);
});

// GET /api/clientes - Lista pacientes
app.get('/api/clientes', async (req, res) => {
  try {
    console.log('📊 Buscando clientes/pacientes...');
    const data = await psicomanagerRequest('/listar-pacientes-dinamico');
    res.json(data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    if (status === 404) {
      // Endpoint 404 = possivelmente nome de endpoint incorreto na API
      res.status(404).json({
        error: 'Endpoint da API Psicomanager não encontrado',
        endpoint: 'listar-pacientes-dinamico',
        message: 'Verifique com o suporte do Psicomanager o nome correto do endpoint.',
        detail: error.message
      });
    } else {
      res.status(status).json({
        error: 'Erro ao buscar clientes',
        psicomanagerApiStatus: status,
        message: error.message,
        dica: status === 500 ? 'A API do Psicomanager pode estar em manutenção ou instável. Tente novamente em alguns minutos.' : error.message
      });
    }
  }
});

// GET /api/sessoes - Lista sessões/pagamentos
app.get('/api/sessoes', async (req, res) => {
  try {
    console.log('📊 Buscando sessões...');
    const data = await psicomanagerRequest('/listar-pgto-sessoes');
    res.json(data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({
      error: 'Erro ao buscar sessões',
      psicomanagerApiStatus: status,
      message: error.message,
      dica: status === 500 ? 'A API do Psicomanager pode estar em manutenção ou instável. Tente novamente em alguns minutos.' : error.message
    });
  }
});

// GET /api/financeiro - Lista despesas/financeiro
app.get('/api/financeiro', async (req, res) => {
  try {
    console.log('💰 Buscando dados financeiros...');
    const data = await psicomanagerRequest('/listar-financa-despesas');
    res.json(data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({
      error: 'Erro ao buscar dados financeiros',
      psicomanagerApiStatus: status,
      message: error.message,
      dica: status === 500 ? 'A API do Psicomanager pode estar em manutenção ou instável. Tente novamente em alguns minutos.' : error.message
    });
  }
});

// GET /api/profissionais - Lista empresas/profissionais
app.get('/api/profissionais', async (req, res) => {
  try {
    console.log('👨‍⚕️ Buscando profissionais...');
    const data = await psicomanagerRequest('/listar-empresas');
    res.json(data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({
      error: 'Erro ao buscar profissionais',
      psicomanagerApiStatus: status,
      message: error.message,
      dica: status === 500 ? 'A API do Psicomanager pode estar em manutenção ou instável. Tente novamente em alguns minutos.' : error.message
    });
  }
});

// POST /api/clientes - Criar paciente
app.post('/api/clientes', async (req, res) => {
  try {
    console.log('➕ Criando novo paciente...');
    const data = await psicomanagerRequest('/salvar-paciente', 'POST', req.body);
    res.status(201).json(data);
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    res.status(status).json({
      error: 'Erro ao criar paciente',
      psicomanagerApiStatus: status,
      message: error.message,
      dica: status === 500 ? 'A API do Psicomanager pode estar em manutenção ou instável. Tente novamente em alguns minutos.' : error.message
    });
  }
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('\n🚀 Servidor rodando em http://localhost:' + PORT);
  console.log('📝 Environment: ' + NODE_ENV);
  console.log('🔐 Client ID configurado: ' + (CLIENT_ID ? 'Sim' : 'Não'));
  console.log('🔐 Secret Token configurado: ' + (SECRET_TOKEN ? 'Sim' : 'Não'));
  console.log('API Base: ' + PSICOMANAGER_API);
  console.log('');
});

module.exports = app;
