/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Sale } from '../types';
import { formatCurrency } from '../utils';
import { 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Download, 
  Info, 
  HelpCircle, 
  ArrowRight, 
  Award, 
  ExternalLink,
  RefreshCw,
  Layers,
  ShieldCheck,
  Zap,
  Globe
} from 'lucide-react';

interface SheetsIntegrationProps {
  products: Product[];
  sales: Sale[];
  spreadsheetUrl: string;
  onUpdateSpreadsheetUrl: (url: string) => void;
  webAppUrl: string;
  onUpdateWebAppUrl: (url: string) => void;
  onPullFromCloud: () => Promise<{ status: 'success' | 'error'; message: string }>;
  initialCapital: number;
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Sincronizar Produtos
    var productSheet = ss.getSheetByName("Produtos") || ss.insertSheet("Produtos");
    productSheet.clear();
    var prodHeaders = [
      "ID Produto", "Nome Produto", "SKU", "Preço de Compra", "Preço de Venda", 
      "Estoque", "Estoque Mínimo", "Data de Entrada", "Categoria", "Tipo Anuncio ML", 
      "Comissão Customizada %", "Frete Padrão", "Diferença", "Taxa ML", "Dias Parados"
    ];
    productSheet.appendRow(prodHeaders);
    
    if (payload.products && payload.products.length > 0) {
      var prodRows = payload.products.map(function(p) {
        var diff = p.salePrice - p.purchasePrice;
        
        // Calcular Taxa ML aproximada para visualização estética no Sheets
        var percent = p.mlFeeType === 'custom' ? (p.customFeePercent || 0) : (p.mlFeeType === 'premium' ? 17 : p.mlFeeType === 'classic' ? 12 : 0);
        var mlFee = (p.salePrice * percent) / 100;
        if (p.salePrice > 0 && p.salePrice < 79 && (p.mlFeeType === 'classic' || p.mlFeeType === 'premium')) {
          mlFee += 6.00;
        }
        
        var days = 0;
        if (p.addedDate) {
          try {
            days = Math.round((new Date().getTime() - new Date(p.addedDate).getTime()) / (1000 * 3600 * 24));
          } catch(err) {}
        }
        
        return [
          p.id, 
          p.name, 
          p.sku, 
          p.purchasePrice, 
          p.salePrice, 
          p.stock, 
          p.minimalStock || 0, 
          p.addedDate, 
          p.category || "Geral", 
          p.mlFeeType, 
          p.customFeePercent || 0, 
          p.shippingCost || 0,
          diff, 
          mlFee, 
          days
        ];
      });
      productSheet.getRange(2, 1, prodRows.length, prodHeaders.length).setValues(prodRows);
    }
    
    // 2. Sincronizar Vendas
    var salesSheet = ss.getSheetByName("Vendas") || ss.insertSheet("Vendas");
    salesSheet.clear();
    var salesHeaders = [
      "ID Venda", "ID Produto", "Nome Produto", "Quantidade", "Preço Venda", "Data", 
      "Taxa ML", "Custo Frete", "Preço Compra", "Lucro Bruto", "Lucro Líquido", "Desconto", "Status", "Tempo Conclusão"
    ];
    salesSheet.appendRow(salesHeaders);
    
    if (payload.sales && payload.sales.length > 0) {
      var salesRows = payload.sales.map(function(s) {
        return [
          s.id, 
          s.productId || "", 
          s.productName, 
          s.quantity, 
          s.salePrice, 
          s.date, 
          s.mlFee, 
          s.shippingCost, 
          s.purchasePrice, 
          s.grossProfit, 
          s.netProfit,
          s.discount || 0,
          s.status || "pending",
          s.completionTime || 0
        ];
      });
      salesSheet.getRange(2, 1, salesRows.length, salesHeaders.length).setValues(salesRows);
    }

    // 3. Sincronizar Configurações (Aporte / Capital Inicial)
    var configSheet = ss.getSheetByName("Config") || ss.insertSheet("Config");
    configSheet.clear();
    configSheet.appendRow(["Chave", "Valor"]);
    var capital = payload.initialCapital !== undefined ? payload.initialCapital : 500;
    configSheet.appendRow(["Aporte", capital]);
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Conectado e gravado com sucesso! Abas 'Produtos', 'Vendas' e 'Config' atualizadas." }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Função para sanitizar números e reverter datas formatadas por engano na planilha
    function sanitizeNumber(val) {
      if (val && Object.prototype.toString.call(val) === '[object Date]') {
        try {
          // No Google Sheets, datas começam em 30/12/1899. Converte milissegundos JavaScript de volta para número do Sheets
          var sheetsNum = (val.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000);
          return sheetsNum;
        } catch(err) {}
      }
      return Number(val) || 0;
    }

