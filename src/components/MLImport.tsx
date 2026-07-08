/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { MLImportRecord, Product } from '../types';
import { formatCurrency, formatDate } from '../utils';
import { 
  Upload, 
  FileSpreadsheet, 
  HelpCircle, 
  Trash2, 
  Download, 
  Check, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Percent, 
  Truck, 
  AlertTriangle, 
  Clipboard, 
  Search, 
  SlidersHorizontal, 
  Tag, 
  MapPin, 
  Navigation,
  FileText,
  User,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

interface MLImportProps {
  products: Product[];
  mlRecords: MLImportRecord[];
  onImportRecords: (records: MLImportRecord[]) => void;
  onClearRecords: () => void;
  isSheetsConnected: boolean;
  onPushToCloud: () => void;
  isSyncing: boolean;
}

export default function MLImport({
  products,
  mlRecords,
  onImportRecords,
  onClearRecords,
  isSheetsConnected,
  onPushToCloud,
  isSyncing
}: MLImportProps) {
  const [pasteData, setPasteArea] = useState('');
  const [copiedScript, setCopiedScript] = useState(false);
  const [dragOver, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [adFilter, setAdFilter] = useState('todos');

  // Lógica de Parser Inteligente de Planilha (Ctrl+V ou CSV)
  const handleParse = (text: string): boolean => {
    setParseError(null);
    setImportSuccess(null);
    if (!text.trim()) {
      setParseError('Cole os dados ou insira um relatório válido.');
      return false;
    }

    try {
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      if (lines.length < 2) {
        setParseError('A tabela fornecida não possui dados suficientes ou está sem cabeçalhos.');
        return false;
      }

      // Detectar o delimitador (tabulação para planilhas coladas, ponto e vírgula ou vírgula para CSV)
      let delimiter = '\t';
      const firstLine = lines[0];
      if (firstLine.includes(';')) delimiter = ';';
      else if (firstLine.includes(',') && !firstLine.includes('\t')) delimiter = ',';

      // Parser inteligente para uma única linha de CSV respeitando aspas
      const parseCSVLine = (lineStr: string, delim: string): string[] => {
        const res: string[] = [];
        let curr = '';
        let inQuotes = false;
        for (let i = 0; i < lineStr.length; i++) {
          const char = lineStr[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === delim && !inQuotes) {
            res.push(curr.trim());
            curr = '';
          } else {
            curr += char;
          }
        }
        res.push(curr.trim());
        return res.map(cell => cell.replace(/^"|"$/g, '').trim());
      };

      // Extrair colunas
      const headers = parseCSVLine(firstLine, delimiter);
      
      // Mapear índices dos cabeçalhos por proximidade/palavras-chave
      const getIndex = (keywords: string[]) => {
        return headers.findIndex(h => 
          keywords.some(k => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")))
        );
      };

      const idxId = getIndex(['n.º de venda', 'n.º venda', 'nº de venda', 'id venda', 'id da venda', 'numero de venda']);
      const idxDate = getIndex(['data da venda', 'data venda', 'data original', 'data_venda']);
      const idxStatus = getIndex(['estado', 'status', 'situacao']);
      const idxStatusDesc = getIndex(['descricao do status', 'descricao status', 'detalhe do status']);
      const idxMulti = getIndex(['pacote de diversos produtos', 'multi_produto', 'diversos produtos']);
      const idxKit = getIndex(['pertence a um kit', 'e_kit', 'kit']);
      const idxUnits = getIndex(['unidades', 'quantidade', 'qtd']);
      const idxProductRevenue = getIndex(['receita por produtos', 'receita do produto', 'receita_produto', 'valor produto']);
      const idxSurcharge = getIndex(['receita por acrescimo', 'acrescimo no preco', 'acrescimo']);
      const idxInstallment = getIndex(['taxa de parcelamento', 'tarifa parcelamento', 'custo parcelamento']);
      const idxSaleFee = getIndex(['tarifa de venda', 'comissao', 'tarifas de venda']);
      const idxShipRevenue = getIndex(['receita por envio', 'receita envio', 'frete comprador']);
      const idxShipFee = getIndex(['tarifas de envio', 'tarifa de envio', 'custo frete ml', 'frete cobrado']);
      const idxWeightCost = getIndex(['custo de envio com base', 'custo por peso', 'medidas e peso']);
      const idxDiffCost = getIndex(['custo por diferencas', 'diferenca de frete', 'diferenca peso']);
      const idxDiscount = getIndex(['descontos e bonus', 'descontos', 'bonus', 'desconto no frete', 'desconto no frete modificado pelo comprador']);
      const idxRefund = getIndex(['cancelamentos e reembolsos', 'reembolsos', 'estorno']);
      const idxTotal = getIndex(['total (brl)', 'total brl', 'total', 'liquido ml']);
      const idxBillingMonth = getIndex(['mes de faturamento', 'mes faturamento', 'mes_tarifas']);
      const idxAdSale = getIndex(['venda por publicidade', 'publicidade', 'ads', 'ads_venda']);
      const idxAdId = getIndex(['# de anuncio', 'id anuncio', 'id_anuncio', 'numero de anuncio']);
      const idxAdTitle = getIndex(['titulo do anuncio', 'titulo anuncio', 'nome do anuncio']);
      const idxVariation = getIndex(['variacao', 'cor', 'tamanho']);
      const idxUnitPrice = getIndex(['preco unitario', 'valor unitario', 'preco unitario de venda']);
      const idxAdType = getIndex(['tipo de anuncio', 'tipo anuncio', 'tipo_anuncio']);
      const idxInvoice = getIndex(['nf-e', 'nota fiscal', 'nfe']);
      const idxBuyerName = getIndex(['dados pessoais', 'comprador', 'nome do comprador', 'cliente']);
      const idxBuyerDoc = getIndex(['documento', 'cpf', 'cnpj', 'tipo e numero do documento']);
      const idxAddress = getIndex(['endereco', 'rua', 'cep']);
      const idxShipMethod = getIndex(['forma de entrega', 'metodo de entrega', 'tipo de envio']);
      const idxDateGo = getIndex(['data a caminho', 'data_caminho']);
      const idxDateDel = getIndex(['data de entrega', 'data_entrega']);
      const idxCarrier = getIndex(['transportador', 'transportadora', 'logistica']);
      const idxTrackNum = getIndex(['numero de rastreamento', 'codigo de rastreio', 'rastreamento']);
      const idxTrackUrl = getIndex(['url de acompanhamento', 'link de rastreio', 'url_rastreio']);
      const idxClaimOpen = getIndex(['reclamacao aberta', 'reclamacao_aberta']);
      const idxClaimClose = getIndex(['reclamacao encerrada', 'reclamacao_encerrada']);
      const idxMediation = getIndex(['em mediacao', 'mediacao']);

      // Validar se achamos pelo menos colunas básicas essenciais como ID ou Anúncio
      if (idxId === -1 && idxAdTitle === -1) {
        setParseError('Não conseguimos identificar os cabeçalhos das colunas Mercado Livre. Verifique se copiou a tabela inteira com os títulos.');
        return false;
      }

      const cleanNum = (val: string) => {
        if (!val) return 0;
        // Limpar pontos de milhar, trocar vírgula por ponto, remover R$ e espaços
        let clean = val.replace(/r\$\s?/i, '').trim();
        // Se contiver ponto e vírgula como separadores decimais (ex: 2.450,50 ou -2,47)
        if (clean.includes('.') && clean.includes(',')) {
          clean = clean.replace(/\./g, '').replace(',', '.');
        } else if (clean.includes(',')) {
          clean = clean.replace(',', '.');
        }
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
      };

      const cleanBool = (val: string) => {
        if (!val) return false;
        const v = val.toLowerCase().trim();
        return v === 'sim' || v === 'yes' || v === 'true' || v === '1' || v === 'autorizada';
      };

      const importedRecords: MLImportRecord[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i], delimiter);
        if (row.length < 2 || !row[idxId === -1 ? 0 : idxId]) continue;

        importedRecords.push({
          id: idxId !== -1 ? row[idxId] : `ml_v_${i}`,
          dateStr: idxDate !== -1 ? row[idxDate] : new Date().toLocaleDateString('pt-BR'),
          status: idxStatus !== -1 ? row[idxStatus] : 'Entregue',
          statusDescription: idxStatusDesc !== -1 ? row[idxStatusDesc] : 'Chegou',
          multiProduct: idxMulti !== -1 ? cleanBool(row[idxMulti]) : false,
          isKit: idxKit !== -1 ? cleanBool(row[idxKit]) : false,
          units: idxUnits !== -1 ? parseInt(row[idxUnits], 10) || 1 : 1,
          productRevenue: idxProductRevenue !== -1 ? cleanNum(row[idxProductRevenue]) : 0,
          surchargeRevenue: idxSurcharge !== -1 ? cleanNum(row[idxSurcharge]) : 0,
          installmentFee: idxInstallment !== -1 ? cleanNum(row[idxInstallment]) : 0,
          saleFeeAndTaxes: idxSaleFee !== -1 ? cleanNum(row[idxSaleFee]) : 0,
          shippingRevenue: idxShipRevenue !== -1 ? cleanNum(row[idxShipRevenue]) : 0,
          shippingFee: idxShipFee !== -1 ? cleanNum(row[idxShipFee]) : 0,
          shippingWeightCost: idxWeightCost !== -1 ? cleanNum(row[idxWeightCost]) : 0,
          shippingDiffCost: idxDiffCost !== -1 ? cleanNum(row[idxDiffCost]) : 0,
          discountsAndBonuses: idxDiscount !== -1 ? cleanNum(row[idxDiscount]) : 0,
          refundsAndCancellations: idxRefund !== -1 ? cleanNum(row[idxRefund]) : 0,
          totalBrl: idxTotal !== -1 ? cleanNum(row[idxTotal]) : 0,
          billingMonth: idxBillingMonth !== -1 ? row[idxBillingMonth] : 'N/A',
          isAdSale: idxAdSale !== -1 ? cleanBool(row[idxAdSale]) : false,
          adId: idxAdId !== -1 ? row[idxAdId] : '',
          adTitle: idxAdTitle !== -1 ? row[idxAdTitle] : 'Produto Mercado Livre',
          variation: idxVariation !== -1 ? row[idxVariation] : 'Padrão',
          adUnitPrice: idxUnitPrice !== -1 ? cleanNum(row[idxUnitPrice]) : 0,
          adType: idxAdType !== -1 ? row[idxAdType] : 'Clássico',
          invoiceStatus: idxInvoice !== -1 ? row[idxInvoice] : 'Não emitida',
          buyerName: idxBuyerName !== -1 ? row[idxBuyerName] : 'Comprador Anônimo',
          buyerDocument: idxBuyerDoc !== -1 ? row[idxBuyerDoc] : '',
          buyerAddress: idxAddress !== -1 ? row[idxAddress] : 'Endereço não disponível',
          shippingMethod: idxShipMethod !== -1 ? row[idxShipMethod] : 'Mercado Envios',
          shippingDateGo: idxDateGo !== -1 ? row[idxDateGo] : '',
          shippingDateDelivery: idxDateDel !== -1 ? row[idxDateDel] : '',
          carrier: idxCarrier !== -1 ? row[idxCarrier] : 'Mercado Envios',
          trackingNumber: idxTrackNum !== -1 ? row[idxTrackNum] : '',
          trackingUrl: idxTrackUrl !== -1 ? row[idxTrackUrl] : '',
          isClaimOpen: idxClaimOpen !== -1 ? cleanBool(row[idxClaimOpen]) : false,
          isClaimClosed: idxClaimClose !== -1 ? cleanBool(row[idxClaimClose]) : false,
          isInMediation: idxMediation !== -1 ? cleanBool(row[idxMediation]) : false
        });
      }

      if (importedRecords.length === 0) {
        setParseError('Nenhuma linha de venda válida foi identificada.');
        return false;
      }

      onImportRecords(importedRecords);
      setImportSuccess(`Sucesso! ${importedRecords.length} transações do Mercado Livre importadas e integradas com sucesso.`);
      setPasteArea('');
      return true;
    } catch (err: any) {
      console.error(err);
      setParseError(`Erro crítico no parser de planilha: ${err.message || err}`);
      return false;
    }
  };

  const handleFile = (file: File) => {
    setParseError(null);
    setImportSuccess(null);
    
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const csvText = XLSX.utils.sheet_to_csv(sheet);
          handleParse(csvText);
        } catch (err: any) {
          console.error(err);
          setParseError(`Erro ao processar planilha Excel: ${err.message || err}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // É um arquivo de texto (CSV/TXT). Vamos tentar ler como UTF-8 primeiro
      const readWithEncoding = (enc: string) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          const parsedSuccessfully = handleParse(text);
          if (!parsedSuccessfully && enc === 'UTF-8') {
            // Se falhou no UTF-8, tentar ler como ISO-8859-1 (Windows-1252)
            readWithEncoding('ISO-8859-1');
          }
        };
        reader.readAsText(file, enc);
      };
      
      readWithEncoding('UTF-8');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Consolidação de Métricas do Mercado Livre
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let totalSaleFee = 0;
    let totalShippingFee = 0;
    let totalAdSales = 0;
    let openClaims = 0;
    let refunds = 0;
    let adUnitsSold = 0;
    
    let totalFullSales = 0;
    let fullUnitsSold = 0;
    let totalCarrierSales = 0;
    let carrierUnitsSold = 0;
    let totalFlexSales = 0;
    let flexUnitsSold = 0;
    
    let totalProductCost = 0;

    mlRecords.forEach(r => {
      const isCanceled = r.status.toLowerCase().includes('cancelad') || r.status.toLowerCase().includes('devol');
      
      if (r.isClaimOpen) openClaims++;
      refunds += Math.abs(r.refundsAndCancellations);
      
      if (isCanceled) return;

      totalRevenue += (r.totalBrl - Math.abs(r.discountsAndBonuses));
      totalSaleFee += Math.abs(r.saleFeeAndTaxes); // Convertemos tarifa em custo positivo
      totalShippingFee += Math.abs(r.shippingFee) + Math.abs(r.shippingWeightCost) + Math.abs(r.shippingDiffCost);
      
      if (r.isAdSale) {
        totalAdSales += (r.totalBrl - Math.abs(r.discountsAndBonuses));
        adUnitsSold += r.units;
      }
      
      const methodLower = (r.shippingMethod || '').toLowerCase();
      const carrierLower = (r.carrier || '').toLowerCase();
      if (methodLower.includes('full') || carrierLower.includes('full')) {
        totalFullSales += (r.totalBrl - Math.abs(r.discountsAndBonuses));
        fullUnitsSold += r.units;
      } else if (methodLower.includes('flex') || carrierLower.includes('flex')) {
        totalFlexSales += (r.totalBrl - Math.abs(r.discountsAndBonuses));
        flexUnitsSold += r.units;
      } else {
        totalCarrierSales += (r.totalBrl - Math.abs(r.discountsAndBonuses));
        carrierUnitsSold += r.units;
      }
      
      // Encontrar produto correspondente no estoque para computar o custo real de aquisição
      let matchingProduct = products.find(p => {
        const adTitleLower = r.adTitle.toLowerCase();
        const pNameLower = p.name.toLowerCase();
        
        if (pNameLower.includes('20cm') || pNameLower.includes('20 cm')) {
          return adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto') || adTitleLower.includes('20c');
        }
        if (pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°')) {
          return adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('hrebos') || adTitleLower.includes('90graus');
        }
        return adTitleLower.includes(pNameLower) || pNameLower.includes(adTitleLower);
      });
      
      if (!matchingProduct && products.length > 0) {
        matchingProduct = products[0];
      }
      
      if (matchingProduct) {
        totalProductCost += matchingProduct.purchasePrice * r.units;
      }
    });

    const netProfitML = totalRevenue - totalSaleFee - totalShippingFee - refunds;
    // Lucro Líquido Previsto (deduzindo também o custo de compra do produto do estoque!)
    const predictedNetProfit = netProfitML - totalProductCost;

    return {
      totalRevenue,
      totalSaleFee,
      totalShippingFee,
      totalAdSales,
      adUnitsSold,
      openClaims,
      refunds,
      netProfitML,
      predictedNetProfit,
      totalFullSales,
      fullUnitsSold,
      totalCarrierSales,
      carrierUnitsSold,
      totalFlexSales,
      flexUnitsSold,
      claimRate: mlRecords.length > 0 ? (openClaims / mlRecords.length) * 100 : 0
    };
  }, [mlRecords, products]);

  // Gráficos Diários de Faturamento ML
  const dailyChartData = useMemo(() => {
    const dailyMap: { [key: string]: { date: string; receita: number; tarifas: number; fretes: number } } = {};
    
    mlRecords.forEach(r => {
      // Extrair apenas o dia e mês da string (Ex: "6 de julho de 2026 20:02" -> "06/07")
      let dateKey = r.dateStr;
      if (r.dateStr.includes('de')) {
        const parts = r.dateStr.split(' ');
        if (parts.length >= 3) {
          const day = parts[0].padStart(2, '0');
          const monthStr = parts[2].toLowerCase();
          const monthMap: { [key: string]: string } = {
            janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
            julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
          };
          const month = monthMap[monthStr] || '07';
          dateKey = `${day}/${month}`;
        }
      } else if (r.dateStr.includes('-')) {
        const parts = r.dateStr.split('-');
        if (parts.length === 3) {
          dateKey = `${parts[2]}/${parts[1]}`;
        }
      }

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, receita: 0, tarifas: 0, fretes: 0 };
      }
      dailyMap[dateKey].receita += r.productRevenue;
      dailyMap[dateKey].tarifas += Math.abs(r.saleFeeAndTaxes);
      dailyMap[dateKey].fretes += Math.abs(r.shippingFee) + Math.abs(r.shippingWeightCost);
    });

    // Converter para array e ordenar pela data do mais antigo para o mais novo
    const arr = Object.values(dailyMap);
    arr.sort((a, b) => {
      const [dayA, monthA] = a.date.split('/');
      const [dayB, monthB] = b.date.split('/');
      const dateA = new Date(2026, parseInt(monthA || '1') - 1, parseInt(dayA || '1'));
      const dateB = new Date(2026, parseInt(monthB || '1') - 1, parseInt(dayB || '1'));
      return dateA.getTime() - dateB.getTime();
    });
    return arr.slice(-15); // Mostrar últimos 15 pontos de dados
  }, [mlRecords]);

  // Filtros e listagem de registros
  const filteredRecords = useMemo(() => {
    return mlRecords.filter(r => {
      const matchesSearch = 
        r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.adTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.buyerName && r.buyerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.adId && r.adId.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = 
        statusFilter === 'todos' ||
        (statusFilter === 'entregue' && r.status.toLowerCase().includes('entregue')) ||
        (statusFilter === 'caminho' && r.status.toLowerCase().includes('caminho')) ||
        (statusFilter === 'reclamacao' && r.isClaimOpen);

      const matchesAd = 
        adFilter === 'todos' ||
        (adFilter === 'publicidade' && r.isAdSale) ||
        (adFilter === 'normal' && !r.isAdSale);

      return matchesSearch && matchesStatus && matchesAd;
    });
  }, [mlRecords, searchQuery, statusFilter, adFilter]);

  // Lista única de anúncios para filtros ou estatísticas
  const topAds = useMemo(() => {
    const adMap: { [key: string]: { id: string; title: string; qty: number; total: number } } = {};
    mlRecords.forEach(r => {
      const isCanceled = r.status.toLowerCase().includes('cancelad') || r.status.toLowerCase().includes('devol');
      if (!r.adId || isCanceled) return;

      let matchingProduct = products.find(p => {
        const adTitleLower = r.adTitle.toLowerCase();
        const pNameLower = p.name.toLowerCase();
        if (pNameLower.includes('20cm') || pNameLower.includes('20 cm')) {
          return adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto');
        }
        if (pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°')) {
          return adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('hrebos');
        }
        return adTitleLower.includes(pNameLower) || pNameLower.includes(adTitleLower);
      });
      if (!matchingProduct && products.length > 0) {
        matchingProduct = products[0];
      }
      const productCost = matchingProduct ? (matchingProduct.purchasePrice * r.units) : 0;
      const rowNetProfit = (r.totalBrl - Math.abs(r.discountsAndBonuses)) - productCost;

      if (!adMap[r.adId]) {
        adMap[r.adId] = { id: r.adId, title: r.adTitle, qty: 0, total: 0 };
      }
      adMap[r.adId].qty += r.units;
      adMap[r.adId].total += rowNetProfit;
    });
    return Object.values(adMap).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [mlRecords, products]);

  // Mapa de Calor de faturamento por estado brasileiro
  const stateData = useMemo(() => {
    const stateMap: { [key: string]: { estado: string; total: number; vendas: number } } = {};
    
    // Lista completa de estados brasileiros para validação
    const estadosBr = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
      'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];
    
    mlRecords.forEach(r => {
      const isCanceled = r.status.toLowerCase().includes('cancelad') || r.status.toLowerCase().includes('devol');
      if (isCanceled) return;

      let matchingProduct = products.find(p => {
        const adTitleLower = r.adTitle.toLowerCase();
        const pNameLower = p.name.toLowerCase();
        if (pNameLower.includes('20cm') || pNameLower.includes('20 cm')) {
          return adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto');
        }
        if (pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°')) {
          return adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('hrebos');
        }
        return adTitleLower.includes(pNameLower) || pNameLower.includes(adTitleLower);
      });
      if (!matchingProduct && products.length > 0) {
        matchingProduct = products[0];
      }
      const productCost = matchingProduct ? (matchingProduct.purchasePrice * r.units) : 0;
      const rowNetProfit = (r.totalBrl - Math.abs(r.discountsAndBonuses)) - productCost;

      let detectedState = 'Outros';
      const address = (r.buyerAddress || '').toUpperCase();
      
      // Procurar sigla de estado cercada por delimitadores comuns
      for (const uf of estadosBr) {
        const regexUf = new RegExp(`\\b${uf}\\b`);
        if (regexUf.test(address)) {
          detectedState = uf;
          break;
        }
      }
      
      // Se não encontrou sigla, verificar nomes completos de estados sem acento
      if (detectedState === 'Outros') {
        const stateNames: { [key: string]: string } = {
          'SAO PAULO': 'SP', 'RIO DE JANEIRO': 'RJ', 'MINAS GERAIS': 'MG', 'BAHIA': 'BA',
          'PARANA': 'PR', 'RIO GRANDE DO SUL': 'RS', 'SANTA CATARINA': 'SC', 'PERNAMBUCO': 'PE',
          'CEARA': 'CE', 'PARÁ': 'PA', 'MARANHAO': 'MA', 'GOIAS': 'GO', 'AMAZONAS': 'AM',
          'ESPIRITO SANTO': 'ES', 'PARAIBA': 'PB', 'ALAGOAS': 'AL', 'PIAUI': 'PI',
          'RIO GRANDE DO NORTE': 'RN', 'MATO GROSSO': 'MT', 'MATO GROSSO DO SUL': 'MS',
          'SERGIPE': 'SE', 'RONDONIA': 'RO', 'TOCANTINS': 'TO', 'ACRE': 'AC',
          'AMAPA': 'AP', 'RORAIMA': 'RR', 'DISTRITO FEDERAL': 'DF'
        };
        for (const [name, uf] of Object.entries(stateNames)) {
          if (address.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(name)) {
            detectedState = uf;
            break;
          }
        }
      }
      
      if (!stateMap[detectedState]) {
        stateMap[detectedState] = { estado: detectedState, total: 0, vendas: 0 };
      }
      stateMap[detectedState].total += rowNetProfit;
      stateMap[detectedState].vendas += r.units;
    });
    
    return Object.values(stateMap).sort((a, b) => b.total - a.total);
  }, [mlRecords, products]);

  const handleCopyScriptText = () => {
    const code = `// CODIGO DO APPS SCRIPT ATUALIZADO NO PASSO 3 COM ABA 'IMPORTE MERCADO LIVRE'
// O código completo já foi injetado nas suas configurações e está pronto para ser copiado!`;
    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="space-y-6" id="ml-import-view">
      {/* Banner de Boas Vindas temático Mercado Livre */}
      <div className="bg-gradient-to-r from-[#FFE600]/15 via-[#FFE600]/5 to-transparent border border-[#FFE600]/30 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFE600]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        
        <div className="space-y-2 relative">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2.5 py-0.5 rounded-full uppercase shadow-[0_2px_10px_rgba(255,230,0,0.15)]">
              MERCADO LIVRE INTEGRADO 🛒
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Módulo de Conciliação Diária</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-white pt-1">
            Importar Relatórios do Mercado Livre
          </h2>
          <p className="text-xs sm:text-sm text-white/60 max-w-xl font-medium leading-relaxed">
            Suba sua planilha oficial do Mercado Livre para cruzar dados de faturamento bruto, tarifas, logística, devoluções e reclamações em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0 relative">
          {mlRecords.length > 0 && (
            <button
              onClick={onClearRecords}
              className="flex-1 md:flex-initial bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 text-xs font-bold py-3 px-5 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Importados
            </button>
          )}

          {isSheetsConnected ? (
            <button
              onClick={onPushToCloud}
              disabled={isSyncing || mlRecords.length === 0}
              className="flex-1 md:flex-initial bg-[#FFE600] hover:bg-[#FFE600]/85 text-black disabled:opacity-40 text-xs font-extrabold py-3.5 px-6 rounded-2xl transition-all shadow-[0_4px_15px_rgba(255,230,0,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed uppercase tracking-wider"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
              {isSyncing ? 'Gravando Nuvem...' : 'Salvar na Planilha'}
            </button>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-[11px] text-white/50 max-w-xs text-center font-medium">
              💡 Conecte o Google Sheets nas configurações para salvar permanentemente estes relatórios do ML!
            </div>
          )}
        </div>
      </div>

      {/* Se não houver dados, exibe a interface de upload e guia */}
      {mlRecords.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Coluna Esquerda: Caixa de Importação e Drag-Drop */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#FFE600]" />
                  Enviar Relatório de Transações do Mercado Livre
                </h3>
                <span className="text-[10px] text-white/40 font-mono">Formatos: XLS, XLSX, CSV, TXT</span>
              </div>

              {/* Área Drag & Drop ou Arquivo */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all relative ${
                  dragOver 
                    ? 'border-[#FFE600] bg-[#FFE600]/5' 
                    : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                }`}
              >
                <input
                  type="file"
                  id="ml-file-input"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center space-y-3 pointer-events-none">
                  <div className="bg-[#FFE600]/10 text-[#FFE600] p-4 rounded-full">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-white">Arraste o arquivo exportado (.csv, .xlsx, .xls) ou clique para buscar</p>
                    <p className="text-[10px] text-white/40">Relatório baixado em "Vendas &gt; Ver faturamento diário / Baixar XLS"</p>
                  </div>
                </div>
              </div>

              {/* Caixa para Colagem Rápida */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white/70 flex items-center gap-1.5">
                    <Clipboard className="w-3.5 h-3.5 text-[#FFE600]" />
                    Ou cole as linhas da tabela (Copie do Excel/Google Sheets e cole aqui)
                  </label>
                  <span className="text-[9px] text-[#FFE600] font-bold">Mais Prático! ⚡</span>
                </div>
                
                <textarea
                  rows={6}
                  value={pasteData}
                  onChange={(e) => setPasteArea(e.target.value)}
                  placeholder="Selecione as linhas na sua planilha com Ctrl+C (incluindo o cabeçalho) e cole com Ctrl+V aqui..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-mono placeholder:text-white/20"
                />

                <button
                  type="button"
                  onClick={() => handleParse(pasteData)}
                  className="w-full bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-[0.98]"
                >
                  <span>Processar e Analisar Dados</span>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              </div>

              {parseError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-400">Falha ao processar tabela</p>
                    <p className="text-[11px] text-white/60 leading-relaxed">{parseError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Instruções e Manual */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5">
              <h3 className="text-xs font-black tracking-widest text-white/50 uppercase">
                COMO OBTER O RELATÓRIO DO ML
              </h3>

              <div className="space-y-4 text-xs text-white/70 leading-relaxed font-medium">
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FFE600]/10 text-[#FFE600] flex items-center justify-center font-black shrink-0">1</div>
                  <p>Acesse seu painel do <strong>Mercado Livre</strong>.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FFE600]/10 text-[#FFE600] flex items-center justify-center font-black shrink-0">2</div>
                  <p>Vá em <strong>Faturamento</strong> ou clique no botão de exportar relatórios de faturamento diário/mensal de vendas.</p>
                </div>
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#FFE600]/10 text-[#FFE600] flex items-center justify-center font-black shrink-0">3</div>
                  <p>Baixe a planilha como <strong>XLS / CSV</strong>, abra-a e copie todas as colunas relevantes ou arraste o arquivo diretamente no painel à esquerda!</p>
                </div>
              </div>

              <div className="bg-[#FFE600]/5 border border-[#FFE600]/20 rounded-2xl p-4 space-y-2">
                <p className="text-[11px] font-bold text-[#FFE600] flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Garantia de Privacidade
                </p>
                <p className="text-[10px] text-white/60 leading-relaxed">
                  Nenhum dado é enviado para servidores externos. Todo o processamento de faturamento e dados pessoais dos clientes é feito diretamente no seu navegador de forma 100% segura.
                </p>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Se houver dados importados, exibe o Dashboard Completo */
        <div className="space-y-6">
          
          {/* Sucesso na Importação */}
          {importSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-emerald-300">{importSuccess}</span>
              </div>
              <button 
                onClick={() => setImportSuccess(null)} 
                className="text-xs font-bold text-white/50 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Cards de Métricas Avançadas - Fileira 1: Geral & Faturamento Real */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Faturamento ML Bruto */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFE600]/5 rounded-full blur-xl pointer-events-none group-hover:bg-[#FFE600]/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">FATURAMENTO ML</span>
                <div className="bg-[#FFE600]/10 text-[#FFE600] p-2 rounded-lg">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-2xl font-light text-white tracking-tight leading-none">
                  {formatCurrency(metrics.totalRevenue)}
                </h4>
                <p className="text-[10px] text-white/40 mt-1">Soma bruta de produtos vendidos</p>
              </div>
            </div>

            {/* Card 2: Líquido Recebido ML */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">LÍQUIDO RECEBIDO ML</span>
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-2xl font-light text-emerald-400 tracking-tight leading-none">
                  {formatCurrency(metrics.netProfitML)}
                </h4>
                <p className="text-[10px] text-white/40 mt-1">Valor liberado livre de custos do ML</p>
              </div>
            </div>

            {/* Card 3: Lucro Líquido Previsto (Destaque Neon Corporativo) */}
            <div className="bg-[#121212] border-2 border-[#FFE600]/20 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-[0_0_20px_rgba(255,230,0,0.05)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFE600]/10 rounded-full blur-xl pointer-events-none group-hover:bg-[#FFE600]/15 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-[#FFE600] uppercase">LUCRO LÍQ. PREVISTO 🔥</span>
                <div className="bg-[#FFE600]/10 text-[#FFE600] p-2 rounded-lg">
                  <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-2xl font-black text-[#FFE600] tracking-tight leading-none">
                  {formatCurrency(metrics.predictedNetProfit)}
                </h4>
                <p className="text-[10px] text-white/50 mt-1">Líquido de taxas, frete e custos de estoque</p>
              </div>
            </div>

            {/* Card 4: Faturamento Ads */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">VENDAS VIA PUBLICIDADE</span>
                <div className="bg-purple-500/10 text-purple-400 p-2 rounded-lg">
                  <DollarSign className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-2xl font-light text-purple-400 tracking-tight leading-none">
                  {formatCurrency(metrics.totalAdSales)}
                </h4>
                <p className="text-[10px] text-white/40 mt-1">{metrics.adUnitsSold} unidades vendidas via Ads</p>
              </div>
            </div>

          </div>

          {/* Cards de Métricas Avançadas - Fileira 2: Logísticas & Eficiência */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
            
            {/* Card 5: Vendas Full */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">VENDAS FULL</span>
                <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg">
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  {formatCurrency(metrics.totalFullSales)}
                </h4>
                <p className="text-[10px] text-amber-500 mt-1 font-bold">{metrics.fullUnitsSold} unidades via Envios Full</p>
              </div>
            </div>

            {/* Card 6: Vendas Flex */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">VENDAS FLEX</span>
                <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-lg">
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  {formatCurrency(metrics.totalFlexSales)}
                </h4>
                <p className="text-[10px] text-emerald-400 mt-1 font-bold">{metrics.flexUnitsSold} unidades via Envios Flex</p>
              </div>
            </div>

            {/* Card 7: Vendas Transportadora */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-sky-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">VENDAS TRANSPORTADORA</span>
                <div className="bg-sky-500/10 text-sky-400 p-2 rounded-lg">
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-none">
                  {formatCurrency(metrics.totalCarrierSales)}
                </h4>
                <p className="text-[10px] text-sky-400 mt-1 font-bold">{metrics.carrierUnitsSold} unidades via Transportadora</p>
              </div>
            </div>

            {/* Card 8: Custo Logística Geral */}
            <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-red-500/10 transition-all"></div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">CUSTO LOGÍSTICA GERAL</span>
                <div className="bg-red-500/10 text-red-400 p-2 rounded-lg">
                  <Truck className="w-4 h-4 stroke-[2.5]" />
                </div>
              </div>
              <div>
                <h4 className="text-lg sm:text-xl font-bold text-red-400 tracking-tight leading-none">
                  -{formatCurrency(metrics.totalShippingFee)}
                </h4>
                <p className="text-[10px] text-white/40 mt-1">Fretes, pesos e diferenças declaradas</p>
              </div>
            </div>

          </div>

          {/* Gráfico Recharts Interativo de Curva de Faturamento Diário vs Custos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Gráfico Principal */}
            <div className="lg:col-span-8 bg-[#121212] border border-white/5 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div className="space-y-1">
                  <h3 className="text-xs font-black tracking-widest text-white/40 uppercase">Evolução de Faturamento Diário</h3>
                  <p className="text-sm font-light text-white">Curva de Receitas vs Despesas de Logística & Tarifas do Mercado Livre</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#FFE600]"></span> Receita</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Tarifas</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Logística</span>
                </div>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FFE600" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#FFE600" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTarifas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                    <XAxis dataKey="date" stroke="#666" fontSize={10} tickLine={false} />
                    <YAxis stroke="#666" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46', borderRadius: '12px' }}
                      labelStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                    <Area type="monotone" dataKey="receita" stroke="#FFE600" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceita)" name="Receita Bruta" />
                    <Area type="monotone" dataKey="tarifas" stroke="#f87171" strokeWidth={1.5} fillOpacity={1} fill="url(#colorTarifas)" name="Tarifas" />
                    <Area type="monotone" dataKey="fretes" stroke="#38bdf8" strokeWidth={1.5} fill="none" name="Frete & Logística" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bento de Publicidade, Reclamações & Devoluções */}
            <div className="lg:col-span-4 grid grid-cols-1 gap-6">
              
              {/* Box Publicidade */}
              <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-[#FFE600] uppercase">MERCADO ADS 🚀</span>
                  <h4 className="text-sm font-bold text-white">Vendas via Publicidade</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed font-medium">Faturamento gerado impulsionando produtos através de campanhas.</p>
                </div>

                <div className="py-4 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h5 className="text-2xl font-light text-white">{formatCurrency(metrics.totalAdSales)}</h5>
                    <p className="text-[10px] text-white/40">{metrics.adUnitsSold} unidades vendidas via Ads</p>
                  </div>
                  <div className="bg-[#FFE600]/10 border border-[#FFE600]/20 rounded-full p-4 flex items-center justify-center">
                    <span className="text-xs font-black text-[#FFE600]">
                      {metrics.totalRevenue > 0 ? ((metrics.totalAdSales / metrics.totalRevenue) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                </div>

                <p className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 rounded-xl p-2.5 font-bold flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Publicidade representou uma parcela relevante no faturamento.
                </p>
              </div>

              {/* Box Reclamações & Devoluções */}
              <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-red-400 uppercase">RECLAMAÇÕES & DEV. ⚠️</span>
                  <h4 className="text-sm font-bold text-white">Controle de Reputação</h4>
                  <p className="text-[11px] text-white/50 leading-relaxed font-medium">Reclamações abertas que impactam no seu termômetro e saúde financeira.</p>
                </div>

                <div className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-white/60 block">Reclamações Abertas</span>
                    <span className={`text-lg font-bold ${metrics.openClaims > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                      {metrics.openClaims} ocorrências
                    </span>
                  </div>
                  <div className="space-y-1 text-right">
                    <span className="text-xs font-bold text-white/60 block">Devoluções / Cancelamentos</span>
                    <span className="text-lg font-bold text-red-400">
                      -{formatCurrency(metrics.refunds)}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-white/50 bg-white/5 rounded-xl p-2.5 font-medium flex items-center justify-between">
                  <span>Índice Geral de Reclamações:</span>
                  <strong className={`font-bold ${metrics.claimRate > 3 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {metrics.claimRate.toFixed(1)}%
                  </strong>
                </div>
              </div>

            </div>

          </div>

          {/* Tabela de Transações Importadas do Mercado Livre */}
          <div className="bg-[#121212] border border-white/5 rounded-3xl shadow-xl overflow-hidden">
            
            {/* Header de Ações / Filtros */}
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#FFE600]" />
                  Transações do Mercado Livre ({filteredRecords.length} de {mlRecords.length})
                </h3>
                <p className="text-xs text-white/50">Histórico de vendas exportado da plataforma do ML</p>
              </div>

              {/* Barra de Filtros */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-none">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/30">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar venda, anúncio ou cliente..."
                    className="w-full sm:w-60 bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30 font-medium"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30 cursor-pointer font-bold"
                >
                  <option value="todos">Todos Envios</option>
                  <option value="entregue">Entregues</option>
                  <option value="caminho">A Caminho</option>
                  <option value="reclamacao">Reclamações</option>
                </select>

                <select
                  value={adFilter}
                  onChange={(e) => setAdFilter(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#FFE600]/30 cursor-pointer font-bold"
                >
                  <option value="todos">Todas Origens</option>
                  <option value="publicidade">Via Ads</option>
                  <option value="normal">Orgânica</option>
                </select>
              </div>
            </div>

            {/* Grid/Tabela de Dados */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-white/[0.01] border-b border-white/5 text-[10px] font-black tracking-wider text-white/40 uppercase">
                    <th className="py-3 px-5">ID Venda / Data</th>
                    <th className="py-3 px-5">Anúncio</th>
                    <th className="py-3 px-5">Logística / Forma</th>
                    <th className="py-3 px-5">Financeiro ML</th>
                    <th className="py-3 px-5">NF-e / Comprador</th>
                    <th className="py-3 px-5">Reclamações</th>
                    <th className="py-3 px-5 text-right">Total Recebido</th>
                    <th className="py-3 px-5 text-right">LUCRO LÍQ. PREVISTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs">
                  {filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      
                      {/* ID / Data */}
                      <td className="py-4 px-5 space-y-1">
                        <span className="font-bold text-white font-mono block select-all" title="Copiar ID de Venda">
                          {r.id}
                        </span>
                        <span className="text-[10px] text-white/40 block">
                          {r.dateStr}
                        </span>
                      </td>

                      {/* Anúncio */}
                      <td className="py-4 px-5 space-y-1 max-w-[280px]">
                        <span className="font-bold text-white line-clamp-1" title={r.adTitle}>
                          {r.adTitle}
                        </span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-[#FFE600] font-bold font-mono">{r.adId}</span>
                          <span className="text-white/40">{r.variation}</span>
                          {r.isAdSale && (
                            <span className="bg-[#FFE600] text-black px-1.5 py-0.5 rounded-[3px] font-black text-[8px] uppercase">
                              Ads
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Logística */}
                      <td className="py-4 px-5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            r.status.toLowerCase().includes('entregue') ? 'bg-emerald-400' : 'bg-[#FFE600]'
                          }`}></span>
                          <span className="font-bold text-white capitalize">{r.status}</span>
                        </div>
                        <div className="text-[10px] text-white/40 space-y-0.5">
                          <p>{r.shippingMethod}</p>
                          {r.carrier && <p className="font-semibold text-white/50">{r.carrier}</p>}
                          {r.trackingNumber && (
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-[9px] select-all">{r.trackingNumber}</span>
                              {r.trackingUrl && (
                                <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-[#FFE600] hover:underline" title="Acompanhar Envio">
                                  <ExternalLink className="w-2.5 h-2.5 inline" />
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Financeiro ML */}
                      <td className="py-4 px-5 space-y-1.5">
                        <div className="text-[10px] space-y-0.5">
                          <p className="text-white/70">Receita: <span className="font-bold text-white">{formatCurrency(r.productRevenue)}</span></p>
                          <p className="text-red-400">Tarifa: <span className="font-semibold">-{formatCurrency(Math.abs(r.saleFeeAndTaxes))}</span></p>
                          {r.shippingFee !== 0 && (
                            <p className="text-sky-400">Frete: <span className="font-semibold">-{formatCurrency(Math.abs(r.shippingFee))}</span></p>
                          )}
                        </div>
                      </td>

                      {/* NF-e e Comprador */}
                      <td className="py-4 px-5 space-y-1">
                        <span className="font-bold text-white flex items-center gap-1">
                          <User className="w-3 h-3 text-white/40" />
                          {r.buyerName || 'Cliente ML'}
                        </span>
                        <div className="text-[10px] text-white/40 space-y-0.5">
                          <p className="font-mono">{r.buyerDocument}</p>
                          <p className={`font-semibold ${
                            r.invoiceStatus === 'Autorizada' ? 'text-emerald-400' : 'text-amber-400'
                          }`}>
                            NF-e: {r.invoiceStatus}
                          </p>
                        </div>
                      </td>

                      {/* Reclamações */}
                      <td className="py-4 px-5">
                        {r.isClaimOpen ? (
                          <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1.5 w-fit animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Aberta
                          </span>
                        ) : r.isClaimClosed ? (
                          <span className="bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 px-2 py-1 rounded-lg font-bold text-[10px] flex items-center gap-1.5 w-fit">
                            <Check className="w-3 h-3" />
                            Resolvida
                          </span>
                        ) : (
                          <span className="text-white/30 text-[10px]">Sem ocorrências</span>
                        )}
                      </td>

                      {/* Total Recebido */}
                      <td className="py-4 px-5 text-right font-mono">
                        <span className="font-bold text-sm text-[#FFE600] block">
                          {formatCurrency(r.totalBrl - Math.abs(r.discountsAndBonuses))}
                        </span>
                        {(() => {
                          let matchingProduct = products.find(p => {
                            const adTitleLower = r.adTitle.toLowerCase();
                            const pNameLower = p.name.toLowerCase();
                            if (pNameLower.includes('20cm') || pNameLower.includes('20 cm')) {
                              return adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto');
                            }
                            if (pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°')) {
                              return adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('hrebos');
                            }
                            return adTitleLower.includes(pNameLower) || pNameLower.includes(adTitleLower);
                          });
                          if (!matchingProduct && products.length > 0) {
                            matchingProduct = products[0];
                          }
                          const productCost = matchingProduct ? (matchingProduct.purchasePrice * r.units) : 0;
                          return matchingProduct ? (
                            <span className="text-[10px] text-red-500 font-bold block mt-0.5">
                              - {formatCurrency(productCost)} custo
                            </span>
                          ) : null;
                        })()}
                      </td>

                      {/* Lucro Líquido Previsto por transação */}
                      {(() => {
                        let matchingProduct = products.find(p => {
                          const adTitleLower = r.adTitle.toLowerCase();
                          const pNameLower = p.name.toLowerCase();
                          if (pNameLower.includes('20cm') || pNameLower.includes('20 cm')) {
                            return adTitleLower.includes('20 cm') || adTitleLower.includes('20cm') || adTitleLower.includes('curto');
                          }
                          if (pNameLower.includes('90') || pNameLower.includes('90gr') || pNameLower.includes('90°')) {
                            return adTitleLower.includes('90') || adTitleLower.includes('90°') || adTitleLower.includes('hrebos');
                          }
                          return adTitleLower.includes(pNameLower) || pNameLower.includes(adTitleLower);
                        });
                        
                        if (!matchingProduct && products.length > 0) {
                          matchingProduct = products[0];
                        }
                        
                        const productCost = matchingProduct ? (matchingProduct.purchasePrice * r.units) : 0;
                        const received = r.totalBrl - Math.abs(r.discountsAndBonuses);
                        const rowNetProfit = received - productCost;
                        const marginPercent = ((rowNetProfit / (productCost || 1)) * 100).toFixed(0);
                        
                        return (
                          <td className="py-4 px-5 text-right font-mono">
                            <span className={`font-extrabold text-sm block ${rowNetProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatCurrency(rowNetProfit)}
                            </span>
                            <span className={`text-[10px] font-bold block mt-0.5 ${rowNetProfit >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                              {marginPercent}% Margem
                            </span>
                          </td>
                        );
                      })()}

                    </tr>
                  ))}

                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-white/40 font-medium">
                        Nenhuma transação atende aos filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* Seção Inferior de Bento Grid: Anúncios Campeões, Mapa de Calor por Estado, e Instruções do Google Sheets */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Box 1: Top 5 Anúncios Campeões de Venda */}
            <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <h4 className="text-xs font-black tracking-widest text-white/40 uppercase">Top 5 Anúncios Campeões de Venda</h4>
              <div className="space-y-3.5">
                {topAds.map((ad, idx) => (
                  <div key={ad.id} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-[#FFE600]/10 text-[#FFE600] flex items-center justify-center font-black shrink-0 text-xs">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="font-bold text-white text-xs block truncate" title={ad.title}>
                          {ad.title}
                        </span>
                        <span className="font-mono text-[10px] text-white/30">{ad.id}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <span className="font-bold text-white text-xs block">{formatCurrency(ad.total)}</span>
                      <span className="text-[10px] text-emerald-400 block">{ad.qty} vendas</span>
                    </div>
                  </div>
                ))}

                {topAds.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-6">Sem anúncios cadastrados.</p>
                )}
              </div>
            </div>

            {/* Box 2: Mapa de Calor de Faturamento Regional por Estado */}
            <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black tracking-widest text-white/40 uppercase">Distribuição por Estado (Mapa de Calor) 🔥</h4>
                <span className="text-[10px] font-black tracking-widest bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full uppercase">REGIONAL</span>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {stateData.map((s) => {
                  const maxTotal = stateData[0]?.total || 1;
                  const ratio = (s.total / maxTotal) * 100;
                  return (
                    <div key={s.estado} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-white flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400"></span>
                          {s.estado}
                        </span>
                        <div className="text-right">
                          <span className="text-white shrink-0 font-bold block">{formatCurrency(s.total)}</span>
                          <span className="text-[10px] text-white/40 block">{s.vendas} vendas</span>
                        </div>
                      </div>
                      {/* Barra de Calor Progressiva */}
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" 
                          style={{ width: `${ratio}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                {stateData.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-6">Sem dados de estados.</p>
                )}
              </div>
            </div>

            {/* Box 3: Box Instruções da Planilha Integrada */}
            <div className="bg-[#121212] border border-white/5 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-widest text-[#FFE600] uppercase">Mapeamento do Google Sheets</span>
                <h4 className="text-sm font-bold text-white">Aba "Importe Mercado Livre"</h4>
                <p className="text-xs text-white/60 leading-relaxed font-medium">
                  Se você usa o Google Sheets ativo de gravação, o sistema salvará estes dados importados na sua planilha em uma aba dedicada chamada <strong className="text-white">"Importe Mercado Livre"</strong> automaticamente ao clicar em "Salvar na Planilha"!
                </p>
              </div>

              <div className="bg-[#FFE600]/10 border border-[#FFE600]/20 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-[#FFE600] font-bold">⚠️ Certifique-se de atualizar seu Apps Script no Google Sheets!</p>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  Para que o Google Sheets consiga ler e salvar esta nova aba de relatórios, você deve copiar o código atualizado no Passo 3 da aba <strong>Sincronizar Google Sheets</strong> e implantá-lo como "Nova Versão".
                </p>
                
                <button
                  onClick={handleCopyScriptText}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-bold py-2 px-3 rounded-lg transition-all w-full flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Clipboard className="w-3 h-3" />
                  {copiedScript ? 'Copiado!' : 'Saber mais do Script'}
                </button>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
