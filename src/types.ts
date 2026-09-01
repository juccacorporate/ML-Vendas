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
  skus?: string[]; // Variações / Múltiplos SKUs vinculados ao produto (ex: ABC123, ABC345, ABC587)
  purchasePrice: number; // Preço de Compra
  salePrice: number;     // Preço de Venda padrão
  stock: number;         // Estoque atual
  minimalStock: number;  // Estoque mínimo para alerta
  addedDate: string;     // Data de entrada (para calcular tempo parado)
  category: string;
  mlFeeType: 'classic' | 'premium' | 'custom' | 'none'; // Tipo de anúncio Mercado Livre
  customFeePercent?: number; // Comissão customizada
  shippingCost: number;   // Custo de frete padrão
  status?: 'active' | 'archived'; // Status do produto
  replenishments?: ProductReplenishment[]; // Histórico de reposição de estoque
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
  mlFee: number;         // Taxa total do Mercado Livre (percentual + fixa se < R$79)
  shippingCost: number;  // Frete pago nesta venda
  purchasePrice: number; // Preço de compra na época (para lucro exato)
  grossProfit: number;   // Preço Venda - Preço Compra
  netProfit: number;     // Preço Venda - Preço Compra - Taxas - Frete
  mlSaleUrl?: string;    // Link opcional do anúncio no ML
  discount?: number;     // Desconto em R$ aplicado à venda
  status?: 'pending' | 'completed' | 'refunded' | 'ignored'; // Status da venda
  completionTime?: number; // Tempo em milissegundos para conclusão no sistema
  lossAmount?: number;     // Prejuízo extra do estorno/cancelamento
  lossReason?: string;     // Motivo curto do prejuízo no estorno
  shippingType?: 'transportadora' | 'full' | 'flex'; // Tipo de Envio: Mercado Livre Full, Transportadora ou Flex
  isCustomSale?: boolean; // Se a venda teve taxas ajustadas manualmente
  customMlFee?: number;   // Comissão unitária customizada na venda
  customShippingCost?: number; // Frete unitário customizado na venda
  mlSaleId?: string;      // ID da venda do Mercado Livre
  isMlSale?: boolean;     // Se é uma venda vinda do Mercado Livre
  shippingRevenue?: number; // Receita por envio / bônus
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
  multiProduct: boolean; // Pacote de diversos produtos
  isKit: boolean; // Pertence a um kit
  units: number; // Unidades
  productRevenue: number; // Receita por produtos
  surchargeRevenue: number; // Receita por acréscimo
  installmentFee: number; // Taxa de parcelamento
  saleFeeAndTaxes: number; // Tarifa de venda e impostos (valor negativo)
  shippingRevenue: number; // Receita por envio
  shippingFee: number; // Tarifas de envio
  shippingWeightCost: number; // Custo de envio medidas/peso
  shippingDiffCost: number; // Custo por diferenças
  discountsAndBonuses: number; // Descontos e bônus
  refundsAndCancellations: number; // Cancelamentos e reembolsos
  totalBrl: number; // Total BRL
  billingMonth: string; // Mês de faturamento
  isAdSale: boolean; // Venda por publicidade
  adId: string; // # de anúncio
  adTitle: string; // Título do anúncio
  variation: string; // Variação
  adUnitPrice: number; // Preço unitário
  adType: string; // Tipo de anúncio (Clássico, Premium)
  invoiceStatus: string; // NF-e em anexo
  buyerName: string; // Dados pessoais ou da empresa
  buyerDocument: string; // Tipo e número do documento
  buyerAddress: string; // Endereço
  shippingMethod: string; // Forma de entrega
  shippingDateGo: string; // Data a caminho
  shippingDateDelivery: string; // Data de entrega
  carrier: string; // Transportador
  trackingNumber: string; // Número de rastreamento
  trackingUrl: string; // URL de acompanhamento
  isClaimOpen: boolean; // Reclamação aberta
  isClaimClosed: boolean; // Reclamação encerrada
  isInMediation: boolean; // Em mediação
  sku?: string; // SKU do anúncio/venda
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

export function extractTokens(str: string): string[] {
  const norm = normalizeText(str);
  const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem', 'em', 'um', 'uma', 'e', 'a', 'o', 'as', 'os', 'por', 'na', 'no', 'nas', 'nos']);
  return norm.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
}

export function getCoreProductType(str: string): string {
  if (!str) return '';
  const s = str.toLowerCase();
  if (s.includes('adaptador') || s.includes('plug')) return 'adaptador';
  if (s.includes('extensor') || (s.includes('cabo') && s.includes('extensor'))) return 'extensor';
  if (s.includes('cabo')) return 'cabo';
  if (s.includes('xuxinha') || s.includes('rabicó') || s.includes('rabico') || s.includes('elástico') || s.includes('elastico')) return 'xuxinha';
  if (s.includes('teclado')) return 'teclado';
  if (s.includes('fone') || s.includes('headset')) return 'fone';
  if (s.includes('suporte')) return 'suporte';
  if (s.includes('garrafa')) return 'garrafa';
  if (s.includes('carregador') || s.includes('fonte')) return 'carregador';
  if (s.includes('capa') || s.includes('case')) return 'capa';
  return '';
}

