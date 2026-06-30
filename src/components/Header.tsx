/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TrendingUp, Package, ShoppingCart, Database, FileSpreadsheet, Share2, Cloud, CloudOff, RefreshCw, LogOut } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lowStockCount: number;
  isSheetsConnected: boolean;
  onOpenTutorial: () => void;
  isCloudSyncing?: boolean;
  isFetchingFromCloud?: boolean;
  cloudSyncError?: string | null;
  onLogout?: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  lowStockCount,
  isSheetsConnected,
  onOpenTutorial,
  isCloudSyncing = false,
  isFetchingFromCloud = false,
  cloudSyncError = null,
  onLogout
}: HeaderProps) {
  return (
    <header className="bg-[#0d0d0d] text-white shadow-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between py-5 gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-[#FFE600] text-black p-2.5 rounded-xl shadow-[0_0_15px_rgba(255,230,0,0.2)] flex items-center justify-center">
              <svg 
                className="w-8 h-8 text-black" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                {/* Custom Handshake / Mercado Libre logo shape representation in clean flat style */}
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15.5h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2 py-0.5 rounded-sm">ML PRO</span>
                <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Geral & Admin Dark
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-light tracking-tight text-white mt-0.5">
                Dashboard de Controle de Vendas
              </h1>
            </div>
          </div>

          {/* Integration Status & Real-time Auto-Sync Info */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto justify-end">
            {isFetchingFromCloud ? (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-extrabold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Buscando dados em Realtime...</span>
              </div>
            ) : isCloudSyncing ? (
              <div className="flex items-center gap-1.5 bg-[#FFE600]/10 border border-[#FFE600]/25 rounded-xl px-3.5 py-2 text-xs text-[#FFE600] font-extrabold animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Enviando alteração...</span>
              </div>
            ) : cloudSyncError ? (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-xl px-3.5 py-2 text-xs text-red-400 font-bold" title={cloudSyncError}>
                <CloudOff className="w-3.5 h-3.5" />
                <span>Falha na gravação na Conta</span>
              </div>
            ) : isSheetsConnected ? (
              <div className="flex items-center gap-1.5 bg-[#FFE600]/10 border border-[#FFE600]/20 rounded-xl px-3.5 py-2 text-xs text-[#FFE600] font-black tracking-wide">
                <Cloud className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Nuvem Ativa de Gravação</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white/55 font-bold">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Sincronização inativa</span>
              </div>
            )}
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center overflow-x-auto no-scrollbar border-t border-white/5 py-2.5 gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#FFE600] text-black shadow-[0_0_15px_rgba(255,230,0,0.2)]'
                : 'text-white/65 hover:text-white hover:bg-white/5'
            }`}
            id="tab-dashboard"
          >
            <TrendingUp className="w-4 h-4" />
            Visão Geral / Métricas
          </button>
          
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all relative whitespace-nowrap cursor-pointer ${
              activeTab === 'stock'
                ? 'bg-[#FFE600] text-black shadow-[0_0_15px_rgba(255,230,0,0.2)]'
                : 'text-white/65 hover:text-white hover:bg-white/5'
            }`}
            id="tab-stock"
          >
            <Package className="w-4 h-4" />
            Controle de Estoque
            {lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] w-4.5 h-4.5 flex items-center justify-center rounded-full font-bold border border-black animate-bounce">
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sales'
                ? 'bg-[#FFE600] text-black shadow-[0_0_15px_rgba(255,230,0,0.2)]'
                : 'text-white/65 hover:text-white hover:bg-white/5'
            }`}
            id="tab-sales"
          >
            <ShoppingCart className="w-4 h-4" />
            Registro & Histórico de Vendas
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-[#FFE600] text-black shadow-[0_0_15px_rgba(255,230,0,0.2)]'
                : 'text-white/65 hover:text-white hover:bg-white/5'
            }`}
            id="tab-sheets"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Sincronizar Google Sheets
            {isSheetsConnected && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
              id="btn-logout"
              title="Sair / Bloquear Painel"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bloquear Painel 🔒</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
