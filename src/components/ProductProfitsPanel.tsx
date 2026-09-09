/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Product, Sale, getAllProductSkus } from '../types';
import { formatCurrency, formatShortDate, calculateCurrentStock, findProductForSale, normalizeName } from '../utils';
import { 
  BadgePercent, 
  Search, 
  ArrowUpDown, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  Coins, 
  Award, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Download, 
  ExternalLink,
  Layers,
  Percent,
  SlidersHorizontal,
  Zap,
  ShoppingBag,
  ArrowRight
} from 'lucide-react';

interface ProductProfitsPanelProps {
  products: Product[];
  sales: Sale[];
  onNavigateToTab?: (tab: string) => void;
}

export interface ProductProfitSummary {
  key: string;
  productId?: string;
  productName: string;
  sku: string;
  category: string;
  isCatalogProduct: boolean;
  productRef?: Product;
  currentStock: number;
  
  // Métricas de Volume
  totalUnitsSold: number;
  totalOrdersCount: number;
  completedUnits: number;
  pendingUnits: number;
  refundedUnits: number;

  // Métricas Financeiras
  grossRevenue: number;
  cmvTotal: number;
  mlFeesTotal: number;
  shippingCostsTotal: number;
  shippingGrossTotal: number;
  shippingRevenueTotal: number;
  taxesTotal: number;
  extrasTotal: number;
  lossesTotal: number;

  // Lucros Líquidos
  completedNetProfit: number;
  pendingNetProfit: number;
  totalNetProfit: number;

  // Médias e Percentuais
  avgSalePrice: number;
  avgPurchasePrice: number;
  avgNetProfitPerUnit: number;
  netMarginPercent: number;
  markupPercent: number;

  // Lista de vendas individuais
  sales: Sale[];
}

