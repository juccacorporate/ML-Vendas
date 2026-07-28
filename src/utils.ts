/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale } from './types';

// Taxas padrão do Mercado Livre e Impostos
export const ML_CLASSIC_PERCENT = 12; // 12% de comissão
export const ML_PREMIUM_PERCENT = 17; // 17% de comissão (permite parcelamento sem juros)
export const ML_FIXED_FEE_LIMIT = 79; // Produtos abaixo de R$ 79 têm taxa fixa
export const ML_FIXED_FEE_AMOUNT = 6.00; // Taxa fixa de R$ 6.00 por unidade
export const TAX_PERCENT = 4; // Imposto padrão de 4% sobre a venda

/**
 * Normaliza textos para comparação flexível (remove acentos, pontuação e caixa alta/baixa)
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Encontra o produto correspondente para uma venda no catálogo de produtos
 */
export function findProductForSale(s: Sale, productsList: Product[]): Product | undefined {
  if (!productsList || productsList.length === 0) return undefined;

  const rawName = (s.productName || '').trim();
  const rawNameLower = rawName.toLowerCase();
  const isBadName = !rawName || ['sim', 'não', 'nao', 'produto mercado livre', 'true', 'false'].includes(rawNameLower);

  // 1. Se o nome do produto na venda for válido, tentar casar pelo nome do produto
  if (!isBadName) {
    const sNameNorm = normalizeName(rawName);

    // Exact match
    const exactMatch = productsList.find(p => normalizeName(p.name) === sNameNorm);
    if (exactMatch) return exactMatch;

    // Spec distinction match (evitar que 20cm cante em 90º, ou 144 cante em 102/192)
    const isAdCurto = rawNameLower.includes('20cm') || rawNameLower.includes('20 cm') || rawNameLower.includes('curto');
    const isAd90 = rawNameLower.includes('90') || rawNameLower.includes('90º') || rawNameLower.includes('90°') || rawNameLower.includes('90graus');
    const isAd144 = rawNameLower.includes('144');
    const isAd102 = rawNameLower.includes('102');

    for (const p of productsList) {
      const pNameLower = p.name.toLowerCase();
      const isProdCurto = pNameLower.includes('20cm') || pNameLower.includes('20 cm') || pNameLower.includes('curto');
      const isProd90 = pNameLower.includes('90') || pNameLower.includes('90º') || pNameLower.includes('90°') || pNameLower.includes('90graus');
      const isProd144 = pNameLower.includes('144');
      const isProd102 = pNameLower.includes('102');

      if (isProdCurto && !isAdCurto) continue;
      if (isProd90 && !isAd90) continue;
      if (isProd144 && !isAd144) continue;
      if (isProd102 && !isAd102) continue;

      const normPName = normalizeName(p.name);
      if (normPName && sNameNorm && (normPName.includes(sNameNorm) || sNameNorm.includes(normPName))) {
        return p;
      }
    }
  }

  // 2. Tentar por ID de produto se não casou por nome ou se nome era genérico
  const sPid = String(s.productId || '').trim();
  if (sPid && sPid !== 'unknown' && sPid !== 'null' && sPid !== 'undefined' && sPid !== '') {
    const matchById = productsList.find(p => String(p.id || '').trim() === sPid);
    if (matchById) return matchById;
  }

  // 3. Tentar por SKU
  const sSku = String((s as any).sku || '').trim().toLowerCase();
  if (sSku && !['sim', 'não', 'nao', 'ml'].includes(sSku)) {
    const matchBySku = productsList.find(p => (p.sku || '').trim().toLowerCase() === sSku);
    if (matchBySku) return matchBySku;
  }

  return undefined;
}

/**
 * Calcula o volume total de saídas (vendas ativas) para um produto específico
 */
export function calculateProductSalesVolume(
  product: Product,
  sales: Sale[],
  allProducts?: Product[]
): number {
  if (!sales || sales.length === 0 || !product) return 0;

  const productsList = allProducts && allProducts.length > 0 ? allProducts : [product];
  const targetId = String(product.id || '').trim();
  const targetNameNorm = normalizeName(product.name || '');

  return sales
    .filter(s => s.status !== 'refunded')
    .reduce((acc, s) => {
      const matched = findProductForSale(s, productsList);
      let isMatch = false;

      if (matched) {
        if (String(matched.id || '').trim() === targetId || normalizeName(matched.name) === targetNameNorm) {
          isMatch = true;
        }
      } else {
        const sPid = String(s.productId || '').trim();
        const sSku = String((s as any).sku || '').trim().toLowerCase();
        const targetSkuClean = (product.sku || '').trim().toLowerCase();

        if (targetId && sPid && sPid === targetId) {
          isMatch = true;
        } else if (targetSkuClean && targetSkuClean.length > 1 && !['sim', 'não', 'nao', 'ml'].includes(targetSkuClean) && sSku === targetSkuClean) {
          isMatch = true;
        }
      }

      if (isMatch) {
        return acc + (Number(s.quantity) || 1);
      }
      return acc;
    }, 0);
}

