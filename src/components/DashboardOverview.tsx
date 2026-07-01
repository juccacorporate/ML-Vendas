/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Product, Sale } from '../types';
import { formatCurrency, calculateDaysInStock } from '../utils';
import { TrendingUp, Percent, AlertTriangle, ArrowUpRight, ArrowDownRight, BarChart3, PackageCheck, Zap, Lock, Unlock, Clock, Coins } from 'lucide-react';

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

  // Dividir as vendas filtradas em liberadas (completed) e congeladas (pending)
  const filteredCompletedSales = filteredAllSales.filter(sale => sale.status !== 'pending');
  const filteredPendingSales = filteredAllSales.filter(sale => sale.status === 'pending');

  // Valores Liberados (Realizados)
  const totalSalesRevenue = filteredCompletedSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalCompletedMLFees = filteredCompletedSales.reduce((acc, s) => acc + s.mlFee, 0);
  const totalCompletedShipping = filteredCompletedSales.reduce((acc, s) => acc + s.shippingCost, 0);
  const totalCostOfGoodsSold = filteredCompletedSales.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
  const totalNetProfit = totalSalesRevenue - totalCostOfGoodsSold - totalCompletedMLFees - totalCompletedShipping;

  // Custos totais operacionais de todas as vendas do período (concluídas e pendentes) para exibição no card de custos
  const totalMLFees = filteredAllSales.reduce((acc, s) => acc + s.mlFee, 0);
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
    acc[key].quantity += s.quantity;
    acc[key].mlFee += s.mlFee;
    acc[key].shippingCost += s.shippingCost;
    acc[key].total += s.mlFee + s.shippingCost;
    return acc;
  }, {});

  const costsGroupedList = Object.values(costsByProduct).filter(item => item.total > 0);

  // Valores Congelados (Retidos - vendas dentro de 30 dias que ainda não estão concluídas)
  const totalFrozenRevenue = filteredPendingSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const totalFrozenNetProfit = filteredPendingSales.reduce((acc, s) => acc + s.netProfit, 0);

  // Margem líquida (calculada com base no faturamento de vendas liberadas ou total, vamos usar faturamento liberado para ser conservador)
  const netMarginPercent = totalSalesRevenue > 0 ? (totalNetProfit / totalSalesRevenue) * 100 : 0;

  // Valor total bloqueado/investido em estoque
  const totalStockCost = products.reduce((acc, p) => acc + (p.purchasePrice * p.stock), 0);
  const totalPotentialSaleValue = products.reduce((acc, p) => acc + (p.salePrice * p.stock), 0);

  // Faturamento líquido acumulado de TODAS as vendas concluídas (sem limite de período, para calcular Caixa)
  const allCompletedSales = sales.filter(s => s.status !== 'pending');
  const allSalesRevenue = allCompletedSales.reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const allMLFees = allCompletedSales.reduce((acc, s) => acc + s.mlFee, 0);
  const allShipping = allCompletedSales.reduce((acc, s) => acc + s.shippingCost, 0);

  // Custo de mercadoria de todas as vendas registradas (concluídas e pendentes) + estoque ativo
  const costOfGoodsAllSales = sales.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
  const totalStockInvestment = totalStockCost + costOfGoodsAllSales;

  // Caixa Disponível Atual (Apenas recursos de vendas concluídas/liberadas)
  const liquidCash = initialCapital - totalStockInvestment + (allSalesRevenue - allMLFees - allShipping);

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

  // Preencher com as vendas reais (concluídas e pendentes) para mostrar o panorama consolidado do canal
  filteredAllSales.forEach(sale => {
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

      {/* Grid de KPIs Financeiros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
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
                      <div key={s.id} className="flex justify-between text-[10.5px] font-medium leading-relaxed">
                        <span className="truncate max-w-[120px] text-white/50" title={`${s.quantity}x ${s.productName}`}>{s.quantity}x {s.productName}</span>
                        <span className="font-mono text-[#FFE600] font-bold">{formatCurrency(s.netProfit)}</span>
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
                <h3 className="text-xl font-black text-white mt-1.5" title="Valor do estoque ativo com as comissões e fretes do ML já descontados">{formatCurrency(totalPotentialNetSaleValue)}</h3>
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

          {/* Canvas SVG Interativo de Gráfico de Barras Duplo */}
          <div className="h-64 flex items-end justify-between gap-2.5 sm:gap-4 pt-10 px-2 relative border-b border-l border-white/10">
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
                  <div className="absolute bottom-full mb-2 bg-[#1c1c1c] text-white rounded-xl p-3 text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-20 shadow-xl border border-white/10 min-w-[150px] whitespace-normal">
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
                  ? (idx / (equityChartData.length - 1)) * (svgWidth - 60) + 30 
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
                        style={{ left: `${leftPct}%`, top: `${topPct}%`, transform: 'translate(-50%, -50%)', width: '24px', height: '24px' }}
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-150 shadow-lg shadow-emerald-500/50" />
                        </div>

                        {/* Card do Tooltip */}
                        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 bg-[#1c1c1c] text-white rounded-xl p-3 text-xs opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-30 shadow-xl border border-white/10 min-w-[170px] whitespace-nowrap">
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
