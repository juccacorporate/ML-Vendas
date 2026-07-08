/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale } from './types';

// Taxas padrão do Mercado Livre
export const ML_CLASSIC_PERCENT = 12; // 12% de comissão
export const ML_PREMIUM_PERCENT = 17; // 17% de comissão (permite parcelamento sem juros)
export const ML_FIXED_FEE_LIMIT = 79; // Produtos abaixo de R$ 79 têm taxa fixa
export const ML_FIXED_FEE_AMOUNT = 6.00; // Taxa fixa de R$ 6.00 por unidade

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


