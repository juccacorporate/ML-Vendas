/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Product, Sale } from '../types';
import { formatCurrency, calculateCurrentStock, calculateProductSalesVolume, cleanMlSaleId } from '../utils';
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
  Globe,
  AlertCircle
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
  mlRecords: any[];
  entradaRecords?: any[];
  entradaRawMatrix?: any[][];
}

const APPS_SCRIPT_CODE = `function cleanMlSaleId(raw) {
  if (!raw && raw !== 0) return "";
  var str = String(raw).trim();
  if (!str) return "";

  // 1. Sequência numérica oficial de pedidos do Mercado Livre (ex: 200000...)
  var mlMatch = str.match(/\\b(200\\d{7,20}|\\d{10,24})\\b/);
  if (mlMatch) {
    return mlMatch[0];
  }

  // 2. Fragmento numérico separado por _
  if (str.indexOf('_') !== -1) {
    var parts = str.split('_');
    for (var i = 0; i < parts.length; i++) {
      if (/^\\d{8,24}$/.test(parts[i])) {
        return parts[i];
      }
    }
  }

  str = str.replace(/\\.0+$/, '').trim();
  if (/^\\d{6,24}$/.test(str)) {
    return str;
  }

  if (
    str.indexOf('ml_v_') === 0 ||
    str.indexOf('rec_') === 0 ||
    str.indexOf('sale_') === 0 ||
    str.indexOf('prod_') === 0 ||
    str.toLowerCase() === 'sem id' ||
    str.toLowerCase() === 'n/a'
  ) {
    return "";
  }

  return str;
}

function normalizeNameScript(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function getCoreProductTypeScript(str) {
  if (!str) return '';
  var s = String(str).toLowerCase();
  if (s.indexOf('adaptador') !== -1 || s.indexOf('plug') !== -1) return 'adaptador';
  if (s.indexOf('extensor') !== -1) return 'extensor';
  if (s.indexOf('cabo') !== -1) return 'cabo';
  if (s.indexOf('xuxinha') !== -1 || s.indexOf('rabico') !== -1 || s.indexOf('elastico') !== -1) return 'xuxinha';
  if (s.indexOf('teclado') !== -1) return 'teclado';
  if (s.indexOf('fone') !== -1 || s.indexOf('headset') !== -1) return 'fone';
  if (s.indexOf('suporte') !== -1) return 'suporte';
  if (s.indexOf('garrafa') !== -1) return 'garrafa';
  if (s.indexOf('carregador') !== -1 || s.indexOf('fonte') !== -1) return 'carregador';
  if (s.indexOf('capa') !== -1 || s.indexOf('case') !== -1) return 'capa';
  return '';
}

function getAllProductSkusScript(p) {
  if (!p) return [];
  var result = [];
  if (p.sku && String(p.sku).trim()) {
    result.push(String(p.sku).trim());
  }
  if (p.skus && Array.isArray(p.skus)) {
    for (var i = 0; i < p.skus.length; i++) {
      var s = String(p.skus[i] || '').trim();
      if (s && result.indexOf(s) === -1) {
        result.push(s);
      }
    }
  } else if (p.skus && typeof p.skus === 'string') {
    var rawParts = p.skus.split('\\n').join(',').split(';').join(',').split(' ').join(',');
    var parts = rawParts.split(',').map(function(x) { return x.trim(); }).filter(Boolean);
    for (var j = 0; j < parts.length; j++) {
      if (parts[j] && result.indexOf(parts[j]) === -1) {
        result.push(parts[j]);
      }
    }
  }
  return result;
}

function findProductForSaleScript(s, productsList) {
  if (!productsList || productsList.length === 0) return null;

  var sPid = String(s.productId || '').trim();
  if (sPid) {
    for (var k = 0; k < productsList.length; k++) {
      if (String(productsList[k].id || '').trim() === sPid) {
        return productsList[k];
      }
    }
  }

  // 1. Busca prioritária por # de Anúncio (adId / MLB...)
  var sAdId = String(s.adId || '').replace(/^[#\s]+/, '').trim().toLowerCase();
  if (sAdId && sAdId.length > 3 && sAdId !== 'sim' && sAdId !== 'nao' && sAdId !== 'ml') {
    var sAdDigitsOnly = sAdId.replace(/[^0-9]/g, '');
    for (var a = 0; a < productsList.length; a++) {
      var p = productsList[a];
      var allSkus = getAllProductSkusScript(p).map(function(x) { return String(x).replace(/^[#\s]+/, '').trim().toLowerCase(); });
      var pIdClean = String(p.id || '').replace(/^[#\s]+/, '').trim().toLowerCase();
      if (allSkus.indexOf(sAdId) !== -1 || pIdClean === sAdId) {
        return p;
      }
      for (var b = 0; b < allSkus.length; b++) {
        var skuDigits = allSkus[b].replace(/[^0-9]/g, '');
        if (sAdDigitsOnly.length >= 6 && skuDigits.length >= 6 && sAdDigitsOnly === skuDigits) {
          return p;
        }
      }
    }
  }

  // 2. Busca por SKU
  var sSku = String(s.sku || '').replace(/^[#\s]+/, '').trim().toLowerCase();
  if (sSku && sSku.length > 1 && sSku !== 'sim' && sSku !== 'nao' && sSku !== 'ml') {
    var sSkuDigits = sSku.replace(/[^0-9]/g, '');
    for (var c = 0; c < productsList.length; c++) {
      var prod = productsList[c];
      var prodSkus = getAllProductSkusScript(prod).map(function(x) { return String(x).replace(/^[#\s]+/, '').trim().toLowerCase(); });
      var prodIdClean = String(prod.id || '').replace(/^[#\s]+/, '').trim().toLowerCase();
      if (prodSkus.indexOf(sSku) !== -1 || prodIdClean === sSku) {
        return prod;
      }
      for (var d = 0; d < prodSkus.length; d++) {
        var pSkuDigits = prodSkus[d].replace(/[^0-9]/g, '');
        if (sSkuDigits.length >= 6 && pSkuDigits.length >= 6 && sSkuDigits === pSkuDigits) {
          return prod;
        }
      }
    }
  }

  return null;
}

function calculateProductSalesVolumeScript(product, sales, allProducts) {
  if (!sales || sales.length === 0 || !product) return 0;
  var productsList = (allProducts && allProducts.length > 0) ? allProducts : [product];
  var targetId = String(product.id || '').trim();
  var targetNameNorm = normalizeNameScript(product.name || '');

  var total = 0;
  for (var i = 0; i < sales.length; i++) {
    var s = sales[i];
    if (s.status === 'refunded') continue;

    var matched = findProductForSaleScript(s, productsList);
    var isMatch = false;

    if (matched) {
      if (String(matched.id || '').trim() === targetId || normalizeNameScript(matched.name || '') === targetNameNorm) {
        isMatch = true;
      }
    } else {
      var sPid = String(s.productId || '').trim();
      var sSku = String(s.sku || '').trim().toLowerCase();
      var targetSkuClean = String(product.sku || '').trim().toLowerCase();

      if (targetId && sPid && sPid === targetId) {
        isMatch = true;
      } else if (targetSkuClean && targetSkuClean.length > 1 && targetSkuClean !== 'sim' && targetSkuClean !== 'nao' && targetSkuClean !== 'ml' && sSku === targetSkuClean) {
        isMatch = true;
      }
    }

    if (isMatch) {
      total += (Number(s.quantity) || 1);
    }
  }
  return total;
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Sincronizar Produtos (Garante que adições, edições, arquivamentos e exclusões reflitam exatamente no Google Sheets)
    var productSheet = ss.getSheetByName("Produtos") || ss.insertSheet("Produtos");
    if (payload.products && Array.isArray(payload.products)) {
      var prodHeaders = [
        "ID Produto", "Nome Produto", "SKU", "# de Anúncio / SKUs Vinculados", "Preço de Compra", "Preço de Venda",
        "Estoque Inicial", "Saídas", "Estoque Atual", "Estoque Mínimo", "Data de Entrada",
        "Categoria", "Tipo Anuncio ML", "Comissão Customizada %", "Frete Padrão", "Diferença",
        "Taxa ML", "Dias Parados", "Status", "Histórico de Reposições"
      ];
      
      productSheet.clear();
      productSheet.appendRow(prodHeaders);
      
      if (payload.products.length > 0) {
        var prodRows = [];
        for (var pIdx = 0; pIdx < payload.products.length; pIdx++) {
          var pItem = payload.products[pIdx];
          var pRowNumber = pIdx + 2;
          var totalSold = calculateProductSalesVolumeScript(pItem, payload.sales || [], payload.products || []);
          
          var replenJson = "";
          if (pItem.replenishments && pItem.replenishments.length > 0) {
            try {
              replenJson = JSON.stringify(pItem.replenishments);
            } catch(err) {}
          }

          var skusJoined = "";
          if (pItem.skus && Array.isArray(pItem.skus) && pItem.skus.length > 0) {
            skusJoined = pItem.skus.join(", ");
          } else if (typeof pItem.skus === 'string') {
            skusJoined = pItem.skus;
          }
          
          prodRows.push([
            pItem.id || pItem.sku,
            pItem.name,
            pItem.sku,
            skusJoined,
            pItem.purchasePrice || 0,
            pItem.salePrice || 0,
            pItem.stock || 0,
            totalSold,
            "=G" + pRowNumber + "-H" + pRowNumber,
            pItem.minimalStock !== undefined ? pItem.minimalStock : 5,
            pItem.addedDate || "",
            pItem.category || "Geral",
            pItem.mlFeeType || "none",
            pItem.customFeePercent || 0,
            pItem.shippingCost || 0,
            "=F" + pRowNumber + "-E" + pRowNumber,
            "=(F" + pRowNumber + "*12/100)+6",
            "=TODAY()-K" + pRowNumber,
            pItem.status || "active",
            replenJson
          ]);
        }
        productSheet.getRange(2, 1, prodRows.length, prodHeaders.length).setValues(prodRows);
      }
    }

    // 2. Sincronizar Vendas (Dividindo em andamento, finalizadas e desprezadas)
    var salesSheetActive = ss.getSheetByName("Vendas em Andamento") || ss.insertSheet("Vendas em Andamento");
    var salesSheetFinished = ss.getSheetByName("Vendas Finalizadas") || ss.insertSheet("Vendas Finalizadas");
    var salesSheetIgnored = ss.getSheetByName("Dados e Vendas Desprezadas") || ss.insertSheet("Dados e Vendas Desprezadas");
    
    // Atualiza apenas as vendas em andamento e finalizadas (limpa e reescreve o full state)
    salesSheetActive.clear();
    salesSheetFinished.clear();
    salesSheetIgnored.clear();
    
    var salesHeaders = [
      "ID Venda", "Nome Produto", "Quantidade", "Preço Venda", "Data", 
      "Taxa ML", "Custo Frete", "Receita por Envio", "Preço Compra", "Lucro Bruto", "A Receber do ML", "Lucro Líquido", "Imposto", "Desconto", "Status", "Tempo Conclusão",
      "ID Venda Mercado Livre", "Nome do Cliente", "Prejuízo Extra", "Motivo Prejuízo", "Tipo de Frete", "Venda Customizada", "Comissão Customizada", "Frete Customizado",
      "# de Anúncio", "SKU"
    ];
    salesSheetActive.appendRow(salesHeaders);
    salesSheetFinished.appendRow(salesHeaders);
    salesSheetIgnored.appendRow(salesHeaders);
    
    if (payload.sales && payload.sales.length > 0) {
      var activeRows = [];
      var finishedRows = [];
      var ignoredRows = [];
      
      payload.sales.forEach(function(s) {
        var isFinished = false;
        var isIgnored = s.status === 'ignored';

        if (!isIgnored) {
          try {
            if (s.date) {
              var saleDate = new Date(s.date + "T12:00:00");
              saleDate.setHours(0,0,0,0);
              var now = new Date();
              now.setHours(0,0,0,0);
              var diffDays = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays >= 30) {
                isFinished = true;
              }
            }
          } catch(e) {}
          
          if (s.status === 'completed' || s.status === 'paid' || s.status === 'refunded' || isFinished) {
            isFinished = true;
          }
        }

        var targetList = isIgnored ? ignoredRows : (isFinished ? finishedRows : activeRows);
        var rNum = targetList.length + 2;
        
        // Obter puramente o ID numérico da venda sem sufixos de produto
        var pureSaleId = cleanMlSaleId(s.mlSaleId) || cleanMlSaleId(s.id);
        if (!pureSaleId && s.id) {
          var cleanStr = String(s.id)
            .replace(/^sale_/, '')
            .replace(/^ml_v_\d+_/, '')
            .replace(/_?prod_\w+/g, '')
            .replace(/^prod_\w+_?/, '')
            .trim();
          pureSaleId = cleanStr || s.id;
        }
        if (pureSaleId && pureSaleId.indexOf('prod_') !== -1) {
          pureSaleId = pureSaleId.replace(/_?prod_\w+/g, '').replace(/^prod_\w+_?/, '').trim();
        }

        targetList.push([
          pureSaleId || s.id,
          s.productName, 
          s.quantity, 
          s.salePrice, 
          s.date, 
          s.mlFee, 
          s.shippingCost, 
          s.shippingRevenue || 0,
          s.purchasePrice, 
          "=(C" + rNum + "*D" + rNum + ")-(I" + rNum + "*C" + rNum + ")",
          "=(C" + rNum + "*D" + rNum + ")-F" + rNum + "-G" + rNum + "+H" + rNum + "",
          "=K" + rNum + "-(I" + rNum + "*C" + rNum + ")-M" + rNum + "",
          "=(C" + rNum + "*D" + rNum + ")*4/100",
          s.discount || 0,
          s.status || "pending",
          s.completionTime || 0,
          pureSaleId || cleanMlSaleId(s.mlSaleId) || "",
          s.buyerName || "",
          s.lossAmount || 0,
          s.lossReason || "",
          s.shippingType || "transportadora",
          s.isCustomSale ? "Sim" : "Não",
          s.customMlFee || 0,
          s.customShippingCost || 0,
          s.adId || "",
          s.sku || ""
        ]);
      });
      
      if (activeRows.length > 0) {
        salesSheetActive.getRange(2, 1, activeRows.length, 1).setNumberFormat("@");
        salesSheetActive.getRange(2, 4, activeRows.length, 1).setNumberFormat("#,##0.00");
        salesSheetActive.getRange(2, 6, activeRows.length, 9).setNumberFormat("#,##0.00");
        salesSheetActive.getRange(2, 1, activeRows.length, salesHeaders.length).setValues(activeRows);
      }
      if (finishedRows.length > 0) {
        salesSheetFinished.getRange(2, 1, finishedRows.length, 1).setNumberFormat("@");
        salesSheetFinished.getRange(2, 4, finishedRows.length, 1).setNumberFormat("#,##0.00");
        salesSheetFinished.getRange(2, 6, finishedRows.length, 9).setNumberFormat("#,##0.00");
        salesSheetFinished.getRange(2, 1, finishedRows.length, salesHeaders.length).setValues(finishedRows);
      }
      if (ignoredRows.length > 0) {
        salesSheetIgnored.getRange(2, 1, ignoredRows.length, 1).setNumberFormat("@");
        salesSheetIgnored.getRange(2, 4, ignoredRows.length, 1).setNumberFormat("#,##0.00");
        salesSheetIgnored.getRange(2, 6, ignoredRows.length, 9).setNumberFormat("#,##0.00");
        salesSheetIgnored.getRange(2, 1, ignoredRows.length, salesHeaders.length).setValues(ignoredRows);
      }
    }

    // 3. Sincronizar Configurações (Aporte / Capital Inicial)
    var configSheet = ss.getSheetByName("Config") || ss.insertSheet("Config");
    configSheet.clear();
    configSheet.appendRow(["Chave", "Valor"]);
    var capital = payload.initialCapital !== undefined ? payload.initialCapital : 500;
    configSheet.appendRow(["Aporte", capital]);

    // 4. Sincronizar Importações Mercado Livre (Aba dedicada requisitada)
    if (payload.mlRecords) {
      var mlSheet = ss.getSheetByName("Importe Mercado Livre") || ss.insertSheet("Importe Mercado Livre");
      mlSheet.clear();
      var mlHeaders = [
        "N.º de venda", "Data da venda", "Estado", "Descrição do status", "Pacote de diversos produtos",
        "Pertence a um kit", "Unidades", "Receita por produtos (BRL)", "Receita por acréscimo no preço (pago pelo comprador)",
        "Taxa de parcelamento equivalente ao acréscimo", "Tarifa de venda e impostos (BRL)", "Receita por envio (BRL)",
        "Tarifas de envio (BRL)", "Custo de envio com base nas medidas e peso declarados", "Custo por diferenças nas medidas e no peso do pacote",
        "Descontos e bônus", "Cancelamentos e reembolsos (BRL)", "Total (BRL)", "Mês de faturamento das suas tarifas",
        "Venda por publicidade", "SKU", "# de anúncio", "Título do anúncio", "Variação", "Preço unitário de venda do anúncio (BRL)",
        "Tipo de anúncio", "NF-e em anexo", "Dados pessoais ou da empresa", "Tipo e número do documento", "Endereço",
        "Forma de entrega", "Data a caminho", "Data de entrega", "Transportador", "Número de rastreamento", "URL de acompanhamento",
        "Reclamação aberta", "Reclamação encerrada", "Em mediação"
      ];
      mlSheet.appendRow(mlHeaders);
      if (payload.mlRecords.length > 0) {
        var mlRows = payload.mlRecords.map(function(r) {
          return [
            r.id, r.dateStr, r.status, r.statusDescription, r.multiProduct ? "Sim" : "Não",
            r.isKit ? "Sim" : "Não", r.units, r.productRevenue, r.surchargeRevenue,
            r.installmentFee, r.saleFeeAndTaxes, r.shippingRevenue,
            r.shippingFee, r.shippingWeightCost, r.shippingDiffCost,
            r.discountsAndBonuses, r.refundsAndCancellations, r.totalBrl, r.billingMonth,
            r.isAdSale ? "Sim" : "Não", r.sku || "", r.adId, r.adTitle, r.variation, r.adUnitPrice,
            r.adType, r.invoiceStatus, r.buyerName, r.buyerDocument, r.buyerAddress,
            r.shippingMethod, r.shippingDateGo, r.shippingDateDelivery, r.carrier, r.trackingNumber, r.trackingUrl,
            r.isClaimOpen ? "Sim" : "Não", r.isClaimClosed ? "Sim" : "Não", r.isInMediation ? "Sim" : "Não"
          ];
        });
        mlSheet.getRange(2, 1, mlRows.length, mlHeaders.length).setValues(mlRows);
      }
    }

    // 5. Criar e Sincronizar Aba "Entrada de Valores" (Relatório de Liberações / Planilha Completa)
    var entradaSheet = ss.getSheetByName("Entrada de Valores") || ss.insertSheet("Entrada de Valores");
    
    if (payload.entradaRawMatrix && Array.isArray(payload.entradaRawMatrix) && payload.entradaRawMatrix.length > 0) {
      entradaSheet.clear();
      var numRows = payload.entradaRawMatrix.length;
      var mHeaders = payload.entradaRawMatrix[0];
      var skuIndicesToRemove = [];
      var colReceita = -1, colAcrescimo = -1, colParcelamento = -1, colTarifaVenda = -1, colReceitaEnvio = -1, colTarifasEnvio = -1;
      
      if (mHeaders && Array.isArray(mHeaders)) {
        for (var j = 0; j < mHeaders.length; j++) {
          var h = String(mHeaders[j]).trim().toLowerCase();
          if (h === "sku" || h === "sku produto" || h === "sku de produto") {
            skuIndicesToRemove.push(j);
          }
          if (h.indexOf("receita por produtos") !== -1) colReceita = j;
          if (h.indexOf("acréscimo") !== -1 || h.indexOf("acrescimo") !== -1) colAcrescimo = j;
          if (h.indexOf("parcelamento") !== -1) colParcelamento = j;
          if (h.indexOf("tarifa de venda") !== -1) colTarifaVenda = j;
          if (h.indexOf("receita por envio") !== -1) colReceitaEnvio = j;
          if (h.indexOf("tarifas de envio") !== -1) colTarifasEnvio = j;
        }
      }
      var numCols = mHeaders ? (mHeaders.length - skuIndicesToRemove.length) + 2 : 0;
      
      var parseMatrixNum = function(val) {
        if (!val) return 0;
        var s = String(val).trim().replace(/r\$\s?/i, '').replace(/\./g, '').replace(',', '.');
        var n = parseFloat(s);
        return isNaN(n) ? 0 : n;
      };

      var isFirstRow = true;
      var formattedMatrix = payload.entradaRawMatrix.map(function(row) {
        if (!Array.isArray(row)) return [];
        var newRow = [];
        for (var j = 0; j < row.length; j++) {
          if (skuIndicesToRemove.indexOf(j) !== -1) continue;
          var cell = row[j];
          if (cell === null || cell === undefined) cell = "";
          var str = String(cell).trim();
          if (/^[0-9]{10,24}$/.test(str)) {
            newRow.push("'" + str);
          } else {
            newRow.push(cell);
          }
        }
        
        if (isFirstRow) {
          newRow.push("A Receber do ML");
          newRow.push("Lucro Líquido Real");
          isFirstRow = false;
        } else {
          var receita = colReceita !== -1 ? parseMatrixNum(row[colReceita]) : 0;
          var acrescimo = colAcrescimo !== -1 ? parseMatrixNum(row[colAcrescimo]) : 0;
          var parcelamento = colParcelamento !== -1 ? parseMatrixNum(row[colParcelamento]) : 0;
          var tarifaVenda = colTarifaVenda !== -1 ? parseMatrixNum(row[colTarifaVenda]) : 0;
          var receitaEnvio = colReceitaEnvio !== -1 ? parseMatrixNum(row[colReceitaEnvio]) : 0;
          var tarifasEnvio = colTarifasEnvio !== -1 ? parseMatrixNum(row[colTarifasEnvio]) : 0;
          
          var aReceberML = receita + acrescimo + parcelamento + tarifaVenda + receitaEnvio + tarifasEnvio;
          
          newRow.push(aReceberML);
          newRow.push("Calculado em Vendas");
        }
        return newRow;
      });
      entradaSheet.getRange(1, 1, numRows, numCols).setValues(formattedMatrix);
    } else if (payload.entradaRecords && Array.isArray(payload.entradaRecords) && payload.entradaRecords.length > 0) {
      var entradaHeaders = [
        "N.º de Venda / Operação", "Data da Entrada / Liberação", "Tipo de Operação", 
        "Status da Operação", "Produto Vinculado"
      ];
      var validEntradas = payload.entradaRecords.filter(function(eRec) {
        var idStr = String(eRec.id || '').trim();
        return !/[eE+.,]/.test(idStr) && /^20[0-9]{10,18}$/.test(idStr);
      });

      if (validEntradas.length > 0) {
        entradaSheet.clear();
        entradaSheet.appendRow(entradaHeaders);
        var entradaRows = validEntradas.map(function(eRec) {
          var idStr = String(eRec.id || '').trim();
          return [
            "'" + idStr,
            eRec.dateStr || "",
            eRec.releaseStatus || "Liberação",
            eRec.operationStatus || "Pago",
            eRec.productName || ""
          ];
        });
        entradaSheet.getRange(2, 1, entradaRows.length, 1).setNumberFormat("@");
        entradaSheet.getRange(2, 1, entradaRows.length, entradaHeaders.length).setValues(entradaRows);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Conectado e gravado com sucesso! Abas de vendas, produtos e Entrada de Valores atualizadas na planilha. 🚀", products: payload.products }))
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
          var sheetsNum = (val.getTime() - new Date(1899, 11, 30).getTime()) / (24 * 60 * 60 * 1000);
          return sheetsNum;
        } catch(err) {}
      }
      if (typeof val === 'string' && val.indexOf('#') === 0) return 0;
      var num = Number(val);
      return isNaN(num) ? 0 : num;
    }

    // Função para formatar datas da planilha de forma imune a problemas de fuso horário/timezone
    function formatSheetDate(val) {
      if (!val) return "";
      if (Object.prototype.toString.call(val) === '[object Date]') {
        try {
          return Utilities.formatDate(val, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
        } catch(err) {}
      }
      var d = new Date(val);
      if (!isNaN(d.getTime())) {
        try {
          return Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
        } catch(err) {
          try {
            return d.toISOString().split('T')[0];
          } catch(e) {}
        }
      }
      return String(val);
    }

    // 1. Ler Produtos
    var products = [];
    var productSheet = ss.getSheetByName("Produtos");
    if (productSheet) {
      var prodData = productSheet.getDataRange().getValues();
      if (prodData.length > 1) {
        var headers = prodData[0];
        var idxId = headers.indexOf("ID Produto");
        if (idxId === -1) idxId = headers.indexOf("SKU");
        var idxName = headers.indexOf("Nome Produto");
        var idxSku = headers.indexOf("SKU");
        var idxSkusList = headers.indexOf("# de Anúncio / SKUs Vinculados");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("Variações de SKU / # de Anúncio");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("# de Anúncio / Variações de SKU");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("# de Anúncio");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("# de anúncio");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("SKUs Vinculados");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("Variações de SKU");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("Outros SKUs");
        if (idxSkusList === -1) idxSkusList = headers.indexOf("Variações");
        var idxPurchase = headers.indexOf("Preço de Compra");
        var idxSale = headers.indexOf("Preço de Venda");
        var idxInitStock = headers.indexOf("Estoque Inicial");
        var idxStock = idxInitStock !== -1 ? idxInitStock : (headers.indexOf("Estoque") !== -1 ? headers.indexOf("Estoque") : headers.indexOf("Estoque Atual"));
        var idxMinStock = headers.indexOf("Estoque Mínimo");
        var idxAddedDate = headers.indexOf("Data de Entrada");
        var idxCategory = headers.indexOf("Categoria");
        var idxFeeType = headers.indexOf("Tipo Anuncio ML");
        var idxCustomFee = headers.indexOf("Comissão Customizada %");
        var idxShipping = headers.indexOf("Frete Padrão");
        var idxStatus = headers.indexOf("Status");
        var idxReplenishments = headers.indexOf("Histórico de Reposições");
        
        for (var i = 1; i < prodData.length; i++) {
          var row = prodData[i];
          if (!row[idxId]) continue;
          
          var addedDateStr = formatSheetDate(row[idxAddedDate]);
          
          var statusVal = idxStatus !== -1 ? String(row[idxStatus]) : 'active';
          if (statusVal !== 'active' && statusVal !== 'archived') statusVal = 'active';

          var replenishments = [];
          if (idxReplenishments !== -1 && row[idxReplenishments]) {
            try {
              replenishments = JSON.parse(row[idxReplenishments]);
            } catch(e) {}
          }

          var skusList = [];
          if (idxSkusList !== -1 && row[idxSkusList]) {
            var rawSkus = String(row[idxSkusList]).trim();
            if (rawSkus) {
              try {
                if (rawSkus.indexOf('[') === 0) {
                  skusList = JSON.parse(rawSkus);
                } else {
                  var rawClean = rawSkus.split('\\n').join(',').split(';').join(',').split(' ').join(',');
                  skusList = rawClean.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
                }
              } catch(e) {
                var rawCleanFallback = rawSkus.split('\\n').join(',').split(';').join(',').split(' ').join(',');
                skusList = rawCleanFallback.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
              }
            }
          }
          
          products.push({
            id: String(row[idxId]),
            name: String(row[idxName]),
            sku: String(row[idxSku]),
            skus: skusList,
            purchasePrice: sanitizeNumber(row[idxPurchase]),
            salePrice: sanitizeNumber(row[idxSale]),
            stock: sanitizeNumber(row[idxStock]),
            minimalStock: sanitizeNumber(row[idxMinStock]),
            addedDate: addedDateStr,
            category: String(row[idxCategory] || "Geral"),
            mlFeeType: String(row[idxFeeType] || "none"),
            customFeePercent: sanitizeNumber(row[idxCustomFee]),
            shippingCost: sanitizeNumber(row[idxShipping]),
            status: statusVal,
            replenishments: replenishments
          });
        }
      }
    }
    
    // 2. Ler Vendas
    var sales = [];
    var salesSheetsToRead = ["Vendas em Andamento", "Vendas Finalizadas", "Vendas", "Dados e Vendas Desprezadas"];
    
    salesSheetsToRead.forEach(function(sheetName) {
      var salesSheet = ss.getSheetByName(sheetName);
      if (salesSheet) {
        var salesData = salesSheet.getDataRange().getValues();
        if (salesData && salesData.length > 0) {
          var firstRow = salesData[0];
          
          // Verificar se a primeira linha é cabeçalho ou dados brutos
          var hasHeaders = false;
          for (var h = 0; h < firstRow.length; h++) {
            var cellStr = String(firstRow[h] || "").toLowerCase();
            if (cellStr.indexOf("venda") !== -1 || cellStr.indexOf("produto") !== -1 || cellStr.indexOf("preço") !== -1 || cellStr.indexOf("preco") !== -1 || cellStr.indexOf("data") !== -1) {
              hasHeaders = true;
              break;
            }
          }
          
          var idxSaleId = -1;
          var idxProdId = -1;
          var idxProdName = -1;
          var idxQty = -1;
          var idxPrice = -1;
          var idxDate = -1;
          var idxFee = -1;
          var idxShip = -1;
          var idxShipRevenue = -1;
          var idxPur = -1;
          var idxGross = -1;
          var idxNet = -1;
          var idxDisc = -1;
          var idxStatus = -1;
          var idxComp = -1;
          var idxMlSaleId = -1;
          var idxBuyerName = -1;
          var idxLossAmount = -1;
          var idxLossReason = -1;
          var idxShippingType = -1;
          var idxIsCustomSale = -1;
          var idxCustomMlFee = -1;
          var idxCustomShippingCost = -1;
          
          var startIndex = 1;
          if (hasHeaders) {
            var headers = firstRow;
            idxSaleId = headers.indexOf("ID Venda");
            if (idxSaleId === -1) idxSaleId = headers.indexOf("ID de Venda");
            if (idxSaleId === -1) idxSaleId = 0;
            
            idxProdId = headers.indexOf("SKU Produto");
            if (idxProdId === -1) idxProdId = headers.indexOf("ID Produto");
            
            idxProdName = headers.indexOf("Nome Produto");
            if (idxProdName === -1) idxProdName = headers.indexOf("Produto");
            if (idxProdName === -1) idxProdName = headers.indexOf("Título do Anúncio");
            if (idxProdName === -1) idxProdName = 1;
            
            idxQty = headers.indexOf("Quantidade");
            if (idxQty === -1) idxQty = 2;
            
            idxPrice = headers.indexOf("Preço Venda");
            if (idxPrice === -1) idxPrice = headers.indexOf("Preço de Venda");
            if (idxPrice === -1) idxPrice = 3;
            
            idxDate = headers.indexOf("Data");
            if (idxDate === -1) idxDate = 4;
            
            idxFee = headers.indexOf("Taxa ML");
            if (idxFee === -1) idxFee = headers.indexOf("Tarifa de Venda");
            if (idxFee === -1) idxFee = 5;
            
            idxShip = headers.indexOf("Custo Frete");
            if (idxShip === -1) idxShip = headers.indexOf("Tarifa de Envio");
            if (idxShip === -1) idxShip = 6;
            
            idxShipRevenue = headers.indexOf("Receita por Envio");
            if (idxShipRevenue === -1) idxShipRevenue = 7;
            
            idxPur = headers.indexOf("Preço Compra");
            if (idxPur === -1) idxPur = headers.indexOf("Preço de Compra");
            if (idxPur === -1) idxPur = 8;
            
            idxGross = headers.indexOf("Lucro Bruto");
            if (idxGross === -1) idxGross = 9;
            
            idxNet = headers.indexOf("Lucro Líquido");
            if (idxNet === -1) idxNet = headers.indexOf("Lucro Líquido Real");
            if (idxNet === -1) idxNet = 11;
            
            idxDisc = headers.indexOf("Desconto");
            idxStatus = headers.indexOf("Status");
            idxComp = headers.indexOf("Tempo Conclusão");
            idxMlSaleId = headers.indexOf("ID Venda Mercado Livre");
            idxBuyerName = headers.indexOf("Nome do Cliente");
            idxLossAmount = headers.indexOf("Prejuízo Extra");
            idxLossReason = headers.indexOf("Motivo Prejuízo");
            idxShippingType = headers.indexOf("Tipo de Frete");
            idxIsCustomSale = headers.indexOf("Venda Customizada");
            idxCustomMlFee = headers.indexOf("Comissão Customizada");
            idxCustomShippingCost = headers.indexOf("Frete Customizado");
            var idxAdIdSale = headers.indexOf("# de Anúncio");
            if (idxAdIdSale === -1) idxAdIdSale = headers.indexOf("# de anúncio");
            if (idxAdIdSale === -1) idxAdIdSale = headers.indexOf("ID Anúncio");
            if (idxAdIdSale === -1) idxAdIdSale = headers.indexOf("Anúncio");
            var idxSkuSale = headers.indexOf("SKU");
            if (idxSkuSale === -1) idxSkuSale = headers.indexOf("SKU Produto");
            startIndex = 1;
          } else {
            // Planilha sem linha de cabeçalho: dados começam direto na linha 0 (Linha 1 do Sheets)
            startIndex = 0;
            idxSaleId = 0;
            idxProdName = 1;
            idxQty = 2;
            idxPrice = 3;
            idxDate = 4;
            idxFee = 5;
            idxShip = 6;
            idxShipRevenue = 7;
            idxPur = 8;
            idxGross = 9;
            idxNet = 11; // Coluna L (ou 10 se K)
            idxStatus = 14;
            idxBuyerName = 17;
            idxShippingType = 20;
            var idxAdIdSale = 24;
            var idxSkuSale = 25;
          }
          
          for (var i = startIndex; i < salesData.length; i++) {
            var row = salesData[i];
            if (!row || row.length === 0) continue;
            var saleIdRaw = row[idxSaleId] !== undefined ? String(row[idxSaleId]).trim() : "";
            if (!saleIdRaw) continue;
            
            var dateStr = formatSheetDate(row[idxDate]);
            
            var rawStatus = idxStatus !== -1 && row[idxStatus] !== undefined ? String(row[idxStatus]).trim() : "";
            var normalizedStatus = "pending";
            if (sheetName === "Vendas Finalizadas") {
              normalizedStatus = "completed";
            } else if (sheetName === "Dados e Vendas Desprezadas") {
              normalizedStatus = "ignored";
            } else {
              var sLower = rawStatus.toLowerCase();
              if (sLower.indexOf("conclu") !== -1 || sLower.indexOf("libera") !== -1 || sLower.indexOf("finaliz") !== -1 || sLower === "completed") {
                normalizedStatus = "completed";
              } else if (sLower.indexOf("estorn") !== -1 || sLower.indexOf("cancel") !== -1 || sLower === "refunded") {
                normalizedStatus = "refunded";
              } else if (sLower.indexOf("ignor") !== -1 || sLower.indexOf("desprez") !== -1 || sLower === "ignored") {
                normalizedStatus = "ignored";
              } else {
                normalizedStatus = "pending";
              }
            }
            
            var qtyVal = sanitizeNumber(row[idxQty]) || 1;
            var salePriceVal = sanitizeNumber(row[idxPrice]);
            var mlFeeVal = idxFee !== -1 ? sanitizeNumber(row[idxFee]) : 0;
            var shipCostVal = idxShip !== -1 ? sanitizeNumber(row[idxShip]) : 0;
            var shipRevVal = idxShipRevenue !== -1 ? sanitizeNumber(row[idxShipRevenue]) : 0;
            var purchasePriceVal = idxPur !== -1 ? sanitizeNumber(row[idxPur]) : 0;
            var grossProfitVal = idxGross !== -1 ? sanitizeNumber(row[idxGross]) : ((salePriceVal * qtyVal) - (purchasePriceVal * qtyVal));
            
            // Fórmula do Manual POP: A Receber = Preço Venda - Taxa ML - Custo Frete + Receita Envio
            // Lucro Líquido Real = A Receber - Custo Compra - Imposto (4%)
            var aReceberCalc = (salePriceVal * qtyVal) - mlFeeVal - shipCostVal + shipRevVal;
            var taxCalc = (salePriceVal * qtyVal) * 0.04;
            var netProfitCalc = aReceberCalc - (purchasePriceVal * qtyVal) - taxCalc;
            
            var rawNetProfit = idxNet !== -1 ? sanitizeNumber(row[idxNet]) : 0;
            var finalNetProfit = (rawNetProfit !== 0 && !isNaN(rawNetProfit)) ? rawNetProfit : netProfitCalc;
            
            sales.push({
              id: saleIdRaw,
              productId: idxProdId !== -1 && row[idxProdId] ? String(row[idxProdId]) : "unknown",
              productName: idxProdName !== -1 && row[idxProdName] ? String(row[idxProdName]) : "Produto",
              quantity: qtyVal,
              salePrice: salePriceVal,
              date: dateStr || new Date().toISOString().split('T')[0],
              mlFee: mlFeeVal,
              shippingCost: shipCostVal,
              shippingRevenue: shipRevVal,
              purchasePrice: purchasePriceVal,
              grossProfit: grossProfitVal,
              netProfit: finalNetProfit,
              discount: idxDisc !== -1 ? sanitizeNumber(row[idxDisc]) : 0,
              status: normalizedStatus,
              completionTime: idxComp !== -1 ? (row[idxComp] !== "" ? sanitizeNumber(row[idxComp]) : undefined) : undefined,
              mlSaleId: idxMlSaleId !== -1 ? (String(row[idxMlSaleId]) || undefined) : undefined,
              buyerName: idxBuyerName !== -1 ? (String(row[idxBuyerName]) || undefined) : undefined,
              lossAmount: idxLossAmount !== -1 ? (sanitizeNumber(row[idxLossAmount]) || undefined) : undefined,
              lossReason: idxLossReason !== -1 ? (String(row[idxLossReason]) || undefined) : undefined,
              shippingType: idxShippingType !== -1 ? (String(row[idxShippingType]) || undefined) : undefined,
              isCustomSale: idxIsCustomSale !== -1 ? (row[idxIsCustomSale] === "Sim" ? true : false) : undefined,
              customMlFee: idxCustomMlFee !== -1 ? (sanitizeNumber(row[idxCustomMlFee]) || undefined) : undefined,
              customShippingCost: idxCustomShippingCost !== -1 ? (sanitizeNumber(row[idxCustomShippingCost]) || undefined) : undefined,
              adId: idxAdIdSale !== -1 && row[idxAdIdSale] ? String(row[idxAdIdSale]).trim() : undefined,
              sku: idxSkuSale !== -1 && row[idxSkuSale] ? String(row[idxSkuSale]).trim() : undefined
            });
          }
        }
      }
    });

    // 3. Ler Configurações (Aporte / Capital Inicial)
    var initialCapital = 500;
    var hasConfigSheet = false;
    var configSheet = ss.getSheetByName("Config");
    if (configSheet) {
      hasConfigSheet = true;
      var configData = configSheet.getDataRange().getValues();
      for (var i = 1; i < configData.length; i++) {
        if (configData[i][0] === "Aporte") {
          initialCapital = sanitizeNumber(configData[i][1]) || 500;
          break;
        }
      }
    }

    // 4. Ler Importações Mercado Livre (Aba 'Importe Mercado Livre' requisitada no vídeo)
    var mlRecords = [];
    var mlSheet = ss.getSheetByName("Importe Mercado Livre");
    if (mlSheet) {
      var mlData = mlSheet.getDataRange().getValues();
      if (mlData.length > 1) {
        var headers = mlData[0];
        var idxId = headers.indexOf("N.º de venda");
        var idxDate = headers.indexOf("Data da venda");
        var idxStatus = headers.indexOf("Estado");
        var idxStatusDesc = headers.indexOf("Descrição do status");
        var idxMulti = headers.indexOf("Pacote de diversos produtos");
        var idxKit = headers.indexOf("Pertence a um kit");
        var idxUnits = headers.indexOf("Unidades");
        var idxProductRevenue = headers.indexOf("Receita por produtos (BRL)");
        var idxSurcharge = headers.indexOf("Receita por acréscimo no preço (pago pelo comprador)");
        var idxInstallment = headers.indexOf("Taxa de parcelamento equivalente ao acréscimo");
        var idxSaleFee = headers.indexOf("Tarifa de venda e impostos (BRL)");
        var idxShipRevenue = headers.indexOf("Receita por envio (BRL)");
        var idxShipFee = headers.indexOf("Tarifas de envio (BRL)");
        var idxWeightCost = headers.indexOf("Custo de envio com base nas medidas e peso declarados");
        var idxDiffCost = headers.indexOf("Custo por diferenças nas medidas e no peso do pacote");
        var idxDiscount = headers.indexOf("Descontos e bônus");
        var idxRefund = headers.indexOf("Cancelamentos e reembolsos (BRL)");
        var idxTotal = headers.indexOf("Total (BRL)");
        var idxBillingMonth = headers.indexOf("Mês de faturamento das suas tarifas");
        var idxAdSale = headers.indexOf("Venda por publicidade");
        var idxSku = headers.indexOf("SKU");
        var idxAdId = headers.indexOf("# de anúncio");
        var idxAdTitle = headers.indexOf("Título do anúncio");
        var idxVariation = headers.indexOf("Variação");
        var idxUnitPrice = headers.indexOf("Preço unitário de venda do anúncio (BRL)");
        var idxAdType = headers.indexOf("Tipo de anúncio");
        var idxInvoice = headers.indexOf("NF-e em anexo");
        var idxBuyerName = headers.indexOf("Dados pessoais ou da empresa");
        var idxBuyerDoc = headers.indexOf("Tipo e número do documento");
        var idxAddress = headers.indexOf("Endereço");
        var idxShipMethod = headers.indexOf("Forma de entrega");
        var idxDateGo = headers.indexOf("Data a caminho");
        var idxDateDel = headers.indexOf("Data de entrega");
        var idxCarrier = headers.indexOf("Transportador");
        var idxTrackNum = headers.indexOf("Número de rastreamento");
        var idxTrackUrl = headers.indexOf("URL de acompanhamento");
        var idxClaimOpen = headers.indexOf("Reclamação aberta");
        var idxClaimClose = headers.indexOf("Reclamação encerrada");
        var idxMediation = headers.indexOf("Em mediação");

        for (var i = 1; i < mlData.length; i++) {
          var row = mlData[i];
          if (!row[idxId !== -1 ? idxId : 0]) continue;

          var rawAdTitle = idxAdTitle !== -1 ? String(row[idxAdTitle] || "").trim() : "";
          var rawSkuVal = idxSku !== -1 ? String(row[idxSku] || "").trim() : "";
          if (rawAdTitle === "Sim" || rawAdTitle === "Não" || rawAdTitle === "nao" || rawAdTitle === "true" || rawAdTitle === "false") {
            rawAdTitle = "";
          }
          if (!rawAdTitle && rawSkuVal && rawSkuVal.length > 3 && rawSkuVal !== "Sim" && rawSkuVal !== "Não") {
            rawAdTitle = rawSkuVal;
          }
          if (!rawAdTitle) {
            for (var col = 0; col < row.length; col++) {
              var cVal = String(row[col] || "").trim();
              var cValLower = cVal.toLowerCase();
              if (cVal.length > 5 && cValLower !== "sim" && cValLower !== "não" && cValLower !== "nao" &&
                  cValLower.indexOf("mercado envios") === -1 && cValLower.indexOf("clássico") === -1 && cValLower.indexOf("classico") === -1 &&
                  cValLower.indexOf("premium") === -1 && cValLower.indexOf("chegou") === -1 && cValLower.indexOf("entregue") === -1 &&
                  !/^[0-9]+$/.test(cVal) && cVal.indexOf("R$") === -1 && cVal.indexOf("http") === -1) {
                rawAdTitle = cVal;
                break;
              }
            }
          }
          
          mlRecords.push({
            id: idxId !== -1 ? String(row[idxId]) : "",
            dateStr: idxDate !== -1 ? String(row[idxDate]) : "",
            status: idxStatus !== -1 ? String(row[idxStatus]) : "",
            statusDescription: idxStatusDesc !== -1 ? String(row[idxStatusDesc]) : "",
            multiProduct: idxMulti !== -1 ? (row[idxMulti] === "Sim") : false,
            isKit: idxKit !== -1 ? (row[idxKit] === "Sim") : false,
            units: idxUnits !== -1 ? sanitizeNumber(row[idxUnits]) : 1,
            productRevenue: idxProductRevenue !== -1 ? sanitizeNumber(row[idxProductRevenue]) : 0,
            surchargeRevenue: idxSurcharge !== -1 ? sanitizeNumber(row[idxSurcharge]) : 0,
            installmentFee: idxInstallment !== -1 ? sanitizeNumber(row[idxInstallment]) : 0,
            saleFeeAndTaxes: idxSaleFee !== -1 ? sanitizeNumber(row[idxSaleFee]) : 0,
            shippingRevenue: idxShipRevenue !== -1 ? sanitizeNumber(row[idxShipRevenue]) : 0,
            shippingFee: idxShipFee !== -1 ? sanitizeNumber(row[idxShipFee]) : 0,
            shippingWeightCost: idxWeightCost !== -1 ? sanitizeNumber(row[idxWeightCost]) : 0,
            shippingDiffCost: idxDiffCost !== -1 ? sanitizeNumber(row[idxDiffCost]) : 0,
            discountsAndBonuses: idxDiscount !== -1 ? sanitizeNumber(row[idxDiscount]) : 0,
            refundsAndCancellations: idxRefund !== -1 ? sanitizeNumber(row[idxRefund]) : 0,
            totalBrl: idxTotal !== -1 ? sanitizeNumber(row[idxTotal]) : 0,
            billingMonth: idxBillingMonth !== -1 ? String(row[idxBillingMonth]) : "",
            isAdSale: idxAdSale !== -1 ? (row[idxAdSale] === "Sim") : false,
            adId: idxAdId !== -1 ? String(row[idxAdId]) : "",
            adTitle: rawAdTitle,
            variation: idxVariation !== -1 ? String(row[idxVariation]) : "",
            adUnitPrice: idxUnitPrice !== -1 ? sanitizeNumber(row[idxUnitPrice]) : 0,
            adType: idxAdType !== -1 ? String(row[idxAdType]) : "",
            invoiceStatus: idxInvoice !== -1 ? String(row[idxInvoice]) : "",
            buyerName: idxBuyerName !== -1 ? String(row[idxBuyerName]) : "",
            buyerDocument: idxBuyerDoc !== -1 ? String(row[idxBuyerDoc]) : "",
            buyerAddress: idxAddress !== -1 ? String(row[idxAddress]) : "",
            shippingMethod: idxShipMethod !== -1 ? String(row[idxShipMethod]) : "",
            shippingDateGo: idxDateGo !== -1 ? String(row[idxDateGo]) : "",
            shippingDateDelivery: idxDateDel !== -1 ? String(row[idxDateDel]) : "",
            carrier: idxCarrier !== -1 ? String(row[idxCarrier]) : "",
            trackingNumber: idxTrackNum !== -1 ? String(row[idxTrackNum]) : "",
            trackingUrl: idxTrackUrl !== -1 ? String(row[idxTrackUrl]) : "",
            isClaimOpen: idxClaimOpen !== -1 ? (row[idxClaimOpen] === "Sim") : false,
            isClaimClosed: idxClaimClose !== -1 ? (row[idxClaimClose] === "Sim") : false,
            isInMediation: idxMediation !== -1 ? (row[idxMediation] === "Sim") : false,
            sku: idxSku !== -1 ? String(row[idxSku]) : ""
          });
        }
      }
    }
    
    // 5. Ler Aba "Entrada de Valores" (Relatório de Liberações / Conciliação Financeira)
    var entradaRecords = [];
    var entradaSheet = ss.getSheetByName("Entrada de Valores");
    if (entradaSheet) {
      var entradaData = entradaSheet.getDataRange().getValues();
      if (entradaData.length > 1) {
        var eHeaders = entradaData[0];
        var eIdxId = -1;
        var eIdxDate = -1;
        var eIdxDesc = -1;
        var eIdxTipoOp = -1;
        var eIdxOpStatus = -1;
        var eIdxProd = -1;
        
        for (var eh = 0; eh < eHeaders.length; eh++) {
          var hName = normalizeNameScript(eHeaders[eh]);
          if (hName.indexOf("tipo de operacao") !== -1 || hName.indexOf("tipo operacao") !== -1 || (hName.indexOf("tipo") !== -1 && hName.indexOf("item") === -1 && hName.indexOf("documento") === -1)) {
            if (eIdxTipoOp === -1) eIdxTipoOp = eh;
          }
          if (hName.indexOf("status da operacao") !== -1 || hName.indexOf("status operacao") !== -1 || hName.indexOf("estado da operacao") !== -1 || (hName.indexOf("status") !== -1 && hName.indexOf("liberacao") === -1)) {
            if (eIdxOpStatus === -1) eIdxOpStatus = eh;
          }
          if (hName.indexOf("numero da operacao") !== -1 || hName.indexOf("numero de operacao") !== -1 || hName.indexOf("numero de envio") !== -1 || hName.indexOf("venda") !== -1 || hName.indexOf("pacote") !== -1) {
            if (eIdxId === -1) eIdxId = eh;
          }
          if (hName.indexOf("data da operacao") !== -1 || hName.indexOf("data da liberacao") !== -1 || hName.indexOf("data") !== -1) {
            if (eIdxDate === -1) eIdxDate = eh;
          }
          if (hName.indexOf("desc") !== -1 || hName.indexOf("recebimento") !== -1) {
            if (eIdxDesc === -1) eIdxDesc = eh;
          }
          if (hName.indexOf("item") !== -1 || hName.indexOf("produto") !== -1 || hName.indexOf("titulo") !== -1 || hName.indexOf("vinculado") !== -1) {
            if (eIdxProd === -1 && hName.indexOf("id") === -1) eIdxProd = eh;
          }
        }
        
        // Se os índices não foram identificados pelo cabeçalho, usar índices padrão da planilha MP (C=2, E=4, F=5, H=7)
        if (eIdxTipoOp === -1 && eHeaders.length > 2) eIdxTipoOp = 2;
        if (eIdxId === -1 && eHeaders.length > 4) eIdxId = 4;
        if (eIdxOpStatus === -1 && eHeaders.length > 5) eIdxOpStatus = 5;
        if (eIdxProd === -1 && eHeaders.length > 7) eIdxProd = 7;
        
        for (var er = 1; er < entradaData.length; er++) {
          var eRow = entradaData[er];
          if (!eRow || eRow.length === 0) continue;
          
          var rawEId = "";
          if (eIdxId !== -1 && eRow[eIdxId]) {
            rawEId = String(eRow[eIdxId]).trim();
          } else if (eRow.length > 4 && eRow[4]) {
            rawEId = String(eRow[4]).trim();
          }
          
          if (!rawEId) {
            for (var c = 0; c < eRow.length; c++) {
              var cVal = String(eRow[c] || "").trim();
              if (/^[0-9]{10,20}$/.test(cVal)) {
                rawEId = cVal;
                break;
              }
            }
          }
          if (!rawEId) continue;
          
          var tipoOp = eIdxTipoOp !== -1 && eRow[eIdxTipoOp] ? String(eRow[eIdxTipoOp]).trim() : (eRow.length > 2 && eRow[2] ? String(eRow[2]).trim() : "Liberação");
          var opStatus = eIdxOpStatus !== -1 && eRow[eIdxOpStatus] ? String(eRow[eIdxOpStatus]).trim() : (eRow.length > 5 && eRow[5] ? String(eRow[5]).trim() : "Pago");
          
          var tipoOpNorm = normalizeNameScript(tipoOp);
          var opStatusNorm = normalizeNameScript(opStatus);
          
          // REGRA DE OURO 1: Tipo de operação DEVE ser "Liberação" (descarta saques, cashback, estornos avulsos)
          if (tipoOpNorm && tipoOpNorm.indexOf("libera") === -1 && tipoOpNorm.indexOf("dispon") === -1) {
            continue;
          }
          
          // REGRA DE OURO 2: Status da operação (Coluna F) DEVE ser "Pago"!
          // Se for "Cancelado", a venda não aconteceu e é descartada do cruzamento de liberação
          if (opStatusNorm) {
            if (opStatusNorm.indexOf("cancelad") !== -1 || opStatusNorm.indexOf("estorn") !== -1 || opStatusNorm.indexOf("devol") !== -1) {
              continue;
            }
            if (opStatusNorm !== "pago" && opStatusNorm !== "paga" && opStatusNorm !== "paid" && opStatusNorm !== "concluido" && opStatusNorm !== "aprovado") {
              continue;
            }
          }
          
          var prodName = eIdxProd !== -1 && eRow[eIdxProd] ? String(eRow[eIdxProd]).trim() : (eRow.length > 7 && eRow[7] ? String(eRow[7]).trim() : "Item Mercado Livre");
          
          entradaRecords.push({
            id: cleanMlSaleId(rawEId) || rawEId,
            dateStr: eIdxDate !== -1 ? formatSheetDate(eRow[eIdxDate]) : "",
            description: "Liberação",
            releaseStatus: tipoOp || "Liberação",
            operationStatus: opStatus || "Pago",
            productName: prodName
          });
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      products: products,
      sales: sales,
      initialCapital: initialCapital,
      hasConfigSheet: hasConfigSheet,
      mlRecords: mlRecords,
      entradaRecords: entradaRecords
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
  initialCapital,
  mlRecords,
  entradaRecords,
  entradaRawMatrix
}: SheetsIntegrationProps) {
  const [copied, setCopied] = useState<'headers' | 'script' | null>(null);
  const [inputUrl, setInputUrl] = useState(spreadsheetUrl);
  const [inputWebAppUrl, setInputWebAppUrl] = useState(webAppUrl);

  useEffect(() => {
    setInputWebAppUrl(webAppUrl);
  }, [webAppUrl]);
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [syncResult, setSyncResult] = useState<{ status: 'success' | 'error' | null; message: string }>({
    status: null,
    message: ''
  });

  const IDEAL_COLUMNS = [
    
    { title: 'A: Nome Produto', desc: 'Nome visível do produto', example: 'Fone Bluetooth SoundPRO X' },
    { title: 'B: SKU / Código de Estoque', desc: 'Código de controle de estoque', example: 'ML-FONE-BT-001' },
    { title: 'C: Preço de Compra (R$)', desc: 'Custo de aquisição do item', example: '45.00' },
    { title: 'D: Preço de Venda (R$)', desc: 'Preço de listagem no Mercado Livre', example: '129.90' },
    { title: 'E: Diferença (R$)', desc: 'Preço de Venda menos Preço de Compra', example: '84.90' },
    { title: 'G: Tipo Anúncio ML', desc: 'Formato da taxa de comissão: classic ou premium', example: 'premium' },
    { title: 'H: Taxa Mercado Livre (R$)', desc: 'Imposto operacional calculado p/ unidade', example: '22.09' },
    { title: 'I: Frete Estimado (R$)', desc: 'Custo pago pelo vendedor no frete grátis', example: '0.00' },
    { title: 'J: Estoque disponível', desc: 'Quantidade de itens atual no estoque', example: '24' },
    { title: 'K: Tempo parado no estoque', desc: 'Dias desde a entrada até hoje', example: '38' },
  ];

  // Copiar Cabeçalhos para o Teclado
  const handleCopyHeaders = () => {
    const headers = 'SKU\tNome Produto\tSKU\tPreço de Compra\tPreço de Venda\tDiferença\tTipo Anuncio ML\tTaxa ML\tFrete Estimado\tEstoque\tTempo parado em estoque';
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
        body: JSON.stringify({ webAppUrl, products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix })
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
    const headers = ['SKU', 'Nome Produto', 'SKU', 'Preco de Compra', 'Preco de Venda', 'Diferenca', 'Tipo Anuncio ML', 'Taxa ML', 'Frete Estimado', 'Estoque Inicial', 'Estoque Atual', 'Dias Parados'];
    
    const rows = products.map(p => {
      const diff = p.salePrice - p.purchasePrice;
      const mlFee = p.salePrice * (p.mlFeeType === 'premium' ? 0.17 : p.mlFeeType === 'classic' ? 0.12 : 0);
      const days = Math.round((new Date().getTime() - new Date(p.addedDate).getTime()) / (1000 * 3600 * 24));
      const currentStock = sales ? calculateCurrentStock(p, sales, products) : p.stock;
      
      return [
        
        `"${p.name.replace(/"/g, '""')}"`,
        p.sku,
        p.purchasePrice.toFixed(2),
        p.salePrice.toFixed(2),
        diff.toFixed(2),
        p.mlFeeType,
        mlFee.toFixed(2),
        p.shippingCost.toFixed(2),
        p.stock.toString(),
        currentStock.toString(),
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
      
      {/* Banner de Aviso de Atualização Obrigatória do Apps Script */}
      <div className="bg-[#FFE600]/10 border-2 border-[#FFE600] rounded-2xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-3 text-[#FFE600]">
          <AlertCircle className="w-6 h-6 animate-pulse" />
          <h4 className="text-sm font-black uppercase tracking-wider">Nova Aba Adicionada: "Entrada de Valores" &amp; Database ⚠️</h4>
        </div>
        <p className="text-xs text-white/90 leading-relaxed font-medium">
          A aba dedicada <strong className="text-[#FFE600]">"Entrada de Valores"</strong> foi integrada ao código do Google Apps Script para receber relatórios de liberações financeiras do Mercado Pago/Mercado Livre, junto com as abas <strong>Database</strong>, <strong>Importe Mercado Livre</strong>, <strong>Produtos</strong> e <strong>Vendas</strong>.
        </p>
        <div className="text-xs text-white/70 space-y-1 bg-black/40 p-3.5 rounded-xl border border-white/5">
          <p className="font-bold text-white mb-1">Como criar/atualizar todas as abas na sua planilha:</p>
          <p>1. Copie o código atualizado no <strong>Passo 3 (Painel Direito)</strong>.</p>
          <p>2. No seu Google Sheets, clique em <strong>Extensões &gt; Apps Script</strong>.</p>
          <p>3. Cole o código atualizado e clique em salvar 💾.</p>
          <p>4. Em <strong>Implantar &gt; Gerenciar implantações &gt; Editar &gt; Nova versão</strong>, clique em <strong>Implantar</strong>.</p>
          <p>5. Clique no botão amarelo <strong>"Exportar p/ Planilha 🚀"</strong> abaixo e a aba <strong>Entrada de Valores</strong> será criada automaticamente na sua planilha!</p>
        </div>
      </div>

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
              
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                let trimmed = inputWebAppUrl.trim();
                if (trimmed && !trimmed.endsWith('/exec') && trimmed.includes('/macros/s/')) {
                  trimmed = trimmed.replace(/\/edit.*$/, '').replace(/\/view.*$/, '').replace(/\/dev.*$/, '') + (trimmed.endsWith('/') ? 'exec' : '/exec');
                }
                setInputWebAppUrl(trimmed);
                onUpdateWebAppUrl(trimmed); 
              }} className="space-y-3">
                <input
                  type="url"
                  required
                  value={inputWebAppUrl}
                  onChange={(e) => setInputWebAppUrl(e.target.value)}
                  placeholder="Ex: https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full bg-white/5 border border-[#FFE600]/25 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono text-[#FFE600] placeholder-white/30"
                />
                {inputWebAppUrl && !inputWebAppUrl.includes('script.google.com') && (
                  <p className="text-[11px] text-amber-400 font-medium">
                    ⚠️ Atenção: Cole a URL do Web App gerada no Apps Script (começa com <span className="font-mono">https://script.google.com/macros/s/...</span>), e não o link da planilha.
                  </p>
                )}
                {inputWebAppUrl && inputWebAppUrl.includes('script.google.com') && !inputWebAppUrl.endsWith('/exec') && (
                  <p className="text-[11px] text-amber-400 font-medium">
                    💡 Dica: A URL do Web App precisa terminar com <span className="font-mono font-bold">/exec</span>. Ao salvar, ela será ajustada automaticamente.
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer text-center shadow-[0_0_12px_rgba(255,230,0,0.1)] hover:shadow-[0_0_16px_rgba(255,230,0,0.2)]"
                >
                  Salvar Link do Web App
                </button>
              </form>
              
              <div className="space-y-3 pt-2">
                {webAppUrl && webAppUrl === inputWebAppUrl && (
                  <div className="p-3 bg-emerald-950/25 border border-emerald-500/15 rounded-xl text-xs text-emerald-400 font-bold flex items-center gap-2 animate-fade-in">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span>Link do Web App ativo e salvo na memória! 🔗</span>
                  </div>
                )}

                {inputWebAppUrl && inputWebAppUrl !== webAppUrl && (
                  <div className="p-3 bg-[#FFE600]/10 border border-[#FFE600]/20 rounded-xl text-xs text-[#FFE600] font-medium flex items-center gap-2 animate-pulse">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Atenção: Clique em "Salvar Link do Web App" para aplicar as alterações.</span>
                  </div>
                )}

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

              <div className="bg-[#FFE600]/10 border border-[#FFE600]/20 rounded-xl p-3 text-[11px] text-[#FFE600] leading-relaxed font-semibold mb-4 animate-pulse">
                ⚠️ <strong className="font-bold">ATUALIZAÇÃO DE SCRIPT ANTIGO:</strong> Se você já tinha o script configurado antes e quer apenas corrigi-lo, você <strong className="underline text-white">DEVE</strong> ir em <strong>Implantar &gt; Gerenciar implantações</strong>, clicar no ícone de <strong>Lápis (Editar)</strong>, e no campo <strong>Versão</strong> selecionar obrigatoriamente <strong className="underline text-white font-black">"Nova versão" (New version)</strong> antes de clicar em Implantar. Caso contrário, o Google continuará rodando a versão antiga com erro!
              </div>

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
