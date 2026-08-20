import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r'  const sanitizeCloudData = .*?return \{ products: sanitizedProducts, sales: finalSanitizedSales \};\n  \};\n', re.DOTALL)

new_func = """  const sanitizeCloudData = (cloudProducts: Product[], cloudSales: Sale[], cloudMlRecords?: MLImportRecord[]) => {
    const recordsToUse = cloudMlRecords || mlRecords || [];
    
    // 1. Manter APENAS produtos que foram cadastrados manualmente.
    // Ignorar "fantasmas" auto-criados (prod_ml_...) e lixos ("sim", "nao").
    const sanitizedProducts = (cloudProducts || [])
      .filter(p => {
        const n = (p.name || '').trim().toLowerCase();
        const isTrash = n === 'sim' || n === 'não' || n === 'nao';
        const isGhost = p.id.startsWith('prod_ml_');
        return !isTrash && !isGhost;
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

    // 2. Mapear vendas e DESCARTAR qualquer venda que não possua um produto correspondente no estoque oficial.
    const sanitizedSales = (cloudSales || [])
      .map(s => {
        let salePrice = Number(s.salePrice) || 0;
        const quantity = Number(s.quantity) || 1;
        const discount = Number(s.discount) || 0;

        const cleanSaleProductName = (s.productName || '').trim();
        const isBadName = !cleanSaleProductName || ['sim', 'não', 'nao', 'produto mercado livre'].includes(cleanSaleProductName.toLowerCase());

        let matchingProd: Product | undefined = undefined;
        if (!isBadName) {
          matchingProd = sanitizedProducts.find(p => normalizeName(p.name) === normalizeName(cleanSaleProductName));
        }
        if (!matchingProd) {
          matchingProd = sanitizedProducts.find(p => p.id === s.productId);
        }

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

        // SE NÃO TIVER PRODUTO OFICIAL NO ESTOQUE APÓS TODAS AS TENTATIVAS, É UMA VENDA INVÁLIDA (FANTASMA)
        if (!matchingProd) {
          return null; // Retorna null para filtrarmos em seguida
        }

        let productName = matchingProd.name;
        let productId = matchingProd.id;
        let purchasePrice = matchingProd.purchasePrice;

        if (salePrice <= 0 || salePrice > 1000000) {
          if (Number(s.grossProfit) > 0 && purchasePrice > 0) {
            salePrice = Number(s.grossProfit) + purchasePrice + discount;
          } else {
            salePrice = matchingProd.salePrice;
          }
        }

        const totalSaleValue = salePrice * quantity;
        const totalCostValue = purchasePrice * quantity;

        const localSale = sales.find(ls => ls.id === s.id);
        
        let mlSaleId = s.mlSaleId || (localSale && localSale.mlSaleId);
        if (!mlSaleId && s.id) {
          const cleanId = s.id.split('_')[0];
          if (/^\d+$/.test(cleanId)) {
            mlSaleId = cleanId;
          }
        }

        const isMlSale = s.isMlSale !== undefined ? s.isMlSale : !!(mlSaleId || originalRecord);

        let mlFee = Number(s.mlFee) || 0;
        let shippingCost = Number(s.shippingCost) || 0;
        let shipRev = Number(s.shippingRevenue) || 0;

        if (!s.mlFee && matchingProd) {
          const percent = matchingProd.mlFeeType === 'custom' 
            ? (matchingProd.customFeePercent || 0) 
            : (matchingProd.mlFeeType === 'premium' ? 17 : matchingProd.mlFeeType === 'classic' ? 12 : 0);
          mlFee = (salePrice * percent) / 100;
          if (salePrice > 0 && salePrice < 79 && (matchingProd.mlFeeType === 'classic' || matchingProd.mlFeeType === 'premium')) {
            mlFee += 6.00;
          }
          mlFee = Number(mlFee.toFixed(2));
        }

        if (!s.shippingCost && matchingProd) {
          shippingCost = matchingProd.shippingCost;
        }

        const lossAmount = Number(s.lossAmount) || 0;
        const lossReason = s.lossReason || undefined;

        const taxML = isMlSale ? (totalSaleValue * 0.04) : 0;
        let grossProfit = Number(s.grossProfit) || 0;
        let netProfit = Number(s.netProfit) || 0;

        if (!s.grossProfit || s.grossProfit == 0) {
          grossProfit = totalSaleValue - totalCostValue;
        }
        
        if (!s.netProfit || s.netProfit == 0) {
          netProfit = totalSaleValue - totalCostValue - (mlFee * quantity) - (shippingCost * quantity) + (shipRev * quantity) - taxML - discount;
        }

        let protectedStatus = s.status || 'pending';
        let isRefunded = protectedStatus === 'refunded';
        
        if (s.date && !isRefunded && protectedStatus === 'pending') {
          const saleDateObj = new Date(s.date + 'T12:00:00');
          const nowObj = new Date();
          saleDateObj.setHours(0, 0, 0, 0);
          nowObj.setHours(0, 0, 0, 0);
          const diffTime = nowObj.getTime() - saleDateObj.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          if (diffDays >= 30) {
            protectedStatus = 'completed';
          }
        }

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
          lossReason
        };
      })
      .filter(s => s !== null);

    const uniqueSalesMap = new Map<string, any>();
    const finalSanitizedSales: any[] = [];
    
    sanitizedSales.forEach(s => {
      if (s.isMlSale && s.mlSaleId) {
        if (!uniqueSalesMap.has(s.mlSaleId)) {
          uniqueSalesMap.set(s.mlSaleId, s);
          finalSanitizedSales.push(s);
        } else {
          const existing = uniqueSalesMap.get(s.mlSaleId)!;
          if (s.lossAmount && !existing.lossAmount) {
            Object.assign(existing, s);
          }
        }
      } else {
        finalSanitizedSales.push(s);
      }
    });

    return { products: sanitizedProducts, sales: finalSanitizedSales };
  };
"""

new_content = pattern.sub(new_func, content)

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
