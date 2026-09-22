/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Sale } from '../types';
import { formatCurrency, calculateCurrentStock, getProductSalesActivity } from '../utils';
import { Search, Save, Package, Check, RefreshCw, AlertCircle, ArrowLeft } from 'lucide-react';

interface ManualStockAdjustPanelProps {
  products: Product[];
  sales: Sale[];
  onSaveBatchStock: (updates: Array<{ id: string; stock: number; purchasePrice: number; salePrice: number; minimalStock: number }>) => void;
  onBackToCatalog?: () => void;
}

export default function ManualStockAdjustPanel({
  products,
  sales,
  onSaveBatchStock,
  onBackToCatalog
}: ManualStockAdjustPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockValues, setStockValues] = useState<Record<string, { stock: number; purchasePrice: number; salePrice: number; minimalStock: number }>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'active' | 'archived'>('all');

  // Inicializar valores a partir dos produtos
  useEffect(() => {
    const initial: Record<string, { stock: number; purchasePrice: number; salePrice: number; minimalStock: number }> = {};
    products.forEach(p => {
      initial[p.id] = {
        stock: p.stock,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        minimalStock: p.minimalStock
      };
    });
    setStockValues(initial);
  }, [products]);

  const handleStockChange = (productId: string, field: 'stock' | 'purchasePrice' | 'salePrice' | 'minimalStock', value: number) => {
    setStockValues(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSaveAll = () => {
    const updates: Array<{ id: string; stock: number; purchasePrice: number; salePrice: number; minimalStock: number }> = [];
    products.forEach(p => {
      const current = stockValues[p.id];
      if (current) {
        updates.push({
          id: p.id,
          stock: Number(current.stock) || 0,
          purchasePrice: Number(current.purchasePrice) || 0,
          salePrice: Number(current.salePrice) || 0,
          minimalStock: Number(current.minimalStock) || 0
        });
      }
    });

    onSaveBatchStock(updates);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const filteredProducts = products.filter(p => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      (p.sku && p.sku.toLowerCase().includes(searchLower)) ||
      (p.skus && p.skus.some(s => s.toLowerCase().includes(searchLower)));

    const activity = getProductSalesActivity(p, sales, products);
    const matchesFilter = filterMode === 'all' || (filterMode === 'active' ? !activity.isArchived : activity.isArchived);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="bg-gradient-to-r from-[#FFE600]/10 via-white/5 to-transparent border border-[#FFE600]/30 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2.5 py-0.5 rounded-full uppercase">
              MODO DE AJUSTE MANUAL 📦
            </span>
            <span className="text-xs text-white/50 font-bold">Indicação de Quantidade Física de Estoque</span>
          </div>
          <h2 className="text-xl font-light text-white">Indicar Estoque e Custo Unitário</h2>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Informe manualmente quantas unidades físicas você possui em estoque e o custo unitário (CMV) de cada produto. O sistema utilizará esses valores para descontar as vendas e calcular seu patrimônio e lucro líquido real.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {onBackToCatalog && (
            <button
              onClick={onBackToCatalog}
              className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao Catálogo</span>
            </button>
          )}

          <button
            onClick={handleSaveAll}
            className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3 px-6 rounded-xl transition-all shadow-[0_0_20px_rgba(255,230,0,0.3)] flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Ajustes de Estoque</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-[#141414] p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex-1 w-full sm:w-auto relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por nome do anúncio ou código MLB..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#FFE600]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="inline-flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-[#FFE600] text-black shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              Todos ({products.length})
            </button>
            <button
              onClick={() => setFilterMode('active')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'active' ? 'bg-[#FFE600] text-black shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              Com Vendas 30d
            </button>
            <button
              onClick={() => setFilterMode('archived')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filterMode === 'archived' ? 'bg-[#FFE600] text-black shadow-sm' : 'text-white/60 hover:text-white'
              }`}
            >
              Arquivados (+30d)
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Ajuste Rápido de Estoque */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-white/5 text-white/40 text-[11px] font-bold uppercase tracking-wider border-b border-white/10">
                <th className="py-3.5 px-5">Produto (Título do Anúncio)</th>
                <th className="py-3.5 px-4">IDs de Anúncio Vinculados (# MLB)</th>
                <th className="py-3.5 px-4 text-center text-[#FFE600] font-black">Estoque Físico Indicado (un.)</th>
                <th className="py-3.5 px-4 text-center">Estoque Atual (Cálculo com Saídas)</th>
                <th className="py-3.5 px-4 text-center">Custo de Compra (CMV) R$</th>
                <th className="py-3.5 px-4 text-center">Preço de Venda R$</th>
                <th className="py-3.5 px-4 text-center">Estoque Mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/40">
                    Nenhum produto encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const val = stockValues[p.id] || {
                    stock: p.stock,
                    purchasePrice: p.purchasePrice,
                    salePrice: p.salePrice,
                    minimalStock: p.minimalStock
                  };
                  const currentStock = calculateCurrentStock(p, sales, products);
                  const activity = getProductSalesActivity(p, sales, products);

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      {/* Nome do Produto */}
                      <td className="py-3.5 px-5 max-w-sm">
                        <div className="space-y-1">
                          <p className="text-white font-bold leading-snug">{p.name}</p>
                          <div className="flex items-center gap-2">
                            {activity.isArchived ? (
                              <span className="text-[9.5px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                Arquivado (+30d sem giro)
                              </span>
                            ) : (
                              <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                                Ativo • {activity.unitsSold30d} un. vendidas em 30d
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* IDs de Anúncio Vinculados */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {p.sku && (
                            <span className="text-[10px] bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 px-1.5 py-0.5 rounded font-mono font-bold">
                              {p.sku}
                            </span>
                          )}
                          {p.skus && p.skus.map((altSku, idx) => (
                            <span key={idx} className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-1.5 py-0.5 rounded font-mono">
                              {altSku}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Estoque Indicado */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={val.stock}
                          onChange={(e) => handleStockChange(p.id, 'stock', Number(e.target.value))}
                          className="w-24 bg-black/60 border-2 border-[#FFE600]/50 focus:border-[#FFE600] rounded-xl px-2.5 py-1.5 text-center text-sm font-black text-[#FFE600] font-mono focus:outline-none"
                        />
                      </td>

                      {/* Estoque Atual */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono inline-block ${
                          currentStock === 0
                            ? 'bg-red-500 text-white'
                            : currentStock <= p.minimalStock
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}>
                          {currentStock} un.
                        </span>
                      </td>

                      {/* Preço de Compra (CMV) */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <span className="text-white/40 text-[11px]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={val.purchasePrice}
                            onChange={(e) => handleStockChange(p.id, 'purchasePrice', Number(e.target.value))}
                            className="w-24 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-white font-mono focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Preço de Venda */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <span className="text-white/40 text-[11px]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={val.salePrice}
                            onChange={(e) => handleStockChange(p.id, 'salePrice', Number(e.target.value))}
                            className="w-24 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-2.5 py-1.5 text-center text-xs font-bold text-white font-mono focus:outline-none"
                          />
                        </div>
                      </td>

                      {/* Estoque Mínimo */}
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={val.minimalStock}
                          onChange={(e) => handleStockChange(p.id, 'minimalStock', Number(e.target.value))}
                          className="w-16 bg-white/5 border border-white/10 focus:border-white/30 rounded-xl px-2 py-1.5 text-center text-xs font-bold text-white/70 font-mono focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer com Salvar */}
        <div className="p-4 border-t border-white/5 bg-white/2 flex items-center justify-between">
          <span className="text-xs text-white/40">
            Mostrando {filteredProducts.length} de {products.length} produtos
          </span>
          <button
            onClick={handleSaveAll}
            className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-2.5 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(255,230,0,0.25)] flex items-center gap-2 cursor-pointer uppercase tracking-wider"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Salvo com Sucesso!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Salvar Todas as Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
