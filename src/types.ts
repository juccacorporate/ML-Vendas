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
}

export interface GoogleSheetsConfig {
  spreadsheetUrl: string;
  spreadsheetId: string;
  range: string;
  connected: boolean;
  lastSync?: string;
}
