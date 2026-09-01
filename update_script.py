import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'    // 1\. Sincronizar Produtos\n    var productSheet = ss\.getSheetByName\("Produtos"\).*?    // 2\. Sincronizar Vendas', re.DOTALL)

replacement = """    // 1. Sincronizar Produtos
    // ATENCAO: Não reescrever toda a aba, APENAS atualizar as saídas e estoque.
    var productSheet = ss.getSheetByName("Produtos");
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
            headers.push("Saídas");
          }
          if (oIdxEstoqueAtual === -1) {
            oIdxEstoqueAtual = headers.length;
            productSheet.getRange(1, oIdxEstoqueAtual + 1).setValue("Estoque Atual");
            headers.push("Estoque Atual");
          }

          // Montar arrays de atualização
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
               }
            }
            saidasValues.push([totalSold]);
            
            // Formula for Estoque Atual: Estoque Inicial - Saídas
            var rowNum = oRow + 1;
            
            function colIndexToLetter(idx) {
                var letter = "";
                var temp = idx + 1;
                while (temp > 0) {
                    var mod = (temp - 1) % 26;
                    letter = String.fromCharCode(65 + mod) + letter;
                    temp = Math.floor((temp - mod) / 26);
                }
                return letter;
            }
            
            var colEstoqueInicialLetter = oIdxEstoqueInicial !== -1 ? colIndexToLetter(oIdxEstoqueInicial) : "E";
            var colSaidasLetter = colIndexToLetter(oIdxSaidas);
            
            estoqueAtualValues.push(['=' + colEstoqueInicialLetter + rowNum + '-' + colSaidasLetter + rowNum]);
          }

          // Atualizar planilhas
          if (saidasValues.length > 0) {
              productSheet.getRange(2, oIdxSaidas + 1, saidasValues.length, 1).setValues(saidasValues);
              productSheet.getRange(2, oIdxEstoqueAtual + 1, estoqueAtualValues.length, 1).setValues(estoqueAtualValues);
          }
        }
      } catch(e) {}
    }

    // 2. Sincronizar Vendas"""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
