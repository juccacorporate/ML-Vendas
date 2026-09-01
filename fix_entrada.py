import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'      var skuIndicesToRemove = \[\];\n      if \(mHeaders && Array\.isArray\(mHeaders\)\) \{\n        for \(var j = 0; j < mHeaders\.length; j\+\+\) \{\n          var h = String\(mHeaders\[j\]\)\.trim\(\)\.toLowerCase\(\);\n          if \(h === "sku" \|\| h === "sku produto" \|\| h === "sku de produto"\) \{\n            skuIndicesToRemove\.push\(j\);\n          \}\n        \}\n      \}')

replacement = r"""      var skuIndicesToRemove = [];
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
      }"""

content = re.sub(pattern, replacement, content)

pattern2 = re.compile(r'      var numCols = mHeaders \? mHeaders\.length - skuIndicesToRemove\.length : 0;\n      var formattedMatrix = payload\.entradaRawMatrix\.map\(function\(row\) \{\n        if \(\!Array\.isArray\(row\)\) return \[\];\n        var newRow = \[\];\n        for \(var j = 0; j < row\.length; j\+\+\) \{\n          if \(skuIndicesToRemove\.indexOf\(j\) \!\=\= -1\) continue;\n          var cell = row\[j\];\n          if \(cell === null \|\| cell === undefined\) cell = "";\n          var str = String\(cell\)\.trim\(\);\n          if \(/^\\d\{10,24\}\$\/\.test\(str\)\) \{\n            newRow\.push\("\'" \+ str\);\n          \} else \{\n            newRow\.push\(cell\);\n          \}\n        \}\n        return newRow;\n      \}\);')

replacement2 = r"""      var numCols = mHeaders ? (mHeaders.length - skuIndicesToRemove.length) + 2 : 0;
      
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
          if (/^\d{10,24}$/.test(str)) {
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
          newRow.push("Ver na aba Vendas"); // Placeholder for Lucro Real as it needs cross-reference
        }
        return newRow;
      });"""

content = re.sub(pattern2, replacement2, content)
with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
