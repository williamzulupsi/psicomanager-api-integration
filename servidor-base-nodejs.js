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

// Base URL correta da API Psicomanager
const PSICOMANAGER_API = 'http://apip.psicomanager.com/v1/1003/psico/pv-sinc';
const AUTH_ENDPOINT = 'http://apip.psicomanager.com/v1/1003/psico/psico-auth/autenticar-api';

// Armazenar JWT em cache
let cachedJWT = null;
let jwtExpiresAt = null;

// Função para obter JWT
async function getJWT() {
    try {
          // Verificar se JWT em cache ainda é válido
          if (cachedJWT && jwtExpiresAt && Date.now() < jwtExpiresAt) {
                  console.log('📝 Usando JWT em cache');
                  return cachedJWT;
          }

          console.log('🔐 Gerando novo JWT...');
          const response = await axios.post(AUTH_ENDPOINT, {
                  client_id: CLIENT_ID,
                  secret_id: SECRET_TOKEN,
                  sol_orig: '6'
          }, {
                  headers: {
                            'Content-Type': 'application/json'
                  }
          });

          cachedJWT = response.data.records.token;
          // JWT válido por ~24 horas, renovar a cada 12 horas
          jwtExpiresAt = Date.now() + (12 * 60 * 60 * 1000);

          console.log('✅ JWT gerado com sucesso');
          return cachedJWT;
    } catch (error) {
          console.error('❌ Erro ao gerar JWT:', error.message);
          throw error;
    }
}

// Função auxiliar para fazer requisições à API Psicomanager
async function psicomanagerRequest(endpoint, method = 'GET', params = null) {
    try {
          const jwt = await getJWT();

          const config = {
                  method,
                  url: `${PSICOMANAGER_API}${endpoint}`,
                  headers: {
                            'Authorization': `Bearer ${jwt}`,
                            'Content-Type': 'application/json'
                  }
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
          console.error(`❌ Erro na requisição ${method} ${endpoint}:`, error.message);
          throw error;
    }
}

// Endpoints da API

// GET / - Root endpoint
app.get('/', (req, res) => {
    res.json({
          name: 'Psicomanager API Integration',
          version: '2.0.0',
          description: 'Servidor de integração com a API do Psicomanager (versão atualizada com JWT)',
          endpoints: {
                  health: '/health',
                  clientes: '/api/clientes',
                  sessoes: '/api/sessoes',
                  financeiro: '/api/financeiro'
          }
    });
});

// GET /health - Health check
app.get('/health', (req, res) => {
    res.json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          environment: NODE_ENV,
          version: '2.0.0',
          credentials: {
                  clientId: !!CLIENT_ID,
                  secretToken: !!SECRET_TOKEN
          }
    });
});

// GET /api/clientes - Lista pacientes
app.get('/api/clientes', async (req, res) => {
    try {
          console.log('📊 Buscando clientes/pacientes...');
          const data = await psicomanagerRequest('/listar-pacientes-dinamico');
          res.json(data);
    } catch (error) {
          res.status(error.response?.status || 500).json({
                  error: 'Erro ao buscar clientes',
                  message: error.message
          });
    }
});

// GET /api/sessoes - Lista sessões/receitas
app.get('/api/sessoes', async (req, res) => {
    try {
          console.log('📊 Buscando sessões...');
          const data = await psicomanagerRequest('/listar-pgto-sessoes');
          res.json(data);
    } catch (error) {
          res.status(error.response?.status || 500).json({
                  error: 'Erro ao buscar sessões',
                  message: error.message
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
          res.status(error.response?.status || 500).json({
                  error: 'Erro ao buscar dados financeiros',
                  message: error.message
          });
    }
});

// GET /api/profissionais - Lista profissionais
app.get('/api/profissionais', async (req, res) => {
    try {
          console.log('👨‍⚕️ Buscando profissionais...');
          const data = await psicomanagerRequest('/listar-empresas');
          res.json(data);
    } catch (error) {
          res.status(error.response?.status || 500).json({
                  error: 'Erro ao buscar profissionais',
                  message: error.message
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
          res.status(error.response?.status || 500).json({
                  error: 'Erro ao criar paciente',
                  message: error.message
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
