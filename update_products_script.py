import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'    var productSheet = ss\.getSheetByName\("Produtos"\).*?    // 2\. Aba Vendas em Andamento', re.DOTALL)

replacement = """    var productSheet = ss.getSheetByName("Produtos");
    if (productSheet) {
      try {
        var prodData = productSheet.getDataRange().getValues();
        if (prodData && prodData.length > 1) {
          var headers = prodData[0];
          var oIdxSku = headers.indexOf("SKU");
          var oIdxSaidas = headers.indexOf("Saídas");
          var oIdxEstoqueAtual = headers.indexOf("Estoque Atual");
          var oIdxEstoqueInicial = headers.indexOf("Estoque Inicial");
          if (oIdxEstoqueInicial === -1) oIdxEstoqueInicial = headers.indexOf("Estoque");

          // Adicionar colunas se não existirem
          if (oIdxSaidas === -1) {
            oIdxSaidas = headers.length;
            productSheet.getRange(1, oIdxSaidas + 1).setValue("Saídas");
          }
          if (oIdxEstoqueAtual === -1) {
            oIdxEstoqueAtual = headers.length;
            if (oIdxEstoqueAtual === oIdxSaidas) oIdxEstoqueAtual++; // Se Saídas acabou de ser criada, Estoque Atual vai depois
            productSheet.getRange(1, oIdxEstoqueAtual + 1).setValue("Estoque Atual");
          }

          // Montar arrays de atualização para ser mais rápido (em lote)
          var saidasValues = [];
          var estoqueAtualValues = [];
          
          for (var oRow = 1; oRow < prodData.length; oRow++) {
            var rVal = prodData[oRow];
            var pSkuKey = (oIdxSku !== -1 && rVal[oIdxSku]) ? String(rVal[oIdxSku]).trim().toLowerCase() : "";
            var totalSold = 0;
            
            if (pSkuKey && payload.products) {
               // Encontrar o produto correspondente no payload para calcular saídas
               var p = null;
               for (var j = 0; j < payload.products.length; j++) {
                 if (String(payload.products[j].sku || "").trim().toLowerCase() === pSkuKey) {
                   p = payload.products[j];
                   break;
                 }
               }
               if (p) {
                 totalSold = calculateProductSalesVolumeScript(p, payload.sales || [], payload.products || []);
                 p.stock = (oIdxEstoqueInicial !== -1) ? Number(rVal[oIdxEstoqueInicial]) || 0 : 0; // Update payload stock for return
               }
            }
            saidasValues.push([totalSold]);
            
            // Formula for Estoque Atual: Estoque Inicial - Saídas
            var rowNum = oRow + 1;
            var colEstoqueInicialLetter = oIdxEstoqueInicial !== -1 ? String.fromCharCode(65 + oIdxEstoqueInicial) : "E"; // Guess E if not found
            if (oIdxEstoqueInicial !== -1) {
                var letter = "";
                var temp = oIdxEstoqueInicial + 1;
                while (temp > 0) {
                    var mod = (temp - 1) % 26;
                    letter = String.fromCharCode(65 + mod) + letter;
                    temp = Math.floor((temp - mod) / 26);
                }
                colEstoqueInicialLetter = letter;
            }
            
            var colSaidasLetter = "";
            var temp2 = oIdxSaidas + 1;
            while (temp2 > 0) {
                var mod2 = (temp2 - 1) % 26;
                colSaidasLetter = String.fromCharCode(65 + mod2) + colSaidasLetter;
                temp2 = Math.floor((temp2 - mod2) / 26);
            }
            
            estoqueAtualValues.push(['=' + colEstoqueInicialLetter + rowNum + '-' + colSaidasLetter + rowNum]);
          }

          // Atualizar planilhas
          productSheet.getRange(2, oIdxSaidas + 1, saidasValues.length, 1).setValues(saidasValues);
          productSheet.getRange(2, oIdxEstoqueAtual + 1, estoqueAtualValues.length, 1).setValues(estoqueAtualValues);
        }
      } catch(e) {}
    }

    // 2. Aba Vendas em Andamento"""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
