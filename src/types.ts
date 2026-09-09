/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ProductReplenishment {
  id: string;
  date: string;
  quantity: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string; // SKU Principal / Código Único
  skus?: string[]; // Variações / Múltiplos SKUs vinculados ao produto
  purchasePrice: number; // Preço de Compra (CMV)
  salePrice: number;     // Preço de Venda padrão
  stock: number;         // Estoque atual
  minimalStock: number;  // Estoque mínimo para alerta
  addedDate: string;     // Data de entrada
  category: string;
  mlFeeType: 'classic' | 'premium' | 'custom' | 'none'; // Tipo de anúncio
  customFeePercent?: number; // Comissão customizada
  shippingCost: number;   // Custo de frete padrão
  status?: 'active' | 'archived';
  replenishments?: ProductReplenishment[];
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  sku?: string;          // SKU do produto na venda
  adId?: string;         // # de Anúncio no Mercado Livre (ex: MLB3782694854)
  quantity: number;
  salePrice: number;     // Preço de venda praticado
  date: string;          // Data da venda
  mlFee: number;         // Taxa total do Mercado Livre
  shippingCost: number;  // Frete pago nesta venda
  purchasePrice: number; // Preço de compra na época
  grossProfit: number;   // Preço Venda - Preço Compra
  netProfit: number;     // Preço Venda - Preço Compra - Taxas - Frete - Imposto
  mlSaleUrl?: string;
  discount?: number;
  status?: 'pending' | 'completed' | 'refunded' | 'ignored';
  completionTime?: number;
  lossAmount?: number;
  lossReason?: string;
  shippingType?: 'transportadora' | 'full' | 'flex';
  isCustomSale?: boolean;
  customMlFee?: number;
  customShippingCost?: number;
  mlSaleId?: string;
  isMlSale?: boolean;
  shippingRevenue?: number;
  buyerName?: string;
  buyerDocument?: string;
  buyerAddress?: string;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetUrl: string;
  spreadsheetId: string;
  range: string;
  connected: boolean;
  lastSync?: string;
}

export interface MLImportRecord {
  id: string; // N.º de venda
  dateStr: string; // Data da venda original
  status: string; // Estado
  statusDescription: string; // Descrição do status
  multiProduct: boolean;
  isKit: boolean;
  units: number;
  productRevenue: number; // Coluna H
  surchargeRevenue: number; // Coluna I
  installmentFee: number; // Coluna J
  saleFeeAndTaxes: number; // Coluna K (Tarifa ML)
  shippingRevenue: number; // Coluna L
  shippingFee: number; // Coluna M (Tarifa Envio)
  shippingWeightCost: number;
  shippingDiffCost: number;
  discountsAndBonuses: number;
  refundsAndCancellations: number;
  totalBrl: number;
  billingMonth: string;
  isAdSale: boolean;
  adId: string; // # de anúncio
  adTitle: string; // Título do anúncio
  variation: string;
  adUnitPrice: number;
  adType: string;
  invoiceStatus: string;
  buyerName: string;
  buyerDocument: string;
  buyerAddress: string;
  shippingMethod: string;
  shippingDateGo: string;
  shippingDateDelivery: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  isClaimOpen: boolean;
  isClaimClosed: boolean;
  isInMediation: boolean;
  sku?: string;
}

export interface EntradaValorRecord {
  id: string; // N.º de Venda / Operação (ex: "2000001450876553")
  dateStr: string; // Data da Liberação
  description?: string;
  releaseStatus: string; // "Liberação" ou "Disponível"
  operationStatus?: string;
  productName: string;
}

export function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'em', 'um', 'uma', 'e', 'a', 'o', 'as', 'os', 'por', 'na', 'no', 'nas', 'nos']);

