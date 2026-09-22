/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Product, Sale, getAllProductSkus } from '../types';
import { calculateMLFee, calculateTax, calculateDaysInStock, formatCurrency, calculateCurrentStock, calculateProductSalesVolume, getProductSalesActivity, isValidProductTitle } from '../utils';
import { Edit, Trash2, Plus, Search, Tag, Settings, Activity, Clock, SlidersHorizontal, Eye, RefreshCw, Layers, X, Hash, Package, Check, ArrowLeft, CheckCircle2, Unlink, FileSpreadsheet, Ban } from 'lucide-react';
import ManualStockAdjustPanel from './ManualStockAdjustPanel';
import QuickStockModal from './QuickStockModal';

interface StockControlProps {
  products: Product[];
  sales: Sale[];
  bannedProducts?: string[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onBanProduct?: (productName: string) => void;
  onUnbanProduct?: (productName: string) => void;
  onClearDatabase: () => void;
  onUnlinkAllProducts?: () => void;
}

export default function StockControl({
  products,
  sales,
  bannedProducts = [],
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onBanProduct,
  onUnbanProduct,
  onClearDatabase,
  onUnlinkAllProducts
}: StockControlProps) {
  // Modo de visualização: Catálogo ou Indicação Manual de Estoque
  const [tabMode, setTabMode] = useState<'catalog' | 'manual_stock'>('catalog');

  // Estado para modal de produtos banidos
  const [isBannedModalOpen, setIsBannedModalOpen] = useState(false);

  // Estados para vinculação rápida de ID de anúncio em linha
  const [linkingProductId, setLinkingProductId] = useState<string | null>(null);
  const [linkingInput, setLinkingInput] = useState('');

  // Estado para modal de indicação rápida de estoque individual
  const [quickStockProduct, setQuickStockProduct] = useState<Product | null>(null);

  // Estados para pesquisa e filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'low' | 'idle'>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Controle de Modal / Formulário de Adicionar Produto
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [banningProductId, setBanningProductId] = useState<string | null>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);

