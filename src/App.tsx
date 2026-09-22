/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Product, Sale, MLImportRecord, EntradaValorRecord, findMatchingProduct } from './types';
import { INITIAL_PRODUCTS, INITIAL_SALES, normalizeName, calculateCurrentStock, calculateMLFee, cleanMlSaleId, getSaleMlId, findProductForSale, getProductSalesActivity, isValidProductTitle, isDateLikeString, parseMLDate, toStandardDateISO } from './utils';
import { Lock, Unlock, Key, LogOut } from 'lucide-react';

// Importando componentes modulares
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import StockControl from './components/StockControl';
import SalesManager from './components/SalesManager';
import SheetsIntegration from './components/SheetsIntegration';
import MLImport from './components/MLImport';
import ProductProfitsPanel from './components/ProductProfitsPanel';

export default function App() {
  // Migração automática do Web App URL para o novo ativo fornecido pelo usuário na aba Database (linha 1, coluna A)
  const defaultNewUrl = 'https://script.google.com/macros/s/AKfycbxUZXSIzp-0hgv1PMuyqThl98Vj9igr3lvNhXx31GBXbMoInTed24ANzbOkm38yT7uE/exec';
  const defaultSpreadsheetUrl = 'https://docs.google.com/spreadsheets/d/12F010pz_9MO9-8wOxeDnUmKnYiTrHXv7HZMuog2MZiE/edit?gid=1782622408#gid=1782622408';
  const storedUrl = localStorage.getItem('ml_webapp_url');
  if (!storedUrl || storedUrl.includes('AKfycbyesx') || storedUrl.includes('AKfycbz81q6fIBlapP5yD1lkDCMqh9Q3x-Eh_5deS_o_bm4mFKY0q21YkNMKx5KF4pyq-a9j') || storedUrl.includes('AKfycbz_GaOVZTAI')) {
    localStorage.setItem('ml_webapp_url', defaultNewUrl);
  }

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('is_ml_authenticated') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);

  // Regra 1 & 2: Ao abrir a aplicação, SEMPRE deve ser feita a busca/leitura no banco de dados para reproduzir os dados atualizados para todos os acessos
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [mlRecords, setMlRecords] = useState<MLImportRecord[]>([]);
  const [entradaRecords, setEntradaRecords] = useState<EntradaValorRecord[]>(() => {
    const saved = localStorage.getItem('ml_entrada_records');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => {
          const str = String(item.id || '').trim();
          const isStrictId = !/[eE\+,\.]/.test(str) && /^20\d{10,18}$/.test(str);
          if (!isStrictId) return false;
          const opStat = String(item.operationStatus || '').toLowerCase().trim();
          const tipo = String(item.releaseStatus || item.description || '').toLowerCase().trim();
          if (tipo && !tipo.includes('libera') && !tipo.includes('dispon')) return false;
          if (opStat && (opStat.includes('cancelad') || opStat.includes('estorn') || opStat.includes('devol') || (opStat !== 'pago' && opStat !== 'paga' && opStat !== 'paid' && opStat !== 'aprovado' && opStat !== 'concluido'))) {
            return false;
          }
          return true;
        });
      }
    } catch (e) {}
    return [];
  });

  const [entradaRawMatrix, setEntradaRawMatrix] = useState<any[][] | null>(() => {
    try {
      const saved = localStorage.getItem('ml_entrada_raw_matrix');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem('ml_spreadsheet_url') || defaultSpreadsheetUrl;
  });

  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    const current = localStorage.getItem('ml_webapp_url');
    if (current && !current.includes('AKfycbz81q6fIBlapP5yD1lkDCMqh9Q3x-Eh_5deS_o_bm4mFKY0q21YkNMKx5KF4pyq-a9j')) {
      return current;
    }
    return defaultNewUrl;
  });

  const [isFetchingWebAppUrl, setIsFetchingWebAppUrl] = useState<boolean>(true);

  // Regra de Sincronização Mestra: Buscar Web App URL da aba "Database" da planilha
  const forceFetchWebAppUrl = async (): Promise<string | null> => {
    const urlToUse = spreadsheetUrl || defaultSpreadsheetUrl;
    setIsFetchingWebAppUrl(true);
    try {
      const res = await fetch(`/api/get-webapp-url?spreadsheetUrl=${encodeURIComponent(urlToUse)}`);
      const data = await res.json();
      if (data.webAppUrl) {
        if (data.webAppUrl !== webAppUrl) {
          console.log('Web App URL atualizada automaticamente da aba Database da planilha:', data.webAppUrl);
          setWebAppUrl(data.webAppUrl);
          localStorage.setItem('ml_webapp_url', data.webAppUrl);
        }
        return data.webAppUrl;
      }
      return webAppUrl;
    } catch (err) {
      console.error('Erro ao buscar Web App URL da planilha:', err);
      return null;
    } finally {
      setIsFetchingWebAppUrl(false);
    }
  };

  useEffect(() => {
    forceFetchWebAppUrl();
  }, [spreadsheetUrl]);

  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  
  // Controle de sincronização de múltiplos dispositivos - sempre inicia buscando da nuvem
  const [hasFetchedFromCloud, setHasFetchedFromCloud] = useState<boolean>(false);
  const [isFetchingFromCloud, setIsFetchingFromCloud] = useState<boolean>(true);
  
  // Flag para indicar se há alterações locais novas feitas pelo usuário pendentes de gravação na nuvem.
  // Garante a Regra 2: nunca apaga dados da database e sempre lê primeiro do ponto 1.
  const [hasPendingWrite, setHasPendingWrite] = useState<boolean>(false);

  const [initialCapital, setInitialCapital] = useState<number>(() => {
    const saved = localStorage.getItem('ml_initial_capital');
    return saved ? Number(saved) : 0;
  });

  const [bannedProducts, setBannedProducts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ml_banned_products');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('ml_banned_products', JSON.stringify(bannedProducts));
  }, [bannedProducts]);

  // Salvar no localStorage sempre que houver alterações nos estados principais
  useEffect(() => {
    localStorage.setItem('ml_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('ml_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('ml_records', JSON.stringify(mlRecords));
  }, [mlRecords]);

  useEffect(() => {
    localStorage.setItem('ml_entrada_records', JSON.stringify(entradaRecords));
  }, [entradaRecords]);

  useEffect(() => {
    if (entradaRawMatrix) {
      try {
        localStorage.setItem('ml_entrada_raw_matrix', JSON.stringify(entradaRawMatrix));
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('ml_entrada_raw_matrix');
      } catch (e) {}
    }
  }, [entradaRawMatrix]);

  useEffect(() => {
    localStorage.setItem('ml_spreadsheet_url', spreadsheetUrl);
  }, [spreadsheetUrl]);

  useEffect(() => {
    localStorage.setItem('ml_webapp_url', webAppUrl);
  }, [webAppUrl]);

  useEffect(() => {
    localStorage.setItem('ml_initial_capital', String(initialCapital));
  }, [initialCapital]);

  // Resetar o estado de busca quando a URL do Apps Script mudar (ex: o usuário trocou de planilha)
  useEffect(() => {
    setHasFetchedFromCloud(false);
  }, [webAppUrl]);

  // Função para sanitizar e corrigir automaticamente produtos e vendas vindos da planilha
  const sanitizeCloudData = (cloudProducts: Product[], cloudSales: Sale[], cloudMlRecords?: MLImportRecord[], cloudEntradaRecords?: EntradaValorRecord[]) => {
    const recordsToUse = cloudMlRecords || mlRecords || [];
    const recordsToUseEntrada = cloudEntradaRecords || entradaRecords || [];
    
    // 1. Manter APENAS produtos reais válidos.
    // Ignorar lixos ("sim", "nao"), datas ou registros corrompidos.
    const sanitizedProducts: Product[] = (cloudProducts || [])
      .filter(p => {
        if (!p || !p.name) return false;
        if (!isValidProductTitle(p.name)) return false;
        if (isDateLikeString(p.name)) return false;
        const lower = String(p.name).toLowerCase().trim();
        if (/\b(outubro|setembro|agosto|julho|junho|maio|abril|mar[cç]o|fevereiro|janeiro)\b/i.test(lower)) {
          return false;
        }
        // Filtrar produtos banidos pelo usuário
        if (bannedProducts.some(b => String(b).trim().toLowerCase() === lower || (p.sku && String(b).trim().toLowerCase() === String(p.sku).trim().toLowerCase()))) {
          return false;
        }
        return true;
      })
      .map(p => ({
        ...p,
        skus: Array.isArray(p.skus)
          ? p.skus
          : (typeof (p as any).skus === 'string' && (p as any).skus
              ? (p as any).skus.split(/[,;\n\r]+/).map((s: string) => s.trim()).filter(Boolean)
              : []),
        purchasePrice: Number(p.purchasePrice) || 0,
        salePrice: Number(p.salePrice) || 0,
        stock: Number(p.stock) || 0,
        minimalStock: Number(p.minimalStock) || 0,
        shippingCost: Number(p.shippingCost) || 0,
        customFeePercent: p.customFeePercent !== undefined ? Number(p.customFeePercent) : undefined
      }));

    // 2. Mapear vendas e DESCARTAR qualquer venda que não possua um produto correspondente no estoque oficial ou que seja um registro sintético corrompido.
    const validCloudSales = (cloudSales || []).filter(s => {
      const sId = String(s.id || '').trim();
      // Descarta linhas artificiais geradas com prefixo sale_ e preço zerado
      if (sId.startsWith('sale_') && (Number(s.salePrice) <= 0 || !s.productName || s.productName === 'Venda Desconhecida')) {
        return false;
      }
      return true;
    });

    // Mapear vendas existentes por ID para preservação de customizações do usuário (ex: perdas manuais, custos de envio customizados)
    const existingSalesMap = new Map<string, Sale>();
    validCloudSales.forEach(s => {
      const sCleanId = cleanMlSaleId(s.mlSaleId) || cleanMlSaleId(s.id) || String(s.id || '').trim();
      if (sCleanId) {
        existingSalesMap.set(sCleanId, s);
      }
    });

    // Mapear a tabela de entrada de valores (liberações financeiras do Mercado Pago)
    const entradaMap = new Map<string, EntradaValorRecord>();
    recordsToUseEntrada.forEach(e => {
      const eCleanId = cleanMlSaleId(e.id) || String(e.id || '').trim();
      if (eCleanId) {
        entradaMap.set(eCleanId, e);
      }
    });

    const reconciledSales: Sale[] = [];
    const processedSaleIds = new Set<string>();

    // Processar cada registro de vendas brutas do Mercado Livre (aba "Importe Mercado Livre")
    // de acordo com as regras invioláveis do Manual POP (Seções 1.2, 4.3, 6.2 e 7)
    if (recordsToUse && recordsToUse.length > 0) {
      recordsToUse.forEach(r => {
        const rawId = String(r.id || '').trim();
        const rCleanId = cleanMlSaleId(rawId) || rawId;
        if (!rCleanId) return;

        // Evitar duplicidades: um registro por venda (Seção 7.1.1)
        if (processedSaleIds.has(rCleanId)) return;
        processedSaleIds.add(rCleanId);

        const existingSale = existingSalesMap.get(rCleanId);

        // 1. CHAVE PRIMÁRIA & SSOT (Seção 1.2 e 6.2):
        // Buscar correspondência estrita com produto cadastrado no Controle de Estoque
        let matchingProd: Product | undefined;
        if (existingSale?.productId) {
          matchingProd = sanitizedProducts.find(p => p.id === existingSale.productId || p.sku === existingSale.productId || (p.skus && p.skus.includes(existingSale.productId)));
        }
        if (!matchingProd) {
          matchingProd = findMatchingProduct(r, sanitizedProducts);
        }
        if (!matchingProd && isValidProductTitle(r.adTitle)) {
          matchingProd = findProductForSale({ productName: r.adTitle } as any, sanitizedProducts);
        }

        // Se o produto NÃO existe no estoque, mandar para "Dados e Vendas Desprezadas" (status: 'ignored')
        // conforme Seção 1.2, 4.4 e 6.2 do Manual POP
        if (!matchingProd) {
          reconciledSales.push({
            id: rCleanId,
            productId: 'desprezado',
            productName: r.adTitle || 'Produto Não Cadastrado no Estoque',
            quantity: Number(r.units) || 1,
            salePrice: Number(r.adUnitPrice) || 0,
            date: toStandardDateISO(r.dateStr || ''),
            mlFee: Math.abs(r.saleFeeAndTaxes || 0),
            shippingCost: Math.abs(r.shippingFee || 0) + Math.abs(r.shippingWeightCost || 0) + Math.abs(r.shippingDiffCost || 0),
            shippingRevenue: Math.abs(r.shippingRevenue || 0),
            purchasePrice: 0,
            grossProfit: 0,
            netProfit: 0,
            status: 'ignored',
            mlSaleId: rCleanId,
            isMlSale: true,
            adId: r.adId,
            sku: r.sku
          });
          return;
        }

        // Produto VÁLIDO no estoque (Oficial)
        const quantity = Number(r.units) || (existingSale ? Number(existingSale.quantity) : 1) || 1;
        let salePrice = Number(r.adUnitPrice) || 0;
        if (salePrice <= 0 && r.productRevenue) {
          salePrice = Math.abs(r.productRevenue) / quantity;
        }
        if (salePrice <= 0 && existingSale && existingSale.salePrice > 0) {
          salePrice = existingSale.salePrice;
        }
        if (salePrice <= 0 && matchingProd.salePrice > 0) {
          salePrice = matchingProd.salePrice;
        }

        const purchasePrice = matchingProd.purchasePrice > 0
          ? matchingProd.purchasePrice
          : (existingSale?.purchasePrice || 0);

        const cleanSaleProductName = (r.adTitle && isValidProductTitle(r.adTitle))
          ? r.adTitle.trim()
          : (existingSale?.productName || matchingProd.name);

        const dateISO = toStandardDateISO(r.dateStr || existingSale?.date || '');

        // Tarifas e Envio
        const mlFee = (r.saleFeeAndTaxes !== undefined && r.saleFeeAndTaxes !== 0)
          ? Math.abs(r.saleFeeAndTaxes)
          : (existingSale ? existingSale.mlFee : calculateMLFee(salePrice, matchingProd.mlFeeType, matchingProd.customFeePercent) * quantity);

        const shippingCost = (r.shippingFee !== undefined || r.shippingWeightCost !== undefined || r.shippingDiffCost !== undefined)
          ? (Math.abs(r.shippingFee || 0) + Math.abs(r.shippingWeightCost || 0) + Math.abs(r.shippingDiffCost || 0))
          : (existingSale ? existingSale.shippingCost : (matchingProd.shippingCost || 0));

        const shippingRevenue = Math.abs(r.shippingRevenue || 0);
        const surchargeRev = Number(r.surchargeRevenue || 0);
        const installmentFee = Number(r.installmentFee || 0);

        // Seção 4.3.1 do Manual POP - Cálculo do A Receber do ML (Repasse Líquido / Payout)
        // A Receber = Receita produtos + Acréscimo + Taxa parcelamento - Tarifa ML + Receita envio - Tarifa envio
        const totalGross = salePrice * quantity;
        const aReceberML = totalGross + surchargeRev + installmentFee - mlFee + shippingRevenue - shippingCost;

        // Seção 4.3.2 do Manual POP - Lucro Líquido Real = A Receber - Custo Compra - Imposto Provisionado (4%)
        const taxAmount = totalGross * 0.04;
        let netProfit = aReceberML - (purchasePrice * quantity) - taxAmount;
        let grossProfit = totalGross - (purchasePrice * quantity);

        // Determinação de Status (Seção 7 e 7.1 do Manual POP)
        let status: 'pending' | 'completed' | 'refunded' | 'ignored' = 'pending';

        const rStatusLower = (r.status || '').toLowerCase();
        const rDescLower = (r.statusDescription || '').toLowerCase();
        const isRefunded = rStatusLower.includes('cancelad') || rStatusLower.includes('devolv') ||
                           rStatusLower.includes('estorn') || rStatusLower.includes('reembols') ||
                           rDescLower.includes('cancelad') || rDescLower.includes('devolv') ||
                           rDescLower.includes('estorn') || rDescLower.includes('reembols');

        if (isRefunded) {
          status = 'refunded';
          netProfit = -shippingCost; // Em devolução/cancelamento, o frete é retido/perdido e não há lucro
          grossProfit = 0;
        } else {
          // Cruzamento de dados com a aba Entrada de Valores (Seção 7.1)
          const entradaRecord = entradaMap.get(rCleanId);
          const hasLiberacao = entradaRecord && (
            (entradaRecord.releaseStatus && /libera[cç][aã]o|dispon[ií]vel/i.test(entradaRecord.releaseStatus)) ||
            (entradaRecord.description && /libera[cç][aã]o/i.test(entradaRecord.description))
          );

          // Regra temporal: prazo de 30 dias do Mercado Livre expirado (Seção 7)
          let isExpired30Days = false;
          if (dateISO) {
            const saleDateObj = parseMLDate(dateISO);
            if (saleDateObj) {
              const nowObj = new Date();
              const diffDays = Math.floor((nowObj.getTime() - saleDateObj.getTime()) / (1000 * 60 * 60 * 24));
              if (diffDays >= 30) {
                isExpired30Days = true;
              }
            }
          }

          if (hasLiberacao || isExpired30Days || existingSale?.status === 'completed') {
            status = 'completed'; // Vendas Finalizadas / Liberadas
          } else {
            status = 'pending'; // Vendas em Andamento / Faturamento Previsto
          }
        }

        // Logística (Full vs Transportadora/Flex)
        const isFull = (r.shippingMethod && r.shippingMethod.toLowerCase().includes('full')) ||
                       (existingSale?.shippingType === 'full');
        const shippingType: 'full' | 'transportadora' = isFull ? 'full' : 'transportadora';

        // Preservar anotações manuais se houver (ex: perda lançada com ID de 16 dígitos - Seção 2.2.7)
        const lossAmount = existingSale?.lossAmount !== undefined
          ? existingSale.lossAmount
          : (status === 'refunded' ? shippingCost : undefined);
        const lossReason = existingSale?.lossReason || (status === 'refunded' ? 'Devolução / Estorno ML' : undefined);

        reconciledSales.push({
          id: rCleanId,
          productId: matchingProd.id,
          productName: cleanSaleProductName,
          quantity,
          salePrice,
          purchasePrice,
          date: dateISO || new Date().toISOString().split('T')[0],
          mlFee,
          shippingCost,
          shippingRevenue,
          grossProfit,
          netProfit,
          status,
          mlSaleId: rCleanId,
          isMlSale: true,
          shippingType,
          lossAmount,
          lossReason,
          buyerName: r.buyerName || existingSale?.buyerName,
          buyerDocument: r.buyerDocument || existingSale?.buyerDocument,
          buyerAddress: r.buyerAddress || existingSale?.buyerAddress,
          trackingNumber: r.trackingNumber || existingSale?.trackingNumber,
          carrier: r.carrier || existingSale?.carrier,
          trackingUrl: r.trackingUrl || existingSale?.trackingUrl,
          adId: r.adId || existingSale?.adId,
          sku: r.sku || existingSale?.sku
        });
      });
    }

    // Incluir vendas manuais ou vendas diretas pré-existentes que não sejam do relatório ML
    validCloudSales.forEach(s => {
      const sCleanId = cleanMlSaleId(s.mlSaleId) || cleanMlSaleId(s.id) || String(s.id || '').trim();
      if (!processedSaleIds.has(sCleanId) && !s.isMlSale) {
        processedSaleIds.add(sCleanId);
        reconciledSales.push(s);
      }
    });

    const finalSanitizedSales = reconciledSales;

    // Avaliar status de arquivamento dos produtos (Regra dos 30 dias sem vendas)
    sanitizedProducts.forEach(p => {
      const activity = getProductSalesActivity(p, finalSanitizedSales, sanitizedProducts);
      p.status = activity.isArchived ? 'archived' : 'active';
    });

    return { products: sanitizedProducts, sales: finalSanitizedSales };
  };

  // Buscar dados da planilha na inicialização do aplicativo para manter sincronizado com múltiplos dispositivos
  useEffect(() => {
    if (!webAppUrl || hasFetchedFromCloud || isFetchingWebAppUrl) return;

    const fetchInitialData = async () => {
      setIsFetchingFromCloud(true);
      setCloudSyncError(null);
      try {
        console.log('Buscando dados em tempo real da planilha do Google Sheets...', webAppUrl);
        let activeUrlToTry = webAppUrl;
        let response = await fetch(`/api/sync-sheets?webAppUrl=${encodeURIComponent(activeUrlToTry)}`);
        let result = await response.json().catch(() => null);
        
        // Se a URL falhou (404/500/abort), tenta recuperar automaticamente a URL atualizada da aba Database da planilha
        if (!response.ok || (result && result.status === 'error' && (result.message?.includes('404') || result.message?.includes('aborted')))) {
          console.warn('Tentativa de sincronização falhou. Recuperando Web App URL atualizada da planilha...');
          const freshUrl = await forceFetchWebAppUrl();
          if (freshUrl && freshUrl !== activeUrlToTry) {
            activeUrlToTry = freshUrl;
            response = await fetch(`/api/sync-sheets?webAppUrl=${encodeURIComponent(activeUrlToTry)}`);
            result = await response.json().catch(() => null);
          }
        }
        
        if (!response.ok) {
          throw new Error(result?.message || `HTTP ${response.status}`);
        }

        if (result && result.status === 'success') {
          // Sanitização robusta contra dados corrompidos ou chaves de datas na coluna de preços
          const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords, result.entradaRecords || entradaRecords);
          
          setProducts(sanitized.products);
          setSales(sanitized.sales);
          if (result.mlRecords && Array.isArray(result.mlRecords)) {
            setMlRecords(result.mlRecords);
          }
          if (result.entradaRecords && Array.isArray(result.entradaRecords)) {
            const filtered = result.entradaRecords.filter(e => {
              const opStat = String(e.operationStatus || '').toLowerCase().trim();
              const tipo = String(e.releaseStatus || e.description || '').toLowerCase().trim();
              if (tipo && !tipo.includes('libera') && !tipo.includes('dispon')) return false;
              if (opStat && (opStat.includes('cancelad') || opStat.includes('estorn') || opStat.includes('devol') || (opStat !== 'pago' && opStat !== 'paga' && opStat !== 'paid' && opStat !== 'aprovado' && opStat !== 'concluido'))) {
                return false;
              }
              return true;
            });
            setEntradaRecords(filtered);
          }
          
          // Sincronizar produtos banidos do Google Sheets
          if (result.bannedProducts && Array.isArray(result.bannedProducts)) {
            setBannedProducts(prev => {
              const setNames = new Set(prev.map(b => String(b).trim().toLowerCase()));
              const newItems = [...prev];
              result.bannedProducts.forEach((b: any) => {
                const str = typeof b === 'string' ? b : (b.name || String(b));
                if (str && !setNames.has(str.trim().toLowerCase())) {
                  setNames.add(str.trim().toLowerCase());
                  newItems.push(str.trim());
                }
              });
              return newItems;
            });
          }

          // Sincronizar o capital inicial / aporte
          if (result.initialCapital !== undefined && typeof result.initialCapital === 'number' && result.initialCapital > 0) {
            if (result.hasConfigSheet || result.initialCapital !== 500) {
              setInitialCapital(result.initialCapital);
              localStorage.setItem('ml_initial_capital', String(result.initialCapital));
            }
          }

          console.log('Dados em tempo real obtidos e sanitizados com sucesso do Google Sheets!');
          setHasFetchedFromCloud(true); // Habilita o auto-sync somente após download com sucesso total
        } else if (result && result.status === 'error') {
          throw new Error(result.message || 'Erro ao carregar dados do Apps Script.');
        }
      } catch (err: any) {
        console.error('Erro ao recuperar dados iniciais da nuvem:', err);
        let detailMsg = err.message || String(err);
        if (detailMsg.includes('aborted') || detailMsg.includes('AbortError') || detailMsg.includes('timeout')) {
          detailMsg = 'A resposta da planilha excedeu o tempo limite. Clique em "Atualizar Agora" no topo para tentar novamente.';
        }
        setCloudSyncError(`Sincronização pendente: ${detailMsg}`);
        // Se falhar o carregamento, NÃO marcamos como fetched para bloquear escrita acidental e incentivar nova tentativa manual
        setHasFetchedFromCloud(false);
      } finally {
        setIsFetchingFromCloud(false);
      }
    };

    fetchInitialData();
  }, [webAppUrl, hasFetchedFromCloud, isFetchingWebAppUrl]);

  // Forçar recarregamento/importação manual do banco de dados na planilha do Sheets
  const handlePullFromCloud = async (): Promise<{ status: 'success' | 'error'; message: string }> => {
    if (!webAppUrl) return { status: 'error' as const, message: 'Por favor, insira a URL do Web App primeiro.' };
    setIsFetchingFromCloud(true);
    setCloudSyncError(null);
    try {
      console.log('Forçando leitura/puxada de dados do Google Sheets...', webAppUrl);
      const url = `/api/sync-sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
      const response = await fetch(url);
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || `HTTP ${response.status}`);
      }

      if (result && result.status === 'success') {
        const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords, result.entradaRecords || entradaRecords);
        
        setProducts(sanitized.products);
        setSales(sanitized.sales);
        if (result.mlRecords && Array.isArray(result.mlRecords)) {
          setMlRecords(result.mlRecords);
        }
        if (result.entradaRecords && Array.isArray(result.entradaRecords)) {
          const filtered = result.entradaRecords.filter(e => {
            const opStat = String(e.operationStatus || '').toLowerCase().trim();
            const tipo = String(e.releaseStatus || e.description || '').toLowerCase().trim();
            if (tipo && !tipo.includes('libera') && !tipo.includes('dispon')) return false;
            if (opStat && (opStat.includes('cancelad') || opStat.includes('estorn') || opStat.includes('devol') || (opStat !== 'pago' && opStat !== 'paga' && opStat !== 'paid' && opStat !== 'aprovado' && opStat !== 'concluido'))) {
              return false;
            }
            return true;
          });
          setEntradaRecords(filtered);
        }

        if (result.bannedProducts && Array.isArray(result.bannedProducts)) {
          setBannedProducts(prev => {
            const setNames = new Set(prev.map(b => String(b).trim().toLowerCase()));
            const newItems = [...prev];
            result.bannedProducts.forEach((b: any) => {
              const str = typeof b === 'string' ? b : (b.name || String(b));
              if (str && !setNames.has(str.trim().toLowerCase())) {
                setNames.add(str.trim().toLowerCase());
                newItems.push(str.trim());
              }
            });
            return newItems;
          });
        }
        
        // Sincronizar o capital inicial / aporte
        if (result.initialCapital !== undefined && typeof result.initialCapital === 'number' && result.initialCapital > 0) {
          if (result.hasConfigSheet || result.initialCapital !== 500) {
            setInitialCapital(result.initialCapital);
            localStorage.setItem('ml_initial_capital', String(result.initialCapital));
          }
        }

        console.log('Dados importados e sanitizados com sucesso do Google Sheets!');
        setHasFetchedFromCloud(true);
        setHasPendingWrite(false); // Como acabamos de ler, não temos alterações locais novas a gravar
        return { status: 'success', message: `Leitura concluída com sucesso! ${sanitized.products.length} produtos e ${sanitized.sales.length} vendas importados da sua planilha.` };
      } else {
        throw new Error(result?.message || 'Erro do Google Apps Script');
      }
    } catch (err: any) {
      console.error('Erro ao ler dados manuais da nuvem:', err);
      const errorMsg = err.message || String(err);
      setCloudSyncError(errorMsg);
      return { status: 'error', message: `Erro ao importar dados da planilha: ${errorMsg}. Certifique-se de que o Apps Script foi implantado corretamente como Web App (Qualquer pessoa) e que removeu o "setHeader" dele se estiver usando o modelo antigo.` };
    } finally {
      setIsFetchingFromCloud(false);
    }
  };

  const handleMasterSync = async (): Promise<{ status: 'success' | 'error'; message: string }> => {
    let currentWebAppUrl = webAppUrl;
    if (spreadsheetUrl) {
      setIsFetchingWebAppUrl(true);
      try {
        const res = await fetch(`/api/get-webapp-url?spreadsheetUrl=${encodeURIComponent(spreadsheetUrl)}`);
        const data = await res.json();
        if (data.webAppUrl) {
          currentWebAppUrl = data.webAppUrl;
          setWebAppUrl(data.webAppUrl);
          localStorage.setItem('ml_webapp_url', data.webAppUrl);
        }
      } catch (err) {
        console.error('Erro no Master Sync URL:', err);
      } finally {
        setIsFetchingWebAppUrl(false);
      }
    }

    if (!currentWebAppUrl) {
      return { status: 'error', message: 'Nenhuma URL de Web App encontrada na aba Database.' };
    }

    setIsFetchingFromCloud(true);
    setCloudSyncError(null);
    try {
      console.log('Forçando Master Sync...', currentWebAppUrl);
      const url = `/api/sync-sheets?webAppUrl=${encodeURIComponent(currentWebAppUrl)}`;
      const response = await fetch(url);
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message || `HTTP ${response.status}`);
      }

      if (result && result.status === 'success') {
        const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords, result.entradaRecords || entradaRecords);
        setProducts(sanitized.products);
        setSales(sanitized.sales);
        if (result.mlRecords && Array.isArray(result.mlRecords)) setMlRecords(result.mlRecords);
        if (result.entradaRecords && Array.isArray(result.entradaRecords)) {
          setEntradaRecords(result.entradaRecords);
        }
        if (result.initialCapital !== undefined && typeof result.initialCapital === 'number') {
           setInitialCapital(result.initialCapital);
           localStorage.setItem('ml_initial_capital', String(result.initialCapital));
        }

        setHasFetchedFromCloud(true);
        setHasPendingWrite(false);
        return { status: 'success', message: 'Master Sync concluído: URL atualizada e dados puxados com sucesso!' };
      } else {
        throw new Error(result?.message || 'Erro no sync.');
      }
    } catch (error: any) {
      console.error('Erro no Master Sync Pull:', error);
      return { status: 'error', message: String(error.message || error) };
    } finally {
      setIsFetchingFromCloud(false);
    }
  };

  // Intervalo de atualização periódica para manter múltiplos dispositivos sincronizados em tempo real (20 segundos)
  useEffect(() => {
    if (!webAppUrl || !hasFetchedFromCloud) return;

    const interval = setInterval(async () => {
      // Apenas atualiza se o documento estiver visível para evitar chamadas de API desnecessárias em background
      if (document.hidden) return;

      // Se temos alterações locais pendentes de gravação, não buscamos da nuvem para evitar sobrescrever dados locais
      if (hasPendingWrite) return;

      try {
        const url = `/api/sync-sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
        const response = await fetch(url);
        if (response.ok) {
          const result = await response.json();
          if (result.status === 'success') {
            // Apenas atualiza se houver dados e forem diferentes dos atuais para evitar re-renderizações e ciclos infinitos
            const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords);
            
            if (sanitized.products && JSON.stringify(sanitized.products) !== JSON.stringify(products)) {
              setProducts(sanitized.products);
            }
            if (sanitized.sales && JSON.stringify(sanitized.sales) !== JSON.stringify(sales)) {
              setSales(sanitized.sales);
            }
            if (result.mlRecords && JSON.stringify(result.mlRecords) !== JSON.stringify(mlRecords)) {
              setMlRecords(result.mlRecords);
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao atualizar dados em background:', err);
      }
    }, 20000); // 20s de intervalo para tempo real sem sobrecarregar a cota do Apps Script

    return () => clearInterval(interval);
  }, [webAppUrl, hasFetchedFromCloud, products, sales, mlRecords, hasPendingWrite]);

  // Sincronização em background: SOMENTE executa se o usuário fez uma alteração MANUAL EXPLÍCITA (hasPendingWrite === true)
  // e NUNCA grava se a lista de produtos estiver vazia, garantindo a integridade absoluta da database (SSOT)
  useEffect(() => {
    if (!webAppUrl) return;
    
    // Trava de segurança: se não houve alteração pendente pelo usuário ou se ainda está buscando da nuvem, bloqueia o envio
    if (isFetchingFromCloud || !hasFetchedFromCloud || !hasPendingWrite) return;

    const syncTimeout = setTimeout(async () => {
      setIsCloudSyncing(true);
      setCloudSyncError(null);
      try {
        const response = await fetch('/api/sync-sheets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ webAppUrl, products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix, bannedProducts })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Erro no Apps Script');
        }
        console.log('Sincronização manual salva com sucesso na planilha!');
        setHasPendingWrite(false); // Reseta a flag de alterações pendentes após sucesso
      } catch (err: any) {
        console.error('Erro na sincronização:', err);
        setCloudSyncError(err.message || String(err));
      } finally {
        setIsCloudSyncing(false);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(syncTimeout);
  }, [products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix, webAppUrl, isFetchingFromCloud, hasFetchedFromCloud, hasPendingWrite]);

  const handlePushToCloudExplicit = async () => {
    if (!webAppUrl) return;
    setIsCloudSyncing(true);
    setCloudSyncError(null);
    try {
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webAppUrl, products, sales, initialCapital, mlRecords, entradaRecords, entradaRawMatrix })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.message || `HTTP ${response.status}`);
      }
      setHasPendingWrite(false);
    } catch (err: any) {
      console.error('Erro ao enviar para o Sheets:', err);
      setCloudSyncError(err.message || String(err));
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Atualização em memória das vendas pendentes (conclusão por 30 dias apenas para exibição no painel, sem disparar escrita na nuvem)
  useEffect(() => {
    let changed = false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const updatedSales = sales.map(s => {
      const currentStatus = s.status || 'pending';
      if (currentStatus === 'refunded' || currentStatus === 'completed') {
        return s;
      }

      const saleDate = parseMLDate(s.date);
      if (!saleDate) return s;
      saleDate.setHours(0, 0, 0, 0);
      const diffTime = now.getTime() - saleDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 30) {
        changed = true;
        return {
          ...s,
          status: 'completed' as const
        };
      }
      return s;
    });

    if (changed) {
      setSales(updatedSales);
      // NUNCA acionar setHasPendingWrite(true) aqui para evitar que abertura do site envie POST para a planilha!
    }
  }, [sales]);

  // Função para concluir venda pendente manualmente
  const handleCompleteSale = (saleId: string) => {
    setSales(prev => prev.map(s => {
      if (s.id === saleId) {
        return {
          ...s,
          status: 'completed' as const
        };
      }
      return s;
    }));
    setHasPendingWrite(true);
  };

  // Contar produtos com estoque crítico (abaixo do nível de segurança)
  const lowStockCount = products.filter(p => calculateCurrentStock(p, sales, products) <= p.minimalStock).length;

  // Funções de manipulação do estoque e vendas
  const handleAddProduct = (newProduct: Omit<Product, 'id'>) => {
    const freshProduct: Product = {
      ...newProduct,
      id: newProduct.sku
    };
    const nextProducts = [freshProduct, ...products.filter(p => p.id !== freshProduct.id)];
    setProducts(nextProducts);
    const reSanitized = sanitizeCloudData(nextProducts, sales, mlRecords, entradaRecords);
    setSales(reSanitized.sales);
    setHasPendingWrite(true);
  };

  const handleEditProduct = (updatedProd: Product) => {
    const nextProducts = products.map(p => p.id === updatedProd.id ? updatedProd : p);
    setProducts(nextProducts);
    const reSanitized = sanitizeCloudData(nextProducts, sales, mlRecords, entradaRecords);
    setSales(reSanitized.sales);
    setHasPendingWrite(true);
  };

  const handleDeleteProduct = (id: string) => {
    const nextProducts = products.filter(p => p.id !== id);
    setProducts(nextProducts);
    const reSanitized = sanitizeCloudData(nextProducts, sales, mlRecords, entradaRecords);
    setSales(reSanitized.sales);
    setHasPendingWrite(true);
  };

  const handleBanProduct = (productTarget: string) => {
    const normName = String(productTarget || '').trim();
    if (!normName) return;

    const lowerName = normName.toLowerCase();

    setBannedProducts(prev => {
      if (prev.some(b => b.trim().toLowerCase() === lowerName)) return prev;
      return [...prev, normName];
    });

    const nextProducts = products.filter(p => {
      const pNameLower = String(p.name || '').trim().toLowerCase();
      const pSkuLower = String(p.sku || '').trim().toLowerCase();
      return pNameLower !== lowerName && pSkuLower !== lowerName;
    });

    setProducts(nextProducts);
    const reSanitized = sanitizeCloudData(nextProducts, sales, mlRecords, entradaRecords);
    setSales(reSanitized.sales);
    setHasPendingWrite(true);
  };

  const handleUnbanProduct = (productName: string) => {
    const normName = productName.trim().toLowerCase();
    setBannedProducts(prev => prev.filter(b => b.trim().toLowerCase() !== normName));
    setHasPendingWrite(true);
  };

  const handleUnlinkAllProducts = () => {
    const nextProducts = products.map(p => ({
      ...p,
      skus: []
    }));
    setProducts(nextProducts);
    const reSanitized = sanitizeCloudData(nextProducts, sales, mlRecords, entradaRecords);
    setSales(reSanitized.sales);
    setHasPendingWrite(true);
  };

  const handleAddSale = (newSale: Omit<Sale, 'id' | 'grossProfit' | 'netProfit'>) => {
    const totalSaleValue = newSale.salePrice * newSale.quantity;
    const totalCostValue = newSale.purchasePrice * newSale.quantity;
    const discount = newSale.discount || 0;
    
    const grossProfit = newSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
    const shipRev = newSale.shippingRevenue || 0;
    const taxAmount = totalSaleValue * 0.04;
    const aReceberML = totalSaleValue - newSale.mlFee + shipRev - newSale.shippingCost;
    const netProfit = newSale.status === 'refunded' ? -newSale.shippingCost : (aReceberML - taxAmount - totalCostValue);

    // Calcular se a data da venda está acima de 30 dias atrás
    const saleDate = new Date(newSale.date + 'T12:00:00');
    const now = new Date();
    saleDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = now.getTime() - saleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const status = newSale.status === 'refunded' ? 'refunded' : (diffDays >= 30 ? 'completed' : 'pending');

    const validMlId = cleanMlSaleId(newSale.mlSaleId);
    const saleId = validMlId || (newSale.mlSaleId ? String(newSale.mlSaleId).trim() : `manual_${Date.now()}`);

    const freshSale: Sale = {
      ...newSale,
      id: saleId,
      mlSaleId: validMlId || newSale.mlSaleId,
      grossProfit: Number(grossProfit.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      status
    };

    // O estoque atual é calculado dinamicamente no utils.ts
    setSales(prev => [freshSale, ...prev]);
    setHasPendingWrite(true);
  };

  const handleCancelSale = (saleId: string, lossAmount: number = 0, lossReason: string = '') => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return;

    // Ao invés de deletar, atualiza o status para 'refunded', zera os lucros e venda, e salva o prejuízo extra e o motivo.
    // O estorno automaticamente devolve o estoque via calculateCurrentStock!
    setSales(prev => prev.map(s => {
      if (s.id === saleId) {
        return {
          ...s,
          status: 'refunded' as const,
          netProfit: 0,
          grossProfit: 0,
          lossAmount: Number(lossAmount) || 0,
          lossReason: lossReason || undefined
        };
      }
      return s;
    }));
    setHasPendingWrite(true);
  };

  // Editar Registro de Venda Concluído/Pendente/Cancelado
  const handleEditSale = (updatedSale: Sale) => {
    const oldSale = sales.find(s => s.id === updatedSale.id);
    if (!oldSale) return;

    // 2. Calcular lucro bruto e líquido recalculados com base em seus valores, descontando o desconto
    const totalSaleValue = updatedSale.salePrice * updatedSale.quantity;
    const totalCostValue = updatedSale.purchasePrice * updatedSale.quantity;
    const discount = updatedSale.discount || 0;
    
    let grossProfit = 0;
    let netProfit = 0;
    let shipRev = updatedSale.shippingRevenue || 0;

    if (updatedSale.isMlSale || updatedSale.mlSaleId) {
      const idToSearch = (updatedSale.mlSaleId || updatedSale.id || '').split('_')[0];
      const originalRecord = mlRecords.find(r => r.id === idToSearch || updatedSale.id.startsWith(r.id));
      
      if (originalRecord) {
        shipRev = updatedSale.status === 'refunded' ? 0 : Math.abs(originalRecord.shippingRevenue || 0);
        const taxAmount = totalSaleValue * 0.04;
        if (updatedSale.status === 'refunded') {
          netProfit = -updatedSale.shippingCost;
          grossProfit = 0;
        } else {
          const aReceberML = totalSaleValue + (originalRecord ? (originalRecord.surchargeRevenue || 0) + (originalRecord.installmentFee || 0) : 0) - updatedSale.mlFee + shipRev - updatedSale.shippingCost;
          netProfit = aReceberML - taxAmount - totalCostValue;
          grossProfit = totalSaleValue - totalCostValue;
        }
      } else {
        const taxAmount = totalSaleValue * 0.04;
        if (updatedSale.status === 'refunded') {
          netProfit = -updatedSale.shippingCost;
          grossProfit = 0;
        } else {
          const aReceberML = totalSaleValue + (originalRecord ? (originalRecord.surchargeRevenue || 0) + (originalRecord.installmentFee || 0) : 0) - updatedSale.mlFee + shipRev - updatedSale.shippingCost;
          netProfit = aReceberML - taxAmount - totalCostValue;
          grossProfit = totalSaleValue - totalCostValue;
        }
      }
    } else {
      grossProfit = updatedSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
      const taxAmount = totalSaleValue * 0.04;
      const aReceberML = totalSaleValue - updatedSale.mlFee + shipRev - updatedSale.shippingCost;
      netProfit = updatedSale.status === 'refunded' ? -updatedSale.shippingCost : (aReceberML - taxAmount - totalCostValue);
    }

    const freshSale: Sale = {
      ...updatedSale,
      shippingRevenue: shipRev,
      grossProfit: Number(grossProfit.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2))
    };

    setSales(prev => prev.map(s => s.id === updatedSale.id ? freshSale : s));
    setHasPendingWrite(true);
  };

  const handleClearDatabase = () => {
    setProducts([]);
    setSales([]);
    setHasPendingWrite(true);
  };

  const handleUpdateCapital = (newCapital: number) => {
    if (newCapital !== initialCapital) {
      setInitialCapital(newCapital);
      setHasPendingWrite(true);
    }
  };

  
  const handleImportRecebimentos = (records: any[], rawMatrix?: any[][]): number => {
    let updatedCount = 0;

    if (rawMatrix && Array.isArray(rawMatrix) && rawMatrix.length > 0) {
      setEntradaRawMatrix(rawMatrix);
    }

    const isStrictSaleId = (val: any): boolean => {
      if (!val) return false;
      const str = String(val).trim();
      if (/[eE\+,\.]/.test(str)) return false;
      if (str.toLowerCase().includes('prod_')) return false;
      return /^\d{8,20}$/.test(str);
    };

    // Apenas considerar registros com ID numérico de pacote/venda válido, Tipo = Liberação e Status da Operação = Pago
    const validRecords = records.filter(r => {
      const rawId = String(r.id || r.mlSaleId || '').trim();
      if (!isStrictSaleId(rawId)) return false;

      const tipo = String(r.releaseStatus || r.description || '').toLowerCase();
      if (tipo && !tipo.includes('libera') && !tipo.includes('dispon')) return false;

      const opStat = String(r.operationStatus || '').toLowerCase();
      if (opStat && (opStat.includes('cancelad') || opStat.includes('estorn') || opStat.includes('devol') || (opStat !== 'pago' && opStat !== 'paga' && opStat !== 'paid' && opStat !== 'aprovado' && opStat !== 'concluido'))) {
        return false;
      }
      return true;
    });

    const canceledRecords = records.filter(r => {
      const rawId = String(r.id || r.mlSaleId || '').trim();
      if (!isStrictSaleId(rawId)) return false;
      const opStat = String(r.operationStatus || '').toLowerCase();
      const tipo = String(r.releaseStatus || r.description || '').toLowerCase();
      return opStat.includes('cancelad') || opStat.includes('estorn') || tipo.includes('estorno') || tipo.includes('cancel');
    });

    setSales(prev => {
      const updated = prev.map(s => {
        if (s.mlSaleId || s.id) {
          const mlId = (s.mlSaleId || s.id).split('_')[0].trim();
          
          // Se foi cancelado na entrada de valores, NUNCA fica como concluída/liberada
          const isCanceled = canceledRecords.some(r => {
            const rId = String(r.id || r.mlSaleId || '').trim();
            return rId === mlId || mlId.includes(rId) || rId.includes(mlId);
          });
          if (isCanceled && s.status === 'completed') {
            return { ...s, status: 'pending' as const };
          }

          const rec = validRecords.find(r => {
            const rId = String(r.id || r.mlSaleId || '').trim();
            return rId === mlId || mlId.includes(rId) || rId.includes(mlId);
          });
          if (rec && s.status !== 'completed' && s.status !== 'refunded') {
            updatedCount++;
            return { ...s, status: 'completed' as const };
          }
        }
        return s;
      });
      return updated;
    });

    const newEntradaList: EntradaValorRecord[] = validRecords.map(r => {
      const rId = String(r.id || r.mlSaleId).trim();

      // Cruzar com a base de vendas para resgatar o nome real do item caso venha com código MLB ou 'Item Mercado Livre'
      const matchedSale = sales.find(s => {
        const mlId = (s.mlSaleId || s.id).split('_')[0].trim();
        return mlId === rId || mlId.includes(rId) || rId.includes(mlId);
      });

      let name = r.productName;
      if (!name || name === 'Item Mercado Livre' || /^MLB\d+/i.test(name)) {
        if (matchedSale && matchedSale.productName && !/^MLB\d+/i.test(matchedSale.productName)) {
          name = matchedSale.productName;
        }
      }

      return {
        id: rId,
        dateStr: r.dateStr || '',
        description: 'Liberação',
        releaseStatus: r.releaseStatus || 'Liberação',
        operationStatus: r.operationStatus || 'Pago',
        productName: name || (matchedSale ? matchedSale.productName : 'Item Mercado Livre')
      };
    });

    setEntradaRecords(prev => {
      // Filtrar a lista anterior descartando cancelados, datas ou IDs inválidos
      const filteredPrev = prev.filter(item => {
        if (!isStrictSaleId(item.id)) return false;
        const opStat = String(item.operationStatus || '').toLowerCase();
        if (opStat && (opStat.includes('cancelad') || opStat.includes('estorn') || (opStat !== 'pago' && opStat !== 'paga' && opStat !== 'paid' && opStat !== 'aprovado' && opStat !== 'concluido'))) {
          return false;
        }
        return true;
      });
      const existingMap = new Map<string, EntradaValorRecord>(filteredPrev.map(item => [item.id, item]));

      // Remover explicitamente qualquer item cancelado
      canceledRecords.forEach(c => {
        const cId = String(c.id || c.mlSaleId || '').trim();
        existingMap.delete(cId);
      });

      newEntradaList.forEach(item => {
        const existing = existingMap.get(item.id);
        if (!existing || /^MLB\d+/i.test(existing.productName) || existing.productName === 'Item Mercado Livre') {
          existingMap.set(item.id, item);
        }
      });
      return Array.from(existingMap.values());
    });

    setHasPendingWrite(true);
    return updatedCount;
  };

  const handleImportMLRecords = async (records: MLImportRecord[]) => {
    // 0. Filtrar rigorosamente produtos no estoque garantindo que apenas títulos válidos permaneçam
    let updatedProducts = products.filter(p => p && isValidProductTitle(p.name));
    let updatedSales = [...sales];
    
    records.forEach((r, idx) => {
          // Limpar e sanitizar adTitle
          let cleanTitle = (r.adTitle || '').trim();
          if (!isValidProductTitle(cleanTitle)) {
            cleanTitle = '';
          }
          if (!cleanTitle && r.sku && isValidProductTitle(r.sku)) {
            cleanTitle = r.sku;
          }
          r.adTitle = cleanTitle;

          // Formatar data da venda de forma segura e padronizada (YYYY-MM-DD)
          let formattedDate = toStandardDateISO(r.dateStr || '');

          // 1. Localizar produto no catálogo
          let matchingProduct = findMatchingProduct(r, updatedProducts);

          let isIgnored = false;
          if (!matchingProduct) {
            // Regra POP 1.2 SSOT e 1.4: Se o produto não existe no estoque fornecido pelo usuário, a venda é isolada e enviada para Vendas Ignoradas
            isIgnored = true;
          }
          // Regra do Usuário: O sistema NUNCA auto-vincula IDs de anúncio ao produto.
          // Vinculação é realizada EXCLUSIVAMENTE pelo usuário de forma manual se ele desejar.

          const finalSaleTitle = (r.adTitle && isValidProductTitle(r.adTitle))
            ? r.adTitle
            : (matchingProduct ? matchingProduct.name : 'Venda Desconhecida');

          let finalProductId = matchingProduct ? matchingProduct.id : '';

          // 2. Mapear status do ML para status da venda com base estrita no período de 30 dias se não for reembolsada
          let saleStatus: 'completed' | 'pending' | 'refunded' | 'ignored' = 'completed';
          const statusLower = (r.status || '').toLowerCase();
          const descLower = (r.statusDescription || '').toLowerCase();
          const isRefunded = 
            statusLower.includes('cancelad') || 
            statusLower.includes('devol') || 
            statusLower.includes('reembols') || 
            statusLower.includes('refund') || 
            statusLower.includes('estorn') ||
            descLower.includes('cancelad') || 
            descLower.includes('devol') || 
            descLower.includes('reembols') || 
            descLower.includes('refund') || 
            descLower.includes('estorn');

          if (isIgnored) {
            saleStatus = 'ignored';
          } else if (isRefunded) {
            saleStatus = 'refunded';
          } else {
            const saleDateObj = parseMLDate(formattedDate);
            if (saleDateObj) {
              const nowObj = new Date();
              saleDateObj.setHours(0, 0, 0, 0);
              nowObj.setHours(0, 0, 0, 0);
              const diffTime = nowObj.getTime() - saleDateObj.getTime();
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              saleStatus = diffDays < 30 ? 'pending' : 'completed';
            } else {
              saleStatus = 'pending';
            }
          }
          
          const totalSaleValue = r.productRevenue;
          const totalCostValue = matchingProduct ? (matchingProduct.purchasePrice * r.units) : 0;
          
          // 3. Verificar se essa venda já existe na nossa base de vendas (pelo ID do ML ou produto + data)
          const realMlId = cleanMlSaleId(r.id);
          const uniqueSaleId = realMlId || `sale_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`;
          const existingSaleIdx = updatedSales.findIndex(s => 
            (realMlId && getSaleMlId(s) === realMlId) || 
            s.id === uniqueSaleId ||
            (matchingProduct && !getSaleMlId(s) && s.productId === matchingProduct.id && s.date === formattedDate && Math.abs((s.salePrice * s.quantity) - totalSaleValue) < 0.05)
          );
          const discount = r.discountsAndBonuses || 0;
          const rawRecordFee = Math.abs(r.saleFeeAndTaxes || 0);
          const rawShippingFee = Math.abs(r.shippingFee || 0) + Math.abs(r.shippingWeightCost || 0) + Math.abs(r.shippingDiffCost || 0);
          const shippingRevenue = saleStatus === 'refunded' ? 0 : Math.abs(r.shippingRevenue || 0);
          
          let mlFee = 0;
          let shippingCost = 0;

          if (saleStatus === 'refunded') {
            mlFee = 0;
            shippingCost = rawShippingFee > 0 ? rawShippingFee : ((matchingProduct && matchingProduct.shippingCost > 0) ? matchingProduct.shippingCost : 6.65);
          } else {
            if (rawRecordFee > 0) {
              mlFee = rawRecordFee;
            } else if (matchingProduct) {
              mlFee = calculateMLFee(r.productRevenue / r.units, matchingProduct.mlFeeType, matchingProduct.customFeePercent) * r.units;
            }

            // Custo de frete do Mercado Livre: se 0 no relatório, o vendedor não teve custo de frete
            shippingCost = rawShippingFee;
          }
          
          const taxAmount = totalSaleValue * 0.04;
          const grossProfit = saleStatus === 'refunded' ? 0 : totalSaleValue - totalCostValue;
          
          // PDF Rule 4.3.1: A Receber do ML = Receita(H) + Acrescimo(I) + Parcelamento(J) + Tarifa(K) + Rec.Envio(L) + TarifaEnvio(M)
          // PDF Rule 4.3.2: Lucro Real = A Receber - Custo Compra - Imposto
          const aReceberML = totalSaleValue 
                           + (r.surchargeRevenue || 0) 
                           + (r.installmentFee || 0) 
                           - mlFee 
                           + (r.shippingRevenue || 0) 
                           - shippingCost;
          
          const netProfit = saleStatus === 'refunded' ? -shippingCost : (aReceberML - taxAmount - totalCostValue);
          
          // Determinar tipo de logística
          let shippingType: 'full' | 'flex' | 'transportadora' = 'transportadora';
          const methodLower = (r.shippingMethod || '').toLowerCase();
          const carrierLower = (r.carrier || '').toLowerCase();
          if (methodLower.includes('full') || carrierLower.includes('full')) {
            shippingType = 'full';
          } else if (methodLower.includes('flex') || carrierLower.includes('flex')) {
            shippingType = 'flex';
          }
          
          if (existingSaleIdx !== -1) {
            // Se já existe, atualizamos os dados para refletir as mudanças de status, frete, produto e custo de compra
            const oldSale = updatedSales[existingSaleIdx];
            
            // CHAVE PRIMÁRIA: Se a venda antiga já tinha um ID de Produto válido associado, preservar! (Não deixar o fuzzy match sobrescrever)
            let preservedProductId = oldSale.productId;
            let preservedProductName = oldSale.productName;
            let preservedPurchasePrice = oldSale.purchasePrice;
            
            if (!preservedProductId || preservedProductId === finalProductId || !updatedProducts.find(p => p.id === preservedProductId)) {
              // Só atualiza o produto se a venda antiga não tinha produto, ou era o mesmo, ou o produto antigo não existe mais no estoque
              preservedProductId = finalProductId;
              preservedProductName = finalSaleTitle;
              preservedPurchasePrice = matchingProduct ? matchingProduct.purchasePrice : 0;
            }

            updatedSales[existingSaleIdx] = {
              ...oldSale,
              id: uniqueSaleId,
              productId: preservedProductId,
              productName: preservedProductName,
              status: saleStatus,
              quantity: r.units,
              salePrice: r.units > 0 ? Number((r.productRevenue / r.units).toFixed(2)) : r.productRevenue,
              purchasePrice: preservedPurchasePrice,
              grossProfit: Number(grossProfit.toFixed(2)),
              netProfit: Number(netProfit.toFixed(2)),
              mlFee: Number(mlFee.toFixed(2)),
              shippingCost: Number(shippingCost.toFixed(2)),
              shippingRevenue,
              discount,
              shippingType,
              sku: r.sku || oldSale.sku,
              adId: r.adId || oldSale.adId,
              buyerName: r.buyerName,
              buyerDocument: r.buyerDocument,
              buyerAddress: r.buyerAddress,
              trackingNumber: r.trackingNumber,
              carrier: r.carrier,
              trackingUrl: r.trackingUrl,
              isMlSale: !!realMlId,
              mlSaleId: realMlId
            };
          } else {
            // Se não existe, inserimos uma nova venda no histórico
            updatedSales.push({
              id: uniqueSaleId,
              productId: finalProductId,
              productName: finalSaleTitle,
              sku: r.sku,
              adId: r.adId,
              quantity: r.units,
              salePrice: r.productRevenue / r.units,
              purchasePrice: matchingProduct ? matchingProduct.purchasePrice : 0,
              date: formattedDate,
              discount,
              mlFee: Number(mlFee.toFixed(2)),
              shippingCost: Number(shippingCost.toFixed(2)),
              shippingRevenue,
              grossProfit: Number(grossProfit.toFixed(2)),
              netProfit: Number(netProfit.toFixed(2)),
              status: saleStatus,
              mlSaleId: realMlId,
              isMlSale: !!realMlId,
              shippingType,
              buyerName: r.buyerName,
              buyerDocument: r.buyerDocument,
              buyerAddress: r.buyerAddress,
              trackingNumber: r.trackingNumber,
              carrier: r.carrier,
              trackingUrl: r.trackingUrl
            });
          }
        });

    // Se estamos importando vendas reais do Mercado Livre, removemos vendas de demonstração padrão (sale_1 a sale_7)
    const baseSales = records.length > 0 ? updatedSales.filter(s => !s.id.match(/^sale_[1-7]$/)) : updatedSales;

    const uniqueSalesMap = new Map<string, Sale>();
    const deduplicatedSales: Sale[] = [];
    
    baseSales.forEach(s => {
      const realId = getSaleMlId(s);
      if (realId) {
        if (!uniqueSalesMap.has(realId)) {
          uniqueSalesMap.set(realId, s);
          deduplicatedSales.push(s);
        } else {
          const existing = uniqueSalesMap.get(realId)!;
          if (s.lossAmount && !existing.lossAmount) {
             Object.assign(existing, s);
          }
        }
      } else {
        deduplicatedSales.push(s);
      }
    });

    // Atualizar status de arquivamento dos produtos (Regra de 30 dias sem vendas)
    updatedProducts.forEach(p => {
      const activity = getProductSalesActivity(p, deduplicatedSales, updatedProducts);
      p.status = activity.isArchived ? 'archived' : 'active';
    });

    setSales(deduplicatedSales);
    setProducts(updatedProducts);
    
    setMlRecords(prev => {
      const newRecords = [...prev];
      records.forEach(r => {
        if (!newRecords.some(nr => nr.id === r.id)) {
          newRecords.push(r);
        }
      });
      return newRecords;
    });

    setHasPendingWrite(true);
  };

  const handleClearMLRecords = () => {
    setMlRecords([]);
    setEntradaRecords([]);
    setEntradaRawMatrix(null);
    try {
      localStorage.removeItem('ml_entrada_records');
      localStorage.removeItem('ml_entrada_raw_matrix');
    } catch (e) {}
    setHasPendingWrite(true);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center p-4 font-sans selection:bg-[#FFE600] selection:text-black">
        <div className="bg-[#121212] rounded-3xl border border-white/5 w-full max-w-md p-8 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
          {/* Sabor visual - Lock background */}
          <div className="absolute right-0 top-0 opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-12">
            <Lock className="w-80 h-80 text-white" />
          </div>

          <div className="flex flex-col items-center">
            {/* Logo Mercado Livre Style Padlock */}
            <div className="bg-[#FFE600] text-black p-4 rounded-2xl shadow-[0_5_15px_rgba(255,230,0,0.15)] flex items-center justify-center mb-6">
              <Lock className="w-9 h-9 text-black stroke-[2.5]" />
            </div>

            <div className="text-center space-y-2 mb-8 select-none">
              <span className="text-[10px] font-black tracking-widest bg-[#FFE600] text-black px-2.5 py-1 rounded-full uppercase">
                ACESSO RESTRITO 🔒
              </span>
              <h2 className="text-xl sm:text-2xl font-light tracking-tight text-white pt-2">
                Controle de Investidor
              </h2>
              <p className="text-xs text-white/50 max-w-sm mx-auto mt-1 leading-relaxed">
                Este painel de faturamento possui dados sigilosos do investidor. Confirme sua senha de acesso para prosseguir.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (passwordInput === 'Investidor123') {
                  setIsAuthenticated(true);
                  localStorage.setItem('is_ml_authenticated', 'true');
                  setPasswordError(null);
                } else {
                  setPasswordError('Senha de segurança incorreta! Tente novamente.');
                }
              }}
              className="w-full space-y-5"
            >
              <div>
                <label className="text-xs font-bold text-white/60 block mb-1.5 pl-1">Digite a senha de segurança</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-white/30">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(null);
                    }}
                    placeholder="Senha de Acesso"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30 font-bold transition-all placeholder:text-white/20 tracking-wider font-mono"
                  />
                </div>
                {passwordError && (
                  <p className="text-red-500 text-xs font-bold mt-2 pl-1 animate-pulse">
                    ⚠️ {passwordError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="w-full bg-[#FFE600] hover:bg-[#FFE600]/85 text-black font-extrabold text-xs py-3.5 px-5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-[0_4_12px_rgba(255,230,0,0.15)] hover:shadow-[0_4_16px_rgba(255,230,0,0.25)] active:scale-95 uppercase tracking-wider"
              >
                <span>Desbloquear Painel</span>
                <Unlock className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Se estiver carregando o banco de dados pela primeira vez na inicialização após o login
  if (!hasFetchedFromCloud && isFetchingFromCloud) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center max-w-sm text-center space-y-6">
          <div className="relative">
            {/* Um círculo pulsante em volta do logo do Mercado Livre */}
            <div className="absolute inset-0 bg-[#FFE600]/20 rounded-full blur-xl animate-pulse"></div>
            <div className="bg-[#FFE600] text-black p-5 rounded-full shadow-[0_0_30px_rgba(255,230,0,0.3)] relative">
              <svg className="w-10 h-10 animate-spin text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-[10px] font-black tracking-widest bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20 px-3 py-1 rounded-full uppercase">
                SINCRONIZANDO EM REALTIME 🔄
              </span>
              <h2 className="text-xl font-light tracking-tight pt-2">
                Buscando Banco de Dados
              </h2>
              <p className="text-xs text-white/50 leading-relaxed">
                Carregando estoque, faturamento e vendas sincronizadas do Google Sheets. Por favor, aguarde...
              </p>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={() => {
                  setIsFetchingFromCloud(false);
                  setHasFetchedFromCloud(true); // Desbloqueia o aplicativo para o modo local
                  setActiveTab('sheets'); // Redireciona para aba de configurações
                }}
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[10px] py-3 px-4 rounded-xl transition-all cursor-pointer uppercase tracking-wider hover:text-[#FFE600] hover:border-[#FFE600]/30"
              >
                ⚙️ Ajustar Link ou Cancelar Sincronização
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans selection:bg-[#FFE600] selection:text-black">
      
      {/* Header com Abas e ML design */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lowStockCount={lowStockCount}
        isSheetsConnected={!!webAppUrl || !!spreadsheetUrl}
        onOpenTutorial={() => {}}
        isCloudSyncing={isCloudSyncing}
        isFetchingFromCloud={isFetchingFromCloud}
        cloudSyncError={cloudSyncError}
        products={products}
        onMasterSync={handleMasterSync}
        onLogout={() => {
          setIsAuthenticated(false);
          localStorage.removeItem('is_ml_authenticated');
          setPasswordInput('');
        }}
      />

      {/* Área de Conteúdo Principal com Container Limitador de Responsividade */}
      <main className="flex-1 max-w-[1550px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <DashboardOverview
            products={products}
            sales={sales}
            initialCapital={initialCapital}
            onUpdateCapital={handleUpdateCapital}
            onNavigateToTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'product-profits' && (
          <ProductProfitsPanel
            products={products}
            sales={sales}
            onNavigateToTab={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'stock' && (
          <StockControl
            products={products}
            sales={sales}
            bannedProducts={bannedProducts}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onBanProduct={handleBanProduct}
            onUnbanProduct={handleUnbanProduct}
            onClearDatabase={handleClearDatabase}
            onUnlinkAllProducts={handleUnlinkAllProducts}
          />
        )}

        {activeTab === 'sales' && (
          <SalesManager
            products={products}
            sales={sales}
            onAddSale={handleAddSale}
            onCancelSale={handleCancelSale}
            onCompleteSale={handleCompleteSale}
            onClearDatabase={handleClearDatabase}
            onEditSale={handleEditSale}
          />
        )}

        {activeTab === 'sheets' && (
          <SheetsIntegration
            products={products}
            sales={sales}
            spreadsheetUrl={spreadsheetUrl}
            onUpdateSpreadsheetUrl={setSpreadsheetUrl}
            webAppUrl={webAppUrl}
            onUpdateWebAppUrl={setWebAppUrl}
            onPullFromCloud={handlePullFromCloud}
            initialCapital={initialCapital}
            mlRecords={mlRecords}
            entradaRecords={entradaRecords}
            entradaRawMatrix={entradaRawMatrix || undefined}
          />
        )}

        {activeTab === 'mercadolivre' && (
          <MLImport
            products={products}
            mlRecords={mlRecords}
            onImportRecords={handleImportMLRecords}
            onClearRecords={handleClearMLRecords}
            isSheetsConnected={!!webAppUrl || !!spreadsheetUrl}
            onPushToCloud={handlePushToCloudExplicit}
            isSyncing={isCloudSyncing}
            onImportRecebimentos={handleImportRecebimentos}
          />
        )}

      </main>

      {/* Footer corporativo */}
      <footer className="bg-[#0d0d0d] text-white/40 py-6 border-t border-white/10 mt-12 text-center text-xs">
        <div className="max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
          <p>© 2026 Controle Administrativo de Vendas no Mercado Livre. Todos os direitos reservados.</p>
          <p className="text-[10px] text-white/20 font-medium">Desenvolvido com diretrizes de precisão gerencial de faturamento e fluxo líq. corporativo.</p>
        </div>
      </footer>

    </div>
  );
}