    // 1. Ler Produtos
    var products = [];
    var productSheet = ss.getSheetByName("Produtos");
    if (productSheet) {
      var prodData = productSheet.getDataRange().getValues();
      if (prodData.length > 1) {
        var headers = prodData[0];
        var idxId = headers.indexOf("ID Produto");
        var idxName = headers.indexOf("Nome Produto");
        var idxSku = headers.indexOf("SKU");
        var idxPurchase = headers.indexOf("Preço de Compra");
        var idxSale = headers.indexOf("Preço de Venda");
        var idxStock = headers.indexOf("Estoque");
        var idxMinStock = headers.indexOf("Estoque Mínimo");
        var idxAddedDate = headers.indexOf("Data de Entrada");
        var idxCategory = headers.indexOf("Categoria");
        var idxFeeType = headers.indexOf("Tipo Anuncio ML");
        var idxCustomFee = headers.indexOf("Comissão Customizada %");
        var idxShipping = headers.indexOf("Frete Padrão");
        
        for (var i = 1; i < prodData.length; i++) {
          var row = prodData[i];
          if (!row[idxId]) continue;
          
          var addedDateStr = "";
          if (row[idxAddedDate]) {
            try {
              var d = new Date(row[idxAddedDate]);
              if (!isNaN(d.getTime())) {
                addedDateStr = d.toISOString().split('T')[0];
              } else {
                addedDateStr = String(row[idxAddedDate]);
              }
            } catch(err) {
              addedDateStr = String(row[idxAddedDate]);
            }
          }
          
          products.push({
            id: String(row[idxId]),
            name: String(row[idxName]),
            sku: String(row[idxSku]),
            purchasePrice: sanitizeNumber(row[idxPurchase]),
            salePrice: sanitizeNumber(row[idxSale]),
            stock: sanitizeNumber(row[idxStock]),
            minimalStock: idxMinStock !== -1 ? sanitizeNumber(row[idxMinStock]) : 0,
            addedDate: addedDateStr || new Date().toISOString().split('T')[0],
            category: idxCategory !== -1 ? String(row[idxCategory]) : "Geral",
            mlFeeType: idxFeeType !== -1 ? String(row[idxFeeType]) : "none",
            customFeePercent: idxCustomFee !== -1 ? (row[idxCustomFee] !== "" ? sanitizeNumber(row[idxCustomFee]) : undefined) : undefined,
            shippingCost: idxShipping !== -1 ? sanitizeNumber(row[idxShipping]) : 0
          });
        }
      }
    }
    
