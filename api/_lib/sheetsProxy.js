/**
 * Núcleo ÚNICO do proxy com o Google Apps Script / Google Sheets.
 *
 * É usado tanto pelas funções serverless da Vercel (api/*.js) quanto pelo servidor local (server.ts).
 * Antes existiam duas implementações diferentes (uma em api/sync-sheets.js e outra em server.ts),
 * que enviavam campos diferentes para a planilha e tinham regras de segurança diferentes — a principal
 * causa de o app "ora funcionar, ora não" conforme o ambiente (local x produção).
 *
 * Pastas/arquivos que começam com "_" dentro de /api NÃO viram rotas na Vercel.
 */

// Somente URLs de Web App do Google Apps Script são aceitas (evita que o proxy seja usado
// para acessar endereços arbitrários na internet ou na rede interna — SSRF).
const APPS_SCRIPT_URL_RE = /^https:\/\/script\.google\.com\/(?:a\/macros\/[A-Za-z0-9._-]+\/|macros\/)s\/[A-Za-z0-9_-]+\/(?:exec|dev)$/;
const SPREADSHEET_ID_RE = /\/d\/([a-zA-Z0-9-_]+)/;

// Orçamento total de tempo por requisição. Fica abaixo do maxDuration configurado em vercel.json (60s).
const TOTAL_BUDGET_MS = 55000;

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*'
};

export function isAllowedWebAppUrl(value) {
  return typeof value === 'string' && value.length <= 300 && APPS_SCRIPT_URL_RE.test(value.trim());
}

