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

// Base URL da API Psicomanager
const PSICOMANAGER_API = 'https://api.psicomanager.com.br/v1';

// Headers padrão para requisições à API
const getHeaders = () => ({
  'Authorization': `Bearer ${SECRET_TOKEN}`,
    'Content-Type': 'application/json'
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
          status: 'ok',
              timestamp: new Date().toISOString(),
                  environment: NODE_ENV,
                      version: '1.0.0'
                        });
                        });

                        // Endpoint para listar clientes
                        app.get('/api/clientes', async (req, res) => {
                          try {
                              const response = await axios.get(
                                    `${PSICOMANAGER_API}/clientes`,
                                          { headers: getHeaders() }
                                              );
                                                  res.json(response.data);
                                                    } catch (error) {
                                                        console.error('Erro ao buscar clientes:', error.message);
                                                            res.status(error.response?.status || 500).json({
                                                                  error: 'Erro ao buscar clientes',
                                                                        message: error.message
                                                                            });
                                                                              }
                                                                              });

                                                                              // Endpoint para listar sessões
                                                                              app.get('/api/sessoes', async (req, res) => {
                                                                                try {
                                                                                    const response = await axios.get(
                                                                                          `${PSICOMANAGER_API}/sessoes`,
                                                                                                { headers: getHeaders() }
                                                                                                    );
                                                                                                        res.json(response.data);
                                                                                                          } catch (error) {
                                                                                                              console.error('Erro ao buscar sessões:', error.message);
                                                                                                                  res.status(error.response?.status || 500).json({
                                                                                                                        error: 'Erro ao buscar sessões',
                                                                                                                              message: error.message
                                                                                                                                  });
                                                                                                                                    }
                                                                                                                                    });
                                                                                                                                    
                                                                                                                                    // Endpoint para dados financeiros
                                                                                                                                    app.get('/api/financeiro', async (req, res) => {
                                                                                                                                      try {
                                                                                                                                          const response = await axios.get(
                                                                                                                                                `${PSICOMANAGER_API}/financeiro`,
                                                                                                                                                      { headers: getHeaders() }
                                                                                                                                                          );
                                                                                                                                                              res.json(response.data);
                                                                                                                                                                } catch (error) {
                                                                                                                                                                    console.error('Erro ao buscar dados financeiros:', error.message);
                                                                                                                                                                        res.status(error.response?.status || 500).json({
                                                                                                                                                                              error: 'Erro ao buscar dados financeiros',
                                                                                                                                                                                    message: error.message
                                                                                                                                                                                        });
                                                                                                                                                                                          }
                                                                                                                                                                                          });
                                                                                                                                                                                          
                                                                                                                                                                                          // Endpoint raiz
                                                                                                                                                                                          app.get('/', (req, res) => {
                                                                                                                                                                                            res.json({
                                                                                                                                                                                                name: 'Psicomanager API Integration',
                                                                                                                                                                                                    version: '1.0.0',
                                                                                                                                                                                                        description: 'Servidor de integração com a API do Psicomanager',
                                                                                                                                                                                                            endpoints: {
                                                                                                                                                                                                                  health: '/health',
                                                                                                                                                                                                                        clientes: '/api/clientes',
                                                                                                                                                                                                                              sessoes: '/api/sessoes',
                                                                                                                                                                                                                                    financeiro: '/api/financeiro'
                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                          });
                                                                                                                                                                                                                                          
                                                                                                                                                                                                                                          // Tratamento de erros 404
                                                                                                                                                                                                                                          app.use((req, res) => {
                                                                                                                                                                                                                                            res.status(404).json({
                                                                                                                                                                                                                                                error: 'Endpoint não encontrado',
                                                                                                                                                                                                                                                    path: req.path
                                                                                                                                                                                                                                                      });
                                                                                                                                                                                                                                                      });
                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                      // Iniciar servidor
                                                                                                                                                                                                                                                      app.listen(PORT, () => {
                                                                                                                                                                                                                                                        console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
                                                                                                                                                                                                                                                          console.log(`📝 Environment: ${NODE_ENV}`);
                                                                                                                                                                                                                                                            console.log(`🔐 Client ID configurado: ${CLIENT_ID ? 'Sim' : 'Não'}`);
                                                                                                                                                                                                                                                              console.log(`🔐 Secret Token configurado: ${SECRET_TOKEN ? 'Sim' : 'Não'}`);
                                                                                                                                                                                                                                                              });
