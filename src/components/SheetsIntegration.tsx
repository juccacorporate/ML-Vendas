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
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Sincronizar Produtos
    var productSheet = ss.getSheetByName("Produtos") || ss.insertSheet("Produtos");
    productSheet.clear();
    var prodHeaders = ["ID Produto", "Nome Produto", "SKU", "Preço de Compra", "Preço de Venda", "Diferença", "Tipo Anuncio ML", "Taxa ML", "Frete Estimado", "Estoque", "Dias Parados"];
    productSheet.appendRow(prodHeaders);
    
    if (payload.products && payload.products.length > 0) {
      var prodRows = payload.products.map(function(p) {
        var diff = p.salePrice - p.purchasePrice;
        var mlFee = p.salePrice * (p.mlFeeType === 'premium' ? 0.17 : p.mlFeeType === 'classic' ? 0.12 : 0);
        var days = Math.round((new Date().getTime() - new Date(p.addedDate).getTime()) / (1000 * 3600 * 24));
        return [p.id, p.name, p.sku, p.purchasePrice, p.salePrice, diff, p.mlFeeType, mlFee, p.shippingCost, p.stock, days];
      });
      productSheet.getRange(2, 1, prodRows.length, prodHeaders.length).setValues(prodRows);
    }
    
    // 2. Sincronizar Vendas
    var salesSheet = ss.getSheetByName("Vendas") || ss.insertSheet("Vendas");
    salesSheet.clear();
    var salesHeaders = ["ID Venda", "Nome Produto", "Quantidade", "Preço Venda", "Data", "Taxa ML", "Custo Frete", "Preço Compra", "Lucro Bruto", "Lucro Líquido", "Status"];
    salesSheet.appendRow(salesHeaders);
    
    if (payload.sales && payload.sales.length > 0) {
      var salesRows = payload.sales.map(function(s) {
        return [s.id, s.productName, s.quantity, s.salePrice, s.date, s.mlFee, s.shippingCost, s.purchasePrice, s.grossProfit, s.netProfit, s.status];
      });
      salesSheet.getRange(2, 1, salesRows.length, salesHeaders.length).setValues(salesRows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Conectado e gravado com sucesso! Abas 'Produtos' e 'Vendas' atualizadas." }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "active", message: "Disparador de Integração ML PRO Ativo!" }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}`;

export default function SheetsIntegration({
  products,
  sales,
  spreadsheetUrl,
  onUpdateSpreadsheetUrl,
  webAppUrl,
  onUpdateWebAppUrl
}: SheetsIntegrationProps) {
  const [copied, setCopied] = useState<'headers' | 'script' | null>(null);
  const [inputUrl, setInputUrl] = useState(spreadsheetUrl);
  
  const [isSyncing, setIsSyncing] = useState(false);
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
        body: JSON.stringify({ webAppUrl, products, sales })
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
              <p className="text-xs text-white/50 mb-4">Insira o link do <strong>Web App gerado no Passo 3 (Painel Direito)</strong> para que o botão de sincronização possa realizar a gravação instantânea dos dados.</p>
              
              <div className="space-y-3">
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => onUpdateWebAppUrl(e.target.value)}
                  placeholder="Ex: https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full bg-white/5 border border-[#FFE600]/25 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono text-[#FFE600] placeholder-white/30"
                />
                
                {webAppUrl && (
                  <button
                    onClick={handleSyncWithWebApp}
                    disabled={isSyncing}
                    className="w-full bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(255,230,0,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sincronizando de Forma Ativa...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        <span>Sincronizar Dados Agora 🚀</span>
                      </>
                    )}
                  </button>
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