/**
 * Normaliza identificadores removendo '#' e espaços extras
 */
export function normalizeIdentifier(val: string): string {
  if (!val) return '';
  return String(val).replace(/^[#\s]+/, '').trim().toLowerCase();
}

/**
 * Retorna todos os SKUs e # de Anúncio válidos associados a um produto (SKU principal + # de anúncio + variações)
 */
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

  // 1. Busca Direta por # de Anúncio (adId / MLB...) no estoque
  if (rAdIdClean && rAdIdClean.length > 3 && !['sim', 'não', 'nao', 'ml'].includes(rAdIdClean)) {
    const matchByAdId = products.find(p => {
      const allSkus = getAllProductSkus(p).map(s => normalizeIdentifier(s));
      const pIdClean = normalizeIdentifier(p.id || '');
      // Compara exato ou sem prefixo mlb (se ambos forem dígitos)
      const rDigitsOnly = rAdIdClean.replace(/\D/g, '');
      return allSkus.some(s => {
        if (s === rAdIdClean) return true;
        const sDigitsOnly = s.replace(/\D/g, '');
        return rDigitsOnly.length >= 6 && sDigitsOnly.length >= 6 && rDigitsOnly === sDigitsOnly;
      }) || (pIdClean && pIdClean === rAdIdClean);
    });
    if (matchByAdId) return matchByAdId;
  }

  // 2. Busca por SKU exata ou variações de SKU no estoque (Multi-SKU)
  if (rSkuClean && !['sim', 'não', 'nao', 'ml'].includes(rSkuClean)) {
    const matchBySku = products.find(p => {
      const allSkus = getAllProductSkus(p).map(s => normalizeIdentifier(s));
      const pIdClean = normalizeIdentifier(p.id || '');
      const rDigitsOnly = rSkuClean.replace(/\D/g, '');
      return allSkus.some(s => {
        if (s === rSkuClean) return true;
        const sDigitsOnly = s.replace(/\D/g, '');
        return rDigitsOnly.length >= 6 && sDigitsOnly.length >= 6 && rDigitsOnly === sDigitsOnly;
      }) || (pIdClean && pIdClean === rSkuClean);
    });
    if (matchBySku) return matchBySku;
  }

  // 2.1 Busca por Variação que contenha algum dos # de Anúncio ou SKUs do produto
  if (rVariationClean && rVariationClean.length > 2) {
    const matchByVar = products.find(p => {
      const allSkus = getAllProductSkus(p).map(s => normalizeIdentifier(s));
      return allSkus.some(sku => sku.length > 2 && rVariationClean.includes(sku));
    });
    if (matchByVar) return matchByVar;
  }

  // 3. Busca por Título Exato ou Substring no Estoque (Regra 1.2 e 6.2 do Manual)
  if (rTitleNorm && rTitleNorm.length > 3) {
    const matchByTitle = products.find(p => {
      const pNameNorm = normalizeText(p.name || '');
      return pNameNorm && (pNameNorm === rTitleNorm || (pNameNorm.length > 8 && rTitleNorm.includes(pNameNorm)) || (rTitleNorm.length > 8 && pNameNorm.includes(rTitleNorm)));
    });
    if (matchByTitle) return matchByTitle;
  }

  // 4. Busca por Sobreposição de Palavras-Chave (Tokens) com Guarda de Categoria/Tipo
  if (rTitleNorm && rTitleNorm.length > 3) {
    const rTokens = extractTokens(r.adTitle || '');
    const rType = getCoreProductType(r.adTitle || '');

    let bestMatch: Product | undefined;
    let bestScore = 0;

    for (const p of products) {
      const pType = getCoreProductType(p.name || '');
      if (rType && pType && rType !== pType) continue; // Evita que adaptador vire cabo ou fone

      const pTokens = extractTokens(p.name || '');
      if (pTokens.length === 0) continue;

      const matchingTokens = pTokens.filter(t => rTokens.includes(t));
      const score = matchingTokens.length / Math.min(pTokens.length, rTokens.length);

      if (matchingTokens.length >= 2 && score >= 0.5 && score > bestScore) {
        bestScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return undefined;
}

export interface EntradaValorRecord {
  id: string; // N.º de Venda / Operação / Pacote (ex: "2000001450876553")
  dateStr: string; // Data da Entrada / Liberação (ex: "23/08/2026")
  description?: string; // Descrição do Recebimento ("Liberação")
  releaseStatus: string; // Tipo de Operação ("Liberação" ou "Disponível")
  operationStatus?: string; // Status da Operação ("Pago", "Cancelado", etc.)
  productName: string; // Produto Vinculado / Título do Anúncio (ex: "Kit 144 Xuxinha...")
}

