import { lookupWebAppUrl } from './_lib/sheetsProxy.js';

/**
 * Função serverless da Vercel: lê a URL do Web App gravada na aba "Database" da planilha.
 *
 * Esta rota só existia no servidor local (server.ts); em produção ela caía no "catch-all" do
 * vercel.json e devolvia o index.html, então a recuperação automática da URL nunca funcionava na Vercel.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ status: 'error', message: 'Método não permitido.' });
    return;
  }

  const result = await lookupWebAppUrl(req.query && req.query.spreadsheetUrl);
  res.status(result.status).json(result.body);
}
