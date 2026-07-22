import React, { useState } from 'react';
import { X, Calculator, ArrowRight, TrendingUp, Maximize2, Minimize2 } from 'lucide-react';
import { formatCurrency } from '../utils';

interface MLCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MLCalculatorModal({ isOpen, onClose }: MLCalculatorModalProps) {
  const [mode, setMode] = useState<'profit' | 'price'>('profit');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  
  // Common inputs
  const [purchasePrice, setPurchasePrice] = useState<number | ''>('');
  const [shippingCost, setShippingCost] = useState<number | ''>('');
  const [taxPercent, setTaxPercent] = useState<number | ''>(4); // Imposto da venda (padrão 4%)
  
  // Profit mode inputs
  const [salePrice, setSalePrice] = useState<number | ''>('');
  const [mlCategory, setMlCategory] = useState<'classic' | 'premium' | 'manual'>('classic');
  const [manualMlFeePercent, setManualMlFeePercent] = useState<number | ''>(12);
  const [fixedFee, setFixedFee] = useState<number | ''>(0); // Taxa fixa manual (padrão 0)

  // Price mode inputs
  const [desiredProfit, setDesiredProfit] = useState<number | ''>('');

  if (!isOpen) return null;

  const numPurchase = Number(purchasePrice) || 0;
  const numShipping = Number(shippingCost) || 0;
  const numSale = Number(salePrice) || 0;
  const numDesiredProfit = Number(desiredProfit) || 0;
  const numTaxPercent = Number(taxPercent) || 0;

  const numManualPercent = Number(manualMlFeePercent) || 0;
  const numFixedFee = Number(fixedFee) || 0;

  // Calculos
  let calculatedSalePrice = 0;
  let calculatedMlFee = 0;
  let calculatedTax = 0;
  let grossProfit = 0;
  let netProfit = 0;

  const percentRate = (
    mlCategory === 'classic' ? 12 :
    mlCategory === 'premium' ? 17 :
    numManualPercent
  ) / 100;

  const taxRate = numTaxPercent / 100;

  if (mode === 'profit') {
    calculatedSalePrice = numSale;

    calculatedMlFee = (calculatedSalePrice * percentRate) + numFixedFee;
    calculatedTax = (calculatedSalePrice * taxRate);
    grossProfit = calculatedSalePrice - numPurchase;
    netProfit = grossProfit - numShipping - calculatedMlFee - calculatedTax;
  } else {
    // Mode 'price' (Sugestão de Preço para obter o Lucro Líquido Desejado)
    const divider = 1 - percentRate - taxRate;

    if (divider > 0) {
      const s = (numDesiredProfit + numPurchase + numShipping + numFixedFee) / divider;
      calculatedSalePrice = Math.max(0, s);
    } else {
      calculatedSalePrice = 0;
    }

    calculatedMlFee = (calculatedSalePrice * percentRate) + numFixedFee;
    calculatedTax = (calculatedSalePrice * taxRate);
    grossProfit = calculatedSalePrice - numPurchase;
    netProfit = numDesiredProfit;
  }

  const totalExpenses = numShipping + calculatedMlFee + calculatedTax;
  const netMargin = numPurchase > 0 ? (netProfit / numPurchase) * 100 : 0;

