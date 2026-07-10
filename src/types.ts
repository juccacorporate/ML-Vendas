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

  // 1. Prioridade absoluta: SKU exato (ignorando maiúsculas/minúsculas e espaços)
  if (r.sku) {
    const rSkuClean = String(r.sku).trim().toLowerCase();
    if (rSkuClean) {
      const matchBySku = products.find(p => {
        const pSkuClean = (p.sku || '').trim().toLowerCase();
        return pSkuClean && (pSkuClean === rSkuClean || rSkuClean.includes(pSkuClean) || pSkuClean.includes(rSkuClean));
      });
      if (matchBySku) return matchBySku;
    }
  }

  // 2. Busca por id do anúncio (adId) na SKU do produto
  if (r.adId) {
    const rAdIdClean = String(r.adId).trim().toLowerCase();
    if (rAdIdClean) {
      const matchByAdIdInSku = products.find(p => {
        const pSkuClean = (p.sku || '').trim().toLowerCase();
        return pSkuClean && pSkuClean.includes(rAdIdClean);
      });
      if (matchByAdIdInSku) return matchByAdIdInSku;
    }
  }

  // 3. Fallback: Busca inteligente por nome e regras de distinção estrita dos cabos
  const matchByName = products.find(p => {
    const adTitleLower = r.adTitle.toLowerCase();
    const pNameLower = p.name.toLowerCase();
    const pSkuLower = (p.sku || '').toLowerCase();

    // Caso o título do anúncio contenha a SKU do produto
    if (pSkuLower && adTitleLower.includes(pSkuLower)) {
      return true;
    }

    const isAdCurto = adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto') || adTitleLower.includes('20c');
    const isAd90 = adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('90º') || adTitleLower.includes('90graus');

    const isProdCurto = pNameLower.includes('20cm') || pNameLower.includes('20 cm') || pNameLower.includes('curto');
    const isProd90 = pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°') || pNameLower.includes('90º');

    // Se o produto for do tipo curto (20cm)
    if (isProdCurto) {
      return isAdCurto;
    }

    // Se o produto for do tipo 90 graus
    if (isProd90) {
      return isAd90 && !isAdCurto;
    }

    // Se o produto for o cabo simples (Hrebos simples - contém hrebos mas não é 90 nem curto)
    if (pNameLower.includes('hrebos')) {
      return adTitleLower.includes('hrebos') && !isAd90 && !isAdCurto;
    }

    // Normalização básica de caracteres especiais como ordinal ou grau
    const normAdTitle = adTitleLower.replace(/[°ºª]/g, '');
    const normPName = pNameLower.replace(/[°ºª]/g, '');

    // Correspondência parcial genérica
    return normAdTitle.includes(normPName) || normPName.includes(normAdTitle);
  });

  return matchByName;
}