/**
 * Calcula o estoque atual restante de um produto (Estoque Inicial - Saídas)
 */
export function calculateCurrentStock(product: Product, sales: Sale[], allProducts?: Product[]): number {
  if (!product) return 0;
  const totalSold = calculateProductSalesVolume(product, sales, allProducts);
  return (product.stock || 0) - totalSold;
}

/**
 * Calcula o imposto (4%) incidente sobre o preço total de venda
 */
export function calculateTax(salePrice: number, quantity: number = 1): number {
  return Number(((salePrice * quantity * TAX_PERCENT) / 100).toFixed(2));
}

/**
 * Calcula a taxa cobrada pelo Mercado Livre para um produto
 */
export function calculateMLFee(salePrice: number, feeType: 'classic' | 'premium' | 'custom' | 'none', customPercent?: number): number {
  if (feeType === 'none') return 0;

  const percent = feeType === 'custom' && customPercent !== undefined
    ? customPercent
    : (feeType === 'classic' ? ML_CLASSIC_PERCENT : (feeType === 'premium' ? ML_PREMIUM_PERCENT : 0));
  
  let fee = (salePrice * percent) / 100;

  // Se o valor do produto for menor que R$ 79, adiciona o custo de taxa fixa de R$ 6.00 apenas para anúncios classic ou premium do ML
  if (salePrice < ML_FIXED_FEE_LIMIT && (feeType === 'classic' || feeType === 'premium')) {
    fee += ML_FIXED_FEE_AMOUNT;
  }

  return Number(fee.toFixed(2));
}

/**
 * Calcula os dias que um produto está parado em estoque de forma imune a fusos horários
 */
export function calculateDaysInStock(addedDateStr: string): number {
  if (!addedDateStr) return 0;
  
  // Garante parsing local dividindo partes
  const parts = addedDateStr.split('-');
  let addedDate: Date;
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    addedDate = new Date(year, month, day);
  } else {
    addedDate = new Date(addedDateStr);
  }
  
  const now = new Date();
  
  // Reset time to compare days only
  addedDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - addedDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return isNaN(diffDays) ? 0 : diffDays;
}

/**
 * Formata valores numéricos em BRL (Moeda Real)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Formata datas de forma robusta e independente de fuso horário
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Se for no formato YYYY-MM-DD, ex: 2026-06-29, formatamos de forma direta e imune a fusos horários
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  // Fallback seguro se não for no formato YYYY-MM-DD
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  
  // Se a string não contiver hora, extrai as partes UTC
  if (!dateStr.includes(':')) {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return date.toLocaleDateString('pt-BR');
}

/**
 * Dados iniciais simulados para demonstração imediata e estética do Dashboard
 */
export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Fone de Ouvido Bluetooth SoundPRO X',
    sku: 'ML-FONE-BT-001',
    purchasePrice: 45.00,
    salePrice: 129.90,
    stock: 24,
    minimalStock: 5,
    addedDate: '2026-05-10',
    category: 'Eletrônicos',
    mlFeeType: 'premium',
    shippingCost: 0
  },
  {
    id: 'prod_2',
    name: 'Suporte de Celular Veicular Magnético',
    sku: 'ML-SUP-VEIC-002',
    purchasePrice: 8.50,
    salePrice: 38.00,
    stock: 95,
    minimalStock: 15,
    addedDate: '2026-06-01',
    category: 'Acessórios Automotivos',
    mlFeeType: 'classic',
    shippingCost: 0
  },
  {
    id: 'prod_3',
    name: 'Teclado Mecânico Gamer RGB Silent',
    sku: 'ML-TEC-GMR-003',
    purchasePrice: 110.00,
    salePrice: 289.00,
    stock: 12,
    minimalStock: 4,
    addedDate: '2026-04-15',
    category: 'Informática',
    mlFeeType: 'premium',
    shippingCost: 22.90
  },
  {
    id: 'prod_4',
    name: 'Cabo Carregador USB-C Reforçado (2 metros)',
    sku: 'ML-CAB-USBC-004',
    purchasePrice: 4.80,
    salePrice: 24.90,
    stock: 150,
    minimalStock: 20,
    addedDate: '2026-05-28',
    category: 'Celulares e Acessórios',
    mlFeeType: 'classic',
    shippingCost: 0
  },
  {
    id: 'prod_5',
    name: 'Garrafa Térmica Esportiva Inox 750ml',
    sku: 'ML-GAR-TERM-005',
    purchasePrice: 32.00,
    salePrice: 89.90,
    stock: 3,
    minimalStock: 8,
    addedDate: '2026-03-20',
    category: 'Esporte e Fitness',
    mlFeeType: 'classic',
    shippingCost: 0
  }
];

