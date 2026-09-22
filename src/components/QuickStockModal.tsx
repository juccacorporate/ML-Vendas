/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, Sale } from '../types';
import { calculateCurrentStock, formatCurrency } from '../utils';
import { Package, X, Check, ArrowRight } from 'lucide-react';

interface QuickStockModalProps {
  product: Product;
  sales: Sale[];
  products: Product[];
  onSave: (updatedProduct: Product) => void;
  onClose: () => void;
}

export default function QuickStockModal({
  product,
  sales,
  products,
  onSave,
  onClose
}: QuickStockModalProps) {
  const currentStock = calculateCurrentStock(product, sales, products);
  const totalSold = product.stock - currentStock;

  const [stockInput, setStockInput] = useState<number>(product.stock);
  const [purchasePriceInput, setPurchasePriceInput] = useState<number>(product.purchasePrice);
  const [minimalStockInput, setMinimalStockInput] = useState<number>(product.minimalStock);

  const calculatedNewCurrent = Math.max(0, stockInput - (totalSold > 0 ? totalSold : 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...product,
      stock: Number(stockInput) || 0,
      purchasePrice: Number(purchasePriceInput) || 0,
      minimalStock: Number(minimalStockInput) || 0
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-[#141414] rounded-2xl border border-[#FFE600]/30 max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-xl bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFE600] block">
              Indicação Rápida de Estoque
            </span>
            <h3 className="text-sm font-bold text-white leading-tight line-clamp-1">
              {product.name}
            </h3>
          </div>
        </div>

        <p className="text-xs text-white/60 mb-5 leading-relaxed">
          Defina o estoque físico total cadastrado e o custo unitário (CMV). O estoque atual líquido será recalculado automaticamente considerando as saídas por vendas.
        </p>

        {/* Resumo atual */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-5 grid grid-cols-2 gap-3 text-center text-xs">
          <div>
            <span className="text-[10px] text-white/40 block">Estoque Físico Atual</span>
            <span className="text-base font-black text-emerald-400 font-mono">{currentStock} un.</span>
          </div>
          <div>
            <span className="text-[10px] text-white/40 block">Total de Saídas</span>
            <span className="text-base font-black text-amber-400 font-mono">{totalSold > 0 ? totalSold : 0} un.</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-white/70 block mb-1">
              Estoque Físico Total Cadastrado (un.) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={stockInput}
              onChange={(e) => setStockInput(Number(e.target.value))}
              className="w-full bg-white/5 border border-[#FFE600]/40 focus:border-[#FFE600] rounded-xl p-3 text-base text-[#FFE600] font-mono font-black focus:outline-none"
            />
            <span className="text-[10px] text-white/40 block mt-1">
              Novo Estoque Atual Disponível: <strong className="text-white font-mono">{calculatedNewCurrent} un.</strong>
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 block mb-1">
              Preço de Custo de Compra (CMV) R$ *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={purchasePriceInput}
              onChange={(e) => setPurchasePriceInput(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-white/70 block mb-1">
              Estoque Mínimo de Segurança (Alerta)
            </label>
            <input
              type="number"
              min="0"
              value={minimalStockInput}
              onChange={(e) => setMinimalStockInput(Number(e.target.value))}
              className="w-full bg-white/5 border border-white/10 focus:border-white/30 rounded-xl p-2.5 text-xs text-white font-mono font-bold focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black text-xs font-black py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(255,230,0,0.3)] flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Salvar Estoque</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
