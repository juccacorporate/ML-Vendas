/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware para JSON com limite maior para sincronização de grandes volumes se houver
  app.use(express.json({ limit: '20mb' }));

  // API Proxy para Sincronização do Google Sheets - IGNORA CORS NO CLIENTE/IFRAME
  app.post('/api/sync-sheets', async (req, res) => {
    const { webAppUrl, products, sales } = req.body;

    if (!webAppUrl) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A URL do Web App do Google Sheets está ausente.' 
      });
    }

    try {
      console.log(`Disparando envio ao Web App do Google Sheets: ${webAppUrl}`);
      
      // Enviando requisição diretamente do servidor para evitar problemas de iframe/CORS/compartilhamento
      const response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ products, sales })
      });

      if (!response.ok) {
        throw new Error(`Google Sheets API retornou status HTTP ${response.status}`);
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        // Se a resposta do Apps Script não for JSON puro, tratamos texto bruto como mensagem de sucesso
        responseData = { 
          status: 'success', 
          message: responseText || 'Planilha integrada e gravada com sucesso.' 
        };
      }

      return res.json(responseData);
    } catch (error: any) {
      console.error('Erro de Sincronização no Servidor Proxy:', error);
      return res.status(500).json({
        status: 'error',
        message: `Ocorreu um erro ao gravar os dados na sua planilha: ${error.message || error}`
      });
    }
  });

  // Configuração do Vite Middleware para desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ML PRO Backend Server] Iniciado e escutando na porta ${PORT}`);
  });
}

startServer();