    // 2. Ler Vendas
    var sales = [];
    var salesSheet = ss.getSheetByName("Vendas");
    if (salesSheet) {
      var salesData = salesSheet.getDataRange().getValues();
      if (salesData.length > 1) {
        var headers = salesData[0];
        var idxSaleId = headers.indexOf("ID Venda");
        var idxProdId = headers.indexOf("ID Produto");
        var idxProdName = headers.indexOf("Nome Produto");
        var idxQty = headers.indexOf("Quantidade");
        var idxPrice = headers.indexOf("Preço Venda");
        var idxDate = headers.indexOf("Data");
        var idxFee = headers.indexOf("Taxa ML");
        var idxShip = headers.indexOf("Custo Frete");
        var idxPur = headers.indexOf("Preço Compra");
        var idxGross = headers.indexOf("Lucro Bruto");
        var idxNet = headers.indexOf("Lucro Líquido");
        var idxDisc = headers.indexOf("Desconto");
        var idxStatus = headers.indexOf("Status");
        var idxComp = headers.indexOf("Tempo Conclusão");
        
        for (var i = 1; i < salesData.length; i++) {
          var row = salesData[i];
          if (!row[idxSaleId]) continue;
          
          var dateStr = "";
          if (row[idxDate]) {
            try {
              var d = new Date(row[idxDate]);
              if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
              } else {
                dateStr = String(row[idxDate]);
              }
            } catch(err) {
              dateStr = String(row[idxDate]);
            }
          }
          
          sales.push({
            id: String(row[idxSaleId]),
            productId: idxProdId !== -1 ? String(row[idxProdId]) : "unknown",
            productName: String(row[idxProdName]),
            quantity: sanitizeNumber(row[idxQty]) || 1,
            salePrice: sanitizeNumber(row[idxPrice]),
            date: dateStr || new Date().toISOString().split('T')[0],
            mlFee: idxFee !== -1 ? sanitizeNumber(row[idxFee]) : 0,
            shippingCost: idxShip !== -1 ? sanitizeNumber(row[idxShip]) : 0,
            purchasePrice: idxPur !== -1 ? sanitizeNumber(row[idxPur]) : 0,
            grossProfit: idxGross !== -1 ? sanitizeNumber(row[idxGross]) : 0,
            netProfit: idxNet !== -1 ? sanitizeNumber(row[idxNet]) : 0,
            discount: idxDisc !== -1 ? sanitizeNumber(row[idxDisc]) : 0,
            status: idxStatus !== -1 ? String(row[idxStatus]) : "completed",
            completionTime: idxComp !== -1 ? (row[idxComp] !== "" ? sanitizeNumber(row[idxComp]) : undefined) : undefined
          });
        }
      }
    }

    // 3. Ler Configurações (Aporte / Capital Inicial)
    var initialCapital = 500;
    var configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      var configData = configSheet.getDataRange().getValues();
      for (var i = 1; i < configData.length; i++) {
        if (configData[i][0] === "Aporte") {
          initialCapital = sanitizeNumber(configData[i][1]) || 500;
          break;
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      products: products,
      sales: sales,
      initialCapital: initialCapital
    }))
    .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

