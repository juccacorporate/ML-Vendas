const fs = require('fs');

let content = fs.readFileSync('src/components/SheetsIntegration.tsx', 'utf8');

const targetStr = `      var skuIndicesToRemove = [];
      if (mHeaders && Array.isArray(mHeaders)) {
        for (var j = 0; j < mHeaders.length; j++) {
          var h = String(mHeaders[j]).trim().toLowerCase();
          if (h === "sku" || h === "sku produto" || h === "sku de produto") {
            skuIndicesToRemove.push(j);
          }
        }
      }`;

const replacementStr = `      var skuIndicesToRemove = [];
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
      }`;

content = content.replace(targetStr, replacementStr);

const targetStr2 = `      var numCols = mHeaders ? mHeaders.length - skuIndicesToRemove.length : 0;
      var formattedMatrix = payload.entradaRawMatrix.map(function(row) {
        if (!Array.isArray(row)) return [];
        var newRow = [];
        for (var j = 0; j < row.length; j++) {
          if (skuIndicesToRemove.indexOf(j) !== -1) continue;
          var cell = row[j];
          if (cell === null || cell === undefined) cell = "";
          var str = String(cell).trim();
          if (/^\\d{10,24}$/.test(str)) {
            newRow.push("'" + str);
          } else {
            newRow.push(cell);
          }
        }
        return newRow;
      });`;

const replacementStr2 = `      var numCols = mHeaders ? (mHeaders.length - skuIndicesToRemove.length) + 2 : 0;
      
      var parseMatrixNum = function(val) {
        if (!val) return 0;
        var s = String(val).trim().replace(/r\\$\\s?/i, '').replace(/\\./g, '').replace(',', '.');
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
          if (/^\\d{10,24}$/.test(str)) {
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
      });`;

content = content.replace(targetStr2, replacementStr2);

fs.writeFileSync('src/components/SheetsIntegration.tsx', content);