function isAbortError(error) {
  return (
    !!error &&
    (error.name === 'AbortError' ||
      error.code === 'ABORT_ERR' ||
      String(error).includes('aborted') ||
      String(error).includes('AbortError'))
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * fetch com tempo limite, que lê o corpo DENTRO do limite (antes uma resposta que "travava"
 * depois dos cabeçalhos podia pendurar a requisição para sempre) e com nova tentativa apenas
 * para operações seguras (GET).
 */
async function fetchText(url, { method = 'GET', headers = {}, body, retries = 0, budgetMs = TOTAL_BUDGET_MS } = {}) {
  const startedAt = Date.now();
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = budgetMs - (Date.now() - startedAt);
    if (remaining < 3000) break;

    // Cada tentativa pode usar TODO o tempo que resta: o Apps Script às vezes demora 30s+ (cold start / planilha grande)
    // e ainda assim responde com sucesso. Dividir o orçamento entre as tentativas fazia esses casos falharem.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    try {
      const response = await fetch(url, {
        method,
        body,
        redirect: 'follow',
        headers: { ...DEFAULT_HEADERS, ...headers },
        signal: controller.signal
      });
      const text = await response.text();
      return { response, text };
    } catch (error) {
      lastError = error;
      // Tempo esgotado: o orçamento acabou, repetir não adianta. Só repetimos falhas rápidas de rede.
      if (attempt < retries && !isAbortError(error)) {
        console.warn(`[Sheets Proxy] Tentativa ${attempt + 1} falhou (${error && error.message ? error.message : error}). Tentando novamente...`);
        await sleep(800);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('Tempo limite de conexão excedido.');
}

function describeHttpError(status, mode) {
  let msg = `Google Sheets API retornou status HTTP ${status}.`;
  if (status === 401 || status === 403) {
    msg = `O Google negou o acesso ao Web App do Apps Script (HTTP ${status} - "Acesso negado"). No Apps Script, abra Implantar > Gerenciar implantações > Editar e confirme: "Executar como: Eu" e "Quem pode acessar: Qualquer pessoa". Depois salve criando uma "Nova versão" e use a URL que termina com '/exec'.`;
  } else if (status === 404) {
    msg =
      mode === 'write'
        ? "A URL do Web App do Google Apps Script não foi encontrada (HTTP 404). Verifique se a URL termina com '/exec' e se a implantação está ativa."
        : "A URL do Web App do Google Apps Script não foi encontrada (HTTP 404). Isso ocorre quando a URL está incorreta ou o Web App foi excluído/desativado. Verifique no seu Google Sheets: Extensões > Apps Script > Implantar > Gerenciar implantações e copie a URL do Web App que termina com '/exec'.";
  } else if (status === 500) {
    msg +=
      mode === 'write'
        ? ' Isso geralmente indica erro de código ou formato incorreto no seu Apps Script ao gravar. Por favor, cheque a aba "Execuções" no painel do Google Apps Script.'
        : ' Isso geralmente significa que há um erro interno de execução no seu código do Apps Script (como uma coluna ausente ou uma fórmula inválida na planilha). Por favor, verifique no menu "Execuções" do seu Apps Script para ver o log de erro detalhado.';
  }
  return msg;
}

function looksLikeHtml(text) {
  return text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<script');
}

function describeThrown(error, mode) {
  if (isAbortError(error)) {
    return mode === 'write'
      ? 'O envio de dados demorou mais do que o esperado (Tempo limite excedido). Verifique sua conexão e tente salvar novamente.'
      : 'A conexão com o Google Sheets demorou mais do que o esperado (Tempo limite excedido). Por favor, clique em "Atualizar Agora" para re-tentar.';
  }
  return (error && error.message) || String(error);
}

function invalidUrlResponse(webAppUrl) {
  if (!webAppUrl) {
    return { status: 400, body: { status: 'error', message: 'A URL do Web App do Google Sheets está ausente.' } };
  }
  return {
    status: 400,
    body: {
      status: 'error',
      message:
        "A URL informada não é um Web App válido do Google Apps Script. Use a URL que começa com 'https://script.google.com/macros/s/' e termina com '/exec'."
    }
  };
}

/** GET: lê todos os dados da planilha através do Web App. */
export async function syncRead(webAppUrl) {
  if (!isAllowedWebAppUrl(webAppUrl)) return invalidUrlResponse(webAppUrl);

  try {
    const { response, text } = await fetchText(webAppUrl.trim(), { retries: 1 });

    if (!response.ok) {
      return { status: 502, body: { status: 'error', message: describeHttpError(response.status, 'read') } };
    }

    try {
      return { status: 200, body: JSON.parse(text) };
    } catch (parseError) {
      console.error('Falha ao decodificar JSON retornado pelo Apps Script:', text.substring(0, 500));
      const message = looksLikeHtml(text)
        ? '⚠️ Sua planilha do Google Sheets retornou uma página de erro do Google (Erro 500/Sintaxe). Isso ocorre quando o Apps Script possui erros de sintaxe ou autorização de conta. Para corrigir: \n1. Abra sua planilha e acesse "Extensões > Apps Script".\n2. Copie o NOVO código do Passo 3 da plataforma e cole substituindo todo o código atual.\n3. Salve clicando no disquete 💾.\n4. Clique em "Implantar" > "Gerenciar implantações" > clique no ícone de Lápis (Editar) > NO SELETOR DE VERSÃO mude para "Nova versão" (Obrigatoriamente!) e clique em "Implantar".'
        : 'A resposta do Google Sheets Apps Script não é um JSON válido. Verifique se o script foi implantado corretamente como Web App.';
      return { status: 502, body: { status: 'error', message } };
    }
  } catch (error) {
    console.error('Erro de Sincronização no Proxy (GET):', error);
    return { status: 500, body: { status: 'error', message: describeThrown(error, 'read') } };
  }
}

/** POST: grava produtos, vendas e demais dados na planilha através do Web App. */
export async function syncWrite(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const { webAppUrl, products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix, bannedProducts } = body;

  if (!isAllowedWebAppUrl(webAppUrl)) return invalidUrlResponse(webAppUrl);

  // Trava de segurança SSOT: nunca enviar gravação vazia que possa apagar a planilha do usuário
  if (!Array.isArray(products) || products.length === 0) {
    console.warn('[Sheets Proxy] Gravação cancelada por segurança: lista de produtos vazia.');
    return {
      status: 200,
      body: {
        status: 'success',
        ignored: true,
        message: 'Gravação ignorada para proteger a integridade do banco de dados (lista de produtos vazia).'
      }
    };
  }

  try {
    // POST não é repetido automaticamente: uma tentativa que estourou o tempo pode ainda estar
    // gravando no Google, e repetir geraria duas gravações concorrentes.
    const { response, text } = await fetchText(webAppUrl.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix, bannedProducts }),
      retries: 0
    });

    if (!response.ok) {
      return { status: 502, body: { status: 'error', message: describeHttpError(response.status, 'write') } };
    }

    try {
      return { status: 200, body: JSON.parse(text) };
    } catch (parseError) {
      if (looksLikeHtml(text)) {
        return {
          status: 502,
          body: {
            status: 'error',
            message:
              '⚠️ Sua planilha do Google Sheets retornou uma página de erro do Google (Erro 500/Sintaxe) ao salvar. Certifique-se de copiar o novo código do Passo 3, salvá-lo no Apps Script, e criar uma "Nova versão" ao Implantar como Web App de acesso público ("Qualquer pessoa").'
          }
        };
      }
      // Texto simples vindo do Apps Script é tratado como mensagem de sucesso
      return { status: 200, body: { status: 'success', message: text || 'Planilha integrada e gravada com sucesso.' } };
    }
  } catch (error) {
    console.error('Erro de Sincronização no Proxy (POST):', error);
    return { status: 500, body: { status: 'error', message: describeThrown(error, 'write') } };
  }
}

/** Busca a URL do Web App gravada na aba "Database" da planilha (usada para auto-recuperação da URL). */
export async function lookupWebAppUrl(spreadsheetUrl) {
  try {
    if (typeof spreadsheetUrl !== 'string' || !spreadsheetUrl) return { status: 200, body: { webAppUrl: null } };
    const match = spreadsheetUrl.match(SPREADSHEET_ID_RE);
    if (!match) return { status: 200, body: { webAppUrl: null } };

    const csvUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv&sheet=Database`;
    const { response, text } = await fetchText(csvUrl, { retries: 0, budgetMs: 15000 });
    if (response.ok) {
      const scriptMatch = text.match(/https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9-_]+\/exec/);
      if (scriptMatch) return { status: 200, body: { webAppUrl: scriptMatch[0] } };
    }
    return { status: 200, body: { webAppUrl: null } };
  } catch (error) {
    return { status: 200, body: { webAppUrl: null } };
  }
}