export default function ProductProfitsPanel({
  products,
  sales,
  onNavigateToTab
}: ProductProfitsPanelProps) {
  // Deduplicar vendas
  const uniqueSalesMap = new Map<string, Sale>();
  sales.forEach(sale => {
    const key = sale.mlSaleId || sale.id;
    if (!uniqueSalesMap.has(key)) {
      uniqueSalesMap.set(key, sale);
    }
  });
  const uniqueSales = Array.from(uniqueSalesMap.values());

  // Filtros de tempo
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | '30days' | '7days' | 'custom'>('all');
  
  const todayStr = new Date().toISOString().split('T')[0];
  const salesDateStrings = Array.from(new Set(uniqueSales.map(s => s.date).filter(Boolean))).sort();
  const minDateStr = salesDateStrings.length > 0 ? salesDateStrings[0] : '2024-01-01';
  const maxDateStr = salesDateStrings.length > 0
    ? (salesDateStrings[salesDateStrings.length - 1] > todayStr ? salesDateStrings[salesDateStrings.length - 1] : todayStr)
    : todayStr;

  const [customStartDate, setCustomStartDate] = useState<string>(minDateStr);
  const [customEndDate, setCustomEndDate] = useState<string>(maxDateStr);

  // Filtros de dados
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [profitFilter, setProfitFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'negative'>('all');
  const [includeZeroSales, setIncludeZeroSales] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'profit' | 'margin' | 'revenue' | 'units' | 'unitProfit' | 'loss' | 'name'>('profit');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  // Linha expandida para raio-x
  const [expandedProductKey, setExpandedProductKey] = useState<string | null>(null);

  // Filtragem inicial das vendas por período
  const filteredSalesByDate = useMemo(() => {
    return uniqueSales.filter(sale => {
      if (sale.status === 'ignored') return false;

      if (selectedTimeframe === 'all') return true;
      if (selectedTimeframe === 'custom') {
        return sale.date >= customStartDate && sale.date <= customEndDate;
      }

      if (!sale.date) return false;
      const saleDate = new Date(sale.date + 'T12:00:00');
      const now = new Date(todayStr + 'T12:00:00');
      const diffTime = Math.abs(now.getTime() - saleDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (selectedTimeframe === '30days') return diffDays <= 30;
      if (selectedTimeframe === '7days') return diffDays <= 7;
      return true;
    });
  }, [uniqueSales, selectedTimeframe, customStartDate, customEndDate, todayStr]);

  // Agrupamento e Contabilização do Lucro Líquido por Produto
  const productSummaries = useMemo(() => {
    const summaryMap = new Map<string, ProductProfitSummary>();

    // Se o usuário optar por incluir produtos sem vendas do catálogo, inicializa todos os produtos
    if (includeZeroSales) {
      products.forEach(p => {
        const key = `catalog_${p.id}`;
        summaryMap.set(key, {
          key,
          productId: p.id,
          productName: p.name,
          sku: p.sku || (p.skus && p.skus[0]) || '',
          category: p.category || 'Geral',
          isCatalogProduct: true,
          productRef: p,
          currentStock: calculateCurrentStock(p, uniqueSales, products),
          totalUnitsSold: 0,
          totalOrdersCount: 0,
          completedUnits: 0,
          pendingUnits: 0,
          refundedUnits: 0,
          grossRevenue: 0,
          cmvTotal: 0,
          mlFeesTotal: 0,
          shippingCostsTotal: 0,
          taxesTotal: 0,
          extrasTotal: 0,
          lossesTotal: 0,
          completedNetProfit: 0,
          pendingNetProfit: 0,
          totalNetProfit: 0,
          avgSalePrice: p.salePrice || 0,
          avgPurchasePrice: p.purchasePrice || 0,
          avgNetProfitPerUnit: 0,
          netMarginPercent: 0,
          markupPercent: 0,
          sales: []
        });
      });
    }

    // Processar cada venda filtrada
    filteredSalesByDate.forEach(sale => {
      // Tentar associar a um produto do catálogo
      const matchedProduct = findProductForSale(sale, products);
      
      let key: string;
      let displayName: string;
      let skuStr: string;
      let categoryStr: string;
      let isCatalog = false;

      if (matchedProduct) {
        key = `catalog_${matchedProduct.id}`;
        displayName = matchedProduct.name;
        skuStr = sale.sku || matchedProduct.sku || (matchedProduct.skus && matchedProduct.skus[0]) || 'Sem SKU';
        categoryStr = matchedProduct.category || 'Geral';
        isCatalog = true;
      } else {
        // Venda avulsa ou importada sem vínculo exato
        const normName = normalizeName(sale.productName || 'Produto Avulso');
        key = `sales_${normName}_${sale.sku || ''}`;
        displayName = sale.productName || 'Produto Avulso';
        skuStr = sale.sku || 'Sem SKU';
        categoryStr = 'Importado / ML';
      }

      let summary = summaryMap.get(key);
      if (!summary) {
        summary = {
          key,
          productId: matchedProduct?.id,
          productName: displayName,
          sku: skuStr,
          category: categoryStr,
          isCatalogProduct: isCatalog,
          productRef: matchedProduct,
          currentStock: matchedProduct ? calculateCurrentStock(matchedProduct, uniqueSales, products) : 0,
          totalUnitsSold: 0,
          totalOrdersCount: 0,
          completedUnits: 0,
          pendingUnits: 0,
          refundedUnits: 0,
          grossRevenue: 0,
          cmvTotal: 0,
          mlFeesTotal: 0,
          shippingCostsTotal: 0,
          shippingGrossTotal: 0,
          shippingRevenueTotal: 0,
          taxesTotal: 0,
          extrasTotal: 0,
          lossesTotal: 0,
          completedNetProfit: 0,
          pendingNetProfit: 0,
          totalNetProfit: 0,
          avgSalePrice: 0,
          avgPurchasePrice: 0,
          avgNetProfitPerUnit: 0,
          netMarginPercent: 0,
          markupPercent: 0,
          sales: []
        };
        summaryMap.set(key, summary);
      }

      // Adicionar venda à lista do produto
      summary.sales.push(sale);
      summary.totalOrdersCount += 1;

      const qty = Number(sale.quantity) || 1;
      const isRefunded = sale.status === 'refunded';
      const isCompleted = sale.status === 'completed';
      const isPending = sale.status === 'pending';

      if (isRefunded) {
        summary.refundedUnits += qty;
        const lossVal = (sale.lossAmount || 0) + (sale.shippingCost || 0);
        summary.lossesTotal += lossVal;
        summary.shippingGrossTotal += (sale.shippingCost || 0);
        summary.shippingCostsTotal += (sale.shippingCost || 0);
      } else {
        summary.totalUnitsSold += qty;
        if (isCompleted) summary.completedUnits += qty;
        if (isPending) summary.pendingUnits += qty;

        const rev = (sale.salePrice || 0) * qty;
        const cost = (sale.purchasePrice || 0) * qty;
        const tax = rev * 0.04;
        const shipCost = Number(sale.shippingCost) || 0;
        const shipRev = Number(sale.shippingRevenue) || 0;
        const netShipForThisSale = Math.max(0, shipCost - shipRev);

        summary.grossRevenue += rev;
        summary.cmvTotal += cost;
        summary.mlFeesTotal += (sale.mlFee || 0);
        summary.shippingGrossTotal += shipCost;
        summary.shippingRevenueTotal += shipRev;
        summary.shippingCostsTotal += netShipForThisSale;
        summary.taxesTotal += tax;

        const expectedNetProfit = rev - cost - (sale.mlFee || 0) - shipCost - tax;
        const extraForThisSale = (sale.netProfit || 0) - expectedNetProfit;
        summary.extrasTotal += extraForThisSale;

        if (isCompleted) {
          summary.completedNetProfit += (sale.netProfit || 0);
        } else {
          summary.pendingNetProfit += (sale.netProfit || 0);
        }
      }

      // Lucro líquido total do produto
      summary.totalNetProfit += (sale.netProfit || 0);
    });

    // Calcular médias e margens finais
    const list: ProductProfitSummary[] = Array.from(summaryMap.values()).map(item => {
      const activeUnits = item.totalUnitsSold;
      const avgSale = activeUnits > 0 ? (item.grossRevenue / activeUnits) : (item.productRef?.salePrice || 0);
      const avgCost = activeUnits > 0 ? (item.cmvTotal / activeUnits) : (item.productRef?.purchasePrice || 0);
      
      // Considerar lucro ativo conforme o filtro de status selecionado
      let activeProfit = item.totalNetProfit;
      if (statusFilter === 'completed') {
        activeProfit = item.completedNetProfit;
      } else if (statusFilter === 'pending') {
        activeProfit = item.pendingNetProfit;
      }

      const avgProfitPerUnit = activeUnits > 0 ? (activeProfit / activeUnits) : 0;
      // Regra de Ouro do Sistema: A Margem Líquida Real é calculada sobre o Custo de Compra (CMV)
      const margin = item.cmvTotal > 0 ? (activeProfit / item.cmvTotal) * 100 : 0;
      const markup = margin;

      return {
        ...item,
        avgSalePrice: avgSale,
        avgPurchasePrice: avgCost,
        avgNetProfitPerUnit: avgProfitPerUnit,
        netMarginPercent: margin,
        markupPercent: markup
      };
    });

    return list;
  }, [products, filteredSalesByDate, uniqueSales, includeZeroSales, statusFilter]);

  // Aplicar filtros de busca, margem e status
  const filteredAndSortedList = useMemo(() => {
    let result = productSummaries.filter(item => {
      // Busca textual
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = item.productName.toLowerCase().includes(term);
        const matchSku = item.sku.toLowerCase().includes(term);
        const matchCat = item.category.toLowerCase().includes(term);
        const matchSales = item.sales.some(s => 
          (s.mlSaleId && s.mlSaleId.toLowerCase().includes(term)) ||
          (s.adId && s.adId.toLowerCase().includes(term))
        );
        if (!matchName && !matchSku && !matchCat && !matchSales) return false;
      }

      // Filtro de rentabilidade (Margem sobre Custo CMV)
      if (profitFilter === 'high') {
        if (item.netMarginPercent < 30) return false;
      } else if (profitFilter === 'medium') {
        if (item.netMarginPercent < 15 || item.netMarginPercent >= 30) return false;
      } else if (profitFilter === 'low') {
        if (item.netMarginPercent < 0 || item.netMarginPercent >= 15) return false;
      } else if (profitFilter === 'negative') {
        if (item.totalNetProfit >= 0 && item.netMarginPercent >= 0) return false;
      }

      // Se statusFilter for 'completed', ocultar produtos sem vendas concluídas
      if (statusFilter === 'completed' && item.completedUnits === 0 && !includeZeroSales) {
        return false;
      }
      if (statusFilter === 'pending' && item.pendingUnits === 0 && !includeZeroSales) {
        return false;
      }

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'profit':
          const pA = statusFilter === 'completed' ? a.completedNetProfit : (statusFilter === 'pending' ? a.pendingNetProfit : a.totalNetProfit);
          const pB = statusFilter === 'completed' ? b.completedNetProfit : (statusFilter === 'pending' ? b.pendingNetProfit : b.totalNetProfit);
          comparison = pB - pA;
          break;
        case 'margin':
          comparison = b.netMarginPercent - a.netMarginPercent;
          break;
        case 'revenue':
          comparison = b.grossRevenue - a.grossRevenue;
          break;
        case 'units':
          comparison = b.totalUnitsSold - a.totalUnitsSold;
          break;
        case 'unitProfit':
          comparison = b.avgNetProfitPerUnit - a.avgNetProfitPerUnit;
          break;
        case 'loss':
          comparison = b.lossesTotal - a.lossesTotal;
          break;
        case 'name':
          comparison = a.productName.localeCompare(b.productName);
          break;
      }

      return sortDirection === 'desc' ? comparison : -comparison;
    });

    return result;
  }, [productSummaries, searchTerm, profitFilter, statusFilter, includeZeroSales, sortBy, sortDirection]);

  // Totais Consolidados do Painel
  const totals = useMemo(() => {
    let totalGrossRevenue = 0;
    let totalCMV = 0;
    let totalMLFees = 0;
    let totalShipping = 0;
    let totalTaxes = 0;
    let totalLosses = 0;
    let totalCompletedProfit = 0;
    let totalPendingProfit = 0;
    let totalProfit = 0;
    let totalUnits = 0;
    let totalOrders = 0;

    productSummaries.forEach(p => {
      totalGrossRevenue += p.grossRevenue;
      totalCMV += p.cmvTotal;
      totalMLFees += p.mlFeesTotal;
      totalShipping += p.shippingCostsTotal;
      totalTaxes += p.taxesTotal;
      totalLosses += p.lossesTotal;
      totalCompletedProfit += p.completedNetProfit;
      totalPendingProfit += p.pendingNetProfit;
      totalProfit += p.totalNetProfit;
      totalUnits += p.totalUnitsSold;
      totalOrders += p.totalOrdersCount;
    });

    const averageMargin = totalCMV > 0 ? (totalProfit / totalCMV) * 100 : 0;
    const averageProfitPerUnit = totalUnits > 0 ? (totalProfit / totalUnits) : 0;

    // Top Produtos
    const sortedByProfit = [...productSummaries].filter(p => p.totalUnitsSold > 0).sort((a, b) => b.totalNetProfit - a.totalNetProfit);
    const topProfitProduct = sortedByProfit.length > 0 ? sortedByProfit[0] : null;

    const sortedByMargin = [...productSummaries].filter(p => p.totalUnitsSold > 0 && p.cmvTotal > 0).sort((a, b) => b.netMarginPercent - a.netMarginPercent);
    const topMarginProduct = sortedByMargin.length > 0 ? sortedByMargin[0] : null;

    const sortedByUnits = [...productSummaries].filter(p => p.totalUnitsSold > 0).sort((a, b) => b.totalUnitsSold - a.totalUnitsSold);
    const topVolumeProduct = sortedByUnits.length > 0 ? sortedByUnits[0] : null;

    const negativeProfitProducts = productSummaries.filter(p => p.totalUnitsSold > 0 && p.totalNetProfit < 0);

    return {
      totalGrossRevenue,
      totalCMV,
      totalMLFees,
      totalShipping,
      totalTaxes,
      totalLosses,
      totalCompletedProfit,
      totalPendingProfit,
      totalProfit,
      totalUnits,
      totalOrders,
      averageMargin,
      averageProfitPerUnit,
      topProfitProduct,
      topMarginProduct,
      topVolumeProduct,
      negativeProfitCount: negativeProfitProducts.length
    };
  }, [productSummaries]);

  // Função para exportar os dados em formato CSV limpo
  const handleExportCSV = () => {
    const headers = [
      'Produto',
      'SKU',
      'Categoria',
      'Unidades Vendidas',
      'Faturamento Bruto (R$)',
      'Custo CMV (R$)',
      'Taxas ML (R$)',
      'Frete (R$)',
      'Impostos 4% (R$)',
      'Prejuizos/Estornos (R$)',
      'Lucro Líquido Realizado (R$)',
      'Lucro Líquido Previsto (R$)',
      'Lucro Líquido Total (R$)',
      'Lucro Médio/Un (R$)',
      'Margem Líquida (%)'
    ];

    const rows = filteredAndSortedList.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      `"${item.sku.replace(/"/g, '""')}"`,
      `"${item.category.replace(/"/g, '""')}"`,
      item.totalUnitsSold,
      item.grossRevenue.toFixed(2),
      item.cmvTotal.toFixed(2),
      item.mlFeesTotal.toFixed(2),
      item.shippingCostsTotal.toFixed(2),
      item.taxesTotal.toFixed(2),
      item.lossesTotal.toFixed(2),
      item.completedNetProfit.toFixed(2),
      item.pendingNetProfit.toFixed(2),
      item.totalNetProfit.toFixed(2),
      item.avgNetProfitPerUnit.toFixed(2),
      item.netMarginPercent.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lucro_liquido_produtos_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Cabeçalho do Painel com Identidade Visual & Resumo Rápido */}
      <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2 py-0.5 rounded-sm uppercase">
              GESTÃO DE RENTABILIDADE
            </span>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Contabilização Individual por Produto
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-light tracking-tight text-white flex items-center gap-2.5">
            <BadgePercent className="w-6 h-6 text-[#FFE600]" />
            Painel de Lucro Líquido por Produto Vendido
          </h2>
          <p className="text-xs text-white/50 max-w-3xl leading-relaxed">
            Demonstrativo contábil e apuração de margem real de cada item vendido. Analisa faturamento, custos de aquisição (CMV), 
            comissão do Mercado Livre, despesas de frete, alíquota de impostos (4%) e estornos para calcular exatamente quanto cada produto 
            coloca no seu bolso.
          </p>
        </div>

        {/* Botão de Exportação */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-2.5 px-4 rounded-xl border border-white/10 transition-all cursor-pointer hover:border-[#FFE600]/30 hover:text-[#FFE600]"
            title="Exportar dados do painel em CSV para Excel"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Grid de 4 Cards de Destaque Financeiro */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Lucro Líquido Total Contabilizado */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-emerald-500/20 shadow-md relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#141414] to-emerald-950/15">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Lucro Líquido Apurado</p>
                <h3 className="text-2xl font-black text-white mt-1 font-mono">
                  {formatCurrency(statusFilter === 'completed' ? totals.totalCompletedProfit : (statusFilter === 'pending' ? totals.totalPendingProfit : totals.totalProfit))}
                </h3>
              </div>
              <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 text-emerald-400">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-white/5 pt-3 text-[11px]">
              <div className="flex justify-between text-white/60">
                <span>Realizado (Liberado):</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(totals.totalCompletedProfit)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Previsto (A Liberar):</span>
                <span className="font-mono font-bold text-[#FFE600]">{formatCurrency(totals.totalPendingProfit)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10.5px]">
            <span className="text-white/40">Margem Média Geral:</span>
            <span className="font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {totals.averageMargin.toFixed(1)}% Real
            </span>
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* Card 2: Produto Mais Lucrativo (Campeão de Lucro em R$) */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-[#FFE600]/20 shadow-md relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#141414] to-yellow-950/10">
          <div>
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-[#FFE600] uppercase tracking-wider flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" />
                  Campeão em Lucro R$
                </p>
                <h3 className="text-sm font-extrabold text-white mt-1 truncate" title={totals.topProfitProduct?.productName || 'Nenhum'}>
                  {totals.topProfitProduct?.productName || 'Sem vendas registradas'}
                </h3>
              </div>
              <div className="bg-[#FFE600]/10 p-2.5 rounded-xl border border-[#FFE600]/20 text-[#FFE600] shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            {totals.topProfitProduct ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3 text-[11px]">
                <div className="flex justify-between text-white/60">
                  <span>Lucro Gerado:</span>
                  <span className="font-mono font-black text-emerald-400">{formatCurrency(totals.topProfitProduct.totalNetProfit)}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Volume Vendido:</span>
                  <span className="font-mono font-bold text-white">{totals.topProfitProduct.totalUnitsSold} un.</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-3">Sem dados para apuração.</p>
            )}
          </div>

          {totals.topProfitProduct && (
            <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10.5px]">
              <span className="text-white/40 font-mono text-[9.5px]">SKU: {totals.topProfitProduct.sku}</span>
              <span className="font-bold text-[#FFE600]">
                +{totals.topProfitProduct.netMarginPercent.toFixed(1)}% Margem
              </span>
            </div>
          )}
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFE600]" />
        </div>

        {/* Card 3: Maior Margem Líquida % (Mais Eficiente) */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-blue-500/20 shadow-md relative overflow-hidden flex flex-col justify-between bg-gradient-to-b from-[#141414] to-blue-950/15">
          <div>
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  Maior Margem Líquida
                </p>
                <h3 className="text-sm font-extrabold text-white mt-1 truncate" title={totals.topMarginProduct?.productName || 'Nenhum'}>
                  {totals.topMarginProduct?.productName || 'Sem vendas registradas'}
                </h3>
              </div>
              <div className="bg-blue-500/10 p-2.5 rounded-xl border border-blue-500/20 text-blue-400 shrink-0">
                <Percent className="w-5 h-5" />
              </div>
            </div>

            {totals.topMarginProduct ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3 text-[11px]">
                <div className="flex justify-between text-white/60">
                  <span>Margem Real:</span>
                  <span className="font-mono font-black text-blue-400">+{totals.topMarginProduct.netMarginPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Lucro / Peça:</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(totals.topMarginProduct.avgNetProfitPerUnit)}/un</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-3">Sem dados para apuração.</p>
            )}
          </div>

          {totals.topMarginProduct && (
            <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10.5px]">
              <span className="text-white/40">Faturamento:</span>
              <span className="font-bold text-white font-mono">{formatCurrency(totals.topMarginProduct.grossRevenue)}</span>
            </div>
          )}
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* Card 4: Campeão em Volume de Vendas */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-white/10 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <div className="min-w-0 pr-2">
                <p className="text-xs font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#FFE600]" />
                  Mais Vendido (Giro)
                </p>
                <h3 className="text-sm font-extrabold text-white mt-1 truncate" title={totals.topVolumeProduct?.productName || 'Nenhum'}>
                  {totals.topVolumeProduct?.productName || 'Sem vendas registradas'}
                </h3>
              </div>
              <div className="bg-white/5 p-2.5 rounded-xl border border-white/10 text-white/70 shrink-0">
                <Package className="w-5 h-5" />
              </div>
            </div>

            {totals.topVolumeProduct ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3 text-[11px]">
                <div className="flex justify-between text-white/60">
                  <span>Quantidade Vendida:</span>
                  <span className="font-mono font-black text-[#FFE600]">{totals.topVolumeProduct.totalUnitsSold} unidades</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Lucro Total:</span>
                  <span className="font-mono font-bold text-emerald-400">{formatCurrency(totals.topVolumeProduct.totalNetProfit)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-3">Sem dados para apuração.</p>
            )}
          </div>

          <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10.5px]">
            <span className="text-white/40">Produtos em Alerta:</span>
            {totals.negativeProfitCount > 0 ? (
              <span className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                ⚠️ {totals.negativeProfitCount} com perda
              </span>
            ) : (
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ✓ 100% Lucrativos
              </span>
            )}
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-white/20" />
        </div>

      </div>

      {/* Barra de Filtros Integrada */}
      <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 space-y-4">
        
        {/* Linha 1: Filtro de Período e Tipo de Lucro */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-white/5 pb-4">
          
          {/* Seletor de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider mr-1">Período:</span>
            <button
              onClick={() => setSelectedTimeframe('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTimeframe === 'all'
                  ? 'bg-[#FFE600] text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Todo o Histórico
            </button>
            <button
              onClick={() => setSelectedTimeframe('30days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTimeframe === '30days'
                  ? 'bg-[#FFE600] text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Últimos 30 Dias
            </button>
            <button
              onClick={() => setSelectedTimeframe('7days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTimeframe === '7days'
                  ? 'bg-[#FFE600] text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Últimos 7 Dias
            </button>
            <button
              onClick={() => setSelectedTimeframe('custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedTimeframe === 'custom'
                  ? 'bg-[#FFE600] text-black shadow-sm'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              Personalizado
            </button>

            {selectedTimeframe === 'custom' && (
              <div className="flex items-center gap-2 ml-2 bg-black/40 p-1.5 rounded-xl border border-white/10">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded border border-white/10 font-mono"
                />
                <span className="text-white/40 text-xs">até</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-[#1a1a1a] text-white text-xs px-2 py-1 rounded border border-white/10 font-mono"
                />
              </div>
            )}
          </div>

          {/* Seletor de Status do Lucro (Realizado vs Previsto) */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider mr-1">Status:</span>
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'
                }`}
              >
                Todos (Realizado + Previsto)
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'completed' ? 'bg-emerald-500/30 text-emerald-300' : 'text-white/50 hover:text-white'
                }`}
              >
                ✓ Realizado (Liberado)
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  statusFilter === 'pending' ? 'bg-[#FFE600]/20 text-[#FFE600]' : 'text-white/50 hover:text-white'
                }`}
              >
                ⏳ Previsto (A Liberar)
              </button>
            </div>
          </div>

        </div>

        {/* Linha 2: Barra de Busca, Filtro de Margem e Ordenação */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          
          {/* Busca por Texto */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por produto, SKU ou ID da venda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
            />
          </div>

          {/* Filtro por Margem */}
          <div className="md:col-span-3">
            <select
              value={profitFilter}
              onChange={(e) => setProfitFilter(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
            >
              <option value="all" className="bg-[#141414] text-white">Todas as Margens de Lucro</option>
              <option value="high" className="bg-[#141414] text-white">Alta Rentabilidade (&gt; 25% Margem)</option>
              <option value="medium" className="bg-[#141414] text-white">Margem Saudável (10% a 25%)</option>
              <option value="low" className="bg-[#141414] text-white">Margem Baixa (0% a 10%)</option>
              <option value="negative" className="bg-[#141414] text-white">⚠️ Prejuízo / Margem Negativa (&lt; 0%)</option>
            </select>
          </div>

          {/* Ordenar Por */}
          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
            >
              <option value="profit" className="bg-[#141414] text-white">Ordenar: Maior Lucro Líquido (R$)</option>
              <option value="margin" className="bg-[#141414] text-white">Ordenar: Maior Margem Líquida (%)</option>
              <option value="revenue" className="bg-[#141414] text-white">Ordenar: Maior Faturamento (R$)</option>
              <option value="units" className="bg-[#141414] text-white">Ordenar: Mais Vendidos (Qtd Unidades)</option>
              <option value="unitProfit" className="bg-[#141414] text-white">Ordenar: Maior Lucro por Peça (R$/un)</option>
              <option value="loss" className="bg-[#141414] text-white">Ordenar: Maiores Prejuízos / Estornos</option>
              <option value="name" className="bg-[#141414] text-white">Ordenar: Nome do Produto (A-Z)</option>
            </select>
          </div>

          {/* Direção e Toggle de Catálogo */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              onClick={() => setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc')}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs py-2 px-3 rounded-xl border border-white/10 transition-all cursor-pointer"
              title={`Inverter ordem (${sortDirection === 'desc' ? 'Decrescente' : 'Crescente'})`}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>{sortDirection === 'desc' ? 'Maior p/ Menor' : 'Menor p/ Maior'}</span>
            </button>

            <button
              onClick={() => setIncludeZeroSales(!includeZeroSales)}
              className={`p-2 rounded-xl border transition-all text-xs font-bold cursor-pointer ${
                includeZeroSales 
                  ? 'bg-[#FFE600] text-black border-[#FFE600]' 
                  : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
              }`}
              title="Incluir também produtos cadastrados que não tiveram vendas no período"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Tabela Principal de Contabilização de Lucros */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-md overflow-hidden">
        <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Demonstrativo de Lucro por Produto ({filteredAndSortedList.length})
            </h3>
            <span className="text-[10px] text-white/40 font-mono">
              Total Faturado: <strong className="text-white font-bold">{formatCurrency(totals.totalGrossRevenue)}</strong>
            </span>
          </div>

          <div className="text-xs text-white/50 font-medium">
            Clique em qualquer produto para abrir o <strong className="text-[#FFE600]">Raio-X de Vendas</strong>
          </div>
        </div>

        {filteredAndSortedList.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="bg-white/5 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 text-white/40">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-white">Nenhum produto encontrado</h4>
            <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">
              Nenhum registro de venda coincidiu com os filtros aplicados. Tente ajustar o período ou desmarque restrições de busca.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  <th className="py-3 px-4">Produto & SKU</th>
                  <th className="py-3 px-3 text-center">Unidades</th>
                  <th className="py-3 px-3 text-right">Faturamento Bruto</th>
                  <th className="py-3 px-3 text-right">Custo CMV</th>
                  <th className="py-3 px-3 text-right">Taxas ML & Frete</th>
                  <th className="py-3 px-3 text-right">Imposto (4%)</th>
                  <th className="py-3 px-4 text-right">Lucro Líquido Real</th>
                  <th className="py-3 px-3 text-right">Lucro/Un</th>
                  <th className="py-3 px-3 text-center" title="Margem líquida real calculada sobre o Custo de Compra (CMV)">Margem</th>
                  <th className="py-3 px-3 text-center">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredAndSortedList.map((item) => {
                  const isExpanded = expandedProductKey === item.key;
                  const isNegative = item.totalNetProfit < 0;
                  const isHighMargin = item.netMarginPercent >= 30;
                  const isMediumMargin = item.netMarginPercent >= 15 && item.netMarginPercent < 30;

                  return (
                    <React.Fragment key={item.key}>
                      <tr 
                        onClick={() => setExpandedProductKey(isExpanded ? null : item.key)}
                        className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${isExpanded ? 'bg-white/[0.04]' : ''}`}
                      >
                        {/* Produto & SKU */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl shrink-0 ${isNegative ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white/5 text-[#FFE600] border border-white/10'}`}>
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 max-w-[280px]">
                              <p className="font-bold text-white truncate text-xs" title={item.productName}>
                                {item.productName}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9.5px] font-mono text-white/40 bg-white/5 px-1.5 py-0.2 rounded border border-white/5">
                                  SKU: {item.sku || 'Sem SKU'}
                                </span>
                                {item.category && (
                                  <span className="text-[9px] text-white/30 truncate">
                                    • {item.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Unidades Vendidas */}
                        <td className="py-3.5 px-3 text-center">
                          <span className="font-extrabold text-white font-mono text-xs">
                            {item.totalUnitsSold} un.
                          </span>
                          <span className="block text-[9.5px] text-white/40 font-mono">
                            {item.totalOrdersCount} venda{item.totalOrdersCount !== 1 ? 's' : ''}
                          </span>
                        </td>

                        {/* Faturamento Bruto */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-black text-white font-mono text-xs block">
                            {formatCurrency(item.grossRevenue)}
                          </span>
                          <span className="text-[9.5px] text-white/40 font-mono">
                            Méd: {formatCurrency(item.avgSalePrice)}/un
                          </span>
                        </td>

                        {/* Custo CMV */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono text-white/70 font-semibold text-xs block">
                            -{formatCurrency(item.cmvTotal)}
                          </span>
                          <span className="text-[9.5px] text-white/40 font-mono">
                            Méd: {formatCurrency(item.avgPurchasePrice)}/un
                          </span>
                        </td>

                        {/* Taxas ML & Frete */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono text-amber-400/90 font-bold text-xs block">
                            -{formatCurrency(item.mlFeesTotal + item.shippingCostsTotal)}
                          </span>
                          <span className="text-[9px] text-white/40 font-mono" title={item.shippingRevenueTotal > 0 ? `Frete Bruto: ${formatCurrency(item.shippingGrossTotal)} | Pago pelo Comprador: +${formatCurrency(item.shippingRevenueTotal)}` : undefined}>
                            Taxa: {formatCurrency(item.mlFeesTotal)} | Frete: {formatCurrency(item.shippingCostsTotal)}
                          </span>
                        </td>

                        {/* Imposto (4%) */}
                        <td className="py-3.5 px-3 text-right">
                          <span className="font-mono text-blue-400 font-semibold text-xs block">
                            -{formatCurrency(item.taxesTotal)}
                          </span>
                          <span className="text-[9px] text-blue-400/60 font-mono">
                            4% faturamento
                          </span>
                        </td>

                        {/* Lucro Líquido Real */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className={`font-black font-mono text-sm ${isNegative ? 'text-red-400' : 'text-emerald-400'}`}>
                              {formatCurrency(item.totalNetProfit)}
                            </span>
                            
                            {/* Breakdown Liberado vs Previsto */}
                            <div className="flex items-center gap-1.5 text-[9px] font-mono mt-0.5">
                              {item.completedNetProfit > 0 && (
                                <span className="text-emerald-400/80" title="Lucro líquido liberado em conta">
                                  Lib: {formatCurrency(item.completedNetProfit)}
                                </span>
                              )}
                              {item.pendingNetProfit > 0 && (
                                <span className="text-[#FFE600]/80" title="Lucro líquido previsto a liberar">
                                  Prev: {formatCurrency(item.pendingNetProfit)}
                                </span>
                              )}
                              {item.lossesTotal > 0 && (
                                <span className="text-red-400" title="Prejuízos com estorno/frete de devolução">
                                  Perda: -{formatCurrency(item.lossesTotal)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Lucro Médio por Peça */}
                        <td className="py-3.5 px-3 text-right">
                          <span className={`font-extrabold font-mono text-xs ${isNegative ? 'text-red-400' : 'text-emerald-300'}`}>
                            {formatCurrency(item.avgNetProfitPerUnit)}
                          </span>
                          <span className="block text-[9px] text-white/40">por unidade</span>
                        </td>

                        {/* Margem Líquida % */}
                        <td className="py-3.5 px-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-black border ${
                            isNegative 
                              ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                              : isHighMargin 
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                              : isMediumMargin
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/25'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                          }`}>
                            {item.netMarginPercent >= 0 ? '+' : ''}{item.netMarginPercent.toFixed(1)}%
                          </span>
                        </td>

                        {/* Botão de Expansão */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedProductKey(isExpanded ? null : item.key);
                            }}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                            title={isExpanded ? 'Recolher detalhes' : 'Ver raio-x das vendas'}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-[#FFE600]" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Gaveta de Raio-X Detalhado das Vendas do Produto */}
                      {isExpanded && (
                        <tr className="bg-black/40 border-b border-white/10">
                          <td colSpan={10} className="p-5">
                            <div className="space-y-4">
                              
                              {/* Barra de Decomposição Financeira (Onde foi parar cada real da venda) */}
                              <div className="bg-[#181818] p-4 rounded-xl border border-white/5 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                  <span className="font-bold text-white flex items-center gap-1.5">
                                    <BadgePercent className="w-4 h-4 text-[#FFE600]" />
                                    Composição de Custos e Margem Real sobre o Faturamento ({formatCurrency(item.grossRevenue)})
                                  </span>
                                  <span className="text-white/40 text-[11px]">
                                    {item.totalUnitsSold} unidades vendidas em {item.totalOrdersCount} transações
                                  </span>
                                </div>

                                {item.grossRevenue > 0 && (() => {
                                  // Calcular frete líquido deduzindo receitas extras (repasse de envio) para que a barra some exatos 100% do faturamento
                                  const netShipping = item.shippingCostsTotal;
                                  
                                  return (
                                  <div className="space-y-2 pt-1">
                                    {/* Barra horizontal visual empilhada */}
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex border border-white/10">
                                      <div 
                                        style={{ width: `${Math.max(0, (item.cmvTotal / item.grossRevenue) * 100)}%` }} 
                                        className="bg-white/40 h-full" 
                                        title={`Custo Mercadoria (CMV): ${formatCurrency(item.cmvTotal)} (${((item.cmvTotal / item.grossRevenue) * 100).toFixed(1)}%)`}
                                      />
                                      <div 
                                        style={{ width: `${Math.max(0, (item.mlFeesTotal / item.grossRevenue) * 100)}%` }} 
                                        className="bg-amber-500 h-full" 
                                        title={`Taxas ML: ${formatCurrency(item.mlFeesTotal)} (${((item.mlFeesTotal / item.grossRevenue) * 100).toFixed(1)}%)`}
                                      />
                                      <div 
                                        style={{ width: `${Math.max(0, (item.shippingCostsTotal / item.grossRevenue) * 100)}%` }} 
                                        className="bg-orange-500 h-full" 
                                        title={`Frete (Líquido): ${formatCurrency(item.shippingCostsTotal)} (${((item.shippingCostsTotal / item.grossRevenue) * 100).toFixed(1)}%)`}
                                      />
                                      <div 
                                        style={{ width: `${Math.max(0, (item.taxesTotal / item.grossRevenue) * 100)}%` }} 
                                        className="bg-blue-500 h-full" 
                                        title={`Imposto 4%: ${formatCurrency(item.taxesTotal)} (${((item.taxesTotal / item.grossRevenue) * 100).toFixed(1)}%)`}
                                      />
                                      {item.totalNetProfit > 0 && (
                                        <div 
                                          style={{ width: `${Math.max(0, (item.totalNetProfit / item.grossRevenue) * 100)}%` }} 
                                          className="bg-emerald-400 h-full" 
                                          title={`Lucro Líquido Real: ${formatCurrency(item.totalNetProfit)} (${((item.totalNetProfit / item.grossRevenue) * 100).toFixed(1)}%)`}
                                        />
                                      )}
                                    </div>

                                    {/* Legenda dos percentuais */}
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10.5px] pt-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-white/40 shrink-0"></span>
                                        <span className="text-white/60">CMV: <strong className="text-white">{((item.cmvTotal / item.grossRevenue) * 100).toFixed(1)}%</strong></span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0"></span>
                                        <span className="text-white/60">Taxas ML: <strong className="text-amber-400">{((item.mlFeesTotal / item.grossRevenue) * 100).toFixed(1)}%</strong></span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 shrink-0"></span>
                                        <span className="text-white/60">Frete Líq.: <strong className="text-orange-400">{((item.shippingCostsTotal / item.grossRevenue) * 100).toFixed(1)}%</strong></span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 shrink-0"></span>
                                        <span className="text-white/60">Imposto 4%: <strong className="text-blue-400">{((item.taxesTotal / item.grossRevenue) * 100).toFixed(1)}%</strong></span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0"></span>
                                        <span className="text-white/60">Lucro Líq.: <strong className="text-emerald-400">{item.netMarginPercent.toFixed(1)}%</strong></span>
                                      </div>
                                    </div>
                                  </div>
                                  );
                                })()}
                              </div>

                              {/* Tabela de Vendas Individuais Deste Produto */}
                              <div>
                                <h5 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-2 flex items-center justify-between">
                                  <span>Histórico de Vendas Deste Produto no Período ({item.sales.length})</span>
                                  {item.isCatalogProduct && onNavigateToTab && (
                                    <button
                                      onClick={() => onNavigateToTab('stock')}
                                      className="text-[#FFE600] text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>Ver no Estoque ({item.currentStock} un. disponíveis)</span>
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  )}
                                </h5>

                                {item.sales.length === 0 ? (
                                  <p className="text-xs text-white/40 py-4 text-center bg-black/20 rounded-xl border border-white/5">
                                    Nenhuma saída registrada para este produto no período filtrado.
                                  </p>
                                ) : (
                                  <div className="max-h-72 overflow-y-auto rounded-xl border border-white/5 scrollbar-thin">
                                    <table className="w-full text-left text-xs bg-black/30">
                                      <thead>
                                        <tr className="bg-white/5 text-[9.5px] font-bold text-white/40 uppercase tracking-wider border-b border-white/10">
                                          <th className="py-2.5 px-3">Data</th>
                                          <th className="py-2.5 px-3">ID Venda / Mercado Livre</th>
                                          <th className="py-2.5 px-2 text-center">Qtd</th>
                                          <th className="py-2.5 px-3 text-right">Preço Venda</th>
                                          <th className="py-2.5 px-3 text-right">Custo Compra (CMV)</th>
                                          <th className="py-2.5 px-3 text-right">Taxa ML</th>
                                          <th className="py-2.5 px-3 text-right">Frete</th>
                                          <th className="py-2.5 px-3 text-right">Imposto 4%</th>
                                          <th className="py-2.5 px-3 text-right text-emerald-400">Rec. Envio</th>
                                          <th className="py-2.5 px-3 text-right font-bold text-white">Lucro Líquido</th>
                                          <th className="py-2.5 px-3 text-center font-bold text-[#FFE600]" title="Porcentagem de ganho sobre o preço de compra (CMV)">Margem (% CMV)</th>
                                          <th className="py-2.5 px-3 text-center">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/5 text-[11px]">
                                        {item.sales.map((s, sIdx) => {
                                          const isSaleRefunded = s.status === 'refunded';
                                          const isSaleCompleted = s.status === 'completed';
                                          const saleTax = (s.salePrice * s.quantity) * 0.04;
                                          const cmv = s.purchasePrice * s.quantity;
                                          const saleMarginPercent = cmv > 0 ? (s.netProfit / cmv) * 100 : 0;
                                          
                                          // Calculamos a diferença exata para bater a matemática visual,
                                          // caso a venda tenha tido acréscimos, receita de envio ou juros absorvidos
                                          const expectedMath = (s.salePrice * s.quantity) - cmv - s.mlFee - s.shippingCost - saleTax;
                                          const extra = s.status !== 'refunded' ? (s.netProfit - expectedMath) : 0;

                                          return (
                                            <tr key={s.id || sIdx} className="hover:bg-white/[0.02]">
                                              <td className="py-2 px-3 font-mono text-white/60">
                                                {formatShortDate(s.date)}
                                              </td>
                                              <td className="py-2 px-3 font-mono text-white/80">
                                                {s.mlSaleId || s.id}
                                                {s.shippingType === 'full' && (
                                                  <span className="ml-1.5 text-[8.5px] bg-[#FFE600]/20 text-[#FFE600] px-1 py-0.2 rounded font-bold border border-[#FFE600]/30">
                                                    FULL
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-2 text-center font-bold font-mono text-white">
                                                {s.quantity}x
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-semibold text-white">
                                                {formatCurrency(s.salePrice * s.quantity)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono">
                                                <span className="text-white/80 font-semibold block">-{formatCurrency(cmv)}</span>
                                                <span className="text-[9px] text-white/40 block">({formatCurrency(s.purchasePrice)}/un)</span>
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-amber-400">
                                                -{formatCurrency(s.mlFee)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-orange-400">
                                                -{formatCurrency(s.shippingCost)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-blue-400">
                                                -{formatCurrency(saleTax)}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono text-emerald-400">
                                                {Math.abs(extra) > 0.01 ? (extra > 0 ? `+${formatCurrency(extra)}` : formatCurrency(extra)) : '-'}
                                              </td>
                                              <td className="py-2 px-3 text-right font-mono font-extrabold">
                                                <span className={s.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                  {formatCurrency(s.netProfit)}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {s.status === 'completed' || s.status === 'pending' ? (
                                                  <span 
                                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block font-mono ${
                                                      s.netProfit < 0
                                                        ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                                                        : 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                                                    }`}
                                                    title={`Lucro (${formatCurrency(s.netProfit)}) ÷ Custo de Compra (${formatCurrency(cmv)})`}
                                                  >
                                                    {saleMarginPercent >= 0 ? '+' : ''}{saleMarginPercent.toFixed(0)}%
                                                  </span>
                                                ) : (
                                                  <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded inline-block">
                                                    Devolvido
                                                  </span>
                                                )}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                {isSaleCompleted ? (
                                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                                                    <CheckCircle2 className="w-2.5 h-2.5" /> Liberada
                                                  </span>
                                                ) : isSaleRefunded ? (
                                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                                                    <AlertCircle className="w-2.5 h-2.5" /> Devolução
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-[#FFE600]/10 text-[#FFE600] px-2 py-0.5 rounded border border-[#FFE600]/20">
                                                    <Clock className="w-2.5 h-2.5" /> Prevista
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Rodapé da Tabela com Resumo Contábil */}
        <div className="p-4 border-t border-white/5 bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 text-white/50">
            <span>Produtos Listados: <strong className="text-white">{filteredAndSortedList.length}</strong></span>
            <span>Unidades Contabilizadas: <strong className="text-[#FFE600]">{totals.totalUnits} un.</strong></span>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <span className="text-[10px] text-white/40 block uppercase">Faturamento Total</span>
              <span className="font-mono font-bold text-white">{formatCurrency(totals.totalGrossRevenue)}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-white/40 block uppercase">Lucro Líquido Acumulado</span>
              <span className="font-mono font-extrabold text-emerald-400 text-sm">{formatCurrency(totals.totalProfit)}</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