  // Importar Produtos em Lote via Planilha (XLSX / CSV)
  const handleImportProductSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!rows || rows.length < 2) {
        alert('A planilha importada parece estar vazia.');
        return;
      }

      const headers = rows[0].map(h => String(h || '').trim());
      
      let idxName = headers.findIndex(h => /nome|produto|título|titulo|descriç/i.test(h));
      let idxSku = headers.findIndex(h => /^sku$/i.test(h) || /código|codigo|id/i.test(h));
      let idxPurchase = headers.findIndex(h => /compra|cmv|custo/i.test(h));
      let idxSale = headers.findIndex(h => /venda|preço|preco/i.test(h));
      let idxStock = headers.findIndex(h => /estoque|quantidade|unidade/i.test(h));
      let idxCategory = headers.findIndex(h => /categoria/i.test(h));

      if (idxName === -1) idxName = 0;
      if (idxSku === -1) idxSku = 1;
      if (idxPurchase === -1) idxPurchase = 2;
      if (idxSale === -1) idxSale = 3;
      if (idxStock === -1) idxStock = 4;

      let addedCount = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const nameVal = String(row[idxName] || '').trim();
        if (!nameVal || nameVal.toLowerCase().includes('total') || !isValidProductTitle(nameVal)) continue;

        const skuVal = String(row[idxSku] || '').trim() || `SKU_${Date.now()}_${i}`;
        const purchaseVal = Number(String(row[idxPurchase]).replace('R$', '').replace(',', '.')) || 0;
        const saleVal = Number(String(row[idxSale]).replace('R$', '').replace(',', '.')) || 0;
        const stockVal = Number(row[idxStock]) || 0;
        const catVal = idxCategory !== -1 && row[idxCategory] ? String(row[idxCategory]).trim() : 'Geral';

        onAddProduct({
          name: nameVal,
          sku: skuVal,
          purchasePrice: purchaseVal,
          salePrice: saleVal,
          stock: stockVal,
          minimalStock: 5,
          category: catVal,
          mlFeeType: 'classic',
          shippingCost: 0,
          addedDate: new Date().toISOString().split('T')[0]
        });
        addedCount++;
      }

      alert(`Sucesso! ${addedCount} produtos cadastrados no controle de estoque com sucesso.`);
    } catch (err: any) {
      alert(`Erro ao ler planilha: ${err?.message || 'Arquivo inválido'}`);
    } finally {
      e.target.value = '';
    }
  };

  // Estados para Modal de Reposição de Estoque
  const [isReplenishOpen, setIsReplenishOpen] = useState(false);
  const [isUnlinkAllOpen, setIsUnlinkAllOpen] = useState(false);
  const [replenishProduct, setReplenishProduct] = useState<Product | null>(null);
  const [replenishQuantity, setReplenishQuantity] = useState<number>(0);
  const [replenishPrice, setReplenishPrice] = useState<number>(0);
  const [replenishDate, setReplenishDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Estados para o Modal de Excluir Tudo por Senha
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearError, setClearError] = useState<string | null>(null);

  // Campos do formulário
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [additionalSkus, setAdditionalSkus] = useState<string[]>([]);
  const [newSkuInput, setNewSkuInput] = useState('');
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

  // Helper para adicionar SKUs extras
  const handleAddSkuChip = (skuValue: string) => {
    if (!skuValue) return;
    const parts = skuValue.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
    setAdditionalSkus(prev => {
      const updated = [...prev];
      parts.forEach(p => {
        if (!updated.includes(p) && p.toLowerCase() !== sku.trim().toLowerCase()) {
          updated.push(p);
        }
      });
      return updated;
    });
    setNewSkuInput('');
  };

  const handleRemoveSkuChip = (indexToRemove: number) => {
    setAdditionalSkus(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Helper para vincular novo ID de anúncio diretamente na linha do produto
  const handleConfirmLink = (product: Product) => {
    if (!linkingInput.trim()) return;
    const parts = linkingInput.split(/[,;\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
    const existingSkus = product.skus || [];
    const newSkus = [...existingSkus];
    parts.forEach(p => {
      if (!newSkus.includes(p) && p !== (product.sku || '').toUpperCase()) {
        newSkus.push(p);
      }
    });
    onEditProduct({
      ...product,
      skus: newSkus
    });
    setLinkingProductId(null);
    setLinkingInput('');
  };

  // Helper para desvincular ID de anúncio
  const handleUnlinkSku = (product: Product, skuToRemove: string) => {
    const updatedSkus = (product.skus || []).filter(s => s.toLowerCase() !== skuToRemove.toLowerCase());
    onEditProduct({
      ...product,
      skus: updatedSkus
    });
  };

  // Helper para desmembrar todos os IDs vinculados de um produto específico
  const handleUnlinkAllForProduct = (product: Product) => {
    onEditProduct({
      ...product,
      skus: []
    });
  };

  // Salvar lote de ajustes manuais de estoque
  const handleSaveBatchStock = (updates: Array<{ id: string; stock: number; purchasePrice: number; salePrice: number; minimalStock: number }>) => {
    updates.forEach(u => {
      const prod = products.find(p => p.id === u.id);
      if (prod) {
        onEditProduct({
          ...prod,
          stock: u.stock,
          purchasePrice: u.purchasePrice,
          salePrice: u.salePrice,
          minimalStock: u.minimalStock
        });
      }
    });
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (!p || !p.name || !isValidProductTitle(p.name)) return false;
    const allProdSkus = getAllProductSkus(p).map(s => s.toLowerCase());
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      p.name.toLowerCase().includes(searchLower) || 
      allProdSkus.some(s => s.includes(searchLower)) ||
      p.category.toLowerCase().includes(searchLower);
      
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    const currentStock = calculateCurrentStock(p, sales, products);
    
    // Regra dos 30 dias de vendas
    const activity = getProductSalesActivity(p, sales, products);
    const matchesActiveStatus = activeStatusFilter === 'all' || 
      (activeStatusFilter === 'active' ? !activity.isArchived : activity.isArchived);

    let matchesStatus = true;
    if (stockStatusFilter === 'low') {
      matchesStatus = currentStock <= p.minimalStock;
    } else if (stockStatusFilter === 'idle') {
      matchesStatus = activity.isArchived || activity.daysWithoutSale >= 30;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesActiveStatus;
  });

  const handleOpenAdd = () => {
    setName('');
    setSku('');
    setAdditionalSkus([]);
    setNewSkuInput('');
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
    setAdditionalSkus(p.skus || []);
    setNewSkuInput('');
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
    
    // Processar se tiver algo ainda digitado no input de novo SKU
    let finalSkus = [...additionalSkus];
    if (newSkuInput.trim()) {
      const parts = newSkuInput.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!finalSkus.includes(p) && p.toLowerCase() !== sku.trim().toLowerCase()) {
          finalSkus.push(p);
        }
      });
    }

    onAddProduct({
      name,
      sku,
      skus: finalSkus.length > 0 ? finalSkus : undefined,
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

    let finalSkus = [...additionalSkus];
    if (newSkuInput.trim()) {
      const parts = newSkuInput.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        if (!finalSkus.includes(p) && p.toLowerCase() !== sku.trim().toLowerCase()) {
          finalSkus.push(p);
        }
      });
    }

    onEditProduct({
      id: editingProduct.id,
      name,
      sku,
      skus: finalSkus.length > 0 ? finalSkus : undefined,
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

  // Métricas do Topo
  const activeProducts = products.filter(p => !getProductSalesActivity(p, sales, products).isArchived);
  const archivedProducts = products.filter(p => getProductSalesActivity(p, sales, products).isArchived);
  
  let totalStockUnits = 0;
  let totalStockCostValue = 0;
  let totalUnitsSold30d = 0;

  products.forEach(p => {
    const curStock = calculateCurrentStock(p, sales, products);
    totalStockUnits += curStock;
    totalStockCostValue += (curStock * p.purchasePrice);
    const act = getProductSalesActivity(p, sales, products);
    totalUnitsSold30d += act.unitsSold30d;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Banner de Filosofia e Navegação de Modos */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2.5 py-0.5 rounded-full uppercase">
                Estoque Baseado em Vendas 📦
              </span>
              <span className="text-xs text-white/50 font-bold">Leitura Inteligente por Anúncio e # de ID</span>
            </div>
            <h2 className="text-xl font-light text-white">Controle de Estoque & Catálogo Dinâmico</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Não é necessário cadastrar produtos previamente. O sistema lê e cria produtos automaticamente a partir do <strong>Título do Anúncio</strong> e <strong># de Anúncio (MLB)</strong> da sua planilha de vendas Mercado Livre. Você pode vincular múltiplos IDs (# MLB) para somar as vendas e indicar manualmente a quantidade em estoque físico quando desejar. Produtos sem giro há mais de 30 dias são arquivados automaticamente.
            </p>
          </div>

          {/* Seletor de Modo Principal */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <div className="inline-flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full sm:w-auto">
              <button
                onClick={() => setTabMode('catalog')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  tabMode === 'catalog'
                    ? 'bg-[#FFE600] text-black shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <span>📋 Catálogo & Análise</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  tabMode === 'catalog' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'
                }`}>
                  {products.length}
                </span>
              </button>

              <button
                onClick={() => setTabMode('manual_stock')}
                className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  tabMode === 'manual_stock'
                    ? 'bg-[#FFE600] text-black shadow-md'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>📦 Indicar / Ajustar Estoque</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Cards de Métricas Rápidas de Estoque */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/5">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Com Giro (&lt;30d)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-emerald-400 font-mono">{activeProducts.length}</span>
              <span className="text-[10px] text-white/40">produtos ativos</span>
            </div>
            <span className="text-[9.5px] text-emerald-400/80 block mt-0.5 font-medium">
              +{totalUnitsSold30d} un. vendidas em 30d
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Arquivados (+30d)</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-amber-400 font-mono">{archivedProducts.length}</span>
              <span className="text-[10px] text-white/40">sem giro recente</span>
            </div>
            <span className="text-[9.5px] text-amber-400/80 block mt-0.5 font-medium">
              Arquivados por inatividade
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Estoque Físico Total</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-white font-mono">{totalStockUnits}</span>
              <span className="text-[10px] text-white/40">unidades disponíveis</span>
            </div>
            <span className="text-[9.5px] text-white/40 block mt-0.5 font-medium">
              Prateleira física atual
            </span>
          </div>

          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-white/40 block font-bold uppercase tracking-wider">Patrimônio em Estoque</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-[#FFE600] font-mono">{formatCurrency(totalStockCostValue)}</span>
            </div>
            <span className="text-[9.5px] text-[#FFE600]/70 block mt-0.5 font-medium">
              A preço de custo (CMV)
            </span>
          </div>
        </div>
      </div>

      {/* Condicional de Renderização: Modo de Ajuste Manual ou Modo de Catálogo */}
      {tabMode === 'manual_stock' ? (
        <ManualStockAdjustPanel
          products={products}
          sales={sales}
          onSaveBatchStock={handleSaveBatchStock}
          onBackToCatalog={() => setTabMode('catalog')}
        />
      ) : (
        <>
          {/* Barra de Filtro e Pesquisa */}
          <div className="bg-[#141414] p-5 rounded-2xl border border-white/5 shadow-md flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full md:w-auto relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-white/40 w-4.5 h-4.5" />
              <input
                type="text"
                placeholder="Buscar por nome do anúncio, código MLB, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 text-white font-medium"
              />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Filtro de Atividade 30 dias */}
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-xs font-semibold text-white/75">
                <Clock className="w-3.5 h-3.5 text-[#FFE600]" />
                <select
                  value={activeStatusFilter}
                  onChange={(e) => setActiveStatusFilter(e.target.value as any)}
                  className="bg-transparent focus:outline-none text-white font-bold cursor-pointer"
                >
                  <option value="active" className="bg-[#121212] text-white">Com Vendas (&lt;30d)</option>
                  <option value="archived" className="bg-[#121212] text-white">Arquivados (+30d sem giro)</option>
                  <option value="all" className="bg-[#121212] text-white">Todos os Produtos</option>
                </select>
              </div>

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

              {/* Botão rápido para ir ao modo de indicação de estoque */}
              <button
                onClick={() => setTabMode('manual_stock')}
                className="bg-[#FFE600]/15 hover:bg-[#FFE600]/25 text-[#FFE600] border border-[#FFE600]/30 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Package className="w-3.5 h-3.5" />
                <span>Indicar Estoque</span>
              </button>

              {/* Adicionar Produto Manual */}
              <button
                onClick={handleOpenAdd}
                className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                id="add-product-btn"
                title="Cadastrar produto manualmente se desejar"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Produto</span>
              </button>

              {/* Importar Planilha de Produtos */}
              <input
                type="file"
                ref={productFileInputRef}
                onChange={handleImportProductSpreadsheet}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => productFileInputRef.current?.click()}
                className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Importar lista de produtos a partir de uma planilha Excel / CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar Planilha 📥</span>
              </button>

              {/* Produtos Banidos */}
              {bannedProducts && bannedProducts.length > 0 && (
                <button
                  onClick={() => setIsBannedModalOpen(true)}
                  className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  title="Ver produtos banidos permanentemente do estoque"
                >
                  <Ban className="w-3.5 h-3.5 text-red-400" />
                  <span>Banidos ({bannedProducts.length})</span>
                </button>
              )}

              {/* Desmembrar Todos os IDs */}
              <button
                onClick={() => setIsUnlinkAllOpen(true)}
                className="bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 hover:text-amber-100 font-bold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                title="Desmembrar todas as vinculações de múltiplos IDs de anúncio de todos os produtos"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Desmembrar IDs</span>
              </button>

              {/* Apagar Tudo */}
              <button
                onClick={() => {
                  setIsClearOpen(true);
                  setClearPassword('');
                  setClearError(null);
                }}
                className="bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-100 hover:text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                id="clear-all-stock-btn"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Apagar ⚠️</span>
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
                <th className="py-4 px-4 text-center">Imposto (4%)</th>
                <th className="py-4 px-4 text-center">Frete</th>
                <th className="py-4 px-4 text-center text-[#FFE600] font-black">Estoque (Inicial / Saídas / Atual)</th>
                <th className="py-4 px-4 text-center">Dias sem Giro</th>
                <th className="py-4 px-5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white/95 text-xs font-semibold">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-white/40 text-xs bg-white/5">
                    Nenhum produto cadastrado com os filtros ativos.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const activity = getProductSalesActivity(p, sales, products);
                  const days = activity.daysWithoutSale;
                  const totalSoldForProd = calculateProductSalesVolume(p, sales, products);
                  const currentStock = calculateCurrentStock(p, sales, products);
                  const isCritical = currentStock <= p.minimalStock;
                  
                  // Lucro Esperado (comissão padrão + imposto de 4% estimativa)
                  const mlFee = calculateMLFee(p.salePrice, p.mlFeeType, p.customFeePercent);
                  const taxAmount = calculateTax(p.salePrice);
                  const difference = p.salePrice - p.purchasePrice;
                  const estimatedNetProfit = p.salePrice - p.purchasePrice - mlFee - p.shippingCost - taxAmount;
                  const netMargin = p.purchasePrice > 0 ? (estimatedNetProfit / p.purchasePrice) * 100 : 0;

                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      {/* Name, Linked IDs and Sales Activity */}
                      <td className="py-4 px-5">
                        <div className="max-w-md">
                          <p className="text-white font-bold text-xs sm:text-sm leading-snug break-words whitespace-normal">{p.name}</p>
                          
                          {/* Tags: Status dos 30 dias, SKU e IDs Vinculados */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {activity.isArchived ? (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1" title="Sem vendas nos últimos 30 dias">
                                <Clock className="w-3 h-3" /> Arquivado (+30d sem giro)
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold inline-flex items-center gap-1" title="Produto ativo com vendas nos últimos 30 dias">
                                🟢 Ativo • {activity.unitsSold30d} un. em 30d
                              </span>
                            )}

                            {p.sku && (
                              <span className="text-[10px] bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/30 px-2 py-0.5 rounded font-mono font-bold" title="SKU Principal / Código Master">
                                SKU: {p.sku}
                              </span>
                            )}

                            {/* IDs de anúncios vinculados (MLB...) com opção de desvincular */}
                            {p.skus && p.skus.length > 0 && p.skus.map((altSku, sIdx) => (
                              <span key={sIdx} className="text-[9.5px] bg-sky-500/15 text-sky-300 border border-sky-500/30 pl-2 pr-1 py-0.5 rounded font-mono flex items-center gap-1" title="ID de Anúncio Vinculado">
                                #{altSku}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnlinkSku(p, altSku);
                                  }}
                                  className="text-sky-300/60 hover:text-red-400 font-bold ml-0.5 text-[11px] leading-none cursor-pointer"
                                  title="Desvincular este ID do produto"
                                >
                                  ×
                                </button>
                              </span>
                            ))}

                            {p.skus && p.skus.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnlinkAllForProduct(p);
                                }}
                                className="text-[9.5px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300/80 hover:text-amber-200 border border-amber-500/20 px-1.5 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
                                title="Desmembrar todos os IDs vinculados deste produto"
                              >
                                <Unlink className="w-2.5 h-2.5" />
                                <span>Desmembrar</span>
                              </button>
                            )}

                            <span className="text-[10px] bg-white/5 text-white/40 border border-white/5 px-1.5 py-0.5 rounded">
                              {p.category}
                            </span>
                          </div>

                          {/* Inline Vincular Novo ID (# MLB) */}
                          <div className="mt-2">
                            {linkingProductId === p.id ? (
                              <div className="inline-flex items-center gap-1.5 bg-black/60 border border-sky-400/50 p-1 rounded-lg">
                                <input
                                  type="text"
                                  placeholder="Cole ID # MLB..."
                                  value={linkingInput}
                                  onChange={(e) => setLinkingInput(e.target.value)}
                                  className="bg-transparent text-white text-[10px] font-mono px-2 py-0.5 w-32 focus:outline-none"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleConfirmLink(p);
                                    if (e.key === 'Escape') {
                                      setLinkingProductId(null);
                                      setLinkingInput('');
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleConfirmLink(p)}
                                  className="bg-sky-500 hover:bg-sky-400 text-black text-[10px] font-extrabold px-2 py-0.5 rounded cursor-pointer"
                                >
                                  Vincular
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkingProductId(null);
                                    setLinkingInput('');
                                  }}
                                  className="text-white/40 hover:text-white text-xs px-1 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setLinkingProductId(p.id);
                                  setLinkingInput('');
                                }}
                                className="text-[9.5px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                                title="Vincular outro ID de anúncio Mercado Livre (# MLB) a este produto para somar vendas"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Vincular ID (# MLB)</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Compra */}
                      <td className="py-4 px-4 text-center text-white/80">
                        {formatCurrency(p.purchasePrice)}
                        {p.replenishments && p.replenishments.length > 0 && (
                          <div className="mt-1 flex flex-col items-center gap-0.5" title="Última reposição">
                            {p.replenishments.slice(-1).map(r => (
                              <span key={r.id} className="text-[9px] text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                                {r.quantity} un. em {r.date.substring(8,10)}/{r.date.substring(5,7)}
                              </span>
                            ))}
                          </div>
                        )}
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

                      {/* Imposto (4%) */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-blue-400 font-semibold">{formatCurrency(taxAmount)}</span>
                        <span className="text-[9px] block text-white/40 font-medium">4% sobre Venda</span>
                      </td>

                      {/* Frete */}
                      <td className="py-4 px-4 text-center text-white/50">
                        {p.shippingCost > 0 ? formatCurrency(p.shippingCost) : 'Grátis'}
                      </td>

                      {/* Estoque Interativo */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQuickStockProduct(p)}
                            title="Clique para indicar ou alterar o estoque físico deste produto"
                            className={`px-2.5 py-1 rounded text-xs font-bold font-mono inline-flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-all shadow-sm ${
                              currentStock === 0 
                                ? 'bg-red-500 text-white' 
                                : isCritical 
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>{currentStock} un.</span>
                            <span className="text-[9px] bg-white/10 px-1 rounded">✏️</span>
                          </button>
                          <div className="text-[9.5px] text-white/50 font-medium leading-tight flex flex-col items-center">
                            <span>Físico declar.: <strong className="text-white/80 font-mono">{p.stock}</strong> un.</span>
                            {totalSoldForProd > 0 ? (
                              <span className="text-amber-400 font-bold">
                                Saídas registradas: -{totalSoldForProd} un.
                              </span>
                            ) : (
                              <span className="text-white/40">Saídas: 0 un.</span>
                            )}
                          </div>
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
                        <div className="flex items-center gap-1.5 justify-end">
                          {banningProductId === p.id ? (
                            <div className="flex items-center gap-1.5 justify-end bg-red-500/10 border border-red-500/30 p-1 rounded-xl">
                              <span className="text-[10px] text-red-300 font-bold hidden sm:inline pl-1">Banir produto?</span>
                              <button
                                onClick={() => {
                                  if (onBanProduct) onBanProduct(p.name);
                                  setBanningProductId(null);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] px-2.5 py-1 rounded-lg cursor-pointer animate-pulse flex items-center gap-1 shadow-md"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Sim, Banir</span>
                              </button>
                              <button
                                onClick={() => setBanningProductId(null)}
                                className="bg-white/10 hover:bg-white/20 text-white text-[10px] px-2 py-1 rounded-lg cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : deletingProductId === p.id ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => {
                                  onDeleteProduct(p.id);
                                  setDeletingProductId(null);
                                }}
                                className="bg-red-650 hover:bg-red-700 text-white font-extrabold text-[10px] px-2 py-1 rounded cursor-pointer animate-pulse"
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
                              {/* Botão rápido para Indicar / Ajustar Estoque Físico */}
                              <button
                                onClick={() => setQuickStockProduct(p)}
                                className="bg-[#FFE600]/10 hover:bg-[#FFE600]/20 border border-[#FFE600]/30 text-[#FFE600] p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Indicar / Ajustar Estoque Físico"
                              >
                                <Package className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => {
                                  onEditProduct({
                                    ...p,
                                    status: (p.status === 'archived') ? 'active' : 'archived'
                                  });
                                }}
                                className={`${p.status === 'archived' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'} border p-1.5 rounded-lg transition-colors cursor-pointer`}
                                title={p.status === 'archived' ? 'Desarquivar Produto' : 'Arquivar Produto'}
                              >
                                <Layers className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setReplenishProduct(p);
                                  setReplenishQuantity(0);
                                  setReplenishPrice(p.purchasePrice);
                                  setReplenishDate(new Date().toISOString().split('T')[0]);
                                  setIsReplenishOpen(true);
                                }}
                                className="bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Repor Estoque / Recompra"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-white hover:text-[#FFE600] p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Editar Ficha Técnica"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeletingProductId(p.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Deletar da lista local"
                                id={`delete-product-btn-${p.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setBanningProductId(p.id)}
                                className="bg-red-600/15 hover:bg-red-600/30 border border-red-500/30 text-red-300 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Banir da Lista (Ocultar permanentemente)"
                              >
                                <Ban className="w-4 h-4" />
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
      </>
      )}

      {/* Modal Rápido de Indicação / Ajuste de Estoque Físico */}
      {quickStockProduct && (
        <QuickStockModal
          product={quickStockProduct}
          sales={sales}
          products={products}
          onSave={(updated) => {
            onEditProduct(updated);
            setQuickStockProduct(null);
          }}
          onClose={() => setQuickStockProduct(null)}
        />
      )}

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
                  <label className="text-xs font-bold text-white/70 block mb-1">SKU Principal / Código Master *</label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Ex: ABC123"
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

                {/* Bloco de # de Anúncio e Variações de SKU (Multi-Anúncio / Multi-SKU) */}
                <div className="col-span-2 bg-[#1b1e23] p-3.5 rounded-xl border border-sky-500/25 shadow-inner">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-sky-400" />
                      Números de # de Anúncio / Variações de SKU
                    </label>
                    <span className="text-[10px] text-sky-400/80 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {additionalSkus.length} vinculado(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 mb-2.5 leading-relaxed">
                    Vincule múltiplos <span className="text-sky-300 font-mono font-bold"># de anúncio</span> (ex: <span className="text-sky-300 font-mono">MLB3782694854</span>, <span className="text-sky-300 font-mono">MLB3737455528</span>) e códigos de SKU. Qualquer venda do Mercado Livre com esses números dará baixa automaticamente neste produto.
                  </p>

                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newSkuInput}
                      onChange={(e) => setNewSkuInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkuChip(newSkuInput);
                        }
                      }}
                      placeholder="Digite # de Anúncio (ex: MLB3782694854) ou SKU e dê Enter"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSkuChip(newSkuInput)}
                      className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  {additionalSkus.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {additionalSkus.map((altSku, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-sky-950/70 border border-sky-500/40 text-sky-200 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md"
                        >
                          <span className="text-sky-400/80 font-bold">#</span>
                          {altSku}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkuChip(idx)}
                            className="hover:text-red-400 text-sky-400/80 p-0.5 rounded transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
                  <label className="text-xs font-bold text-white/70 block mb-1">SKU Principal / Código Master *</label>
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

                {/* Bloco de # de Anúncio e Variações de SKU (Multi-Anúncio / Multi-SKU) */}
                <div className="col-span-2 bg-[#1b1e23] p-3.5 rounded-xl border border-sky-500/25 shadow-inner">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-sky-400" />
                      Números de # de Anúncio / Variações de SKU
                    </label>
                    <span className="text-[10px] text-sky-400/80 font-mono bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                      {additionalSkus.length} vinculado(s)
                    </span>
                  </div>
                  <p className="text-[11px] text-white/60 mb-2.5 leading-relaxed">
                    Vincule múltiplos <span className="text-sky-300 font-mono font-bold"># de anúncio</span> (ex: <span className="text-sky-300 font-mono">MLB3782694854</span>, <span className="text-sky-300 font-mono">MLB3737455528</span>) e códigos de SKU. Qualquer venda do Mercado Livre com esses números dará baixa automaticamente neste produto.
                  </p>

                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newSkuInput}
                      onChange={(e) => setNewSkuInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkuChip(newSkuInput);
                        }
                      }}
                      placeholder="Digite # de Anúncio (ex: MLB3782694854) ou SKU e dê Enter"
                      className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSkuChip(newSkuInput)}
                      className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  {additionalSkus.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {additionalSkus.map((altSku, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-sky-950/70 border border-sky-500/40 text-sky-200 text-[11px] font-mono font-medium px-2.5 py-1 rounded-md"
                        >
                          <span className="text-sky-400/80 font-bold">#</span>
                          {altSku}
                          <button
                            type="button"
                            onClick={() => handleRemoveSkuChip(idx)}
                            className="hover:text-red-400 text-sky-400/80 p-0.5 rounded transition-colors ml-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
      {/* Modal de Reposição de Estoque */}
      {isReplenishOpen && replenishProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-2">Repor Estoque</h2>
            <p className="text-xs text-white/50 mb-6 font-medium">
              Produto: <strong className="text-white">{replenishProduct.name}</strong>
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (replenishQuantity <= 0) return;
              
              const newReplenishment = {
                id: `rep_${Date.now()}`,
                date: replenishDate,
                quantity: replenishQuantity,
                price: replenishPrice
              };

              onEditProduct({
                ...replenishProduct,
                
                purchasePrice: replenishPrice,
                replenishments: [...(replenishProduct.replenishments || []), newReplenishment]
              });
              setIsReplenishOpen(false);
              setReplenishProduct(null);
            }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Quantidade Adquirida</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={replenishQuantity || ''}
                  onChange={e => setReplenishQuantity(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Novo Custo Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={replenishPrice || ''}
                  onChange={e => setReplenishPrice(Number(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/70 mb-1.5 uppercase tracking-wider">Data da Compra</label>
                <input
                  type="date"
                  required
                  value={replenishDate}
                  onChange={e => setReplenishDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-medium"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReplenishOpen(false)}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-500 hover:bg-sky-400 text-white text-xs font-extrabold py-2.5 px-5 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(14,165,233,0.3)]"
                >
                  Registrar Reposição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Desmembramento Geral de IDs */}
      {isUnlinkAllOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#141414] rounded-2xl border border-amber-500/40 max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-amber-400 mb-2 flex items-center gap-2">
              <Unlink className="w-5 h-5" />
              <span>Desmembrar Todos os IDs</span>
            </h3>
            <p className="text-xs text-white/70 mb-4 leading-relaxed">
              Esta ação irá <strong>remover todas as vinculações de múltiplos IDs de anúncio</strong> de todos os produtos do estoque.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-5 text-[11px] text-amber-200/90 leading-relaxed">
              💡 <strong>Regra:</strong> Cada produto passará a operar estritamente de forma individual com seu próprio SKU master ("produto por produto"). Você poderá vincular manualmente qualquer ID que desejar a qualquer momento.
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsUnlinkAllOpen(false)}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUnlinkAllProducts) {
                    onUnlinkAllProducts();
                  } else {
                    products.forEach(p => {
                      if (p.skus && p.skus.length > 0) {
                        onEditProduct({ ...p, skus: [] });
                      }
                    });
                  }
                  setIsUnlinkAllOpen(false);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold py-2 px-4 rounded-xl cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center gap-1.5"
              >
                <Unlink className="w-4 h-4" />
                <span>Confirmar Desmembramento</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Modal de Produtos Banidos */}
      {isBannedModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 max-w-xl w-full shadow-2xl relative">
            <button
              onClick={() => setIsBannedModalOpen(false)}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                <Ban className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Produtos Banidos do Estoque</h3>
                <p className="text-xs text-white/60">Estes itens são filtrados permanentemente e ignorados do Controle de Estoque.</p>
              </div>
            </div>

            {(!bannedProducts || bannedProducts.length === 0) ? (
              <p className="text-center py-8 text-white/40 text-sm">Nenhum produto banido no momento.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1 my-4">
                {bannedProducts.map((bName, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-sm font-medium text-white/90 truncate max-w-[360px]">{bName}</span>
                    <button
                      onClick={() => {
                        if (onUnbanProduct) onUnbanProduct(bName);
                      }}
                      className="bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Desbanir</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsBannedModalOpen(false)}
                className="bg-white/10 hover:bg-white/15 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
