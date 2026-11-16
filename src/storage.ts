/**
 * Acesso seguro ao localStorage.
 *
 * O localStorage pode lançar exceção (cota de 5 MB estourada, modo privado, cookies/dados de site
 * bloqueados). Em React, uma exceção dentro de um efeito derruba a tela inteira (tela branca).
 * Estas funções nunca lançam: em caso de falha apenas retornam o valor padrão.
 */

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`[storage] Não foi possível salvar "${key}" no navegador:`, err);
    return false;
  }
}

export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignorado */
  }
}

export function storageGetJSON<T>(key: string, fallback: T): T {
  const raw = storageGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Chaves que versões anteriores gravavam a cada alteração mas que NUNCA eram lidas de volta
 * (a nuvem é a fonte da verdade). Eram a principal causa de estouro de cota e lentidão.
 */
const LEGACY_UNUSED_KEYS = ['ml_products', 'ml_sales', 'ml_records'];

export function cleanupLegacyStorage(): void {
  LEGACY_UNUSED_KEYS.forEach(storageRemove);
}