export default function SheetsIntegration({
  products,
  sales,
  spreadsheetUrl,
  onUpdateSpreadsheetUrl,
  webAppUrl,
  onUpdateWebAppUrl,
  onPullFromCloud,
  initialCapital
}: SheetsIntegrationProps) {
  const [copied, setCopied] = useState<'headers' | 'script' | null>(null);
  const [inputUrl, setInputUrl] = useState(spreadsheetUrl);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncResult, setSyncResult] = useState<{ status: 'success' | 'error' | null; message: string }>({
    status: null,
    message: ''
  });

  const IDEAL_COLUMNS = [
    { title: 'A: ID / ID do Produto', desc: 'Identificador único gerado automaticamente', example: 'prod_1' },
    { title: 'B: Nome Produto', desc: 'Nome visível do produto', example: 'Fone Bluetooth SoundPRO X' },
    { title: 'C: SKU / Código de Estoque', desc: 'Código de controle de estoque', example: 'ML-FONE-BT-001' },
    { title: 'D: Preço de Compra (R$)', desc: 'Custo de aquisição do item', example: '45.00' },
    { title: 'E: Preço de Venda (R$)', desc: 'Preço de listagem no Mercado Livre', example: '129.90' },
    { title: 'F: Diferença (R$)', desc: 'Preço de Venda menos Preço de Compra', example: '84.90' },
    { title: 'G: Tipo Anúncio ML', desc: 'Formato da taxa de comissão: classic ou premium', example: 'premium' },
    { title: 'H: Taxa Mercado Livre (R$)', desc: 'Imposto operacional calculado p/ unidade', example: '22.09' },
    { title: 'I: Frete Estimado (R$)', desc: 'Custo pago pelo vendedor no frete grátis', example: '0.00' },
    { title: 'J: Estoque disponível', desc: 'Quantidade de itens atual no estoque', example: '24' },
    { title: 'K: Tempo parado no estoque', desc: 'Dias desde a entrada até hoje', example: '38' },
  ];

  // Copiar Cabeçalhos para o Teclado
  const handleCopyHeaders = () => {
    const headers = 'ID Produto\tNome Produto\tSKU\tPreço de Compra\tPreço de Venda\tDiferença\tTipo Anuncio ML\tTaxa ML\tFrete Estimado\tEstoque\tTempo parado em estoque';
    navigator.clipboard.writeText(headers);
    setCopied('headers');
    setTimeout(() => setCopied(null), 2000);
  };

  // Copiar código do Apps Script
  const handleCopyScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopied('script');
    setTimeout(() => setCopied(null), 2000);
  };

  // Sincronização Ativa com Google Sheets Web App
  const handleSyncWithWebApp = async () => {
    if (!webAppUrl) return;
    setIsSyncing(true);
    setSyncResult({ status: null, message: '' });

    try {
      // Dispara requisição de sincronização ao servidor Proxy local (/api/sync-sheets)
      // para evitar bloqueios de CORS e politicas Restritivas de Iframes do navegador
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ webAppUrl, products, sales, initialCapital })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Servidor retornou status HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.status === 'success') {
        setSyncResult({
          status: 'success',
          message: result.message || 'Sincronização realizada com sucesso! Suas abas "Produtos" e "Vendas" do Google Sheets foram atualizadas.'
        });
      } else {
        setSyncResult({
          status: 'error',
          message: result.message || 'Ocorreu um erro no retorno do script da planilha.'
        });
      }
    } catch (error: any) {
      console.error('Erro ao sincronizar via proxy:', error);
      setSyncResult({
        status: 'error',
        message: `Falha na sincronização: ${error.message || error}. Certifique-se de que o Apps Script foi implantado como "Web App" acessível a "Qualquer pessoa" e de ter inserido o link correto.`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Ler / Importar dados da planilha para o aplicativo
  const handlePullFromWebApp = async () => {
    if (!webAppUrl) return;
    setIsPulling(true);
    setSyncResult({ status: null, message: '' });
    try {
      const result = await onPullFromCloud();
      setSyncResult({
        status: result.status,
        message: result.message
      });
    } catch (error: any) {
      console.error('Erro ao ler dados da planilha:', error);
      setSyncResult({
        status: 'error',
        message: `Falha na importação de dados: ${error.message || error}`
      });
    } finally {
      setIsPulling(false);
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['ID Produto', 'Nome Produto', 'SKU', 'Preco de Compra', 'Preco de Venda', 'Diferenca', 'Tipo Anuncio ML', 'Taxa ML', 'Frete Estimado', 'Estoque', 'Dias Parados'];
    
    const rows = products.map(p => {
      const diff = p.salePrice - p.purchasePrice;
      const mlFee = p.salePrice * (p.mlFeeType === 'premium' ? 0.17 : p.mlFeeType === 'classic' ? 0.12 : 0);
      const days = Math.round((new Date().getTime() - new Date(p.addedDate).getTime()) / (1000 * 3600 * 24));
      
      return [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.purchasePrice.toFixed(2),
        p.salePrice.toFixed(2),
        diff.toFixed(2),
        p.mlFeeType,
        mlFee.toFixed(2),
        p.shippingCost.toFixed(2),
        p.stock.toString(),
        days.toString()
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "produtos_mercado_livre.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLinkSheets = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSpreadsheetUrl(inputUrl);
  };

  return (
    <div className="space-y-6 animate-fade-in text-white animate-fade-in">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel Esquerdo: Configurar Links */}
        <div className="lg:col-span-6 space-y-6">
          
          <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-[#FFE600]" />
                  Passo 1: Visualização da Planilha
                </h3>
                <span className="text-[10px] text-white/40">Leitura/Escrita</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Cole o link público de compartilhamento da sua planilha Google para poder visualizá-la e dar suporte técnico.</p>
              
              <form onSubmit={handleLinkSheets} className="space-y-3">
                <input
                  type="url"
                  required
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="Ex: https://docs.google.com/spreadsheets/d/1Xy_abcd1234.../edit"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-semibold text-white placeholder-white/35"
                />
                <button
                  type="submit"
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center"
                >
                  Salvar Link de Visualização
                </button>
              </form>

              {spreadsheetUrl && (
                <div className="mt-3 p-3 bg-emerald-950/20 border border-emerald-500/15 rounded-xl text-xs text-emerald-400 font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>Link salvo na memória local!</span>
                  </div>
                  <a 
                    href={spreadsheetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-300 hover:underline flex items-center gap-1"
                  >
                    Abrir Planilha <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            <div className="border-t border-white/5 mt-6 pt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#FFE600]" />
                  Passo 2: URL de Gravação Ativa (Essential)
                </h3>
                <span className="text-[10px] text-emerald-400 font-bold">Gravação Direta</span>
              </div>
              <p className="text-xs text-white/50 mb-4">Insira o link do <strong>Web App gerado no Passo 3 (Painel Direito)</strong> para que você possa ler (Importar) ou escrever (Exportar) dados em tempo real de forma 100% segura.</p>
              
              <div className="space-y-3">
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => onUpdateWebAppUrl(e.target.value)}
                  placeholder="Ex: https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full bg-white/5 border border-[#FFE600]/25 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono text-[#FFE600] placeholder-white/30"
                />
                
                {webAppUrl && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      onClick={handlePullFromWebApp}
                      disabled={isPulling || isSyncing}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      id="btn-pull-sheets"
                      title="Lê e importa todo o banco de dados atual da sua planilha para o aplicativo"
                    >
                      {isPulling ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin text-[#FFE600]" />
                          <span>Importando...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 text-emerald-400" />
                          <span>Importar da Planilha 📥</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleSyncWithWebApp}
                      disabled={isSyncing || isPulling}
                      className="bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(255,230,0,0.15)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      id="btn-push-sheets"
                      title="Envia e grava os dados locais atuais do aplicativo na sua planilha"
                    >
                      {isSyncing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Exportando...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Exportar p/ Planilha 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Exibição de Resultados da Sincronização */}
                {syncResult.status && (
                  <div className={`p-4 rounded-xl text-xs font-medium leading-relaxed border ${
                    syncResult.status === 'success' 
                      ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400' 
                      : 'bg-rose-950/20 border-rose-500/20 text-rose-400'
                  }`}>
                    <div className="font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${syncResult.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      {syncResult.status === 'success' ? 'Sucesso na Exportação' : 'Erro no Envio'}
                    </div>
                    {syncResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* Painel Direito: Passo 3 Código Apps Script */}
        <div className="lg:col-span-6">
          <div className="bg-[#141414] p-6 rounded-2xl border border-white/5 shadow-md flex flex-col justify-between h-full space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[#FFE600] uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  Passo 3: Criar seu gatilho de gravação ⚙️
                </h3>
                <span className="text-[10px] bg-[#FFE600]/10 text-[#FFE600] px-1.5 py-0.5 rounded border border-[#FFE600]/10 font-bold">1 Minuto de Setup</span>
              </div>
              <p className="text-xs text-white/50 mb-3 leading-relaxed">
                Siga os passos rápidos abaixo para ativar o receptor e transformar seu Google Sheets em uma API de gravação corporativa para seu estoque e vendas:
              </p>

              <ol className="text-xs space-y-2 list-decimal list-inside text-white/70 mb-4 bg-white/5 p-3 rounded-xl border border-white/5 font-medium leading-relaxed">
                <li>Abra a sua planilha ativa no Google Sheets.</li>
                <li>No menu superior, clique em <strong className="text-white font-bold">Extensões  {`>`}  Apps Script</strong>.</li>
                <li>Apague qualquer código que estiver lá e <strong className="text-[#FFE600] font-bold">cole o código gerado no botão abaixo</strong>.</li>
                <li>Clique no ícone de salvar <strong className="text-white">💾 (ícone de disquete)</strong>.</li>
                <li>Clique no botão azul <strong className="text-white font-bold">"Implantar"  {`>`}  "Nova implantação"</strong> (canto superior direito).</li>
                <li>Selecione o tipo <strong className="text-white">"Web App"</strong> (clicando na engrenagem ao lado de 'Selecionar Tipo').</li>
                <li>No campo <strong className="text-white font-bold">"Executar como" (Execute as)</strong>, selecione obrigatoriamente <strong className="text-[#FFE600] font-bold">"Eu (seu-email@gmail.com)"</strong> (isso evita erros HTTP 401 no envio).</li>
                <li>No campo <strong className="text-white font-bold">"Quem tem acesso" (Who has access)</strong>, mude para <strong className="text-[#FFE600] font-bold">"Qualquer pessoa" (Anyone)</strong>.</li>
                <li>Clique em "Implantar", autorize o acesso à sua conta do Google e <strong className="text-[#FFE600] font-bold">copie a URL do "App da Web" gerada</strong> para colar na barra "Passo 2" à esquerda!</li>
              </ol>

              <button
                onClick={handleCopyScript}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold py-3 px-4 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {copied === 'script' ? (
                  <>
                    <Check className="w-4 h-4 text-[#FFE600]" />
                    <span className="text-[#FFE600]">Código de Gravação Copiado! Click-to-Paste</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-white/50" />
                    <span>Copiar Código do Apps Script</span>
                  </>
                )}
              </button>
            </div>

            <div className="bg-[#FFE600]/5 border border-[#FFE600]/10 p-3 rounded-xl text-[11px] text-white/60 leading-relaxed font-mono overflow-y-auto max-h-[140px]">
              <pre className="text-white/40">{APPS_SCRIPT_CODE.substring(0, 310)}...</pre>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
