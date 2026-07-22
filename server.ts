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

  // Helper para realizar fetch com timeout nativo robusto e limpar o temporizador de forma segura
  async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 45000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  }

  // API Proxy para Sincronização do Google Sheets - GET para buscar dados em realtime
  app.get('/api/sync-sheets', async (req, res) => {
    const webAppUrl = req.query.webAppUrl as string;

    if (!webAppUrl) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A URL do Web App do Google Sheets está ausente.' 
      });
    }

    try {
      console.log(`Disparando busca ao Web App do Google Sheets: ${webAppUrl}`);
      const response = await fetchWithTimeout(webAppUrl, {}, 45000);

      if (!response.ok) {
        let msg = `Google Sheets API retornou status HTTP ${response.status}.`;
        if (response.status === 500) {
          msg += ` Isso geralmente significa que há um erro interno de execução no seu código do Apps Script (como uma coluna ausente ou uma fórmula inválida na planilha). Por favor, verifique no menu "Execuções" do seu Apps Script para ver o log de erro detalhado.`;
        }
        throw new Error(msg);
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        console.error('Falha ao decodificar JSON retornado pelo Apps Script:', responseText.substring(0, 1000));
        
        let customMessage = 'A resposta do Google Sheets Apps Script não é um JSON válido. Verifique se o script foi implantado corretamente como Web App.';
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html') || responseText.includes('<script')) {
          customMessage = '⚠️ Sua planilha do Google Sheets retornou uma página de erro do Google (Erro 500/Sintaxe). Isso ocorre quando o Apps Script possui erros de sintaxe ou autorização de conta. Para corrigir: \n1. Abra sua planilha e acesse "Extensões > Apps Script".\n2. Copie o NOVO código do Passo 3 da plataforma e cole substituindo todo o código atual.\n3. Salve clicando no disquete 💾.\n4. Clique em "Implantar" > "Gerenciar implantações" > clique no ícone de Lápis (Editar) > NO SELETOR DE VERSÃO mude para "Nova versão" (Obrigatoriamente!) e clique em "Implantar".';
        }
        
        return res.status(502).json({
          status: 'error',
          message: customMessage
        });
      }

      return res.json(responseData);
    } catch (error: any) {
      console.error('Erro de Sincronização no Servidor Proxy (GET):', error);
      let errorMsg = error.message || String(error);
      if (error.name === 'AbortError') {
        errorMsg = 'A planilha do Google Sheets demorou demais para responder (Tempo Limite de 45s Excedido). Certifique-se de que o link do Web App do Apps Script está correto, ativo e que sua planilha não possui centenas de milhares de linhas vazias que atrasam a resposta.';
      }
      return res.status(500).json({
        status: 'error',
        message: `Ocorreu um erro ao buscar os dados na sua planilha: ${errorMsg}`
      });
    }
  });

  // API Proxy para Sincronização do Google Sheets - POST para gravar dados
  app.post('/api/sync-sheets', async (req, res) => {
    const { webAppUrl, products, sales, initialCapital, mlRecords } = req.body;

    if (!webAppUrl) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A URL do Web App do Google Sheets está ausente.' 
      });
    }

    try {
      console.log(`Disparando envio ao Web App do Google Sheets: ${webAppUrl}`);
      
      // Enviando requisição diretamente do servidor para evitar problemas de iframe/CORS/compartilhamento
      const response = await fetchWithTimeout(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ products, sales, initialCapital, mlRecords })
      }, 45000);

      if (!response.ok) {
        let msg = `Google Sheets API retornou status HTTP ${response.status}.`;
        if (response.status === 500) {
          msg += ` Isso geralmente indica erro de código ou formato incorreto no seu Apps Script ao gravar. Por favor, cheque a aba "Execuções" no painel do Google Apps Script.`;
        }
        throw new Error(msg);
      }

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (err) {
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html') || responseText.includes('<script')) {
          return res.status(502).json({
            status: 'error',
            message: '⚠️ Sua planilha do Google Sheets retornou uma página de erro do Google (Erro 500/Sintaxe) ao salvar. Certifique-se de copiar o novo código do Passo 3, salvá-lo no Apps Script, e criar uma "Nova versão" ao Implantar como Web App de acesso público ("Qualquer pessoa").'
          });
        }
        // Se a resposta do Apps Script não for JSON puro mas for texto plano, tratamos como mensagem de sucesso
        responseData = { 
          status: 'success', 
          message: responseText || 'Planilha integrada e gravada com sucesso.' 
        };
      }

      return res.json(responseData);
    } catch (error: any) {
      console.error('Erro de Sincronização no Servidor Proxy:', error);
      let errorMsg = error.message || String(error);
      if (error.name === 'AbortError') {
        errorMsg = 'O envio demorou demais para responder (Tempo Limite de 45s Excedido). Verifique o Web App do Apps Script.';
      }
      return res.status(500).json({
        status: 'error',
        message: `Ocorreu um erro ao gravar os dados na sua planilha: ${errorMsg}`
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
