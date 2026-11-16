/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
// Núcleo compartilhado com as funções serverless da Vercel (api/*.js): uma única implementação
// para desenvolvimento local e produção.
import { syncRead, syncWrite, lookupWebAppUrl } from './api/_lib/sheetsProxy.js';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const HOST = process.env.HOST || '0.0.0.0';
  const isProduction = process.env.NODE_ENV === 'production';

  app.disable('x-powered-by');

  // Limite maior para sincronização de grandes volumes
  app.use(express.json({ limit: '20mb' }));

  // Nunca permitir cache das respostas da API (evita dados velhos entre dispositivos)
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    next();
  });

  // Recupera o Web App URL gravado na aba "Database" da planilha
  app.get('/api/get-webapp-url', async (req, res) => {
    const result = await lookupWebAppUrl(String(req.query.spreadsheetUrl || ''));
    res.status(result.status).json(result.body);
  });

  // Exportação do código-fonte consolidado (para auditoria em outra IA).
  // Em produção fica DESLIGADA por padrão: ela entrega o código inteiro (e qualquer segredo nele) a qualquer visitante.
  const codeExportEnabled = !isProduction || process.env.ENABLE_CODE_EXPORT === 'true';
  if (codeExportEnabled) {
    app.get(['/api/download-codebase', '/api/export-codebase', '/PROJETO_COMPLETO_CLAUDE.txt'], (req, res) => {
      try {
        const filesToInclude = [
          'package.json',
          'vite.config.ts',
          'index.html',
          'server.ts',
          'api/_lib/sheetsProxy.js',
          'api/sync-sheets.js',
          'api/get-webapp-url.js',
          'src/main.tsx',
          'src/index.css',
          'src/types.ts',
          'src/utils.ts',
          'src/App.tsx',
          'src/components/ErrorBoundary.tsx',
          'src/components/Header.tsx',
          'src/components/DashboardOverview.tsx',
          'src/components/StockControl.tsx',
          'src/components/SalesManager.tsx',
          'src/components/ProductProfitsPanel.tsx',
          'src/components/MLImport.tsx',
          'src/components/SheetsIntegration.tsx',
          'src/components/MLCalculatorModal.tsx',
          'src/components/QuickStockModal.tsx',
          'src/components/ManualStockAdjustPanel.tsx',
          'src/components/CodeExportModal.tsx'
        ];

        let output = '# ==============================================================================\n';
        output += '# CÓDIGO FONTE COMPLETO CONSOLIDADO - SISTEMA MERCADO LIVRE PRO\n';
        output += '# ESTRUTURA PARA AUDITORIA E ENGENHARIA NO CLAUDE / CHATGPT / LLM\n';
        output += `# DATA DE EXPORTAÇÃO: ${new Date().toISOString()}\n`;
        output += '# ==============================================================================\n\n';

        let includedFiles = 0;
        for (const relPath of filesToInclude) {
          const fullPath = path.join(process.cwd(), relPath);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            output += '\n' + '='.repeat(80) + '\n';
            output += `FILE: ${relPath}\n`;
            output += '='.repeat(80) + '\n\n';
            output += content + '\n\n';
            includedFiles++;
          }
        }

        if (req.query.json === 'true') {
          return res.json({
            success: true,
            totalFiles: includedFiles,
            sizeBytes: Buffer.byteLength(output, 'utf8'),
            content: output
          });
        }

        const isDownload = req.path.includes('download') || req.query.download === 'true';
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (isDownload) {
          res.setHeader('Content-Disposition', 'attachment; filename="PROJETO_COMPLETO_CLAUDE.txt"');
        }
        return res.send(output);
      } catch (err: any) {
        console.error('Erro ao gerar exportação de código:', err);
        res.status(500).send('Erro ao gerar código para exportação: ' + err.message);
      }
    });
  }

  // Proxy de sincronização com o Google Sheets: GET lê, POST grava
  app.get('/api/sync-sheets', async (req, res) => {
    const result = await syncRead(String(req.query.webAppUrl || ''));
    res.status(result.status).json(result.body);
  });

  app.post('/api/sync-sheets', async (req, res) => {
    const result = await syncWrite(req.body);
    res.status(result.status).json(result.body);
  });

  // Erros de leitura do corpo (JSON inválido / payload grande demais) sempre em JSON, nunca em HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({
        status: 'error',
        message: 'Os dados são grandes demais para uma única gravação. Reduza o volume importado ou tente novamente em partes.'
      });
    }
    if (err instanceof SyntaxError) {
      return res.status(400).json({ status: 'error', message: 'Requisição inválida (JSON malformado).' });
    }
    return next(err);
  });

  // Configuração do Vite Middleware para desenvolvimento
  if (!isProduction) {
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

  app.listen(PORT, HOST, () => {
    console.log(`[ML PRO Backend Server] Iniciado e escutando em ${HOST}:${PORT}`);
  });
}

startServer();