export const INITIAL_SALES: Sale[] = [
  {
    id: 'sale_1',
    productId: 'prod_1',
    productName: 'Fone de Ouvido Bluetooth SoundPRO X',
    quantity: 2,
    salePrice: 129.90,
    date: '2026-06-15',
    mlFee: 44.17, // 17% de 259.80 = 44.17
    shippingCost: 0,
    purchasePrice: 45.00,
    grossProfit: 169.80, // (129.90 - 45.00) * 2 = 169.80
    netProfit: 125.63    // 169.80 - 44.17
  },
  {
    id: 'sale_2',
    productId: 'prod_2',
    productName: 'Suporte de Celular Veicular Magnético',
    quantity: 5,
    salePrice: 38.00,
    date: '2026-06-16',
    mlFee: 52.80, // (12% de 38.00 + R$ 6.00 de taxa fixa) * 5 = (4.56 + 6) * 5 = 10.56 * 5 = 52.80
    shippingCost: 0,
    purchasePrice: 8.50,
    grossProfit: 147.50, // (38 - 8.50) * 5 = 147.50
    netProfit: 94.70     // 147.50 - 52.80
  },
  {
    id: 'sale_3',
    productId: 'prod_3',
    productName: 'Teclado Mecânico Gamer RGB Silent',
    quantity: 1,
    salePrice: 289.00,
    date: '2026-06-12',
    mlFee: 49.13, // 17% de 289 = 49.13
    shippingCost: 22.90,
    purchasePrice: 110.00,
    grossProfit: 179.00, // 289 - 110 = 179
    netProfit: 106.97    // 179 - 49.13 - 22.90
  },
  {
    id: 'sale_4',
    productId: 'prod_4',
    productName: 'Cabo Carregador USB-C Reforçado (2 metros)',
    quantity: 10,
    salePrice: 24.90,
    date: '2026-06-14',
    mlFee: 89.88, // (12% de 24.90 + R$ 6.00) * 10 = (2.988 + 6) * 10 = 8.988 * 10 = 89.88
    shippingCost: 0,
    purchasePrice: 4.80,
    grossProfit: 201.00, // (24.90 - 4.80) * 10 = 201
    netProfit: 111.12    // 201 - 89.88
  },
  {
    id: 'sale_5',
    productId: 'prod_1',
    productName: 'Fone de Ouvido Bluetooth SoundPRO X',
    quantity: 1,
    salePrice: 125.00, // Preço promocional
    date: '2026-06-10',
    mlFee: 21.25, // 17% de 125 = 21.25
    shippingCost: 0,
    purchasePrice: 45.00,
    grossProfit: 80.00,
    netProfit: 58.75
  },
  {
    id: 'sale_6',
    productId: 'prod_2',
    productName: 'Suporte de Celular Veicular Magnético',
    quantity: 4,
    salePrice: 38.00,
    date: '2026-05-02', // Mais de 30 dias atrás
    mlFee: 42.24,
    shippingCost: 0,
    purchasePrice: 8.50,
    grossProfit: 118.00,
    netProfit: 75.76,
    status: 'completed'
  },
  {
    id: 'sale_7',
    productId: 'prod_3',
    productName: 'Teclado Mecânico Gamer RGB Silent',
    quantity: 1,
    salePrice: 289.00,
    date: '2026-05-15', // Mais de 30 dias atrás
    mlFee: 49.13,
    shippingCost: 22.90,
    purchasePrice: 110.00,
    grossProfit: 179.00,
    netProfit: 106.97,
    status: 'completed'
  }
];

/**
 * Calcula os dias restantes para liberação de uma venda baseado no ciclo de 30 dias do Mercado Livre
 */
export function getDaysRemainingForRelease(saleDateStr: string, currentStatus?: 'pending' | 'completed'): number {
  if (currentStatus === 'completed') return 0;
  
  const saleDate = new Date(saleDateStr + 'T12:00:00');
  const now = new Date();
  
  // Zera horas para contar dia cheio
  saleDate.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);

  const diffTime = now.getTime() - saleDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, 30 - diffDays);
}

/**
 * Formata datas no formato curto DD/MM
 */
export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

/**
 * Calcula a data estimada de liberação somando 30 dias à data da venda
 */
export function getReleaseDateStr(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T12:00:00');
  date.setDate(date.getDate() + 30);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}





