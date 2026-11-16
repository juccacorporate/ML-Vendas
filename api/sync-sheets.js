import { syncRead, syncWrite } from './_lib/sheetsProxy.js';

/**
 * Função serverless da Vercel: proxy entre o navegador e o Web App do Google Apps Script.
 * Toda a lógica fica em ./_lib/sheetsProxy.js (compartilhada com o servidor local, server.ts).
 *
 * Observação: não há cabeçalhos CORS "*" de propósito. O app chama esta rota no MESMO domínio,
 * então CORS não é necessário — e deixá-lo aberto permitia que qualquer site usasse este proxy.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ status: 'error', message: 'Método não permitido.' });
    return;
  }

  const result =
    req.method === 'GET'
      ? await syncRead(req.query && req.query.webAppUrl)
      : await syncWrite(req.body);

  res.status(result.status).json(result.body);
}
