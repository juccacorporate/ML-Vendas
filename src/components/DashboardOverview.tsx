/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Product, Sale } from '../types';
import { formatCurrency, calculateDaysInStock, formatShortDate, getReleaseDateStr, calculateMLFee } from '../utils';
import { TrendingUp, Percent, AlertTriangle, ArrowUpRight, ArrowDownRight, BarChart3, PackageCheck, Zap, Lock, Unlock, Clock, Coins, AlertCircle } from 'lucide-react';

interface DashboardOverviewProps {
  products: Product[];
  sales: Sale[];
  onNavigateToTab: (tab: string) => void;
  initialCapital: number;
  onUpdateCapital: (val: number) => void;
}

export default function DashboardOverview({
  products,
  sales,
  onNavigateToTab,
  initialCapital,
  onUpdateCapital
}: DashboardOverviewProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | '30days' | '7days' | 'custom'>('all');

  // Encontrar limites para o período customizado (slider de data)
  const salesDates = sales.map(s => new Date(s.date).getTime()).sort();
  const oldestTime = salesDates.length > 0 ? salesDates[0] : new Date('2026-03-01').getTime();
  const todayTime = new Date('2026-06-17').getTime(); // Hoje baseado nos registros
  const totalDays = Math.max(1, Math.ceil((todayTime - oldestTime) / (1000 * 60 * 60 * 24)));

  const [startOffset, setStartOffset] = useState<number>(0);
  const [endOffset, setEndOffset] = useState<number>(totalDays);
  const [isEditingCapital, setIsEditingCapital] = useState<boolean>(false);
  const [capitalInput, setCapitalInput] = useState<string>(String(initialCapital));

  // Converter offsets em strings de data YYYY-MM-DD
  const getCustomDateStr = (offset: number) => {
    const d = new Date(oldestTime);
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  };

  const customStartDate = getCustomDateStr(startOffset);
  const customEndDate = getCustomDateStr(endOffset);

  // Filtrar todas as vendas pelo período selecionado (sem distinção de status para filtros iniciais)
  const filteredAllSales = sales.filter(sale => {
    if (selectedTimeframe === 'all') return true;
    
    if (selectedTimeframe === 'custom') {
      return sale.date >= customStartDate && sale.date <= customEndDate;
    }
    
    const saleDate = new Date(sale.date);
    const now = new Date('2026-06-18'); // Hoje simulado como 2026-06-18 pelo relógio local de metadados
    const diffTime = Math.abs(now.getTime() - saleDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (selectedTimeframe === '30days') return diffDays <= 30;
    if (selectedTimeframe === '7days') return diffDays <= 7;
    return true;
  });

  // Dividir as vendas filtradas em liberadas (completed), congeladas (pending) e estornadas (refunded)
  const filteredCompletedSales = filteredAllSales.filter(sale => sale.status === 'completed');
  const filteredPendingSales = filteredAllSales.filter(sale => sale.status === 'pending');
  const filteredRefundedSales = filteredAllSales.filter(sale => sale.status === 'refunded');

  // Agrupar as vendas pendentes por data para prever a liberação de fundos (+30 dias)
  const pendingGroupedByDate = filteredPendingSales.reduce((acc: { [key: string]: { date: string; totalNetProfit: number } }, s) => {
    if (!acc[s.date]) {
      acc[s.date] = { date: s.date, totalNetProfit: 0 };
    }
    acc[s.date].totalNetProfit += s.netProfit;
    return acc;
  }, {});

  const pendingGroupedList = Object.values(pendingGroupedByDate).sort((a, b) => b.date.localeCompare(a.date));

  // Valores Liberados (Realizados)
  const totalSalesRevenue = filteredCompletedSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalCompletedMLFees = filteredCompletedSales.reduce((acc, s) => acc + s.mlFee, 0);
  const totalCompletedShipping = filteredCompletedSales.reduce((acc, s) => acc + s.shippingCost, 0);
  const totalCostOfGoodsSold = filteredCompletedSales.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);

  // Custos de reembolso e prejuízos imprevistos no período filtrado
  const totalRefundedShipping = filteredRefundedSales.reduce((acc, s) => acc + s.shippingCost, 0);
  // O prejuízo imprevisto total do estorno engloba o prejuízo físico/extra informado pelo usuário + o frete pago na devolução/cancelamento
  const totalUnforeseenLosses = filteredRefundedSales.reduce((acc, s) => acc + (s.lossAmount || 0) + s.shippingCost, 0);

  // Lucro líquido do período = faturamento das vendas de fato concluídas menos os seus custos e taxas (garante que fique zerado se não houver vendas concluídas)
  const totalNetProfit = Math.max(0, totalSalesRevenue - totalCostOfGoodsSold - totalCompletedMLFees - totalCompletedShipping);

  // Custos totais operacionais de todas as vendas do período (concluídas e pendentes) para exibição no card de custos
  // Comissão ML só é cobrada em vendas não reembolsadas
  const totalMLFees = filteredAllSales.filter(s => s.status !== 'refunded').reduce((acc, s) => acc + s.mlFee, 0);
  // Frete é cobrado em todas as vendas (inclusive as reembolsadas/canceladas!)
  const totalShipping = filteredAllSales.reduce((acc, s) => acc + s.shippingCost, 0);

  // Agrupar custos por produto (SKU / linha) para exibição detalhada no card
  const costsByProduct = filteredAllSales.reduce((acc: { [key: string]: { productName: string; quantity: number; mlFee: number; shippingCost: number; total: number } }, s) => {
    const key = s.productName;
    if (!acc[key]) {
      acc[key] = {
        productName: s.productName,
        quantity: 0,
        mlFee: 0,
        shippingCost: 0,
        total: 0
      };
    }
    if (s.status !== 'refunded') {
      acc[key].quantity += s.quantity;
      acc[key].mlFee += s.mlFee;
    }
    acc[key].shippingCost += s.shippingCost;
    acc[key].total = acc[key].mlFee + acc[key].shippingCost;
    return acc;
  }, {});

  const costsGroupedList = Object.values(costsByProduct).filter(item => item.total > 0);

  // Valores Congelados (Retidos - vendas dentro de 30 dias que ainda não estão concluídas)
  const totalFrozenRevenue = filteredPendingSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalFrozenNetProfit = filteredPendingSales.reduce((acc, s) => acc + s.netProfit, 0);

  // Margem líquida (calculada com base no faturamento de vendas liberadas ou total, vamos usar faturamento liberado para ser conservador)
  const netMarginPercent = totalSalesRevenue > 0 ? (totalNetProfit / totalSalesRevenue) * 100 : 0;

  // Métricas de Envio (Mercado Livre Full vs Transportadora / Catálogo)
  // Filtrar apenas vendas com status diferente de 'refunded' para análise de desempenho de canais
  const activeSales = filteredAllSales.filter(s => s.status !== 'refunded');

  const fullSales = activeSales.filter(s => s.shippingType === 'full');
  const transportadoraSales = activeSales.filter(s => s.shippingType !== 'full'); // Padrão é transportadora se for undefined

  const totalFullRevenue = fullSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalFullProfit = fullSales.reduce((acc, s) => acc + s.netProfit, 0);
  const totalFullQty = fullSales.reduce((acc, s) => acc + s.quantity, 0);
  const fullMarginPercent = totalFullRevenue > 0 ? (totalFullProfit / totalFullRevenue) * 100 : 0;

  const totalTranspRevenue = transportadoraSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalTranspProfit = transportadoraSales.reduce((acc, s) => acc + s.netProfit, 0);
  const totalTranspQty = transportadoraSales.reduce((acc, s) => acc + s.quantity, 0);
  const transpMarginPercent = totalTranspRevenue > 0 ? (totalTranspProfit / totalTranspRevenue) * 100 : 0;

  // Calcular variâncias de comissão / precificação de briga de catálogo
  let catalogNegativeVariance = 0; // Desvio negativo acumulado (ex: briga de catálogo)
  let catalogPositiveVariance = 0; // Desvio positivo acumulado (ex: otimização de custo)

  activeSales.forEach(s => {
    const product = products.find(p => p.id === s.productId);
    if (product) {
      const defaultMlFeeUnit = calculateMLFee(product.salePrice, product.mlFeeType, product.customFeePercent);
      const defaultEstimatedNetProfitUnit = product.salePrice - product.purchasePrice - defaultMlFeeUnit - product.shippingCost;
      const realNetProfitUnit = s.netProfit / s.quantity;

      const varianceUnit = realNetProfitUnit - defaultEstimatedNetProfitUnit;
      const totalVariance = varianceUnit * s.quantity;

      if (totalVariance < -0.10) {
        catalogNegativeVariance += Math.abs(totalVariance);
      } else if (totalVariance > 0.10) {
        catalogPositiveVariance += totalVariance;
      }
    }
  });

  // Valor total bloqueado/investido em estoque
  const totalStockCost = products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0);
  const totalPotentialSaleValue = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);

  // Faturamento líquido acumulado de TODAS as vendas concluídas (sem limite de período, para calcular Caixa)
  const allCompletedSales = sales.filter(s => s.status === 'completed');
  const allSalesRevenue = allCompletedSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const allMLFees = allCompletedSales.reduce((acc, s) => acc + s.mlFee, 0);
  const allShipping = allCompletedSales.reduce((acc, s) => acc + s.shippingCost, 0);

  // Custos de frete e prejuízos de TODAS as vendas reembolsadas na base (para cálculo do Caixa)
  const allRefundedSales = sales.filter(s => s.status === 'refunded');
  const allRefundedShipping = allRefundedSales.reduce((acc, s) => acc + s.shippingCost, 0);
  const allUnforeseenLosses = allRefundedSales.reduce((acc, s) => acc + (s.lossAmount || 0), 0);

  // Custo de mercadoria de todas as vendas registradas (concluídas e pendentes) + estoque ativo
  // Vendas reembolsadas NÃO entram aqui pois o estoque voltou para o ativo
  const costOfGoodsAllSales = sales.filter(s => s.status !== 'refunded').reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
  const totalStockInvestment = totalStockCost + costOfGoodsAllSales;

  // Caixa Disponível Atual (Apenas recursos de vendas concluídas/liberadas, deduzindo custos de frete refund e prejuízos)
  const liquidCash = initialCapital - totalStockInvestment + (allSalesRevenue - allMLFees - allShipping) - allRefundedShipping - allUnforeseenLosses;

  // Função auxiliar interna para simular o preço líquido unitário do produto (descontadas as taxas ML e frete)
  const calculateProductNetPrice = (p: Product) => {
    const percent = p.mlFeeType === 'custom' 
      ? (p.customFeePercent || 0) 
      : (p.mlFeeType === 'premium' 
        ? 17 
        : p.mlFeeType === 'classic' 
          ? 12 
          : 0);
    
    let mlFee = (p.salePrice * percent) / 100;
    // Adiciona taxa fixa de R$6.00 do Mercado Livre se o produto custar menos que R$79
    if (p.salePrice > 0 && p.salePrice < 79 && (p.mlFeeType === 'classic' || p.mlFeeType === 'premium')) {
      mlFee += 6;
    }
    const shipping = p.shippingCost || 0;
    const netPrice = p.salePrice - mlFee - shipping;
    return Math.max(0, netPrice);
  };

  const totalPotentialNetSaleValue = products.reduce((acc, p) => acc + (calculateProductNetPrice(p) * p.stock), 0);

  // Acumulado de Dinheiro Congelado (Líquido a receber de Mercado Pago - vendas pendentes)
  const allPendingSales = sales.filter(s => s.status === 'pending');
  const cumulativeFrozenNetValue = allPendingSales.reduce(
    (acc, s) => acc + (s.salePrice * s.quantity - s.mlFee - s.shippingCost), 
    0
  );

  // Patrimônio Líquido Total do Negócio = Caixa Livre + Dinheiro Congelado + Estoque (Custo)
  const totalBusinessEquity = liquidCash + cumulativeFrozenNetValue + totalStockCost;

  // Alertas de Estoque Baixo ou Crítico
  const lowStockItems = products.filter(p => p.stock <= p.minimalStock);
  const idleStockItems = products.filter(p => p.stock > 0 && calculateDaysInStock(p.addedDate) >= 30);

  // Previsibilidade de saídas para os próximos 30 dias (Simulador inteligente baseado no histórico)
  // Calculamos a velocidade média de vendas por dia de cada item
  const totalUnitsSold = filteredAllSales.reduce((acc, s) => acc + s.quantity, 0);
  const uniqueSalesDays = Array.from(new Set(filteredAllSales.map(s => s.date))).length || 1;
  const unitsSoldPerDay = totalUnitsSold / Math.max(uniqueSalesDays, 1);
  const salesPrediction30Days = unitsSoldPerDay * 30;
  const projectedRevenue30Days = (filteredAllSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0) / Math.max(uniqueSalesDays, 1)) * 30;
  const projectedNetProfit30Days = (filteredAllSales.reduce((acc, s) => acc + s.netProfit, 0) / Math.max(uniqueSalesDays, 1)) * 30;

  // Preparar dados para o gráfico de saídas (últimos 7 dias baseados em datas de vendas)
  const salesByDate: { [key: string]: { amount: number, quantity: number, net: number } } = {};
  
  // Populando os últimos 7 dias até hoje simulado (2026-06-18)
  for (let i = 6; i >= 0; i--) {
    const d = new Date('2026-06-18');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    salesByDate[dateStr] = { amount: 0, quantity: 0, net: 0 };
  }

  // Preencher com as vendas reais (concluídas e pendentes) para mostrar o panorama consolidado do canal (ignora estornos)
  filteredAllSales.forEach(sale => {
    if (sale.status === 'refunded') return; // estornos saem desse gráfico diário de vendas e lucros
    
    if (salesByDate[sale.date]) {
      salesByDate[sale.date].amount += sale.salePrice * sale.quantity;
      salesByDate[sale.date].quantity += sale.quantity;
      salesByDate[sale.date].net += sale.netProfit;
    } else if (selectedTimeframe === 'all') {
      // Para o período geral, adiciona datas que podem não estar nos últimos 7 dias
      salesByDate[sale.date] = salesByDate[sale.date] || { amount: 0, quantity: 0, net: 0 };
      salesByDate[sale.date].amount += sale.salePrice * sale.quantity;
      salesByDate[sale.date].quantity += sale.quantity;
      salesByDate[sale.date].net += sale.netProfit;
    }
  });

  const chartData = Object.entries(salesByDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, data]) => ({
      date: date.substring(8, 10) + '/' + date.substring(5, 7), // formato DD/MM
      faturamento: data.amount,
      quantidade: data.quantity,
      lucroLiquido: data.net
    }));

  const maxChartValue = Math.max(...chartData.map(d => Math.max(d.faturamento, d.lucroLiquido)), 100);

  // Preparar os dados de evolução patrimonial correspondendo exatamente às datas do chartData
  // De forma que o patrimônio acompanhe os mesmos dias do gráfico de saídas.
  const equityChartData = chartData.map((d, index) => {
    // Reconstruir a data ISO YYYY-MM-DD da chave correspondente
    const dateEntry = Object.keys(salesByDate).sort((a,b) => a.localeCompare(b))[index];
    
    // Lucro acumulado de todas as vendas (não reembolsadas) na base até esta data
    const cumulativeProfit = sales
      .filter(s => s.status !== 'refunded' && s.date <= dateEntry)
      .reduce((acc, s) => acc + s.netProfit, 0);

    return {
      date: d.date,
      patrimonio: initialCapital + cumulativeProfit
    };
  });

  const maxEquityValue = Math.max(...equityChartData.map(e => e.patrimonio), initialCapital + 100);
  const minEquityValue = Math.min(...equityChartData.map(e => e.patrimonio), initialCapital - 100);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Controles de Período & Boas-vindas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-md">
        <div>
          <h2 className="text-xl font-light text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FFE600] animate-pulse" />
            Visão Geral Administrativa
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Métricas de desempenho financeiro e fluxo de saída ajustado para comissões e fretes do Mercado Livre.
          </p>
        </div>

        {/* Caixa de Aporte do Negócio Sucinta e Independente */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-4 shadow-sm self-start md:self-auto min-w-[210px]">
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-sans">Aporte de Capital</p>
            {isEditingCapital ? (
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  value={capitalInput}
                  onChange={(e) => setCapitalInput(e.target.value)}
                  className="bg-[#0f0f0f] border border-[#FFE600]/30 text-white font-mono text-xs px-2 py-1 rounded w-20 focus:outline-none focus:ring-1 focus:ring-[#FFE600]"
                />
                <button
                  onClick={() => {
                    const val = Number(capitalInput);
                    if (!isNaN(val) && val >= 0) {
                      onUpdateCapital(val);
                      setIsEditingCapital(false);
                    }
                  }}
                  className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors"
                >
                  Salvar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 mt-1">
                <span className="text-sm font-black text-[#FFE600] font-mono">{formatCurrency(initialCapital)}</span>
                <button
                  onClick={() => {
                    setCapitalInput(String(initialCapital));
                    setIsEditingCapital(true);
                  }}
                  className="text-white/40 hover:text-[#FFE600] hover:underline text-[10px] font-bold cursor-pointer transition-colors"
                >
                  Alterar
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setSelectedTimeframe('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              selectedTimeframe === 'all' ? 'bg-[#FFE600] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            Todo período
          </button>
          <button
            onClick={() => setSelectedTimeframe('30days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              selectedTimeframe === '30days' ? 'bg-[#FFE600] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => setSelectedTimeframe('7days')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              selectedTimeframe === '7days' ? 'bg-[#FFE600] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => setSelectedTimeframe('custom')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              selectedTimeframe === 'custom' ? 'bg-[#FFE600] text-black font-bold shadow-sm' : 'text-white/60 hover:text-white'
            }`}
          >
            Personalizado 📅
          </button>
        </div>
      </div>

      {/* Barrinha Rolante de Período Customizável */}
      {selectedTimeframe === 'custom' && (
        <div className="bg-[#141414] p-5 rounded-2xl border border-[#FFE600]/20 shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
          <div className="flex-1 space-y-2">
            <p className="text-xs font-bold text-[#FFE600] flex items-center gap-1.5 uppercase tracking-wide">
              <span>📅 Período Customizado Ativo</span>
            </p>
            <p className="text-sm font-semibold text-white">
              Mostrando saídas de <span className="underline font-bold text-[#FFE600]">{customStartDate.split('-').reverse().join('/')}</span> até <span className="underline font-bold text-[#FFE600]">{customEndDate.split('-').reverse().join('/')}</span>
            </p>
            <p className="text-[11px] text-white/50 leading-relaxed">
              Arraste as barras de rolagem abaixo para ajustar o início e o fim da linha do tempo. O painel recalculará o faturamento, lucro e desempenho para este intervalo.
            </p>
          </div>

          <div className="flex-1 space-y-4 bg-white/5 p-4 rounded-xl border border-white/5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/40">
                <span className="font-bold">Início:</span>
                <span className="text-white font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{customStartDate.split('-').reverse().join('/')}</span>
              </div>
              <input
                type="range"
                min="0"
                max={totalDays}
                value={startOffset}
                onChange={(e) => setStartOffset(Math.min(Number(e.target.value), endOffset))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FFE600]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-white/40">
                <span className="font-bold">Fim:</span>
                <span className="text-white font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{customEndDate.split('-').reverse().join('/')}</span>
              </div>
              <input
                type="range"
                min="0"
                max={totalDays}
                value={endOffset}
                onChange={(e) => setEndOffset(Math.max(Number(e.target.value), startOffset))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FFE600]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Grid de KPIs Financeiros - Linha Superior (Cards Largos) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Faturamento Previsto */}
        <div id="kpi-faturamento" className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden transition-all hover:border-white/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Faturamento Previsto</p>
                <h3 className="text-xl font-black text-white mt-1.5">{formatCurrency(totalFrozenNetProfit)}</h3>
              </div>
              <div className="bg-[#FFE600]/10 p-2 rounded-xl border border-[#FFE600]/20 text-[#FFE600]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>

            {filteredPendingSales.length > 0 ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3">
                <p className="text-[9px] font-bold text-[#FFE600] uppercase tracking-wider">Vendas em Andamento (Líquido):</p>
                <div className="max-h-[85px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {filteredPendingSales.map(s => {
                    return (
                      <div key={s.id} className="flex justify-between items-center text-[10.5px] font-medium leading-relaxed">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-black font-black font-mono bg-[#FFE600] px-1.5 py-0.5 rounded shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.3)]" title={`Data da venda: ${s.date}`}>
                            {formatShortDate(s.date)}
                          </span>
                          <span className="truncate text-white/60 font-semibold" title={`${s.quantity}x ${s.productName}`}>{s.quantity}x {s.productName}</span>
                        </div>
                        <span className="font-mono text-[#FFE600] font-bold shrink-0">{formatCurrency(s.netProfit)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] font-bold border-t border-white/5 pt-1.5 mt-1 text-white/50 bg-white/5 px-2 py-1 rounded">
                  <span>Líquido Previsto (Soma):</span>
                  <span className="text-[#FFE600] font-mono font-bold">{formatCurrency(totalFrozenNetProfit)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-bold border-t border-white/5 pt-2 mt-1 text-white/40">
                  <span>Liberado Separado:</span>
                  <span className="text-emerald-400 font-mono font-bold">{formatCurrency(totalSalesRevenue)}</span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-[10px] text-white/40 flex justify-between items-center border-t border-white/5 pt-2.5">
                <span>Liberado Separado:</span>
                <span className="text-emerald-400 font-mono font-bold">{formatCurrency(totalSalesRevenue)}</span>
              </div>
            )}
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFE600]" />
        </div>

        {/* Custo Total de Taxas ML & Fretes */}
        <div id="kpi-custos" className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden transition-all hover:border-white/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Custos ML & Frete</p>
                <h3 className="text-xl font-black text-amber-500 mt-1.5">{formatCurrency(totalMLFees + totalShipping)}</h3>
              </div>
              <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-400">
                <Percent className="w-4 h-4" />
              </div>
            </div>

            {costsGroupedList.length > 0 ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3">
                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Custos por Produto:</p>
                <div className="max-h-[85px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {costsGroupedList.map(item => (
                    <div key={item.productName} className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-[10.5px] font-bold text-white/80">
                        <span className="truncate max-w-[130px]" title={`${item.quantity}x ${item.productName}`}>{item.quantity}x {item.productName}</span>
                        <span className="font-mono text-red-400">-{formatCurrency(item.total)}</span>
                      </div>
                      <div className="flex gap-3 text-[9px] text-white/40 font-medium">
                        <span>Taxa ML: <strong className="font-mono text-white/60">{formatCurrency(item.mlFee)}</strong></span>
                        <span>Frete: <strong className="font-mono text-white/60">{formatCurrency(item.shippingCost)}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] font-bold border-t border-white/5 pt-1.5 mt-1 text-white/50 bg-white/5 px-2 py-1 rounded">
                  <span>Custos Totais (Soma):</span>
                  <span className="text-amber-500 font-mono font-bold">{formatCurrency(totalMLFees + totalShipping)}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-4">Sem custos operacionais registrados no período.</p>
            )}
          </div>
          <p className="text-[11px] text-white/50 mt-4 flex justify-between">
            <span>Diferença bruta:</span>
            <span className="font-mono text-white/70">{formatCurrency(totalSalesRevenue - totalCostOfGoodsSold)}</span>
          </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

      </div>

      {/* Grid de KPIs Financeiros - Linha Inferior (3 Cards Lado a Lado) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">

        {/* Ganho Líquido */}
        <div id="kpi-lucro" className="bg-[#141414] p-5 rounded-2xl border border-emerald-500/20 shadow-sm relative overflow-hidden transition-all hover:border-emerald-500/30 bg-gradient-to-b from-[#141414] to-emerald-950/15 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Lucro Líquido Realizado</p>
                <h3 className="text-xl font-black text-emerald-400 mt-1.5">{formatCurrency(totalNetProfit)}</h3>
              </div>
              <div className="bg-emerald-500 text-black p-2 rounded-xl shadow-sm font-bold">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            {totalFrozenNetProfit > 0 && (
              <p className="text-[10.5px] text-amber-400 font-bold mt-2 flex items-center gap-0.5">
                <Lock className="w-3 h-3" />
                + {formatCurrency(totalFrozenNetProfit)} retido
              </p>
            )}

            {pendingGroupedList.length > 0 && (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3">
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-1">Previsão de Liberação (+30 dias):</p>
                <div className="max-h-[85px] overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {pendingGroupedList.map(item => {
                    const releaseDate = getReleaseDateStr(item.date);
                    return (
                      <div key={item.date} className="flex justify-between items-center text-[10.5px] font-medium leading-relaxed">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-white/50">Vendas {formatShortDate(item.date)}</span>
                          <span className="text-[8.5px] text-[#FFE600] font-bold font-mono bg-[#FFE600]/10 px-1 py-0.2 rounded shrink-0 border border-[#FFE600]/10" title="Data prevista de liberação">
                            Libera {releaseDate}
                          </span>
                        </div>
                        <span className="font-mono text-emerald-400 font-bold shrink-0">{formatCurrency(item.totalNetProfit)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-white/70 mt-4 flex items-center gap-1 font-medium">
            <span className="text-emerald-400 font-extrabold bg-emerald-500/20 px-1 py-0.5 rounded border border-emerald-500/10">
              {netMarginPercent.toFixed(1)}% Margem Real
            </span>
          </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-400" />
        </div>

        {/* Patrimônio (Estoque Líquido de Venda) */}
        <div id="kpi-patrimonio" className="bg-[#141414] p-5 rounded-2xl border border-[#FFE600]/20 shadow-sm relative overflow-hidden transition-all hover:bg-white/5 bg-gradient-to-b from-[#141414] to-yellow-950/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-[#FFE600] uppercase tracking-wider font-sans">Estoque Líquido de Venda</p>
                <h3 className="text-xl font-black text-white mt-1.5" title="Valor do estoque active com as comissões e fretes do ML já descontados">{formatCurrency(totalPotentialNetSaleValue)}</h3>
              </div>
              <div className="bg-[#FFE600]/15 p-2 rounded-xl border border-[#FFE600]/25 text-[#FFE600]">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-white/40 mt-1">
              Patrimônio Negócio: <strong className="text-white/70" title="Caixa Livre + Congelado + Estoque a Custo">{formatCurrency(totalBusinessEquity)}</strong>
            </p>
          </div>
          
            <p className="text-[10.5px] text-white/40 mt-3 border-t border-white/5 pt-2 flex justify-between">
              <span>Custo total de estoque:</span>
              <strong className="text-white/70 font-mono font-bold">{formatCurrency(totalStockCost)}</strong>
            </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFE600]" />
        </div>

        {/* Prejuízos e Imprevistos */}
        <div id="kpi-prejuizos" className="bg-[#141414] p-5 rounded-2xl border border-red-500/10 shadow-sm relative overflow-hidden transition-all hover:border-red-500/20 bg-gradient-to-b from-[#141414] to-red-950/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Prejuízos e Imprevistos</p>
                <h3 className="text-xl font-black text-red-400 mt-1.5">{formatCurrency(totalUnforeseenLosses)}</h3>
              </div>
              <div className="bg-red-500/10 p-2 rounded-xl border border-red-500/20 text-red-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>

            {filteredRefundedSales.length > 0 ? (
              <div className="mt-3.5 space-y-1.5 border-t border-white/5 pt-3">
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Relação de Estornos:</p>
                <div className="max-h-[110px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {filteredRefundedSales.map(s => {
                    return (
                      <div key={s.id} className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                        <div className="flex justify-between text-[10.5px] font-medium leading-relaxed">
                          <span className="truncate max-w-[120px] text-white/70 font-bold" title={`${s.quantity}x ${s.productName}`}>{s.quantity}x {s.productName}</span>
                          <div className="text-right">
                            {s.lossAmount ? (
                              <span className="font-mono text-red-400 font-bold block">{formatCurrency(s.lossAmount)}</span>
                            ) : (
                              <span className="text-white/30 block text-[9px] font-bold">Sem perda física</span>
                            )}
                            <span className="text-[8.5px] text-white/35 block font-mono">Frete: {formatCurrency(s.shippingCost)}</span>
                          </div>
                        </div>
                        {s.lossReason && (
                          <p className="text-[9.5px] text-red-400 font-medium bg-red-500/10 px-1.5 py-0.5 rounded mt-1 border border-red-500/10 truncate max-w-full" title={s.lossReason}>
                            Motivo: {s.lossReason}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/40 mt-4">Sem prejuízos ou imprevistos registrados no período.</p>
            )}
          </div>
          <p className="text-[11px] text-white/50 mt-4 flex justify-between">
            <span>Soma dos estornos:</span>
            <span className="font-mono text-white/70">{formatCurrency(totalUnforeseenLosses)}</span>
          </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-red-500" />
        </div>

      </div>

      {/* NOVO PAINEL: Desempenho por Canal de Envio (Mercado Livre Full vs Transportadora / Catálogo) */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-md overflow-hidden p-5">
        <div className="border-b border-white/5 pb-4 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-light text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#FFE600] animate-pulse" />
              Desempenho Logístico: Full vs. Catálogo / Transportadora
            </h3>
            <p className="text-xs text-white/50 mt-0.5">Mapeamento dinâmico de faturamento, margem e desvios de lucro causados por briga de catálogo.</p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-[10px] text-white/60 font-bold">
            <span>Período Ativo</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* Card: Mercado Livre Full */}
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-[#FFE600]/20 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-black font-black bg-[#FFE600] px-2 py-0.5 rounded shadow-sm">
                  ⚡ MERCADO LIVRE FULL
                </span>
                <span className="text-xs font-mono font-bold text-[#FFE600]">{totalFullQty} un</span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Faturamento Bruto:</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(totalFullRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-1.5">
                  <span className="text-emerald-400 font-bold">Lucro Líquido Real:</span>
                  <span className="font-black text-emerald-400 font-mono">{formatCurrency(totalFullProfit)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Margem de Lucro:</span>
              <span className="text-xs text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {fullMarginPercent.toFixed(1)}% Margem
              </span>
            </div>
          </div>

          {/* Card: Transportadora / Catálogo */}
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/10 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-white/80 font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                  🚚 TRANSPORTADORA / CATÁLOGO
                </span>
                <span className="text-xs font-mono font-bold text-white/60">{totalTranspQty} un</span>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Faturamento Bruto:</span>
                  <span className="font-bold text-white font-mono">{formatCurrency(totalTranspRevenue)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-1.5">
                  <span className="text-emerald-400 font-bold">Lucro Líquido Real:</span>
                  <span className="font-black text-emerald-400 font-mono">{formatCurrency(totalTranspProfit)}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Margem de Lucro:</span>
              <span className="text-xs text-emerald-400 font-black bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                {transpMarginPercent.toFixed(1)}% Margem
              </span>
            </div>
          </div>

          {/* Card: Variância / Análise de Competição */}
          <div className="bg-[#1a1a1a] p-4 rounded-xl border border-white/5 flex flex-col justify-between col-span-1 md:col-span-2 lg:col-span-1">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                  ⚠️ Variância por Competição
                </span>
                <span className="text-[9px] text-[#FFE600] font-mono">Feedback Real</span>
              </div>
              
              <div className="space-y-2.5 mt-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50">Variação Negativa (Catálogo):</span>
                  <span className="font-bold text-red-400 font-mono">-{formatCurrency(catalogNegativeVariance)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                  <span className="text-white/50">Variação Otimizada (Ganhos):</span>
                  <span className="font-bold text-emerald-400 font-mono">+{formatCurrency(catalogPositiveVariance)}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-white/5">
              {catalogNegativeVariance > catalogPositiveVariance ? (
                <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-[10px] text-red-400 leading-snug">
                  <ArrowDownRight className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Impacto de Concorrência:</strong> Perda líquida acumulada de <strong className="font-mono">{formatCurrency(catalogNegativeVariance - catalogPositiveVariance)}</strong> em relação ao planejado devido a guerra de preços.
                  </span>
                </div>
              ) : catalogPositiveVariance > 0 ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-[10px] text-emerald-400 leading-snug">
                  <ArrowUpRight className="w-4 h-4 shrink-0 animate-bounce" />
                  <span>
                    <strong>Desempenho Otimizado:</strong> Ganho líquido extra acumulado de <strong className="font-mono">{formatCurrency(catalogPositiveVariance - catalogNegativeVariance)}</strong> em relação ao cadastro base devido a fretes unificados ou valor superior.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-white/40 leading-snug">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Sem desvios significativos de precificação ou logísticas de comissão nas vendas deste período.</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Sub-painel de Detalhes de Patrimônio em Estoque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gradient-to-r from-[#151515] to-[#0f0f0f] p-5 rounded-2xl border border-white/5 shadow-md">
        <div className="flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-[#FFE600] uppercase tracking-wider flex items-center gap-1.5">
              <span>📦 Valores Investidos em Estoque Ativo</span>
            </h4>
            <p className="text-xs text-white/50 mt-1">
              Análise de patrimônio estocado para controle patrimonial. Os valores contemplam o estoque ativo atual multiplicado pelos custos de compra e pelos preços líquidos estimados de venda (deduzidas tarifas de anúncios e fretes do Mercado Livre).
            </p>
          </div>
          <div className="mt-4 flex gap-2 border-t border-white/5 pt-3">
            <span className="text-[11px] text-white/40">Quantidade Total em Estoque: <strong className="text-[#FFE600]">{products.reduce((acc, p) => acc + p.stock, 0)} unidades</strong></span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card: Patrimônio em Compra */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-bold text-white/50 uppercase tracking-wide">Patrimônio (Custo de Compra)</p>
              <h3 className="text-lg font-black text-white mt-1">{formatCurrency(totalStockCost)}</h3>
            </div>
            <p className="text-[10px] text-white/40 mt-3 leading-relaxed">
              Saldo total imobilizado correspondente ao valor pago para adquirir os produtos ativos em estoque.
            </p>
          </div>

          {/* Card: Patrimônio em Venda Líquida */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-[#FFE600]/20 transition-all flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#FFE600]/80 uppercase tracking-wide">Patrimônio (Venda Líquida)</p>
              <h3 className="text-lg font-black text-white mt-1">{formatCurrency(totalPotentialNetSaleValue)}</h3>
            </div>
            <p className="text-[10px] text-white/40 mt-3 leading-relaxed">
              Previsão de entrada real líquida em caixa após descontar as tarifas e fretes se todo o estoque for vendido.
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos de Desempenho e Evolução (Duas Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Gráfico de Vendas */}
        <div id="grafico-saidas" className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-light text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#FFE600]" />
                Gráfico Diário de Saídas e Lucro
              </h3>
              <p className="text-xs text-white/50 mt-0.5">Faturamento bruto vs Lucro líquido real dos últimos dias ativos</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#FFE600] block"></span>
                <span className="text-white/60 font-medium text-[11px]">Faturamento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-400 block"></span>
                <span className="text-white/60 font-medium text-[11px]">Lucro Líquido</span>
              </div>
            </div>
          </div>

          {/* Container de Rolagem Lateral para evitar que as barras amassem ou andem fora da especificação em resoluções menores */}
          <div className="w-full overflow-x-auto pb-3 scrollbar-thin">
            {/* Canvas SVG Interativo de Gráfico de Barras Duplo */}
            <div className="h-64 flex items-end justify-between gap-3 pt-10 px-2 relative border-b border-l border-white/10 min-w-[550px] w-full">
              {/* Linhas de fundo para escala */}
              <div className="absolute top-10 left-0 right-0 border-t border-white/5 pointer-events-none"></div>
              <div className="absolute top-28 left-0 right-0 border-t border-white/5 pointer-events-none"></div>
              <div className="absolute top-46 left-0 right-0 border-t border-white/5 pointer-events-none"></div>

              {chartData.map((d, idx) => {
                const fatHeight = maxChartValue > 0 ? (d.faturamento / maxChartValue) * 80 : 0;
                const lucHeight = maxChartValue > 0 ? (d.lucroLiquido / maxChartValue) * 80 : 0;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative z-10">
                    
                    {/* Tooltip on Hover */}
                    <div className={`absolute bottom-full mb-2 bg-[#1c1c1c] text-white rounded-xl p-3 text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-white/10 min-w-[155px] whitespace-normal ${
                      idx === 0 
                        ? 'left-0 translate-x-0' 
                        : idx === chartData.length - 1 
                        ? 'right-0 translate-x-0' 
                        : 'left-1/2 -translate-x-1/2'
                    }`}>
                      <p className="font-bold text-[#FFE600] mb-1">Dia {d.date}</p>
                      <p className="flex justify-between gap-4 text-white/60">
                        <span>Faturamento:</span> 
                        <span className="text-white font-semibold">{formatCurrency(d.faturamento)}</span>
                      </p>
                      <p className="flex justify-between gap-4 text-emerald-400 mt-0.5">
                        <span>Lucro Líquido:</span>
                        <span className="font-bold">{formatCurrency(d.lucroLiquido)}</span>
                      </p>
                      <p className="flex justify-between gap-4 text-amber-400 mt-0.5 border-t border-white/5 pt-1">
                        <span>Qtd. Vendas:</span>
                        <span className="text-white font-bold">{d.quantidade} un.</span>
                      </p>
                    </div>

                    {/* Barras e Detalhes */}
                    <div className="w-full flex justify-center items-end gap-1.5 h-full">
                      
                      {/* Barra Faturamento */}
                      <div 
                        className="w-4 sm:w-6 bg-gradient-to-t from-yellow-650 to-[#FFE600] bg-yellow-450 rounded-t-sm transition-all duration-300 hover:scale-x-105 cursor-pointer"
                        style={{ height: `${Math.max(fatHeight, 2)}%` }}
                      />

                      {/* Barra Lucro Líquido */}
                      <div 
                        className="w-4 sm:w-6 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-300 hover:scale-x-105 cursor-pointer"
                        style={{ height: `${Math.max(lucHeight, 2)}%` }}
                      />

                    </div>

                    <p className="text-[10px] font-bold text-white/40 mt-2 tracking-tighter">
                      {d.date}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-between px-2 pt-2 text-[10px] text-white/40">
            <span>Valores máximos no gráfico: {formatCurrency(maxChartValue)}</span>
            <span>Unidade de amostragem: Diária</span>
          </div>
        </div>

        {/* Novo Gráfico de Evolução Patrimonial (Linha & Bolinhas) */}
        <div id="grafico-patrimonio" className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between relative">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-light text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#10B981]" />
                Gráfico de Evolução Patrimonial
              </h3>
              <p className="text-xs text-white/50 mt-0.5">Evolução do Patrimônio Líquido total (Capital + Lucros Acumulados) ao longo do tempo</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-3 h-3 rounded-full border border-[#10B981] bg-[#141414] flex items-center justify-center">
                <span className="w-1 h-1 rounded-full bg-[#FFE600]"></span>
              </span>
              <span className="text-white/60 font-medium text-[11px]">Patrimônio Líquido</span>
            </div>
          </div>

          {/* Gráfico SVG de Linhas e Bolinhas Interativo */}
          <div className="h-64 flex items-end justify-between pt-10 px-2 relative border-b border-l border-white/10">
            {/* Linhas de fundo para escala */}
            <div className="absolute top-10 left-0 right-0 border-t border-white/5 pointer-events-none"></div>
            <div className="absolute top-28 left-0 right-0 border-t border-white/5 pointer-events-none"></div>
            <div className="absolute top-46 left-0 right-0 border-t border-white/5 pointer-events-none"></div>

            {/* Renderização do SVG */}
            {(() => {
              const svgWidth = 500;
              const svgHeight = 220;
              const paddingY = 25;
              const usableHeight = svgHeight - (paddingY * 2);

              const yMin = Math.max(0, minEquityValue * 0.95);
              const yMax = maxEquityValue * 1.05;
              const yRange = yMax - yMin || 100;

              const points = equityChartData.map((d, idx) => {
                const x = equityChartData.length > 1 
                  ? (idx / (equityChartData.length - 1)) * (svgWidth - 80) + 40 
                  : svgWidth / 2;
                const y = svgHeight - paddingY - ((d.patrimonio - yMin) / yRange) * usableHeight;
                return { x, y, ...d };
              });

              const pathD = points.length > 0 
                ? points.reduce((acc, p, idx) => {
                    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                  }, '')
                : '';

              const areaD = points.length > 0
                ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY + 10} L ${points[0].x} ${svgHeight - paddingY + 10} Z`
                : '';

              return (
                <div className="w-full h-full relative">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#FFE600" />
                        <stop offset="100%" stopColor="#10B981" />
                      </linearGradient>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Preenchimento sob a linha */}
                    {areaD && <path d={areaD} fill="url(#areaGrad)" className="pointer-events-none" />}

                    {/* Linha fluida principal */}
                    {pathD && <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none" />}

                    {/* Círculos maiores decorativos invisíveis no SVG para o cursor do mouse */}
                    {points.map((p, idx) => (
                      <g key={idx}>
                        {/* Linha vertical bem sutil de grade */}
                        <line 
                          x1={p.x} 
                          y1={p.y} 
                          x2={p.x} 
                          y2={svgHeight - paddingY} 
                          stroke="rgba(255, 255, 255, 0.08)" 
                          strokeWidth="1" 
                          strokeDasharray="2 2" 
                          className="pointer-events-none"
                        />
                        
                        {/* Valor de patrimônio estático legível acima da bolinha */}
                        <text 
                          x={p.x} 
                          y={p.y - 12} 
                          textAnchor="middle" 
                          className="fill-[#10B981] font-bold text-[9px] font-mono select-none"
                        >
                          {formatCurrency(p.patrimonio).split(',')[0]}
                        </text>

                        {/* Data estática no rodapé do gráfico de linha */}
                        <text 
                          x={p.x} 
                          y={svgHeight - paddingY + 14} 
                          textAnchor="middle" 
                          className="fill-white/30 font-bold text-[8px] font-mono select-none"
                        >
                          {p.date}
                        </text>

                        <circle cx={p.x} cy={p.y} r="5" fill="#141414" stroke="#10B981" strokeWidth="2.5" />
                        <circle cx={p.x} cy={p.y} r="1.5" fill="#FFE600" />
                      </g>
                    ))}
                  </svg>

                  {/* Pontos de Hover absolutos transparentes em HTML para Tooltips interativos perfeitos no iframe */}
                  {points.map((p, idx) => {
                    const leftPct = (p.x / svgWidth) * 100;
                    const topPct = (p.y / svgHeight) * 100;

                    return (
                      <div 
                        key={idx} 
                        className="absolute group z-20 cursor-pointer" 
                        style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -50%)', width: '44px', height: '44px' }}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-150 shadow-lg shadow-emerald-500/50" />
                        </div>

                        {/* Card do Tooltip adaptativo para evitar vazamento das bordas */}
                        <div className={`absolute bottom-full mb-3 bg-[#1c1c1c] text-white rounded-xl p-3 text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-30 shadow-xl border border-white/10 min-w-[170px] whitespace-nowrap ${
                          idx === 0 
                            ? 'left-0 translate-x-0' 
                            : idx === equityChartData.length - 1 
                            ? 'right-0 translate-x-0 left-auto' 
                            : 'left-1/2 -translate-x-1/2'
                        }`}>
                          <p className="font-extrabold text-[#FFE600] mb-1">Dia {p.date}</p>
                          <p className="flex justify-between gap-4 text-white/75 font-semibold text-[11px]">
                            <span>Patrimônio:</span>
                            <span className="text-emerald-400 font-black">{formatCurrency(p.patrimonio)}</span>
                          </p>
                          <p className="flex justify-between gap-4 text-white/40 text-[9.5px] border-t border-white/5 pt-1 mt-1">
                            <span>Aporte Base:</span>
                            <span>{formatCurrency(initialCapital)}</span>
                          </p>
                          <p className="flex justify-between gap-4 text-emerald-500/80 text-[9.5px]">
                            <span>Lucro Acum.:</span>
                            <span className="font-bold">+{formatCurrency(p.patrimonio - initialCapital)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="flex justify-between px-2 pt-2 text-[10px] text-white/40">
            <span>Capital inicial (Aporte): {formatCurrency(initialCapital)}</span>
            <span>Métrica de evolução: Lucro líquido das saídas acumulado</span>
          </div>
        </div>

      </div>

      {/* Seção de Alertas, Projeções e Recomendações Críticas (Bento Grid de 3 Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Bloco de Previsibilidade & Estimativa (Bento Coluna 1) */}
        <div id="bento-provisoes" className="bg-[#141414] text-white p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
          <div>
            <div className="bg-[#FFE600]/10 text-[#FFE600] px-3 py-1 rounded-full text-xs font-bold w-fit mb-4 border border-[#FFE600]/20 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              Previsibilidade & Projeção
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Próximos 30 Dias Estimados</h3>
            <p className="text-xs text-white/50">Estimativa de fluxo com base no ritmo atual de vendas de <span className="text-white font-bold">{unitsSoldPerDay.toFixed(1)}</span> unidades/dia.</p>

            <div className="mt-5 space-y-3.5">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Ritmo de Saída Estimado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#FFE600]">{Math.ceil(salesPrediction30Days)}</span>
                  <span className="text-xs text-white/60 font-medium font-mono">unidades / mês</span>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Faturamento Projetado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-bold text-white/90">{formatCurrency(projectedRevenue30Days)}</span>
                </div>
              </div>

              <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Ganho Líquido Projetado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-extrabold text-emerald-400">{formatCurrency(projectedNetProfit30Days)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-white/5 text-[10px] text-white/40 text-center">
            Adicione mais vendas para aumentar a precisão estatística da projeção.
          </div>
        </div>

        {/* Estoque Baixo (Bento Coluna 2) */}
        <div id="bento-estoque-baixo" className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
          <div>
            <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold w-fit mb-4 border border-red-500/20 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Alerta de Reposição
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Reposição de Estoque ({lowStockItems.length})</h3>
            <p className="text-xs text-white/50 mb-4">Produtos ativos que atingiram ou estão abaixo do nível mínimo de segurança definido.</p>
            
            {lowStockItems.length === 0 ? (
              <div className="text-white/40 text-xs py-10 text-center bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center h-44">
                <PackageCheck className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
                Excelente! Todos os produtos estão com estoque acima do nível seguro.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {lowStockItems.map((prod) => (
                  <div key={prod.id} className="flex items-center justify-between p-2.5 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-white truncate max-w-[130px]">{prod.name}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5">SKU: {prod.sku}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-red-400 bg-red-500/10 px-2 py-0.5 rounded block border border-red-500/25">
                        Restam {prod.stock} un.
                      </span>
                      <span className="text-[9px] text-white/40 block mt-0.5">Mínimo: {prod.minimalStock}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <button 
              onClick={() => onNavigateToTab('stock')} 
              className="text-xs text-[#FFE600] font-bold hover:underline cursor-pointer"
            >
              Ir para Controle de Estoque →
            </button>
          </div>
        </div>

        {/* Tempo parado (Bento Coluna 3) */}
        <div id="bento-sem-giro" className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between">
          <div>
            <div className="bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full text-xs font-bold w-fit mb-4 border border-amber-500/20 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse text-amber-400" />
              Retido Sem Giro
            </div>
            <h3 className="text-sm font-bold text-white mb-1">Retidos (+30 dias) ({idleStockItems.length})</h3>
            <p className="text-xs text-white/50 mb-4">Produtos em estoque sem nenhum registro de venda nos últimos 30 dias ativos.</p>

            {idleStockItems.length === 0 ? (
              <div className="text-white/40 text-xs py-10 text-center bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center h-44">
                <Coins className="w-8 h-8 text-[#FFE600] mb-2 opacity-80" />
                Parabéns! Nenhum produto está sem giro há mais de 30 dias.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {idleStockItems.map((prod) => {
                  const days = calculateDaysInStock(prod.addedDate);
                  return (
                    <div key={prod.id} className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors">
                      <div>
                        <p className="text-xs font-bold text-white truncate max-w-[130px]">{prod.name}</p>
                        <p className="text-[10px] text-white/40 font-mono mt-0.5 font-semibold">Custo em caixa: {formatCurrency(prod.purchasePrice * prod.stock)}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded block border border-amber-500/25">
                          {days} dias
                        </span>
                        <span className="text-[9px] text-white/40 block mt-0.5">Estoque: {prod.stock} un.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <div className="text-[10px] text-white/50 leading-tight">
              💡 <span className="font-semibold text-white">Dica:</span> Crie ofertas ou anúncios <span className="font-bold text-emerald-400">Clássicos</span> para girar esse estoque retido mais rápido!
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