  // Renderização reduzida (Balãozinho minimizado)
  if (isCollapsed) {
    return (
      <div className="fixed bottom-6 right-6 z-[100] bg-black border border-white/10 rounded-full py-2.5 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex items-center gap-3 animate-in fade-in duration-200">
        <div className="p-1.5 bg-[#FFE600]/10 text-[#FFE600] rounded-full">
          <Calculator className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-white whitespace-nowrap leading-none">Calculadora ML</span>
          <span className="text-[9px] text-[#FFE600] font-bold mt-0.5 leading-none">
            {netProfit > 0 ? `Lucro: ${formatCurrency(netProfit)}` : 'Ativa'}
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1">
          <button
            onClick={() => setIsCollapsed(false)}
            title="Expandir"
            className="p-1 text-white/50 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Fechar"
            className="p-1 text-red-400 hover:text-red-300 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 md:left-auto md:right-6 md:bottom-6 md:w-[380px] z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl overflow-hidden flex flex-col bg-[#0f0f0f] border border-white/15 animate-in slide-in-from-bottom duration-300">
      
      {/* Header do Balão */}
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-[#141414] to-black">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-[#FFE600]/10 text-[#FFE600] rounded-lg">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Calculadora ML (Balão)</h2>
            <p className="text-[10px] text-white/50 font-medium">Interaja com a tela livremente ao fundo</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsCollapsed(true)} 
            title="Minimizar para o canto"
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button 
            onClick={onClose} 
            title="Fechar"
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-1 flex gap-1 border-b border-white/5 bg-white/[0.01]">
        <button
          onClick={() => setMode('profit')}
          className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer ${mode === 'profit' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
        >
          Calcular Lucro
        </button>
        <button
          onClick={() => setMode('price')}
          className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-colors cursor-pointer ${mode === 'price' ? 'bg-[#FFE600]/10 text-[#FFE600]' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
        >
          Sugerir Preço
        </button>
      </div>

      {/* Form Body */}
      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
        
        {mode === 'profit' ? (
          <div>
            <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">Preço de Venda (Anúncio ML)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-xs font-bold">R$</span>
              <input
                type="number"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-8 pr-4 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-[10px] font-bold text-[#FFE600] block mb-1 uppercase tracking-wider flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Margem de Lucro Líquido Desejada (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFE600]/60 text-xs font-bold">R$</span>
              <input
                type="number"
                value={desiredProfit}
                onChange={e => setDesiredProfit(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-[#FFE600]/5 border border-[#FFE600]/20 rounded-xl pl-8 pr-4 py-2 text-xs text-[#FFE600] font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/50 placeholder:text-[#FFE600]/20"
              />
            </div>
          </div>
        )}

        {/* Custo de Compra, Custo de Frete e Imposto da Venda */}
        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">Custo Compra</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-[11px] font-bold">R$</span>
              <input
                type="number"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-2 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">Custo Frete</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-[11px] font-bold">R$</span>
              <input
                type="number"
                value={shippingCost}
                onChange={e => setShippingCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-2 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-red-500/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-blue-400 block mb-1 uppercase tracking-wider">Imposto Venda</label>
            <div className="relative">
              <input
                type="number"
                value={taxPercent}
                onChange={e => setTaxPercent(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="4"
                className="w-full bg-blue-500/10 border border-blue-500/20 rounded-xl pr-6 pl-2.5 py-2 text-xs text-blue-300 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400/60 text-xs font-bold">%</span>
            </div>
          </div>
        </div>

        {/* Tipo de Anúncio */}
        <div className="space-y-3 pt-1">
          <div>
            <label className="text-[10px] font-bold text-white/60 block mb-1 uppercase tracking-wider">Regra de Tarifa / Canal</label>
            <select
              value={mlCategory}
              onChange={e => setMlCategory(e.target.value as any)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30"
            >
              <option value="manual">Manual (Definir comissão e taxa fixa)</option>
              <option value="classic">Clássico (12%)</option>
              <option value="premium">Premium (17%)</option>
            </select>
          </div>

          {/* Configuração de Comissão e Taxa Fixa */}
          <div className="space-y-2.5 p-3 bg-white/[0.02] border border-white/5 rounded-xl animate-in fade-in duration-200">
            <div className="grid grid-cols-2 gap-3">
              {mlCategory === 'manual' ? (
                <div>
                  <label className="text-[9px] font-black text-white/50 block mb-1 uppercase tracking-widest">Comissão (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={manualMlFeePercent}
                      onChange={e => setManualMlFeePercent(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="13"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 text-xs font-bold">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[9px] font-black text-white/50 block mb-1 uppercase tracking-widest">Comissão (%)</label>
                  <div className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold">
                    {(percentRate * 100).toFixed(0)}%
                  </div>
                </div>
              )}

              {/* Valor da Tarifa/Comissão Calculado Automaticamente em R$ */}
              <div>
                <label className="text-[9px] font-black text-[#FFE600] block mb-1 uppercase tracking-widest flex items-center justify-between">
                  <span>Tarifa (R$)</span>
                  <span className="text-[8px] bg-[#FFE600]/20 text-[#FFE600] px-1 py-0.2 rounded font-bold">AUTO</span>
                </label>
                <div className="bg-[#FFE600]/10 border border-[#FFE600]/30 rounded-xl px-3 py-1.5 text-xs text-[#FFE600] font-mono font-black flex items-center justify-between">
                  <span>{formatCurrency(calculatedSalePrice * percentRate)}</span>
                  <span className="text-[8px] text-[#FFE600]/60 font-sans font-medium">({(percentRate * 100).toFixed(0)}%)</span>
                </div>
              </div>
            </div>

            {/* Taxa Fixa Extra Opcional */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-3">
              <label className="text-[9px] font-bold text-white/40 uppercase tracking-wider whitespace-nowrap">
                + Taxa Fixa Extra (R$):
              </label>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs font-bold">R$</span>
                <input
                  type="number"
                  value={fixedFee}
                  onChange={e => setFixedFee(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full bg-black/40 border border-white/10 rounded-xl pl-7 pr-2 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Resumos / Resultados */}
        <div className="pt-4 border-t border-white/5 space-y-2.5">
          {mode === 'price' && (
            <div className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/10">
              <span className="text-xs font-bold text-white/80 flex items-center gap-1">
                <ArrowRight className="w-3.5 h-3.5 text-[#FFE600]" />
                Preço de Venda Sugerido
              </span>
              <span className="text-base font-black text-white font-mono">{formatCurrency(calculatedSalePrice)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50 font-medium">Lucro Bruto Estimado</span>
            <span className="font-mono font-bold text-white/80">{formatCurrency(grossProfit)}</span>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50 font-medium">Comissão + Frete + Taxa</span>
            <span className="font-mono font-bold text-red-400">-{formatCurrency(calculatedMlFee + numShipping)}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-blue-400 font-medium">Imposto da Venda ({numTaxPercent}%)</span>
            <span className="font-mono font-bold text-blue-400">-{formatCurrency(calculatedTax)}</span>
          </div>

          <div className={`flex items-center justify-between p-3.5 rounded-xl border mt-2 ${mode === 'profit' ? 'bg-[#FFE600]/10 border-[#FFE600]/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
            <div>
              <span className={`block text-[9px] font-black uppercase tracking-widest mb-0.5 ${mode === 'profit' ? 'text-[#FFE600]/80' : 'text-emerald-400/80'}`}>Lucro Líquido {mode === 'price' && '(Atingido)'}</span>
              <span className={`text-xl font-black font-mono leading-none tracking-tight ${mode === 'profit' ? 'text-[#FFE600]' : 'text-emerald-400'}`}>
                {formatCurrency(netProfit)}
              </span>
            </div>
            <div className="text-right">
              <span className={`block text-[9px] font-black uppercase tracking-widest mb-0.5 ${mode === 'profit' ? 'text-[#FFE600]/80' : 'text-emerald-400/80'}`}>Margem Líquida</span>
              <span className={`text-base font-black leading-none ${mode === 'profit' ? 'text-[#FFE600]' : 'text-emerald-400'}`}>
                {netMargin.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
