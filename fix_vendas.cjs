const fs = require('fs');

let content = fs.readFileSync('src/components/SheetsIntegration.tsx', 'utf8');

// Add "A Receber do ML" to headers
const targetHeaders = `      "Taxa ML", "Custo Frete", "Receita por Envio", "Preço Compra", "Lucro Bruto", "Lucro Líquido", "Imposto", "Desconto", "Status", "Tempo Conclusão",`;
const newHeaders = `      "Taxa ML", "Custo Frete", "Receita por Envio", "Preço Compra", "Lucro Bruto", "A Receber do ML", "Lucro Líquido", "Imposto", "Desconto", "Status", "Tempo Conclusão",`;
content = content.replace(targetHeaders, newHeaders);

// Update targetList.push
const targetPush = `        targetList.push([
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
          "=(C" + rNum + "*D" + rNum + ")-F" + rNum + "-G" + rNum + "+H" + rNum + "-(I" + rNum + "*C" + rNum + ")-L" + rNum,
          "=(C" + rNum + "*D" + rNum + ")*4/100",`;

const newPush = `        targetList.push([
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
          "=(C" + rNum + "*D" + rNum + ")*4/100",`;

content = content.replace(targetPush, newPush);

fs.writeFileSync('src/components/SheetsIntegration.tsx', content);
