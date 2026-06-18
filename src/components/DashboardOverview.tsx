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
  const totalMLFees = filteredCompletedSales.reduce((acc, s) => acc + s.mlFee, 0);
  const totalShipping = filteredCompletedSales.reduce((acc, s) => acc + s.shippingCost, 0);
  const totalCostOfGoodsSold = filteredCompletedSales.reduce((acc, s) => acc + (s.purchasePrice * s.quantity), 0);
  const totalNetProfit = totalSalesRevenue - totalCostOfGoodsSold - totalMLFees - totalShipping;

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

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Controles de Período & Boas-vindas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-md">
        <div>
          <h2 className="text-xl font-light text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FFE600] animate-pulse" />
            Visão Geral Administrativa
          </h2>
          <p className="text-xs text-white/50 mt-1">
            Métricas de desempenho financeiro e fluxo de saída ajustado para comissões e fretes do Mercado Livre.
          </p>
        </div>
        
        <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Faturamento */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden transition-all hover:border-white/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Faturamento Liberado</p>
                <h3 className="text-xl font-black text-white mt-1.5">{formatCurrency(totalSalesRevenue)}</h3>
              </div>
              <div className="bg-[#FFE600]/10 p-2 rounded-xl border border-[#FFE600]/20 text-[#FFE600]">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {totalFrozenRevenue > 0 && (
              <p className="text-[10px] text-amber-400 font-bold mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3 animate-pulse" />
                + {formatCurrency(totalFrozenRevenue)} Congelado (30 dias)
              </p>
            )}
          </div>
          <p className="text-xs text-white/60 mt-4 flex items-center gap-1">
            <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 text-[10px]">
              <ArrowUpRight className="w-3 h-3" />
              {totalUnitsSold} uni.
            </span>
            vendidas total
          </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-[#FFE600]" />
        </div>

        {/* Custo Total de Taxas ML & Fretes */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-sm relative overflow-hidden transition-all hover:border-white/10 flex flex-col justify-between min-h-[148px]">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Custos ML & Frete</p>
              <h3 className="text-xl font-black text-amber-500 mt-1.5">{formatCurrency(totalMLFees + totalShipping)}</h3>
            </div>
            <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 text-amber-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[11px] text-white/50 mt-4 flex justify-between">
            <span>Tarifas: {formatCurrency(totalMLFees)}</span>
            <span>Envios: {formatCurrency(totalShipping)}</span>
          </p>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Ganho Líquido */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-emerald-500/20 shadow-sm relative overflow-hidden transition-all hover:border-emerald-500/30 bg-gradient-to-b from-[#141414] to-emerald-950/15 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Lucro Realizado</p>
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

        {/* Carteira Mercado Pago 💳 */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-sky-500/20 shadow-sm relative overflow-hidden transition-all hover:border-sky-500/30 bg-gradient-to-b from-[#141414] to-sky-950/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">Conta Mercado Pago</span>
              <span className="text-white/30 text-[10px] bg-white/5 px-1.5 py-0.5 rounded font-mono border border-white/5">SALDO</span>
            </div>
            <div className="mt-2.5">
              <div className="flex items-center gap-1.5">
                <Unlock className="w-3 h-3 text-emerald-400" />
                <span className="text-[10px] font-bold text-white/40 uppercase">Livre:</span>
                <span className="font-mono text-xs text-white/60 ml-auto">{formatCurrency(liquidCash)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 border-t border-white/5 pt-1">
                <Lock className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-bold text-amber-400 uppercase">Congelado ⏳:</span>
                <span className="font-mono text-xs text-amber-400 font-bold ml-auto">{formatCurrency(cumulativeFrozenNetValue)}</span>
              </div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-white/50 flex justify-between border-t border-white/5 pt-1.5">
            <span>Total em MP:</span>
            <span className="font-bold font-mono text-white">{formatCurrency(liquidCash + cumulativeFrozenNetValue)}</span>
          </div>
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-sky-400" />
        </div>

        {/* Patrimônio Líquido */}
        <div className="bg-[#141414] p-5 rounded-2xl border border-[#FFE600]/20 shadow-sm relative overflow-hidden transition-all hover:bg-white/5 bg-gradient-to-b from-[#141414] to-yellow-950/10 flex flex-col justify-between min-h-[148px]">
          <div>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-[#FFE600] uppercase tracking-wider font-sans">Patrimônio Líquido</p>
                <h3 className="text-xl font-black text-white mt-1.5">{formatCurrency(totalBusinessEquity)}</h3>
              </div>
              <div className="bg-[#FFE600]/15 p-2 rounded-xl border border-[#FFE600]/25 text-[#FFE600]">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-white/40 mt-1">Estoque ativo: <strong className="text-white/70">{formatCurrency(totalStockCost)}</strong></p>
          </div>
          
          {isEditingCapital ? (
            <div className="flex items-center gap-1.5 mt-2">
              <input
                type="number"
                value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value)}
                className="bg-white/5 border border-white/20 text-white font-mono text-[11px] px-1.5 py-0.5 rounded w-16 focus:outline-none focus:ring-1 focus:ring-[#FFE600]"
              />
              <button
                onClick={() => {
                  const val = Number(capitalInput);
                  if (!isNaN(val) && val >= 0) {
                    onUpdateCapital(val);
                    setIsEditingCapital(false);
                  }
                }}
                className="bg-[#FFE600] hover:bg-[#FFE600]/80 text-black text-[10px] font-black px-2 py-0.5 rounded cursor-pointer"
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-white/50 mt-2 border-t border-white/5 pt-1.5">
              <span>Aporte: <strong className="font-mono text-white/80">{formatCurrency(initialCapital)}</strong></span>
              <button
                onClick={() => {
                  setCapitalInput(String(initialCapital));
                  setIsEditingCapital(true);
                }}
                className="text-[#FFE600] opacity-80 hover:opacity-100 transition-opacity text-[10px] underline font-bold cursor-pointer"
              >
                Alterar aporte
              </button>
            </div>
          )}
          <span className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-400" />
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
              Análise de patrimônio estocado para controle patrimonial. Os valores contemplam o estoque ativo atual multiplicado pelos custos de compra e de venda de cada produto.
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

          {/* Card: Patrimônio em Venda */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-[#FFE600]/20 transition-all flex flex-col justify-between">
            <div>
              <p className="text-[11px] font-bold text-[#FFE600]/80 uppercase tracking-wide">Patrimônio (Preço de Venda)</p>
              <h3 className="text-lg font-black text-white mt-1">{formatCurrency(totalPotentialSaleValue)}</h3>
            </div>
            <p className="text-[10px] text-white/40 mt-3 leading-relaxed">
              Previsão de entrada bruta líquida em caixa caso todo o estoque atual seja escoado pelos valores atuais anunciados.
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico de Saídas Customizado e Previsões (Duas Colunas) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico de Vendas (2 Colunas no lg) */}
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md lg:col-span-2 flex flex-col justify-between">
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
                <span className="text-white/60 font-medium">Faturamento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-400 block"></span>
                <span className="text-white/60 font-medium">Lucro Líquido</span>
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

        {/* Bloco de Previsibilidade & Estimativa (1 Coluna) */}
        <div className="bg-[#0d0d0d] text-white p-6 rounded-2xl border border-white/10 shadow-xl flex flex-col justify-between">
          <div>
            <div className="bg-[#FFE600]/10 text-[#FFE600] px-3 py-1 rounded-full text-xs font-bold w-fit mb-4 border border-[#FFE600]/20">
              ⚡ Previsibilidade & Projeção
            </div>
            <h3 className="text-base font-light text-white">Próximos 30 Dias Estimados</h3>
            <p className="text-xs text-white/50 mt-1">Estimativa de fluxo com base no ritmo acrobat de vendas de {unitsSoldPerDay.toFixed(1)} unidades/dia.</p>

            <div className="mt-6 space-y-4">
              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Ritmo de Saída Estimado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-[#FFE600]">{Math.ceil(salesPrediction30Days)}</span>
                  <span className="text-xs text-white/60 font-medium font-mono">unidades / mês</span>
                </div>
              </div>

              <div className="bg-white/5 p-3.5 rounded-xl border border-white/5">
                <p className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Faturamento Projetado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-white/90">{formatCurrency(projectedRevenue30Days)}</span>
                </div>
              </div>

              <div className="bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/20">
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Ganho Líquido Projetado</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-extrabold text-[#FFE600]">{formatCurrency(projectedNetProfit30Days)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 text-[11px] text-white/40 text-center">
            Adicione mais vendas para aumentar a precisão estatística da projeção.
          </div>
        </div>

      </div>

      {/* Seção de Alertas e Recomendações Críticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Estoque Baixo */}
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 block animate-pulse"></span>
            Alertas de Reposição de Estoque ({lowStockItems.length})
          </h3>
          
          {lowStockItems.length === 0 ? (
            <div className="text-white/40 text-xs py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
              Excelente! Todos os produtos estão com estoque acima do nível de segurança.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {lowStockItems.map((prod) => (
                <div key={prod.id} className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/15 hover:bg-red-500/10 transition-colors">
                  <div>
                    <p className="text-xs font-bold text-white">{prod.name}</p>
                    <p className="text-[10px] text-white/40 font-mono mt-0.5">SKU: {prod.sku} | Categoria: {prod.category}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-red-400 bg-red-400/10 px-2 py-1 rounded block border border-red-500/25">
                      {prod.stock === 1 ? '1 un.' : `${prod.stock} un.`}
                    </span>
                    <span className="text-[9px] text-white/40 block mt-1">Seguro: &gt;={prod.minimalStock}</span>
                  </div>
                </div>
              ))}
              <div className="pt-2 text-center">
                <button 
                  onClick={() => onNavigateToTab('stock')}
                  className="text-xs font-bold text-[#FFE600] hover:underline cursor-pointer"
                >
                  Ir para Estoque
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tempo parado */}
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
            Produtos com Estoque Retido (+30 dias) ({idleStockItems.length})
          </h3>

          {idleStockItems.length === 0 ? (
            <div className="text-white/40 text-xs py-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
              Parabéns! Nenhum produto está sem giro há mais de 30 dias.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {idleStockItems.map((prod) => {
                const days = calculateDaysInStock(prod.addedDate);
                return (
                  <div key={prod.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 hover:bg-amber-500/10 transition-colors">
                    <div>
                      <p className="text-xs font-bold text-white">{prod.name}</p>
                      <p className="text-[10px] text-white/40 font-mono mt-0.5 font-semibold">Valor em caixa: {formatCurrency(prod.purchasePrice * prod.stock)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-extrabold text-amber-400 bg-amber-400/15 px-2.5 py-1 rounded block border border-amber-500/25">
                        {days} dias parado
                      </span>
                      <span className="text-[9px] text-white/40 block mt-1">Estoque: {prod.stock} un.</span>
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 text-center text-xs text-white/50">
                💡 <span className="font-semibold text-white/80">Dica:</span> Considere criar ofertas ou anúncios <span className="font-bold text-emerald-400">Clássicos</span> com menor margem para girar esse estoque retido mais rápido!
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
