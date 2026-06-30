export default async function handler(req, res) {
  // Config CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({
      status: 'error',
      message: 'Método não permitido.'
    });
    return;
  }

  const webAppUrl = req.method === 'GET' ? req.query.webAppUrl : (req.body || {}).webAppUrl;

  if (!webAppUrl) {
    res.status(400).json({ 
      status: 'error', 
      message: 'A URL do Web App do Google Sheets está ausente.' 
    });
    return;
  }

  try {
    let response;
    if (req.method === 'GET') {
      console.log(`Disparando busca ao Web App do Google Sheets: ${webAppUrl}`);
      response = await fetch(webAppUrl);
    } else {
      const { products, sales } = req.body || {};
      response = await fetch(webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ products, sales })
      });
    }

    if (!response.ok) {
      throw new Error(`Google Sheets API retornou status HTTP ${response.status}`);
    }

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (err) {
      if (req.method === 'GET') {
        console.error('Falha ao decodificar JSON retornado pelo Apps Script:', responseText.substring(0, 500));
        res.status(502).json({
          status: 'error',
          message: 'A resposta do Google Sheets Apps Script não é um JSON válido. Verifique se o script foi implantado corretamente como Web App.'
        });
        return;
      }
      // Se for POST e a resposta não for JSON puro, tratamos texto bruto como mensagem de sucesso
      responseData = { 
        status: 'success', 
        message: responseText || 'Planilha integrada e gravada com sucesso.' 
      };
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Erro de Sincronização no Vercel Proxy:', error);
    res.status(500).json({
      status: 'error',
      message: `Ocorreu um erro ao gravar os dados na sua planilha: ${error.message || error}`
    });
  }
}
