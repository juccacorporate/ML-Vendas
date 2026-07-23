/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  purchasePrice: number; // Preço de Compra
  salePrice: number;     // Preço de Venda padrão
  stock: number;         // Estoque atual
  minimalStock: number;  // Estoque mínimo para alerta
  addedDate: string;     // Data de entrada (para calcular tempo parado)
  category: string;
  mlFeeType: 'classic' | 'premium' | 'custom' | 'none'; // Tipo de anúncio Mercado Livre
  customFeePercent?: number; // Comissão customizada
  shippingCost: number;   // Custo de frete padrão
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
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
  status?: 'pending' | 'completed' | 'refunded'; // Status da venda
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

export function findMatchingProduct(r: MLImportRecord, products: Product[]): Product | undefined {
  if (!products || products.length === 0) return undefined;

  const rSkuClean = (r.sku || '').trim().toLowerCase();
  const rAdIdClean = (r.adId || '').trim().toLowerCase();
  const adTitleLower = (r.adTitle || '').toLowerCase().trim();

  // 1. Se o título for genérico ou booleano, ignoramos no comparativo de título
  const isGenericTitle = !adTitleLower || ['sim', 'não', 'nao', 'true', 'false', 'produto mercado livre'].includes(adTitleLower);

  // 2. Busca exata ou parcial por SKU no estoque
  if (rSkuClean && !['sim', 'não', 'nao', 'ml'].includes(rSkuClean)) {
    const matchBySku = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      const pNameClean = p.name.trim().toLowerCase();
      if (pSkuClean && (pSkuClean === rSkuClean || rSkuClean.includes(pSkuClean) || pSkuClean.includes(rSkuClean))) return true;
      if (pNameClean && (pNameClean.includes(rSkuClean) || rSkuClean.includes(pNameClean))) return true;
      return false;
    });
    if (matchBySku) return matchBySku;
  }

  // 3. Busca por ID do anúncio (adId) na SKU ou Nome do produto
  if (rAdIdClean && rAdIdClean.length > 3) {
    const matchByAdId = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      const pNameClean = p.name.trim().toLowerCase();
      return (pSkuClean && pSkuClean.includes(rAdIdClean)) || (pNameClean && pNameClean.includes(rAdIdClean));
    });
    if (matchByAdId) return matchByAdId;
  }

  // 4. Coletar textos candidatos do registro para verificação cruzada
  const candidateTexts: string[] = [];
  if (!isGenericTitle) candidateTexts.push(adTitleLower);
  if (r.sku && !['sim', 'não', 'nao'].includes(r.sku.toLowerCase())) candidateTexts.push(r.sku.toLowerCase());
  if (r.variation && !['sim', 'não', 'nao'].includes(r.variation.toLowerCase())) candidateTexts.push(r.variation.toLowerCase());

  // Verificar inclusão exata ou de substrings de nomes de produtos
  for (const text of candidateTexts) {
    for (const p of products) {
      const pNameLower = p.name.toLowerCase().trim();
      const pSkuLower = (p.sku || '').toLowerCase().trim();

      if (pSkuLower && text.includes(pSkuLower)) return p;

      // Filtros de distinção de especificações técnicas (ex: 20cm, 90º, 144, 192, 2 metros)
      const isAdCurto = text.includes('20 cm') || text.includes('20cm') || text.includes('curto') || text.includes('20c');
      const isAd90 = text.includes('90') || text.includes('90°') || text.includes('90º') || text.includes('90graus');
      const isAd2m = text.includes('2 metro') || text.includes('2m') || text.includes('2 metros');
      const isAd144 = text.includes('144');
      const isAd192 = text.includes('192');

      const isProdCurto = pNameLower.includes('20cm') || pNameLower.includes('20 cm') || pNameLower.includes('curto');
      const isProd90 = pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°') || pNameLower.includes('90º');
      const isProd2m = pNameLower.includes('2 metro') || pNameLower.includes('2m') || pNameLower.includes('2 metros');
      const isProd144 = pNameLower.includes('144');
      const isProd192 = pNameLower.includes('192');

      if (isProdCurto && !isAdCurto) continue;
      if (isProd90 && !isAd90) continue;
      if (isProd2m && !isAd2m) continue;
      if (isProd144 && !isAd144) continue;
      if (isProd192 && !isAd192) continue;

      const normText = text.replace(/[°ºª]/g, '');
      const normPName = pNameLower.replace(/[°ºª]/g, '');

      if (normText.includes(normPName) || normPName.includes(normText)) {
        return p;
      }
    }
  }

  // Helper para extrair palavras-chave ignorando termos genéricos
  const getKeywords = (str: string) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['para', 'com', 'sem', 'dos', 'das', 'tipo', 'turbo', 'kit', 'par', 'unidades', 'unidade', 'sim', 'nao', 'mercado', 'livre'].includes(w));
  };

  const allWords = candidateTexts.flatMap(t => getKeywords(t));
  if (allWords.length === 0) return undefined;

  let bestMatch: Product | undefined = undefined;
  let maxScore = 0;

  for (const p of products) {
    const pNameLower = p.name.toLowerCase();
    const isProdCurto = pNameLower.includes('20cm') || pNameLower.includes('20 cm') || pNameLower.includes('curto');
    const isProd90 = pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°') || pNameLower.includes('90º');
    const isProd144 = pNameLower.includes('144');
    const isProd192 = pNameLower.includes('192');

    const combinedText = candidateTexts.join(' ');
    if (isProdCurto && !(combinedText.includes('20') || combinedText.includes('curto'))) continue;
    if (isProd90 && !combinedText.includes('90')) continue;
    if (isProd144 && !combinedText.includes('144')) continue;
    if (isProd192 && !combinedText.includes('192')) continue;

    const pWords = getKeywords(p.name);
    let score = 0;
    for (const w of pWords) {
      if (allWords.includes(w)) {
        score += 2;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestMatch = p;
    }
  }

  if (maxScore >= 4) {
    return bestMatch;
  }

  return undefined;
}

