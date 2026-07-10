/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, Sale } from '../types';
import { calculateMLFee, calculateDaysInStock, formatCurrency } from '../utils';
import { Edit, Trash2, Plus, Search, Tag, Settings, Activity, Clock, SlidersHorizontal, Eye, RefreshCw, Layers } from 'lucide-react';

interface StockControlProps {
  products: Product[];
  sales: Sale[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onClearDatabase: () => void;
}

export default function StockControl({
  products,
  sales,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onClearDatabase
}: StockControlProps) {
  // Estados para pesquisa e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'idle'>('all');

  // Controle de Modal / Formulário de Adicionar Produto
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Estados para o Modal de Excluir Tudo por Senha
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [minimalStock, setMinimalStock] = useState<number>(5);
  const [category, setCategory] = useState('');
  const [mlFeeType, setMlFeeType] = useState<'classic' | 'premium' | 'custom' | 'none'>('classic');
  const [customFeePercent, setCustomFeePercent] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [addedDate, setAddedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const categories = Array.from(new Set(products.map(p => p.category)));

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    
    let matchesStatus = true;
    if (stockStatusFilter === 'low') {
      matchesStatus = p.stock <= p.minimalStock;
    } else if (stockStatusFilter === 'idle') {
      // Calcular dias sem giro reais
      const lastSale = sales
        .filter(s => s.productId === p.id && s.status !== 'refunded')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
      let daysWithoutSale = 0;
      if (lastSale) {
        const lastDate = new Date(lastSale.date + 'T12:00:00');
        const diffTime = new Date().getTime() - lastDate.getTime();
        daysWithoutSale = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else {
        const addedDate = new Date(p.addedDate + 'T12:00:00');
        const diffTime = new Date().getTime() - addedDate.getTime();
        daysWithoutSale = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
      matchesStatus = daysWithoutSale >= 30;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenAdd = () => {
    setName('');
    setSku('');
    setPurchasePrice(0);
    setSalePrice(0);
    setStock(10);
    setMinimalStock(5);
    setCategory('Eletrônicos');
    setMlFeeType('classic');
    setCustomFeePercent(0);
    setShippingCost(0);
    setAddedDate(new Date().toISOString().split('T')[0]);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku);
    setPurchasePrice(p.purchasePrice);
    setSalePrice(p.salePrice);
    setStock(p.stock);
    setMinimalStock(p.minimalStock);
    setCategory(p.category);
    setMlFeeType(p.mlFeeType);
    setCustomFeePercent(p.customFeePercent || 0);
    setShippingCost(p.shippingCost);
    setAddedDate(p.addedDate);
    setIsEditOpen(true);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) return;
    
    onAddProduct({
      name,
      sku,
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      stock: Number(stock),
      minimalStock: Number(minimalStock),
      category,
      mlFeeType,
      customFeePercent: mlFeeType === 'custom' ? Number(customFeePercent) : undefined,
      shippingCost: Number(shippingCost),
      addedDate
    });
    setIsAddOpen(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !name || !sku) return;

    onEditProduct({
      id: editingProduct.id,
      name,
      sku,
      purchasePrice: Number(purchasePrice),
      salePrice: Number(salePrice),
      stock: Number(stock),
      minimalStock: Number(minimalStock),
      category,
      mlFeeType,
      customFeePercent: mlFeeType === 'custom' ? Number(customFeePercent) : undefined,
      shippingCost: Number(shippingCost),
      addedDate
    });
    setIsEditOpen(false);
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Barra de Filtro e Pesquisa */}
      <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-md flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-white/40 w-4.5 h-4.5" />
          <input
            type="text"
            placeholder="Buscar por fone, suporte, SKU, marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 text-white font-medium"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          {/* Categoria */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold text-white/75">
            <Tag className="w-3.5 h-3.5 text-[#FFE600]" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent focus:outline-none text-white font-bold cursor-pointer"
            >
              <option value="all" className="bg-[#121212] text-white">Todas categorias</option>
              {categories.map((cat, idx) => (
                <option key={idx} value={cat} className="bg-[#121212] text-white">{cat}</option>
              ))}
            </select>
          </div>

          {/* Estado de Alerta */}
          <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold text-white/75">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FFE600]" />
            <select
              value={stockStatusFilter}
              onChange={(e) => setStockStatusFilter(e.target.value as any)}
              className="bg-transparent focus:outline-none text-white font-bold cursor-pointer"
            >
              <option value="all" className="bg-[#121212] text-white">Status de Estoque</option>
              <option value="low" className="bg-[#121212] text-white">Reposição Crítica</option>
              <option value="idle" className="bg-[#121212] text-white">Estagnados (+30 dias)</option>
            </select>
          </div>

          {/* Adicionar Produto */}
          <button
            onClick={handleOpenAdd}
            className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(255,230,0,0.25)] cursor-pointer flex items-center gap-1.5"
            id="add-product-btn"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Produto</span>
          </button>

          {/* Apagar Tudo */}
          <button
            onClick={() => {
              setIsClearOpen(true);
              setClearPassword('');
              setClearError(null);
            }}
            className="bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-100 hover:text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.1"
            id="clear-all-stock-btn"
          >
            <Trash2 className="w-4 h-4" />
            <span>Apagar Tudo ⚠️</span>
          </button>
        </div>
      </div>

      {/* Tabela Administrativa Complexa de Estoque */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-md overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-base font-light text-white">Itens e Ativos Cadastrados</h3>
            <p className="text-xs text-white/50 mt-0.5">Visão técnica e gerencial de custos, precificação, taxas ML e dias parados.</p>
          </div>
          <span className="text-xs font-bold text-[#FFE600] bg-[#FFE600]/10 border border-[#FFE600]/20 px-2.5 py-1 rounded-full">
            {filteredProducts.length} produtos mostrados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/40 text-[11px] font-bold uppercase tracking-wider border-b border-white/10">
                <th className="py-4 px-5">Produto / SKU</th>
                <th className="py-4 px-4 text-center">Compra</th>
                <th className="py-4 px-4 text-center">Venda ML</th>
                <th className="py-4 px-4 text-center text-[#FFE600] font-black">Lucro & Margem Líq.</th>
                <th className="py-4 px-4 text-center">Previsão Comissão ML</th>
                <th className="py-4 px-4 text-center">Frete</th>
                <th className="py-4 px-4 text-center">Estoque Atual</th>
                <th className="py-4 px-4 text-center">Dias sem Giro</th>
                <th className="py-4 px-5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/95 text-xs font-semibold">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-white/40 text-xs bg-white/5">
                    Nenhum produto cadastrado com os filtros ativos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const lastSale = sales
                    .filter(s => s.productId === p.id && s.status !== 'refunded')
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    
                  let days = 0;
                  if (lastSale) {
                    const lastDate = new Date(lastSale.date + 'T12:00:00');
                    const diffTime = new Date().getTime() - lastDate.getTime();
                    days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  } else {
                    const addedDate = new Date(p.addedDate + 'T12:00:00');
                    const diffTime = new Date().getTime() - addedDate.getTime();
                    days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                  }

                  const isCritical = p.stock <= p.minimalStock;
                  
                  // Lucro Esperado (comissão padrão estimativa)
                  const mlFee = calculateMLFee(p.salePrice, p.mlFeeType, p.customFeePercent);
                  const difference = p.salePrice - p.purchasePrice;
                  const estimatedNetProfit = p.salePrice - p.purchasePrice - mlFee - p.shippingCost;
                  const netMargin = p.purchasePrice > 0 ? (estimatedNetProfit / p.purchasePrice) * 100 : 0;

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      {/* Name and SKU */}
                      <td className="py-4 px-5">
                        <div>
                          <p className="text-white font-bold max-w-xs truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-white/5 text-white/50 border border-white/10 px-1.5 py-0.5 rounded font-mono">
                              {p.sku}
                            </span>
                            <span className="text-[10px] bg-white/5 text-white/40 border border-white/5 px-1.5 py-0.5 rounded">
                              {p.category}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Compra */}
                      <td className="py-4 px-4 text-center text-white/80">
                        {formatCurrency(p.purchasePrice)}
                      </td>

                      {/* Venda */}
                      <td className="py-4 px-4 text-center text-[#FFE600] font-bold">
                        {formatCurrency(p.salePrice)}
                      </td>

                      {/* Lucro & Margem Líquida */}
                      <td className="py-4 px-4 text-center bg-emerald-500/5 border-x border-white/5">
                        <span className={`text-[13px] font-black block font-mono ${estimatedNetProfit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {estimatedNetProfit > 0 ? '+' : ''}{formatCurrency(estimatedNetProfit)}
                        </span>
                        {estimatedNetProfit > 0 ? (
                          <div className="flex flex-col items-center gap-0.5 mt-0.5">
                            <span className="text-[10px] text-emerald-400 font-black bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30" title="Margem de ganho esperada sobre o preço de compra">
                              {netMargin.toFixed(0)}% Margem
                            </span>
                            <span className="text-[9px] text-white/30 font-medium font-mono">
                              (Bruto: {formatCurrency(difference)})
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-0.5 mt-0.5">
                            <span className="text-[9.5px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.2 rounded-full">
                              Sem Margem
                            </span>
                            <span className="text-[9px] text-white/30 font-medium font-mono">
                              (Bruto: {formatCurrency(difference)})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Taxa ML */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-amber-400 font-semibold">{formatCurrency(mlFee)}</span>
                        <span className="text-[9px] block text-white/40 font-medium">
                          {p.mlFeeType === 'premium' ? 'Premium (17%)' : p.mlFeeType === 'classic' ? 'Clássico (12%)' : 'Sem Taxa'}
                          {p.salePrice < 79 && p.mlFeeType !== 'none' ? '+R$6.00' : ''}
                        </span>
                      </td>

                      {/* Frete */}
                      <td className="py-4 px-4 text-center text-white/50">
                        {p.shippingCost > 0 ? formatCurrency(p.shippingCost) : 'Grátis'}
                      </td>

                      {/* Estoque */}
                      <td className="py-4 px-4 text-center">
                        <div className="inline-block">
                          <span className={`px-2 py-1 rounded text-xs font-bold font-mono block ${
                            p.stock === 0 
                              ? 'bg-red-500 text-white' 
                              : isCritical 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : 'bg-emerald-500/20 text-emerald-450 text-emerald-400 border border-emerald-555 border-emerald-500/30'
                          }`}>
                            {p.stock} un.
                          </span>
                          <span className="text-[9px] text-white/40 mt-1 block">Min: {p.minimalStock}</span>
                        </div>
                      </td>

                      {/* Dias parados */}
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1 font-semibold ${
                          days >= 30 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20 font-extrabold' 
                            : 'bg-[#1a1a1a] text-white/60'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {days} dias
                        </span>
                        <span className="text-[9px] text-white/40 block mt-1">Desde: {p.addedDate.substring(8,10)}/{p.addedDate.substring(5,7)}</span>
                      </td>

                      {/* Ações */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {deletingProductId === p.id ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  onDeleteProduct(p.id);
                                  setDeletingProductId(null);
                                }}
                                className="bg-red-650 hover:bg-red-700 bg-red-650 hover:bg-red-700 text-white font-extrabold text-[10px] px-2 py-1 rounded cursor-pointer animate-pulse"
                              >
                                Excluir definitivo
                              </button>
                              <button
                                onClick={() => setDeletingProductId(null)}
                                className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-2 py-1 rounded cursor-pointer"
                              >
                                Voltar
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:text-[#FFE600] p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Editar Dados"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingProductId(p.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Deletar"
                                id={`delete-product-btn-${p.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulário Modal para Adicionar Produto */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-white/10 max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-light text-white mb-2">Cadastrar Novo Produto para Vendas</h3>
            <p className="text-xs text-white/50 mb-5">Preencha os campos para calcular as dezenas de taxas do Mercado Livre e obter o retorno líquido real.</p>

            <form onSubmit={handleSaveAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-white/70 block mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Fone Bluetooth Pro X"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">SKU / Código Único *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ex: ML-FBT-009"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Categoria de Venda</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Eletrônicos"
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Compra R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchasePrice || ''}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Venda R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salePrice || ''}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Nível de Segurança (Mínimo)</label>
                  <input
                    type="number"
                    required
                    value={minimalStock}
                    onChange={(e) => setMinimalStock(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Anúncio Mercado Livre</label>
                  <select
                    value={mlFeeType}
                    onChange={(e) => setMlFeeType(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  >
                    <option value="classic" className="bg-[#121212] text-white">Clássico (12% comissão)</option>
                    <option value="premium" className="bg-[#121212] text-white">Premium (17% comissão)</option>
                    <option value="custom" className="bg-[#121212] text-white">Outra Taxa (Personalizado %)</option>
                    <option value="none" className="bg-[#121212] text-white">Nenhum (Sem taxa ML)</option>
                  </select>
                </div>

                {mlFeeType === 'custom' ? (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Porcentagem Comissão (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customFeePercent || ''}
                      onChange={(e) => setCustomFeePercent(Math.max(0, Number(e.target.value)))}
                      placeholder="Ex: 15"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Frete pago p/ Vendedor R$</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCost || ''}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                )}

                {mlFeeType === 'custom' && (
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-white/70 block mb-1">Frete pago p/ Vendedor R$</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCost || ''}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-xs font-bold text-white/70 block mb-1">Data de Aquisição</label>
                  <input
                    type="date"
                    value={addedDate}
                    onChange={(e) => setAddedDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>
              </div>

              {/* Pré-visualizador de retorno do Mercado Livre */}
              {salePrice > 0 && (() => {
                const percent = mlFeeType === 'custom' 
                  ? customFeePercent 
                  : (mlFeeType === 'classic' ? 12 : (mlFeeType === 'premium' ? 17 : 0));
                
                const comissaoValor = (salePrice * percent) / 100;
                const isTaxaFixaAplicavel = salePrice > 0 && salePrice < 79 && (mlFeeType === 'classic' || mlFeeType === 'premium');
                const taxaFixaValor = isTaxaFixaAplicavel ? 6.00 : 0;
                const totalMLFee = mlFeeType === 'none' ? 0 : (comissaoValor + taxaFixaValor);
                const retornoLiquido = salePrice - totalMLFee - shippingCost - purchasePrice;

                return (
                  <div className="bg-[#FFE600]/10 border border-[#FFE600]/30 rounded-xl p-3.5 text-xs mt-3 text-white space-y-2">
                    <p className="font-bold text-[#FFE600] flex items-center gap-1.5 border-b border-[#FFE600]/20 pb-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      <span>Simulação Detalhada de Comissão e Taxas</span>
                    </p>
                    <div className="space-y-1.5 text-white/80">
                      <div className="flex justify-between">
                        <span>Anúncio Selecionado:</span>
                        <span className="font-bold text-[#FFE600]">
                          {mlFeeType === 'classic' ? 'Clássico' : mlFeeType === 'premium' ? 'Premium' : mlFeeType === 'custom' ? 'Personalizado' : 'Nenhum'}
                        </span>
                      </div>
                      
                      {mlFeeType !== 'none' && (
                        <>
                          <div className="flex justify-between font-mono">
                            <span>Comissão de Venda ({percent}%):</span>
                            <span className="text-red-400 font-bold">-{formatCurrency(comissaoValor)}</span>
                          </div>
                          {isTaxaFixaAplicavel && (
                            <div className="flex justify-between font-mono text-white/60">
                              <span className="flex items-center gap-1">
                                Taxa Fixa por Venda (produto &lt; R$ 79):
                                <span className="text-[10px] bg-red-400/25 text-red-200 px-1 rounded font-bold" title="Taxa fixa obrigatória do Mercado Livre">ML</span>
                              </span>
                              <span className="text-red-400 font-bold">-{formatCurrency(taxaFixaValor)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-white/5 pt-1.5 font-bold font-mono text-[#FFE600]">
                            <span>Soma de Taxas ML:</span>
                            <span className="text-red-400 font-extrabold">-{formatCurrency(totalMLFee)}</span>
                          </div>
                        </>
                      )}

                      {shippingCost > 0 && (
                        <div className="flex justify-between font-mono text-white/75">
                          <span>Frete pago pelo Vendedor:</span>
                          <span className="text-red-400 font-bold">-{formatCurrency(shippingCost)}</span>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-[#FFE600]/20 pt-2 font-bold text-white">
                        <span>Lucro Líquido Unitário Previsto:</span>
                        <span className={`font-black font-mono text-sm ${retornoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(retornoLiquido)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(255,230,0,0.25)]"
                >
                  Cadastrar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formulário Modal para Editar Produto */}
      {isEditOpen && editingProduct && (
        <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-white/10 max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-light text-white mb-2">Editar Produto</h3>
            <p className="text-xs text-white/50 mb-5">Modifique as informações necessárias.</p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-bold text-white/70 block mb-1">Nome do Produto *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">SKU / Código Único *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Compra R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Venda R$ *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={salePrice}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Estoque Atual</label>
                  <input
                    type="number"
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Nível de Segurança</label>
                  <input
                    type="number"
                    required
                    value={minimalStock}
                    onChange={(e) => setMinimalStock(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Anúncio Mercado Livre</label>
                  <select
                    value={mlFeeType}
                    onChange={(e) => setMlFeeType(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                  >
                    <option value="classic" className="bg-[#121212] text-white">Clássico (12% comissão)</option>
                    <option value="premium" className="bg-[#121212] text-white">Premium (17% comissão)</option>
                    <option value="custom" className="bg-[#121212] text-white">Outra Taxa (Personalizado %)</option>
                    <option value="none" className="bg-[#121212] text-white">Nenhum (Sem taxa ML)</option>
                  </select>
                </div>

                {mlFeeType === 'custom' ? (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Porcentagem Comissão (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customFeePercent || ''}
                      onChange={(e) => setCustomFeePercent(Math.max(0, Number(e.target.value)))}
                      placeholder="Ex: 15"
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Frete pago pelo Vendedor</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                )}

                {mlFeeType === 'custom' && (
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-white/70 block mb-1">Frete pago pelo Vendedor</label>
                    <input
                      type="number"
                      step="0.01"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="text-xs font-bold text-white/70 block mb-1">Data de Aquisição / Entrada</label>
                  <input
                    type="date"
                    value={addedDate}
                    onChange={(e) => setAddedDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold"
                  />
                </div>
              </div>

              {/* Pré-visualizador de retorno do Mercado Livre */}
              {salePrice > 0 && (() => {
                const percent = mlFeeType === 'custom' 
                  ? customFeePercent 
                  : (mlFeeType === 'classic' ? 12 : (mlFeeType === 'premium' ? 17 : 0));
                
                const comissaoValor = (salePrice * percent) / 100;
                const isTaxaFixaAplicavel = salePrice > 0 && salePrice < 79 && (mlFeeType === 'classic' || mlFeeType === 'premium');
                const taxaFixaValor = isTaxaFixaAplicavel ? 6.00 : 0;
                const totalMLFee = mlFeeType === 'none' ? 0 : (comissaoValor + taxaFixaValor);
                const retornoLiquido = salePrice - totalMLFee - shippingCost - purchasePrice;

                return (
                  <div className="bg-[#FFE600]/10 border border-[#FFE600]/30 rounded-xl p-3.5 text-xs mt-3 text-white space-y-2">
                    <p className="font-bold text-[#FFE600] flex items-center gap-1.5 border-b border-[#FFE600]/20 pb-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      <span>Simulação Detalhada de Comissão e Taxas</span>
                    </p>
                    <div className="space-y-1.5 text-white/80">
                      <div className="flex justify-between">
                        <span>Anúncio Selecionado:</span>
                        <span className="font-bold text-[#FFE600]">
                          {mlFeeType === 'classic' ? 'Clássico' : mlFeeType === 'premium' ? 'Premium' : mlFeeType === 'custom' ? 'Personalizado' : 'Nenhum'}
                        </span>
                      </div>
                      
                      {mlFeeType !== 'none' && (
                        <>
                          <div className="flex justify-between font-mono">
                            <span>Comissão de Venda ({percent}%):</span>
                            <span className="text-red-400 font-bold">-{formatCurrency(comissaoValor)}</span>
                          </div>
                          {isTaxaFixaAplicavel && (
                            <div className="flex justify-between font-mono text-white/60">
                              <span className="flex items-center gap-1">
                                Taxa Fixa por Venda (produto &lt; R$ 79):
                                <span className="text-[10px] bg-red-400/25 text-red-200 px-1 rounded font-bold" title="Taxa fixa obrigatória do Mercado Livre">ML</span>
                              </span>
                              <span className="text-red-400 font-bold">-{formatCurrency(taxaFixaValor)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-white/5 pt-1.5 font-bold font-mono text-[#FFE600]">
                            <span>Soma de Taxas ML:</span>
                            <span className="text-red-400 font-extrabold">-{formatCurrency(totalMLFee)}</span>
                          </div>
                        </>
                      )}

                      {shippingCost > 0 && (
                        <div className="flex justify-between font-mono text-white/75">
                          <span>Frete pago pelo Vendedor:</span>
                          <span className="text-red-400 font-bold">-{formatCurrency(shippingCost)}</span>
                        </div>
                      )}

                      <div className="flex justify-between border-t border-[#FFE600]/20 pt-2 font-bold text-white">
                        <span>Lucro Líquido Unitário Previsto:</span>
                        <span className={`font-black font-mono text-sm ${retornoLiquido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatCurrency(retornoLiquido)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(255,230,0,0.25)]"
                >
                  Confirmar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmação por senha para Apagar Tudo */}
      {isClearOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-red-500/30 max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              <span>Aviso de Segurança Crítica</span>
            </h3>
            <p className="text-xs text-white/70 mb-5 leading-relaxed">
              Você está prestes a apagar <strong>todos os produtos cadastrados e registros de vendas</strong> do sistema. Esta ação é irreversível e esvaziará a sua base de dados local e sincronizada.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (clearPassword === '123') {
                onClearDatabase();
                setIsClearOpen(false);
                setClearPassword('');
                setClearError(null);
              } else {
                setClearError('Senha de confirmação incorreta!');
              }
            }} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/70 block mb-1">Digite a senha de confirmação</label>
                <input
                  type="password"
                  required
                  value={clearPassword}
                  onChange={(e) => {
                    setClearPassword(e.target.value);
                    setClearError(null);
                  }}
                  placeholder="Senha"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 font-bold font-mono tracking-wider"
                />
                {clearError && (
                  <p className="text-red-500 text-[11px] font-bold mt-1.5">{clearError}</p>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearOpen(false)}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.25)]"
                >
                  Apagar Tudo Definitivamente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
