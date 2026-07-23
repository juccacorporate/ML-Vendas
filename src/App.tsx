/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Product, Sale, MLImportRecord, findMatchingProduct } from './types';
import { INITIAL_PRODUCTS, INITIAL_SALES, normalizeName } from './utils';
import { Lock, Unlock, Key, LogOut } from 'lucide-react';

// Importando componentes modulares
import Header from './components/Header';
import DashboardOverview from './components/DashboardOverview';
import StockControl from './components/StockControl';
import SalesManager from './components/SalesManager';
import SheetsIntegration from './components/SheetsIntegration';
import MLImport from './components/MLImport';

export default function App() {
  // Migração automática do Web App URL para o novo fornecido pelo usuário
  const defaultNewUrl = 'https://script.google.com/macros/s/AKfycbz81q6fIBlapP5yD1lkDCMqh9Q3x-Eh_5deS_o_bm4mFKY0q21YkNMKx5KF4pyq-a9j/exec';
  const storedUrl = localStorage.getItem('ml_webapp_url');
  if (!storedUrl || storedUrl.includes('AKfycbyesx-83QVMrWKiaFOtfaVesZP4uWIXn2BSL-QBo2q5JNjZun5k8Vc4DTOaMohLLmdG')) {
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

  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem('ml_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/12F010pz_9MO9-8wOxeDnUmKnYiTrHXv7HZMuog2MZiE/edit?usp=sharing';
  });

  const [webAppUrl, setWebAppUrl] = useState<string>(() => {
    return localStorage.getItem('ml_webapp_url') || 'https://script.google.com/macros/s/AKfycbz81q6fIBlapP5yD1lkDCMqh9Q3x-Eh_5deS_o_bm4mFKY0q21YkNMKx5KF4pyq-a9j/exec';
  });

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
    return saved ? Number(saved) : 500;
  });

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
  const sanitizeCloudData = (cloudProducts: Product[], cloudSales: Sale[], cloudMlRecords?: MLImportRecord[]) => {
    const recordsToUse = cloudMlRecords || mlRecords || [];
    
    // Descartar produtos fantasma "Sim" e "Não" ou genericamente incorretos criados anteriormente
    const sanitizedProducts = (cloudProducts || [])
      .filter(p => {
        const n = (p.name || '').trim().toLowerCase();
        return n !== 'sim' && n !== 'não' && n !== 'nao';
      })
      .map(p => ({
        ...p,
        purchasePrice: Number(p.purchasePrice) || 0,
        salePrice: Number(p.salePrice) || 0,
        stock: Number(p.stock) || 0,
        minimalStock: Number(p.minimalStock) || 0,
        shippingCost: Number(p.shippingCost) || 0,
        customFeePercent: p.customFeePercent !== undefined ? Number(p.customFeePercent) : undefined
      }));

    const sanitizedSales = (cloudSales || []).map(s => {
      let salePrice = Number(s.salePrice) || 0;
      const quantity = Number(s.quantity) || 1;
      const discount = Number(s.discount) || 0;

      const cleanSaleProductName = (s.productName || '').trim();
      const isBadName = !cleanSaleProductName || ['sim', 'não', 'nao', 'produto mercado livre'].includes(cleanSaleProductName.toLowerCase());

      // Encontrar produto correspondente por ID ou Nome para consistência absoluta e correção de desalinhamentos
      let matchingProd: Product | undefined = sanitizedProducts.find(p => p.id === s.productId);
      if (!matchingProd && !isBadName) {
        matchingProd = sanitizedProducts.find(p => normalizeName(p.name) === normalizeName(cleanSaleProductName));
      } else if (matchingProd && !isBadName && normalizeName(matchingProd.name) !== normalizeName(cleanSaleProductName)) {
        const foundByName = sanitizedProducts.find(p => normalizeName(p.name) === normalizeName(cleanSaleProductName));
        if (foundByName) {
          matchingProd = foundByName;
        }
      }

      // Tentar re-vincular usando o registro do Mercado Livre (mlRecords)
      const idToSearch = (s.mlSaleId || s.id || '').split('_')[0];
      const originalRecord = recordsToUse.find(r => r.id === idToSearch || s.id.startsWith(r.id));

      if (isBadName || !matchingProd) {
        if (originalRecord) {
          const reFound = findMatchingProduct(originalRecord, sanitizedProducts);
          if (reFound) {
            matchingProd = reFound;
          }
        }
      }

      let productName = '';
      if (originalRecord && originalRecord.adTitle && !['sim', 'não', 'nao', 'produto mercado livre'].includes(originalRecord.adTitle.trim().toLowerCase())) {
        productName = originalRecord.adTitle;
      } else if (!isBadName) {
        productName = cleanSaleProductName;
      } else if (matchingProd) {
        productName = matchingProd.name;
      } else if (originalRecord && originalRecord.sku && !['sim', 'não', 'nao'].includes(originalRecord.sku.trim().toLowerCase())) {
        productName = originalRecord.sku;
      } else {
        productName = 'Produto Mercado Livre';
      }

      let productId = matchingProd ? matchingProd.id : s.productId;
      let purchasePrice = matchingProd ? matchingProd.purchasePrice : (Number(s.purchasePrice) || 0);

      // Corrigir preços corrompidos/bizarros (como datas formatadas por engano na planilha, menores ou iguais a zero ou absurdamente grandes)
      if (salePrice <= 0 || salePrice > 1000000) {
        if (Number(s.grossProfit) > 0 && purchasePrice > 0) {
          salePrice = Number(s.grossProfit) + purchasePrice + discount;
        } else if (matchingProd) {
          salePrice = matchingProd.salePrice;
        } else {
          salePrice = 0;
        }
      }

      const totalSaleValue = salePrice * quantity;
      const totalCostValue = purchasePrice * quantity;

      // Preservar propriedades locais se a planilha ainda não as tiver por usar script antigo
      const localSale = sales.find(ls => ls.id === s.id);
      
      let mlSaleId = s.mlSaleId || (localSale && localSale.mlSaleId);
      if (!mlSaleId && s.id) {
        const cleanId = s.id.split('_')[0];
        if (/^\d+$/.test(cleanId)) {
          mlSaleId = cleanId;
        }
      }
      const isMlSale = s.isMlSale || !!mlSaleId || (s.id && !s.id.startsWith('sale_') && /^\d/.test(s.id));

      let mlFee = Number(s.mlFee) || 0;
      let shippingCost = Number(s.shippingCost) || 0;
      let shipRev = s.shippingRevenue || 0;
      let grossProfit = 0;
      let netProfit = 0;

      if (isMlSale || mlSaleId) {
        const idToSearch = (mlSaleId || s.id || '').split('_')[0];
        const originalRecord = recordsToUse.find(r => r.id === idToSearch || s.id.startsWith(r.id));
        
        if (originalRecord) {
          mlFee = s.status === 'refunded' ? 0 : Math.abs(originalRecord.saleFeeAndTaxes);
          const rawShipCost = Math.abs(originalRecord.shippingFee) + Math.abs(originalRecord.shippingWeightCost) + Math.abs(originalRecord.shippingDiffCost);
          shipRev = s.status === 'refunded' ? 0 : Math.abs(originalRecord.shippingRevenue || 0);
          
          if (s.status === 'refunded') {
            shippingCost = Number(s.shippingCost) || (matchingProd ? matchingProd.shippingCost : 0) * quantity;
          } else if (totalSaleValue < 79 && (!s.shippingType || s.shippingType !== 'full') && !s.customShippingCost) {
            // Vendas < R$ 79 no Mercado Livre têm frete pago pelo comprador (exceto se o vendedor oferecer frete grátis)
            shippingCost = Math.max(0, rawShipCost - shipRev);
            if (shipRev === 0 && rawShipCost > 0) {
              shippingCost = 0; // O comprador pagou o frete no checkout do Mercado Livre
            }
          } else {
            shippingCost = rawShipCost;
          }
          
          const taxAmount = totalSaleValue * 0.04;
          if (s.status === 'refunded') {
            netProfit = -shippingCost;
            grossProfit = 0;
          } else {
            netProfit = totalSaleValue - mlFee - shippingCost - taxAmount + shipRev - totalCostValue;
            grossProfit = totalSaleValue - totalCostValue;
          }
        } else {
          // Fallback se não encontrar o registro em mlRecords
          const taxAmount = totalSaleValue * 0.04;
          if (s.status === 'refunded') {
            netProfit = -shippingCost;
            grossProfit = 0;
          } else {
            if (totalSaleValue < 79 && (!s.shippingType || s.shippingType !== 'full') && !s.customShippingCost) {
              if (shippingCost > 0 && shipRev === 0) {
                shippingCost = 0; // Vendas < R$ 79 no Mercado Livre
              }
            }
            netProfit = totalSaleValue - mlFee - shippingCost - taxAmount + shipRev - totalCostValue;
            grossProfit = totalSaleValue - totalCostValue;
          }
        }
      } else {
        // Normal manual sales recalculation
        if (!s.isCustomSale && matchingProd) {
          if (matchingProd.mlFeeType !== 'none') {
            const percent = matchingProd.mlFeeType === 'custom' 
              ? (matchingProd.customFeePercent || 0) 
              : (matchingProd.mlFeeType === 'classic' ? 12 : (matchingProd.mlFeeType === 'premium' ? 17 : 0));
            let calculatedFee = (salePrice * percent) / 100;
            if (salePrice < 79 && (matchingProd.mlFeeType === 'classic' || matchingProd.mlFeeType === 'premium')) {
              calculatedFee += 6;
            }
            mlFee = Number((calculatedFee * quantity).toFixed(2));
          } else {
            mlFee = 0;
          }
        }
        const taxAmount = totalSaleValue * 0.04;
        grossProfit = totalSaleValue - totalCostValue;
        netProfit = s.status === 'refunded' ? -shippingCost : (totalSaleValue - mlFee - shippingCost - taxAmount + shipRev - totalCostValue);
      }

      const lossAmount = s.lossAmount !== undefined ? s.lossAmount : (localSale ? localSale.lossAmount : undefined);
      const lossReason = s.lossReason || (localSale && localSale.lossReason) || undefined;
      const shippingType = s.shippingType || (localSale && localSale.shippingType) || 'transportadora';
      const isCustomSale = s.isCustomSale !== undefined ? s.isCustomSale : (localSale ? localSale.isCustomSale : undefined);
      const customMlFee = s.customMlFee !== undefined ? s.customMlFee : (localSale ? localSale.customMlFee : undefined);
      const customShippingCost = s.customShippingCost !== undefined ? s.customShippingCost : (localSale ? localSale.customShippingCost : undefined);
      const buyerName = s.buyerName || (localSale && localSale.buyerName) || undefined;
      const buyerDocument = s.buyerDocument || (localSale && localSale.buyerDocument) || undefined;
      const buyerAddress = s.buyerAddress || (localSale && localSale.buyerAddress) || undefined;
      const trackingNumber = s.trackingNumber || (localSale && localSale.trackingNumber) || undefined;
      const carrier = s.carrier || (localSale && localSale.carrier) || undefined;
      const trackingUrl = s.trackingUrl || (localSale && localSale.trackingUrl) || undefined;

      const protectedStatus = s.status === 'pending' && localSale && localSale.status !== 'pending'
        ? localSale.status
        : (s.status || 'pending');

      return {
        ...s,
        productId,
        productName,
        status: protectedStatus,
        salePrice,
        purchasePrice,
        quantity,
        discount,
        mlFee,
        shippingCost,
        shippingRevenue: shipRev,
        grossProfit,
        netProfit,
        mlSaleId,
        isMlSale,
        lossAmount,
        lossReason,
        shippingType,
        isCustomSale,
        customMlFee,
        customShippingCost,
        buyerName,
        buyerDocument,
        buyerAddress,
        trackingNumber,
        carrier,
        trackingUrl
      };
    });

    return { products: sanitizedProducts, sales: sanitizedSales };
  };

  // Buscar dados da planilha na inicialização do aplicativo para manter sincronizado com múltiplos dispositivos
  useEffect(() => {
    if (!webAppUrl || hasFetchedFromCloud) return;

    const fetchInitialData = async () => {
      setIsFetchingFromCloud(true);
      setCloudSyncError(null);
      try {
        console.log('Buscando dados em tempo real da planilha do Google Sheets...', webAppUrl);
        const url = `/api/sync-sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = await response.json();
        if (result.status === 'success') {
          // Sanitização robusta contra dados corrompidos ou chaves de datas na coluna de preços
          const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords);
          
          setProducts(sanitized.products);
          setSales(sanitized.sales);
          if (result.mlRecords && Array.isArray(result.mlRecords)) {
            setMlRecords(result.mlRecords);
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
        } else if (result.status === 'error') {
          throw new Error(result.message || 'Erro ao carregar dados do Apps Script.');
        }
      } catch (err: any) {
        console.error('Erro ao recuperar dados iniciais da nuvem:', err);
        setCloudSyncError('Sincronização pendente. Não foi possível conectar com a planilha para importar dados. Edições locais protegidas contra sobrescrita na nuvem.');
        // Se falhar o carregamento, NÃO marcamos como fetched para bloquear escrita acidental e incentivar nova tentativa manual
        setHasFetchedFromCloud(false);
      } finally {
        setIsFetchingFromCloud(false);
      }
    };

    fetchInitialData();
  }, [webAppUrl, hasFetchedFromCloud]);

  // Forçar recarregamento/importação manual do banco de dados na planilha do Sheets
  const handlePullFromCloud = async (): Promise<{ status: 'success' | 'error'; message: string }> => {
    if (!webAppUrl) return { status: 'error' as const, message: 'Por favor, insira a URL do Web App primeiro.' };
    setIsFetchingFromCloud(true);
    setCloudSyncError(null);
    try {
      console.log('Forçando leitura/puxada de dados do Google Sheets...', webAppUrl);
      const url = `/api/sync-sheets?webAppUrl=${encodeURIComponent(webAppUrl)}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        const sanitized = sanitizeCloudData(result.products || [], result.sales || [], result.mlRecords || mlRecords);
        
        setProducts(sanitized.products);
        setSales(sanitized.sales);
        if (result.mlRecords && Array.isArray(result.mlRecords)) {
          setMlRecords(result.mlRecords);
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
        throw new Error(result.message || 'Erro do Google Apps Script');
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

  // Sincronização automática em background sempre que 'products', 'sales', 'mlRecords' ou 'initialCapital' mudarem!
  useEffect(() => {
    if (!webAppUrl) return;
    
    // Se ainda estamos buscando dados do cloud, se o fetch inicial não rodou, ou se não há alterações locais novas, evite escrever!
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
          body: JSON.stringify({ webAppUrl, products, sales, initialCapital, mlRecords })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        if (result.status !== 'success') {
          throw new Error(result.message || 'Erro no Apps Script');
        }
        console.log('Sincronização em tempo real realizada com sucesso!');
        setHasPendingWrite(false); // Reseta a flag de alterações pendentes após sucesso
      } catch (err: any) {
        console.error('Erro na sincronização em tempo real:', err);
        setCloudSyncError(err.message || String(err));
      } finally {
        setIsCloudSyncing(false);
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(syncTimeout);
  }, [products, sales, initialCapital, mlRecords, webAppUrl, isFetchingFromCloud, hasFetchedFromCloud, hasPendingWrite, handlePullFromCloud]);

  // Loop de atualização das vendas pendentes (conclusão automática por período de 30 dias)
  useEffect(() => {
    let changed = false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const updatedSales = sales.map(s => {
      const currentStatus = s.status || 'pending';
      if (currentStatus === 'refunded' || currentStatus === 'completed') {
        return s;
      }

      const saleDate = new Date(s.date + 'T12:00:00');
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
      if (hasFetchedFromCloud) {
        setHasPendingWrite(true);
      }
    }
  }, [sales, hasFetchedFromCloud]);

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
  const lowStockCount = products.filter(p => p.stock <= p.minimalStock).length;

  // Funções de manipulação do estoque e vendas
  const handleAddProduct = (newProduct: Omit<Product, 'id'>) => {
    const freshProduct: Product = {
      ...newProduct,
      id: `prod_${Date.now()}`
    };
    setProducts(prev => [freshProduct, ...prev]);
    setHasPendingWrite(true);
  };

  const handleEditProduct = (updatedProd: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProd.id ? updatedProd : p));
    setHasPendingWrite(true);
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setHasPendingWrite(true);
  };

  const handleAddSale = (newSale: Omit<Sale, 'id' | 'grossProfit' | 'netProfit'>) => {
    const totalSaleValue = newSale.salePrice * newSale.quantity;
    const totalCostValue = newSale.purchasePrice * newSale.quantity;
    const discount = newSale.discount || 0;
    
    // Cálculo do Lucro Bruto e Líquido exato (deduzindo comissão, frete, imposto de 4% e descontos)
    const grossProfit = newSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
    const shipRev = newSale.shippingRevenue || 0;
    const taxAmount = totalSaleValue * 0.04;
    const netProfit = newSale.status === 'refunded' ? -newSale.shippingCost : (totalSaleValue - newSale.mlFee - newSale.shippingCost - taxAmount + shipRev - totalCostValue);

    // Calcular se a data da venda está acima de 30 dias atrás
    const saleDate = new Date(newSale.date + 'T12:00:00');
    const now = new Date();
    saleDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    
    const diffTime = now.getTime() - saleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const status = newSale.status === 'refunded' ? 'refunded' : (diffDays >= 30 ? 'completed' : 'pending');

    const freshSale: Sale = {
      ...newSale,
      id: `sale_${Date.now()}`,
      grossProfit: Number(grossProfit.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      status
    };

    // Subtrair quantidade vendida do estoque: NÃO altera p.stock diretamente, pois o Estoque Atual é calculado dinamicamente (Estoque Inicial - Saídas)
    setSales(prev => [freshSale, ...prev]);
    setHasPendingWrite(true);
  };

  const handleCancelSale = (saleId: string, lossAmount: number = 0, lossReason: string = '') => {
    const targetSale = sales.find(s => s.id === saleId);
    if (!targetSale) return;

    // Ao invés de deletar, atualiza o status para 'refunded', zera os lucros e venda, e salva o prejuízo extra e o motivo.
    // O estorno automaticamente zera a dedução do Estoque Atual via calculateCurrentStock.

    // Ao invés de deletar, atualiza o status para 'refunded', zera os lucros e venda, e salva o prejuízo extra e o motivo
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
          netProfit = totalSaleValue - updatedSale.mlFee - updatedSale.shippingCost - taxAmount + shipRev - totalCostValue;
          grossProfit = totalSaleValue - totalCostValue;
        }
      } else {
        const taxAmount = totalSaleValue * 0.04;
        if (updatedSale.status === 'refunded') {
          netProfit = -updatedSale.shippingCost;
          grossProfit = 0;
        } else {
          netProfit = totalSaleValue - updatedSale.mlFee - updatedSale.shippingCost - taxAmount + shipRev - totalCostValue;
          grossProfit = totalSaleValue - totalCostValue;
        }
      }
    } else {
      grossProfit = updatedSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
      const taxAmount = totalSaleValue * 0.04;
      netProfit = updatedSale.status === 'refunded' ? -updatedSale.shippingCost : (totalSaleValue - updatedSale.mlFee - updatedSale.shippingCost - taxAmount + shipRev - totalCostValue);
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

  const handleImportMLRecords = async (records: MLImportRecord[]) => {
    // 0. Remover do estoque quaisquer produtos criados indevidamente com nomes booleanos ("Sim", "Não")
    let updatedProducts = products.filter(p => {
      const n = (p.name || '').trim().toLowerCase();
      return n !== 'sim' && n !== 'não' && n !== 'nao';
    });
    let updatedSales = [...sales];
    
    records.forEach(r => {
          // Limpar e sanitizar adTitle
          let cleanTitle = (r.adTitle || '').trim();
          if (['sim', 'não', 'nao', 'true', 'false', 'produto mercado livre'].includes(cleanTitle.toLowerCase())) {
            cleanTitle = '';
          }
          if (!cleanTitle && r.sku && !['sim', 'não', 'nao', 'true', 'false'].includes(r.sku.trim().toLowerCase())) {
            cleanTitle = r.sku;
          }
          r.adTitle = cleanTitle;

          // 1. Identificar se existe produto no estoque, mas preservando o título do anúncio do ML intacto
          let matchingProduct = findMatchingProduct(r, updatedProducts);

          if (!matchingProduct) {
            // Se o produto não estava cadastrado no Estoque, cria automaticamente usando o título do anúncio real (NUNCA "Sim" ou "Não")
            const autoProdName = (r.adTitle && !['sim', 'não', 'nao', 'produto mercado livre'].includes(r.adTitle.toLowerCase()))
              ? r.adTitle
              : (r.sku ? `SKU: ${r.sku}` : 'Produto Mercado Livre');

            const autoProd: Product = {
              id: `prod_ml_${r.sku || r.adId || Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: autoProdName,
              sku: r.sku || r.adId || 'ML',
              purchasePrice: 0,
              salePrice: r.units > 0 ? Number((r.productRevenue / r.units).toFixed(2)) : r.productRevenue,
              stock: 0,
              minimalStock: 2,
              addedDate: new Date().toISOString().split('T')[0],
              category: 'Geral',
              mlFeeType: 'classic',
              shippingCost: 6.55
            };
            updatedProducts.push(autoProd);
            matchingProduct = autoProd;
          }

          // Definir o nome exato do produto da venda baseado no Título do Anúncio do Mercado Livre
          const finalSaleTitle = (r.adTitle && !['sim', 'não', 'nao', 'produto mercado livre'].includes(r.adTitle.trim().toLowerCase()))
            ? r.adTitle
            : matchingProduct.name;
          
          // Formatar data da venda (de "6 de julho de 2026 20:02" para "2026-07-06")
          let formattedDate = new Date().toISOString().split('T')[0];
          if (r.dateStr) {
            if (r.dateStr.includes('de')) {
              const parts = r.dateStr.split(' ');
              if (parts.length >= 5) {
                const day = parts[0].padStart(2, '0');
                const monthStr = parts[2].toLowerCase();
                const year = parts[4];
                const monthMap: { [key: string]: string } = {
                  janeiro: '01', fevereiro: '02', marco: '03', abril: '04', maio: '05', junho: '06',
                  julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
                };
                const month = monthMap[monthStr] || '07';
                formattedDate = `${year}-${month}-${day}`;
              }
            } else if (r.dateStr.includes('-')) {
              const parts = r.dateStr.split('-');
              if (parts.length === 3) {
                formattedDate = r.dateStr;
              }
            }
          }

          // 2. Mapear status do ML para status da venda com base estrita no período de 30 dias se não for reembolsada
          let saleStatus: 'completed' | 'pending' | 'refunded' = 'completed';
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

          if (isRefunded) {
            saleStatus = 'refunded';
          } else {
            const saleDateObj = new Date(formattedDate + 'T12:00:00');
            const nowObj = new Date();
            saleDateObj.setHours(0, 0, 0, 0);
            nowObj.setHours(0, 0, 0, 0);
            const diffTime = nowObj.getTime() - saleDateObj.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            saleStatus = diffDays < 30 ? 'pending' : 'completed';
          }
          
          // 3. Verificar se essa venda já existe na nossa base de vendas (pelo ID do ML)
          const uniqueSaleId = `${r.id}_${matchingProduct.id}`;
          const existingSaleIdx = updatedSales.findIndex(s => s.id === uniqueSaleId || (s.mlSaleId && s.mlSaleId === r.id));
          
          const totalSaleValue = r.productRevenue;
          const totalCostValue = matchingProduct.purchasePrice * r.units;
          const discount = r.discountsAndBonuses || 0;
          const mlFee = saleStatus === 'refunded' ? 0 : Math.abs(r.saleFeeAndTaxes);
          const defaultShipping = matchingProduct ? matchingProduct.shippingCost : 0;
          const rawShippingFee = Math.abs(r.shippingFee) + Math.abs(r.shippingWeightCost) + Math.abs(r.shippingDiffCost);
          const shippingRevenue = saleStatus === 'refunded' ? 0 : Math.abs(r.shippingRevenue || 0);
          
          let shippingCost = rawShippingFee;
          if (saleStatus === 'refunded') {
            shippingCost = defaultShipping * r.units;
          } else if (totalSaleValue < 79) {
            // No Mercado Livre, vendas abaixo de R$ 79,00 têm o frete custeado pelo COMPRADOR
            shippingCost = Math.max(0, rawShippingFee - shippingRevenue);
            if (shippingRevenue === 0 && rawShippingFee > 0) {
              shippingCost = 0; // O comprador pagou o frete no checkout
            }
          }
          
          const grossProfit = saleStatus === 'refunded' ? 0 : totalSaleValue - totalCostValue;
          const netProfit = saleStatus === 'refunded' ? -shippingCost : (totalSaleValue - mlFee - shippingCost + shippingRevenue - totalCostValue);
          
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
            
            updatedSales[existingSaleIdx] = {
              ...oldSale,
              id: uniqueSaleId,
              productId: matchingProduct.id,
              productName: finalSaleTitle,
              status: saleStatus,
              quantity: r.units,
              salePrice: r.units > 0 ? Number((r.productRevenue / r.units).toFixed(2)) : r.productRevenue,
              purchasePrice: matchingProduct.purchasePrice,
              grossProfit: Number(grossProfit.toFixed(2)),
              netProfit: Number(netProfit.toFixed(2)),
              mlFee: Number(mlFee.toFixed(2)),
              shippingCost: Number(shippingCost.toFixed(2)),
              shippingRevenue,
              discount,
              shippingType,
              buyerName: r.buyerName,
              buyerDocument: r.buyerDocument,
              buyerAddress: r.buyerAddress,
              trackingNumber: r.trackingNumber,
              carrier: r.carrier,
              trackingUrl: r.trackingUrl,
              isMlSale: true,
              mlSaleId: r.id
            };
          } else {
            // Se não existe, inserimos uma nova venda no histórico
            updatedSales.push({
              id: uniqueSaleId,
              productId: matchingProduct.id,
              productName: finalSaleTitle,
              quantity: r.units,
              salePrice: r.productRevenue / r.units,
              purchasePrice: matchingProduct.purchasePrice,
              date: formattedDate,
              discount,
              mlFee: Number(mlFee.toFixed(2)),
              shippingCost: Number(shippingCost.toFixed(2)),
              shippingRevenue,
              grossProfit: Number(grossProfit.toFixed(2)),
              netProfit: Number(netProfit.toFixed(2)),
              status: saleStatus,
              mlSaleId: r.id,
              isMlSale: true,
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

    setSales(updatedSales);
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

        {activeTab === 'stock' && (
          <StockControl
            products={products}
            sales={sales}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onClearDatabase={handleClearDatabase}
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
          />
        )}

        {activeTab === 'mercadolivre' && (
          <MLImport
            products={products}
            mlRecords={mlRecords}
            onImportRecords={handleImportMLRecords}
            onClearRecords={handleClearMLRecords}
            isSheetsConnected={!!webAppUrl || !!spreadsheetUrl}
            onPushToCloud={() => setHasPendingWrite(true)}
            isSyncing={isCloudSyncing}
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
