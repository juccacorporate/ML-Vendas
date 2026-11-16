/**
 * Utilitários da sincronização com a nuvem (Google Sheets via /api/sync-sheets).
 */

// A Vercel recusa corpos de requisição acima de ~4,5 MB (HTTP 413, resposta que não é JSON).
// Verificamos antes de enviar para mostrar uma mensagem clara em vez de uma falha misteriosa.
export const MAX_POST_BYTES = 4_200_000;

export function utf8Size(text: string): number {
  try {
    return new Blob([text]).size;
  } catch {
    return text.length;
  }
}

/** Traduz falhas HTTP (inclusive respostas que não são JSON) em mensagens compreensíveis. */
export function httpErrorMessage(status: number, result: any): string {
  if (result && typeof result.message === 'string' && result.message) return result.message;
  if (status === 413) {
    return 'Os dados são grandes demais para o servidor aceitar em uma única gravação (limite de ~4,5 MB na hospedagem).';
  }
  if (status === 504 || status === 408) {
    return 'O servidor demorou demais para responder (tempo limite). Tente novamente em instantes.';
  }
  if (status === 429) {
    return 'Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.';
  }
  return `HTTP ${status}`;
}

/** União (sem duplicar, ignorando maiúsculas/minúsculas) da lista local de produtos banidos com a da nuvem. */
export function mergeBannedProducts(local: string[], incoming: any[]): string[] {
  const seen = new Set(local.map(b => String(b).trim().toLowerCase()));
  const merged = [...local];
  incoming.forEach((b: any) => {
    const str = typeof b === 'string' ? b : (b && b.name) || String(b);
    const key = String(str || '').trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push(String(str).trim());
    }
  });
  return merged;
}