export function extractTokens(str: string): string[] {
  if (!str) return [];
  const norm = normalizeText(str);
  return norm.split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

const PRODUCT_TYPE_PATTERNS: Record<string, RegExp> = {
  adaptador: /adaptador|plug/,
  extensor: /extensor/,
  cabo: /cabo/,
  xuxinha: /xuxinha|rabicó|rabico|elástico|elastico/,
  teclado: /teclado/,
  fone: /fone|headset/,
  suporte: /suporte/,
  garrafa: /garrafa/,
  carregador: /carregador|fonte/,
  capa: /capa|case/,
};

export function getCoreProductType(str: string): string {
  if (!str) return '';
  const s = str.toLowerCase();
  for (const [type, pattern] of Object.entries(PRODUCT_TYPE_PATTERNS)) {
    if (pattern.test(s)) return type;
  }
  return '';
}

const INVALID_IDENTIFIERS = new Set(['sim', 'não', 'nao', 'ml']);
const MIN_IDENTIFIER_LENGTH = 3;
const MIN_DIGIT_LENGTH = 6;
const MIN_TOKEN_COUNT = 2;
const MIN_MATCH_SCORE = 0.5;
const MIN_TEXT_LENGTH = 3;

export function normalizeIdentifier(val: string): string {
  if (!val) return '';
  return String(val).replace(/^[#\s]+/, '').trim().toLowerCase();
}

function isValidIdentifier(normalized: string): boolean {
  return normalized.length > MIN_IDENTIFIER_LENGTH && !INVALID_IDENTIFIERS.has(normalized);
}

function matchByDigits(val1: string, val2: string): boolean {
  const digits1 = val1.replace(/\D/g, '');
  const digits2 = val2.replace(/\D/g, '');
  return digits1.length >= MIN_DIGIT_LENGTH && digits2.length >= MIN_DIGIT_LENGTH && digits1 === digits2;
}

function matchesSku(rSkuClean: string, p: Product): boolean {
  const allSkus = getAllProductSkus(p).map(s => normalizeIdentifier(s));
  const pIdClean = normalizeIdentifier(p.id || '');
  return allSkus.some(s => s === rSkuClean || matchByDigits(rSkuClean, s)) || (pIdClean && pIdClean === rSkuClean);
}

function matchesTitleExact(rTitleNorm: string, p: Product): boolean {
  const pNameNorm = normalizeText(p.name || '');
  if (!pNameNorm) return false;
  if (pNameNorm === rTitleNorm) return true;
  if (pNameNorm.length > 8 && rTitleNorm.includes(pNameNorm)) return true;
  if (rTitleNorm.length > 8 && pNameNorm.includes(rTitleNorm)) return true;
  return false;
}

function scoreTokenMatch(rTokens: string[], p: Product): number {
  const pTokens = extractTokens(p.name || '');
  if (pTokens.length === 0) return 0;
  const matchingTokens = pTokens.filter(t => rTokens.includes(t));
  return matchingTokens.length / Math.min(pTokens.length, rTokens.length);
}

export function getAllProductSkus(p: Product): string[] {
  if (!p) return [];
  const list: string[] = [];
  if (p.sku && p.sku.trim()) {
    list.push(p.sku.trim());
  }
  if (Array.isArray(p.skus)) {
    p.skus.forEach(s => {
      if (s && s.trim() && !list.includes(s.trim())) {
        list.push(s.trim());
      }
    });
  }
  return list;
}

export function findMatchingProduct(r: MLImportRecord, products: Product[]): Product | undefined {
  if (!products || products.length === 0) return undefined;

  const rSkuClean = normalizeIdentifier(r.sku || '');
  const rAdIdClean = normalizeIdentifier(r.adId || '');
  const rTitleNorm = normalizeText(r.adTitle || '');
  const rVariationClean = normalizeIdentifier(r.variation || '');

  // 1. Match by Ad ID
  if (isValidIdentifier(rAdIdClean)) {
    const matchByAdId = products.find(p => matchesSku(rAdIdClean, p));
    if (matchByAdId) return matchByAdId;
  }

  // 2. Match by SKU / Variations
  if (isValidIdentifier(rSkuClean)) {
    const matchBySku = products.find(p => matchesSku(rSkuClean, p));
    if (matchBySku) return matchBySku;
  }

  // 3. Match by Exact Title or Substring
  if (rTitleNorm.length > MIN_TEXT_LENGTH) {
    const matchByTitle = products.find(p => matchesTitleExact(rTitleNorm, p));
    if (matchByTitle) return matchByTitle;
  }

  // 4. Match by Token Overlap
  if (rTitleNorm.length > MIN_TEXT_LENGTH) {
    const rTokens = extractTokens(r.adTitle || '');
    const rType = getCoreProductType(r.adTitle || '');

    let bestMatch: Product | undefined;
    let bestScore = 0;

    for (const p of products) {
      const pType = getCoreProductType(p.name || '');
      if (rType && pType && rType !== pType) continue;

      const score = scoreTokenMatch(rTokens, p);
      const matchingTokens = rTokens.filter(t => extractTokens(p.name || '').includes(t));

      if (matchingTokens.length >= MIN_TOKEN_COUNT && score >= MIN_MATCH_SCORE && score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return undefined;
}
