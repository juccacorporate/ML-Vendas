/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Product, Sale } from '../types';
import { calculateMLFee, formatCurrency, formatDate, getDaysRemainingForRelease } from '../utils';
import { ShoppingCart, Plus, Search, Calendar, Landmark, Info, Trash2, ArrowRightCircle, AlertCircle, TrendingUp, Clock, Edit3, X } from 'lucide-react';

interface SalesManagerProps {
  products: Product[];
  sales: Sale[];
  onAddSale: (sale: Omit<Sale, 'id' | 'grossProfit' | 'netProfit'>) => void;
  onCancelSale: (saleId: string, lossAmount?: number, lossReason?: string) => void;
  onCompleteSale?: (saleId: string) => void;
  onClearDatabase: () => void;
  onEditSale?: (updatedSale: Sale) => void;
}

export default function SalesManager({ products, sales, onAddSale, onCancelSale, onCompleteSale, onClearDatabase, onEditSale }: SalesManagerProps) {
  // Controle do Formulário
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customSalePrice, setCustomSalePrice] = useState<number>(0);
  const [customShipping, setCustomShipping] = useState<number>(0);
  const [shippingCostType, setShippingCostType] = useState<'unit' | 'total'>('unit');
  const [saleDate, setSaleDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [discount, setDiscount] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancellingSaleId, setCancellingSaleId] = useState<string | null>(null);

  // Novos Estados: Personalização de Envio (Transportadora vs Full) e Taxas Customizadas
  const [shippingType, setShippingType] = useState<'transportadora' | 'full'>('transportadora');
  const [isCustomMlFee, setIsCustomMlFee] = useState(false);
  const [manualMlFee, setManualMlFee] = useState<number>(0);
  const [mlSaleId, setMlSaleId] = useState('');

  // Estados para o Modal de Cancelamento com Pergunta de Prejuízo
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [saleToCancel, setSaleToCancel] = useState<Sale | null>(null);
  const [lossAmountInput, setLossAmountInput] = useState<string>('0');
  const [lossReasonInput, setLossReasonInput] = useState<string>('');

  // Estados para o Modal de Excluir Tudo por Senha
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);

  // Estados para o Modal de Edição de Venda
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(1);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editShippingType, setEditShippingType] = useState<'transportadora' | 'full'>('transportadora');
  const [isEditCustomMlFee, setIsEditCustomMlFee] = useState(false);
  const [editMlFeeUnit, setEditMlFeeUnit] = useState<number>(0);
  const [editShippingCost, setEditShippingCost] = useState<number>(0);
  const [editDate, setEditDate] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'pending' | 'completed' | 'refunded'>('pending');
  const [editLossAmount, setEditLossAmount] = useState<number>(0);
  const [editLossReason, setEditLossReason] = useState<string>('');
  const [editMlSaleId, setEditMlSaleId] = useState<string>('');

  // Auto-calcular comissão ML sugerida ao editar venda
  React.useEffect(() => {
    if (isEditModalOpen && editingSale && !isEditCustomMlFee) {
      const associatedProduct = products.find(p => p.id === editingSale.productId);
      if (associatedProduct) {
        const suggestedFee = calculateMLFee(Number(editPrice), associatedProduct.mlFeeType, associatedProduct.customFeePercent);
        setEditMlFeeUnit(suggestedFee);
      }
    }
  }, [editPrice, isEditCustomMlFee, isEditModalOpen, editingSale, products]);

  const handleOpenEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setEditPrice(sale.salePrice);
    setEditQuantity(sale.quantity);
    setEditDiscount(sale.discount || 0);
    setEditShippingType(sale.shippingType || 'transportadora');
    
    const feeUnit = sale.quantity > 0 ? (sale.mlFee / sale.quantity) : 0;
    setIsEditCustomMlFee(sale.isCustomSale || false);
    setEditMlFeeUnit(feeUnit);
    
    setEditShippingCost(sale.shippingCost);
    setEditDate(sale.date);
    setEditStatus(sale.status);
    setEditLossAmount(sale.lossAmount || 0);
    setEditLossReason(sale.lossReason || '');
    setEditMlSaleId(sale.mlSaleId || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSale || !onEditSale) return;

    const finalMlFeeTotal = editMlFeeUnit * editQuantity;

    const updatedSale: Sale = {
      ...editingSale,
      salePrice: Number(editPrice),
      quantity: Number(editQuantity),
      discount: Number(editDiscount),
      shippingType: editShippingType,
      isCustomSale: isEditCustomMlFee,
      customMlFee: isEditCustomMlFee ? Number(editMlFeeUnit) : undefined,
      shippingCost: Number(editShippingCost),
      date: editDate,
      status: editStatus,
      mlFee: finalMlFeeTotal,
      lossAmount: editStatus === 'refunded' ? Number(editLossAmount) : undefined,
      lossReason: editStatus === 'refunded' ? editLossReason : undefined,
      mlSaleId: editMlSaleId || undefined,
    };

    onEditSale(updatedSale);
    setIsEditModalOpen(false);
    setEditingSale(null);
  };

  // Pesquisa
  const [searchTerm, setSearchTerm] = useState('');

  // Produto selecionado no dropdown
  const selectedProduct = products.find(p => p.id === selectedProductId);

  // Auto-calcular taxa do ML sugerida quando o preço de venda mudar
  React.useEffect(() => {
    if (selectedProduct && !isCustomMlFee) {
      const suggestedFee = calculateMLFee(Number(customSalePrice), selectedProduct.mlFeeType, selectedProduct.customFeePercent);
      setManualMlFee(suggestedFee);
    }
  }, [customSalePrice, selectedProduct, isCustomMlFee]);

  // Manipular alteração do produto
  const handleProductChange = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setCustomSalePrice(prod.salePrice);
      setCustomShipping(prod.shippingCost);
      setQuantity(1);
      setDiscount(0);
      setFormError(null);
      setShippingType('transportadora');
      setIsCustomMlFee(false);
      const suggestedFee = calculateMLFee(prod.salePrice, prod.mlFeeType, prod.customFeePercent);
      setManualMlFee(suggestedFee);
    }
  };

  // Enviar Venda
  const handleRecordSale = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!selectedProduct || quantity <= 0) return;

    if (selectedProduct.stock < quantity) {
      setFormError(`Quantidade indisponível em estoque! Estoque atual: ${selectedProduct.stock} unidades.`);
      return;
    }

    const finalMlFeeUnit = isCustomMlFee 
      ? Number(manualMlFee) 
      : calculateMLFee(Number(customSalePrice), selectedProduct.mlFeeType, selectedProduct.customFeePercent);

    onAddSale({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity,
      salePrice: Number(customSalePrice),
      date: saleDate,
      mlFee: finalMlFeeUnit * quantity,
      shippingCost: shippingCostType === 'unit' ? Number(customShipping) * quantity : Number(customShipping),
      purchasePrice: selectedProduct.purchasePrice,
      discount: Number(discount),
      shippingType,
      isCustomSale: isCustomMlFee,
      customMlFee: isCustomMlFee ? Number(manualMlFee) : undefined,
      customShippingCost: shippingCostType === 'unit' ? Number(customShipping) : (Number(customShipping) / quantity),
      mlSaleId: mlSaleId || undefined
    });

    // Reset form
    setSelectedProductId('');
    setQuantity(1);
    setCustomSalePrice(0);
    setCustomShipping(0);
    setDiscount(0);
    setFormError(null);
    setShippingType('transportadora');
    setIsCustomMlFee(false);
    setManualMlFee(0);
    setMlSaleId('');
  };

  // Filtragem de vendas
  const filteredSales = sales.filter(s => 
    s.productName.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a,b) => b.date.localeCompare(a.date));

  // Simulando resumo rápido do período de Vendas (separados por status), desconsiderando estornos
  const periodTotalRevenue = filteredSales.filter(s => s.status === 'completed').reduce((acc, s) => acc + (s.salePrice * s.quantity), 0);
  const periodTotalNetProfit = filteredSales.filter(s => s.status === 'completed').reduce((acc, s) => acc + s.netProfit, 0);
  const periodPendingProfit = filteredSales.filter(s => s.status === 'pending').reduce((acc, s) => acc + s.netProfit, 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Grid: Registro de Vendas e Resumo Rápido */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Painel de Registro de Nova Venda (Formulário) */}
        <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md lg:col-span-2">
          {formError && (
            <div className="mb-4 bg-red-400/10 border border-red-400/20 text-red-400 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{formError}</span>
            </div>
          )}

          <h3 className="text-base font-light text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#FFE600]" />
            Registrar Nova Venda de Saída
          </h3>

          <form onSubmit={handleRecordSale} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Seleção do Produto */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-white/70 block mb-1">Selecione o Produto Vendido *</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                >
                  <option value="" className="bg-[#121212] text-white">-- Escolha um produto do estoque --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id} disabled={p.stock === 0} className="bg-[#121212] text-white">
                      {p.name} (SKU: {p.sku}) — Estoque: {p.stock} un. {p.stock === 0 ? '[ESGOTADO]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantidade */}
              {selectedProduct && (
                <>
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Quantidade Vendida *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={selectedProduct.stock}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.min(Number(e.target.value), selectedProduct.stock))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                    />
                    <p className="text-[10px] text-white/40 mt-1 font-medium">Limite disponível: {selectedProduct.stock} un.</p>
                  </div>

                  {/* Preço de Venda Praticado */}
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Preço Unitário de Venda R$ *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={customSalePrice || ''}
                      onChange={(e) => setCustomSalePrice(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                    />
                  </div>

                  {/* Frete Cobrado com Tipo Selecionável */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-white/70">
                        {shippingCostType === 'unit' ? 'Frete Unitário (Por Peça)' : 'Frete Fixo (Venda Inteira)'} R$
                      </label>
                      <div className="flex bg-white/5 p-0.5 rounded-lg border border-white/10 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setShippingCostType('unit')}
                          className={`px-2 py-0.5 rounded-md transition-colors font-bold cursor-pointer ${shippingCostType === 'unit' ? 'bg-[#FFE600] text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          Unitário
                        </button>
                        <button
                          type="button"
                          onClick={() => setShippingCostType('total')}
                          className={`px-2 py-0.5 rounded-md transition-colors font-bold cursor-pointer ${shippingCostType === 'total' ? 'bg-[#FFE600] text-black' : 'text-white/60 hover:text-white'}`}
                        >
                          Total Venda
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      value={customShipping || ''}
                      onChange={(e) => setCustomShipping(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                      placeholder="0,00"
                    />
                  </div>

                  {/* Data da Venda */}
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Data da Venda *</label>
                    <input
                      type="date"
                      required
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                    />
                  </div>

                  {/* Desconto Aplicado */}
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Desconto Aplicado R$ (Opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={discount || ''}
                      onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                      placeholder="0,05"
                    />
                  </div>

                  {/* ID da Venda Mercado Livre */}
                  <div>
                    <label className="text-xs font-bold text-[#FFE600] block mb-1 flex items-center gap-1">
                      <span>ID da Venda Mercado Livre</span>
                      <span className="text-[10px] text-white/40 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={mlSaleId}
                      onChange={(e) => setMlSaleId(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                      placeholder="Ex: 20000035612"
                    />
                  </div>

                  {/* Canal de Envio: Transportadora vs Full */}
                  <div>
                    <label className="text-xs font-bold text-white/70 block mb-1">Canal de Envio / Logística *</label>
                    <select
                      value={shippingType}
                      onChange={(e) => setShippingType(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-[#FFE600] font-black focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                    >
                      <option value="transportadora" className="bg-[#121212] text-white">🚚 Transportadora / Catálogo</option>
                      <option value="full" className="bg-[#121212] text-white">⚡ Mercado Livre Full</option>
                    </select>
                  </div>

                  {/* Personalização de Comissão / Taxas ML */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-white/70 block">
                        Comissão ML Unitária R$
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer text-[10px] text-white/50 select-none">
                        <input
                          type="checkbox"
                          checked={isCustomMlFee}
                          onChange={(e) => setIsCustomMlFee(e.target.checked)}
                          className="rounded border-white/10 bg-white/5 text-[#FFE600] focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                        />
                        <span className="font-bold text-[#FFE600]">Ajustar taxa</span>
                      </label>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      disabled={!isCustomMlFee}
                      value={manualMlFee || ''}
                      onChange={(e) => setManualMlFee(Number(e.target.value))}
                      className={`w-full border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 ${!isCustomMlFee ? 'bg-white/5 opacity-50' : 'bg-white/10 text-[#FFE600]'}`}
                      placeholder="0,00"
                    />
                  </div>

                  {/* Tempo de Conclusão / Gatilho Simulador */}
                  <div className="md:col-span-2 bg-[#FFE600]/5 border border-[#FFE600]/20 rounded-xl p-3 flex gap-2.5 items-start">
                    <Clock className="w-4 h-4 text-[#FFE600] shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <p className="text-[11px] font-bold text-[#FFE600] uppercase tracking-wider">Ciclo de Liberação: 30 dias</p>
                      <p className="text-[10.5px] text-white/60 mt-0.5 leading-relaxed font-medium">
                        O Mercado Livre impõe uma retenção de segurança de 30 dias para liberação do saldo.
                        Durante este período, o dinheiro constará no painel como <strong className="text-[#FFE600] font-bold">Congelado ⏳</strong>, sendo integralmente integrado ao fluxo gerencial após os 30 dias ou caso você realize a liberação manual na tabela abaixo.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Simulação em Tempo Real da Venda que está sendo Registrada */}
            {selectedProduct && quantity > 0 && (
              <div className="bg-[#FFE600]/10 border border-[#FFE600]/30 rounded-2xl p-4 mt-2">
                <p className="font-bold text-[#FFE600] mb-2 text-xs flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  Divisão de Ganhos Desta Transação ({quantity}x)
                </p>
                
                {/* Visualizador de Ganhos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-white/50 font-bold uppercase">Faturamento Bruto</p>
                    <p className="text-sm font-extrabold text-white mt-0.5">
                      {formatCurrency(customSalePrice * quantity)}
                    </p>
                  </div>

                  <div className="bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                    <p className="text-[10px] text-white/50 font-bold uppercase">Encargos Totais ML</p>
                    <p className="text-sm font-extrabold text-red-400 mt-0.5">
                      {formatCurrency(
                        manualMlFee * quantity + 
                        (shippingCostType === 'unit' ? customShipping * quantity : customShipping)
                      )}
                    </p>
                  </div>

                  <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/10">
                    <p className="text-[10px] text-emerald-400 font-bold uppercase">Ganho Líquido Real</p>
                    <p className="text-sm font-black text-emerald-400 mt-0.5">
                      {formatCurrency(
                        (customSalePrice - selectedProduct.purchasePrice - manualMlFee) * quantity - 
                        (shippingCostType === 'unit' ? customShipping * quantity : customShipping) -
                        discount
                      )}
                    </p>
                  </div>
                </div>

                {/* Explicação Detalhada do Cálculo de Taxas para Transparência */}
                {selectedProduct.mlFeeType !== 'none' && (
                  <div className="mt-3 pt-2.5 border-t border-white/5 space-y-1 text-[11px] text-white/50">
                    <div className="flex justify-between">
                      <span>Anúncio do Produto:</span>
                      <span className="font-bold text-[#FFE600] capitalize">
                        {isCustomMlFee ? 'Ajustado Manualmente' : (selectedProduct.mlFeeType === 'classic' ? 'Clássico (12%)' : selectedProduct.mlFeeType === 'premium' ? 'Premium (17%)' : selectedProduct.mlFeeType === 'custom' ? `Personalizado (${selectedProduct.customFeePercent}%)` : 'Sem taxa')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Comissão ML Unitária Sugerida:</span>
                      <span className="font-semibold text-white/80 font-mono">
                        {formatCurrency(calculateMLFee(Number(customSalePrice), selectedProduct.mlFeeType, selectedProduct.customFeePercent))}
                      </span>
                    </div>
                    {isCustomMlFee && (
                      <div className="flex justify-between text-[#FFE600] font-bold">
                        <span>Sua Comissão Unitária Ajustada:</span>
                        <span className="font-bold font-mono">
                          {formatCurrency(manualMlFee)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-white/5 pt-1 mt-1 font-bold">
                      <span>Soma de Comissões ML ({quantity}x):</span>
                      <span className="text-red-400 font-bold font-mono">
                        {formatCurrency(manualMlFee * quantity)}
                      </span>
                    </div>
                    {!isCustomMlFee && customSalePrice < 79 && (selectedProduct.mlFeeType === 'classic' || selectedProduct.mlFeeType === 'premium') && (
                      <div className="space-y-1 mt-1 font-sans">
                        <div className="flex justify-between text-yellow-400/80">
                          <span>Taxa Fixa ML (venda &lt; R$ 79):</span>
                          <span className="font-semibold font-mono">
                            {formatCurrency(6.00 * quantity)}
                          </span>
                        </div>
                        <p className="text-[10px] text-[#FFE600]/70 leading-relaxed bg-white/5 p-2 rounded-lg border border-white/5">
                          💡 <strong>Por que a Taxa Fixa?</strong> O Mercado Livre cobra obrigatoriamente uma taxa fixa de R$ 6,00 por unidade vendida de produtos abaixo de R$ 79,00 nos anúncios Clássico e Premium.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedProduct ? (
              <button
                type="submit"
                className="w-full bg-[#FFE600] text-black font-extrabold text-xs py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(255,230,0,0.25)] hover:bg-[#FFE600]/85 cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Confirmar e Registrar Venda de Saída 🛒</span>
              </button>
            ) : (
              <div className="p-4 bg-white/5 rounded-xl text-center text-xs text-white/40 border border-dashed border-white/10 font-medium">
                Selecione um produto comercializável acima para liberar o registro e estimativas da venda.
              </div>
            )}
          </form>
        </div>

        {/* Resumo Dinâmico Lateral do Período */}
        <div className="bg-[#0d0d0d] border border-white/10 p-6 rounded-2xl text-white flex flex-col justify-between">
          <div>
            <span className="bg-[#FFE600]/10 text-[#FFE600] px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border border-[#FFE600]/20">
              📊 Desempenho do Canal
            </span>
            <h4 className="text-base font-light mt-3 text-white">Consolidado em Histórico</h4>
            <p className="text-xs text-white/50 mt-0.5">Visão rápida das saídas registradas até o momento.</p>

            <div className="mt-6 space-y-4">
              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider font-mono">Faturamento Recebido</span>
                <span className="text-xl font-black text-white mt- block">{formatCurrency(periodTotalRevenue)}</span>
              </div>

              <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-white/40 font-bold block uppercase tracking-wider font-mono">Ganho Líquido Recebido</span>
                <span className="text-xl font-black text-emerald-450 mt-1 block text-emerald-400">{formatCurrency(periodTotalNetProfit)}</span>
              </div>

              {periodPendingProfit > 0 && (
                <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 shadow-inner flex flex-col">
                  <span className="text-[10px] text-amber-400 font-black block uppercase tracking-widest flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                    Retido em Andamento
                  </span>
                  <span className="text-xl font-black text-amber-400 mt-1 block">{formatCurrency(periodPendingProfit)}</span>
                  <p className="text-[9px] text-[#FFE600]/60 mt-1 leading-relaxed font-bold">
                    Aguardando o prazo de 30 dias do repasse de segurança ou liberação manual na tabela.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-white/5 flex items-center gap-2 text-xs text-white/40">
            <Landmark className="w-4 h-4 text-white/40 shrink-0" />
            <span>Valores livres de comissão e do frete cobrados pelo Mercado Livre.</span>
          </div>
        </div>

      </div>

      {/* Histórico Consolidado de Transações */}
      <div className="bg-[#141414] rounded-2xl border border-white/5 shadow-md overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-light text-white">Histórico de Transações de Venda</h3>
            <p className="text-xs text-white/50 mt-0.5">Lista consolidada de todas as saídas integradas ao Mercado Livre.</p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-4 h-4" />
              <input
                type="text"
                placeholder="Pesquisar por produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 text-white font-medium"
              />
            </div>

            {/* Apagar Tudo */}
            <button
              type="button"
              onClick={() => {
                setIsClearOpen(true);
                setClearPassword('');
                setClearError(null);
              }}
              className="bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-100 hover:text-white font-extrabold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              id="clear-all-sales-btn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Apagar Tudo ⚠️</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-white/40 text-[11px] font-bold uppercase tracking-wider border-b border-white/10">
                <th className="py-4 px-5">Data / ID Mercado Livre</th>
                <th className="py-4 px-4">Produto</th>
                <th className="py-4 px-4 text-center">Quantidade</th>
                <th className="py-4 px-4 text-center">Preço de Compra</th>
                <th className="py-4 px-4 text-center">Total Bruto</th>
                <th className="py-4 px-4 text-center">Projeção de Lucro</th>
                <th className="py-4 px-4 text-center">Comissão + Frete</th>
                <th className="py-4 px-4 text-center">Lucro Líquido</th>
                <th className="py-4 px-4 text-center">Status</th>
                <th className="py-4 px-5 text-right font-medium">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/95 text-xs font-semibold">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-white/40 text-xs bg-white/5">
                    Nenhuma venda registrada no histórico científico do canal.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => {
                  const totalSaleValue = sale.salePrice * sale.quantity;
                  const totalFees = sale.mlFee + sale.shippingCost;
                  const isPending = sale.status === 'pending';

                  // Encontrar produto correspondente para analisar diferenciação de margem líq
                  const product = products.find(p => p.id === sale.productId);
                  let marginDifference = 0;
                  let hasMarginDiff = false;
                  if (product && sale.status !== 'refunded') {
                    const defaultMlFeeUnit = calculateMLFee(product.salePrice, product.mlFeeType, product.customFeePercent);
                    const defaultEstimatedNetProfitUnit = product.salePrice - product.purchasePrice - defaultMlFeeUnit - product.shippingCost;
                    const realNetProfitUnit = sale.netProfit / sale.quantity;
                    marginDifference = realNetProfitUnit - defaultEstimatedNetProfitUnit;
                    if (Math.abs(marginDifference) > 0.10) {
                      hasMarginDiff = true;
                    }
                  }

                  return (
                    <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                      {/* Data */}
                      <td className="py-4 px-5">
                        <div className="flex flex-col gap-1.5 justify-center">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-white/40" />
                            <span className="text-white font-bold">{formatDate(sale.date)}</span>
                          </div>
                          {sale.mlSaleId ? (
                            <span className="text-[10px] text-[#FFE600] font-mono bg-[#FFE600]/10 border border-[#FFE600]/20 px-2 py-0.5 rounded w-fit" title="ID da Venda no Mercado Livre">
                              ID: {sale.mlSaleId}
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/30 italic">
                              Sem ID ML
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Produto */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-white/90 font-bold">{sale.productName}</p>
                            
                            {/* Badges de Envio e Diferença de Margem em relação ao planejado */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {sale.shippingType === 'full' ? (
                                <span className="text-[9px] text-black font-extrabold bg-[#FFE600] px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
                                  ⚡ FULL
                                </span>
                              ) : (
                                <span className="text-[9px] text-white/50 font-semibold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
                                  🚚 Transportadora
                                </span>
                              )}
                              
                              {hasMarginDiff && (
                                marginDifference > 0 ? (
                                  <span className="text-[9px] text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded" title="Otimização de custos de logística (ex: múltiplos produtos com único frete) ou preço unitário de venda maior.">
                                    ▲ +{formatCurrency(marginDifference)}/un (Ganho Otimizado)
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-red-400 font-extrabold bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded" title="Redução devido a briga de catálogo no Full, descontos agressivos na venda ou tarifas de frete superiores ao planejado.">
                                    ▼ -{formatCurrency(Math.abs(marginDifference))}/un (Margem Reduzida)
                                  </span>
                                )
                              )}
                            </div>

                            {sale.status === 'refunded' && sale.lossReason && (
                              <p className="text-[10px] text-red-400 font-bold mt-1 bg-red-500/5 px-2 py-1 rounded border border-red-500/10 w-fit max-w-xs leading-snug" title={sale.lossReason}>
                                Motivo: {sale.lossReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Quantidade */}
                      <td className="py-4 px-4 text-center">
                        <span className="bg-white/5 border border-white/10 text-white font-mono font-bold px-2.5 py-1 rounded">
                          {sale.quantity}x
                        </span>
                      </td>

                      {/* Preço de Compra */}
                      <td className="py-4 px-4 text-center text-white/60 font-mono">
                        {formatCurrency(sale.purchasePrice > 0 ? sale.purchasePrice : (product?.purchasePrice || 0))}
                      </td>

                      {/* Total Bruto */}
                      <td className="py-4 px-4 text-center text-white font-bold">
                        {formatCurrency(totalSaleValue)}
                      </td>

                      {/* Projeção de Lucro */}
                      <td className="py-4 px-4 text-center">
                        {(() => {
                          const purchasePriceUnit = sale.purchasePrice > 0 ? sale.purchasePrice : (product?.purchasePrice || 0);
                          const mlFeeUnit = sale.mlFee / sale.quantity;
                          const shippingCostUnit = sale.shippingCost / sale.quantity;
                          const discountUnit = (sale.discount || 0) / sale.quantity;
                          const expectedNetProfitUnit = sale.salePrice - purchasePriceUnit - mlFeeUnit - shippingCostUnit - discountUnit;
                          const totalExpectedNetProfit = expectedNetProfitUnit * sale.quantity;
                          const expectedMarginPercent = purchasePriceUnit > 0 ? (expectedNetProfitUnit / purchasePriceUnit) * 100 : 0;

                          return (
                            <div className="flex flex-col items-center gap-1">
                              <span className={totalExpectedNetProfit >= 0 ? "text-emerald-400 font-black font-mono" : "text-red-400 font-black font-mono"}>
                                {totalExpectedNetProfit >= 0 ? '+' : ''}{formatCurrency(totalExpectedNetProfit)}
                              </span>
                              {expectedMarginPercent !== 0 && (
                                <span 
                                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                    expectedMarginPercent >= 0 
                                      ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" 
                                      : "text-red-400 bg-red-500/20 border-red-500/30"
                                  }`} 
                                  title="Margem projetada de ganho esperada sobre o preço de compra"
                                >
                                  {expectedMarginPercent.toFixed(0)}% Margem
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Comissão */}
                      <td className="py-4 px-4 text-center text-red-400 font-mono">
                        <span className="font-bold">-{formatCurrency(totalFees)}</span>
                        <div className="text-[10px] text-white/40 mt-1 space-y-0.5 font-sans font-medium">
                          <p>Taxa ML: {formatCurrency(sale.mlFee)}</p>
                          <p>Frete: {formatCurrency(sale.shippingCost)}</p>
                        </div>
                      </td>

                      {/* Lucro Liquido */}
                      <td className="py-4 px-4 text-center">
                        {sale.status === 'refunded' ? (
                          <div className="space-y-1">
                            <span className="text-red-500 italic font-bold block">
                              {formatCurrency(0)}
                            </span>
                            {sale.lossAmount !== undefined && sale.lossAmount > 0 && (
                              <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded block w-fit mx-auto" title="Prejuízo adicional lançado no estorno">
                                Prejuízo: -{formatCurrency(sale.lossAmount)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className={`text-emerald-400 font-black block ${isPending ? 'text-white/30 italic line-through' : ''}`}>
                            {formatCurrency(sale.netProfit)}
                          </span>
                        )}
                        
                        {sale.status === 'completed' || sale.status === 'pending' ? (
                          <span className="text-[10px] text-[#FFE600] font-bold bg-[#FFE600]/10 border border-[#FFE600]/20 px-1.5 py-0.5 rounded block w-fit mx-auto mt-0.5">
                            +{((sale.netProfit / (sale.purchasePrice * sale.quantity || 1)) * 100).toFixed(0)}% Margem
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded block w-fit mx-auto mt-0.5">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {sale.status === 'pending' ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <span className="bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded border border-amber-500/20 text-[9px] uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></span>
                              Venda Recém-Efetuada
                            </span>
                            <span className="text-[10px] text-white/50 font-mono font-bold bg-white/5 px-1.5 py-0.5 rounded" title="Mercado Livre retém o valor por 30 dias de segurança">
                              Libera em {(() => {
                                const d = new Date(sale.date + 'T12:00:00');
                                d.setDate(d.getDate() + 30);
                                return d.toLocaleDateString('pt-BR');
                              })()} ({getDaysRemainingForRelease(sale.date, sale.status)} dias restando)
                            </span>
                          </div>
                        ) : sale.status === 'refunded' ? (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="bg-red-500/15 text-red-500 font-black px-2.5 py-1 rounded border border-red-500/25 text-[9px] uppercase tracking-wider">
                              Estornada / Cancelada ✖
                            </span>
                            <span className="text-[9px] text-red-500/60 font-semibold font-sans">
                              Estoque devolvido e valores zerados
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <span className="bg-[#FFE600]/15 text-[#FFE600] font-black px-2.5 py-1 rounded border border-[#FFE600]/25 text-[9px] uppercase tracking-wider">
                              Concluída / Liberada ✅
                            </span>
                            <span className="text-[9px] text-[#FFE600]/60 font-semibold font-sans">
                              Dinheiro incorporado ao Caixa
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Deletar / Estornar com Confirmação Inline */}
                      <td className="py-4 px-5 text-right font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {/* Botão de Editar Venda */}
                          {onEditSale && (
                            <button
                              onClick={() => handleOpenEditModal(sale)}
                              className="bg-[#FFE600]/10 hover:bg-[#FFE600]/20 border border-[#FFE600]/20 text-[#FFE600] p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title="Editar Dados da Venda ✏️"
                              id={`edit-sale-btn-${sale.id}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isPending && onCompleteSale && (
                            <button
                              onClick={() => onCompleteSale(sale.id)}
                              className="bg-emerald-550/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title="Concluir Venda Manualmente 🚀"
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          
                          {sale.status !== 'refunded' && (
                            <button
                              onClick={() => {
                                setSaleToCancel(sale);
                                setLossAmountInput('0');
                                setIsCancelModalOpen(true);
                              }}
                              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                              title="Estornar Venda"
                              id={`cancel-sale-btn-${sale.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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

      {/* Modal de Confirmação de Estorno com Pergunta de Prejuízo */}
      {isCancelModalOpen && saleToCancel && (
        <div className="fixed inset-0 bg-[#000000]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-red-500/20 max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150">
            <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>Estornar / Cancelar Venda</span>
            </h3>
            <p className="text-xs text-white/70 mb-4 leading-relaxed">
              Você está prestes a estornar a venda de <strong>{saleToCancel.quantity}x {saleToCancel.productName}</strong> realizada em {saleToCancel.date.split('-').reverse().join('/')}.
              O estoque será devolvido automaticamente para a base.
            </p>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-4 mb-5">
              <div>
                <label className="text-xs font-bold text-white/80 block leading-relaxed mb-1.5">
                  Houve prejuízo financeiro extra com este estorno?
                  <span className="text-[10px] text-white/40 block font-normal mt-0.5">
                    Informe caso haja custos extras não reembolsados, embalagem perdida ou danos físicos ao produto.
                  </span>
                </label>
                
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-bold text-white/40">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={lossAmountInput}
                    onChange={(e) => setLossAmountInput(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 block leading-relaxed mb-1.5">
                  Descreva o que aconteceu (motivo do prejuízo):
                  <span className="text-[10px] text-white/40 block font-normal mt-0.5">
                    Deixe uma frase explicativa curta para registrar no histórico e no card de prejuízos.
                  </span>
                </label>
                <input
                  type="text"
                  value={lossReasonInput}
                  onChange={(e) => setLossReasonInput(e.target.value)}
                  placeholder="Ex: Cliente devolveu produto quebrado / Danificou caixa"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-red-500/30 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setSaleToCancel(null);
                  setLossReasonInput('');
                }}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  const loss = Number(lossAmountInput) || 0;
                  onCancelSale(saleToCancel.id, loss, lossReasonInput);
                  setIsCancelModalOpen(false);
                  setSaleToCancel(null);
                  setLossReasonInput('');
                }}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              >
                Confirmar Estorno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Venda */}
      {isEditModalOpen && editingSale && (
        <div className="fixed inset-0 bg-[#000000]/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-white/10 max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#FFE600] flex items-center gap-2">
                  <Edit3 className="w-5 h-5 animate-pulse" />
                  <span>Editar Registro de Venda</span>
                </h3>
                <p className="text-[11px] text-white/50 mt-1">
                  Corrija valores, quantidades, custos e status da transação.
                </p>
                <div className="mt-2 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 text-[10px] text-white/70 font-mono inline-block">
                  Item: <span className="text-[#FFE600] font-bold">{editingSale.productName}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingSale(null);
                }}
                className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Preço de Venda Unitário */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Venda Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice || ''}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                  />
                </div>

                {/* Quantidade Vendida */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Quantidade Vendida</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={editQuantity || ''}
                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                  />
                </div>

                {/* Desconto */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Desconto Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editDiscount || ''}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                  />
                </div>

                {/* Canal de Envio */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Canal de Envio / Logística</label>
                  <select
                    value={editShippingType}
                    onChange={(e) => setEditShippingType(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-[#FFE600] font-black focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                  >
                    <option value="transportadora" className="bg-[#121212] text-white">🚚 Transportadora / Catálogo</option>
                    <option value="full" className="bg-[#121212] text-white">⚡ Mercado Livre Full</option>
                  </select>
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">

                {/* Ajustar Comissão ML Unitária */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white/70 block">
                      Comissão ML Unitária R$
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-white/50 select-none">
                      <input
                        type="checkbox"
                        checked={isEditCustomMlFee}
                        onChange={(e) => setIsEditCustomMlFee(e.target.checked)}
                        className="rounded border-white/10 bg-white/5 text-[#FFE600] focus:ring-0 focus:ring-offset-0 w-3 h-3 cursor-pointer"
                      />
                      <span className="font-bold text-[#FFE600]">Ajustar taxa</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    disabled={!isEditCustomMlFee}
                    value={editMlFeeUnit || ''}
                    onChange={(e) => setEditMlFeeUnit(Number(e.target.value))}
                    className={`w-full border border-white/10 rounded-xl p-3 text-xs text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 ${!isEditCustomMlFee ? 'bg-black/20 opacity-50' : 'bg-black/40 text-[#FFE600]'}`}
                  />
                </div>

                {/* Custo do Frete Total */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Custo do Frete Total (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editShippingCost || ''}
                    onChange={(e) => setEditShippingCost(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                  />
                </div>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-4">

                {/* ID da Venda Mercado Livre */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#FFE600] block mb-1 flex items-center gap-1">
                    <span>ID da Venda Mercado Livre</span>
                    <span className="text-[10px] text-white/40 font-normal">(Opcional)</span>
                  </label>
                  <input
                    type="text"
                    value={editMlSaleId}
                    onChange={(e) => setEditMlSaleId(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                    placeholder="Ex: 20000035612"
                  />
                </div>

                {/* Data da Venda */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Data da Venda</label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                  />
                </div>

                {/* Status da Venda */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Status da Venda</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 cursor-pointer"
                  >
                    <option value="pending" className="bg-[#121212] text-white">⏳ Pendente / Retido</option>
                    <option value="completed" className="bg-[#121212] text-white">✅ Concluída / Liberada</option>
                    <option value="refunded" className="bg-[#121212] text-white">✖ Estornada / Cancelada</option>
                  </select>
                </div>

              </div>

              {/* Se Estornada / Cancelada, mostrar campos de Prejuízo */}
              {editStatus === 'refunded' && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                  <p className="text-[11px] font-bold text-red-400">Dados do Estorno:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-white/60 block mb-1">Prejuízo Financeiro Extra R$</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editLossAmount || ''}
                        onChange={(e) => setEditLossAmount(Number(e.target.value))}
                        placeholder="0,00"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/60 block mb-1">Motivo do Prejuízo</label>
                      <input
                        type="text"
                        value={editLossReason}
                        onChange={(e) => setEditLossReason(e.target.value)}
                        placeholder="Ex: Embalagem violada"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-red-500/30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Painel ao vivo de Simulação de Resultados da Edição */}
              <div className="bg-[#ffe600]/5 border border-[#ffe600]/10 rounded-xl p-4 mt-2">
                <p className="text-[10px] text-[#FFE600] font-black uppercase tracking-wider mb-2.5">
                  Simulação de Resultado Após Atualização
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                    <p className="text-[9px] text-white/50 uppercase font-bold">Total Venda</p>
                    <p className="text-[13px] font-mono font-black text-white mt-0.5">
                      {formatCurrency(editPrice * editQuantity)}
                    </p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                    <p className="text-[9px] text-white/50 uppercase font-bold">Encargos ML</p>
                    <p className="text-[13px] font-mono font-bold text-red-400 mt-0.5">
                      {formatCurrency(editMlFeeUnit * editQuantity + editShippingCost)}
                    </p>
                  </div>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                    <p className="text-[9px] text-emerald-400 uppercase font-black">Lucro Líq. Est.</p>
                    <p className="text-[13px] font-mono font-black text-emerald-400 mt-0.5">
                      {formatCurrency(
                        editStatus === 'refunded' 
                          ? 0 
                          : ((editPrice - editingSale.purchasePrice - editMlFeeUnit) * editQuantity - editShippingCost - editDiscount)
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingSale(null);
                  }}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-[#FFE600] text-black text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(255,230,0,0.2)] hover:bg-[#FFE600]/85"
                >
                  Salvar Alterações 💾
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
