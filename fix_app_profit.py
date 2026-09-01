import re

with open("src/App.tsx", "r") as f:
    content = f.read()

# Fix handleAddSale
pattern1 = re.compile(r'    // Cálculo do Lucro Bruto e Líquido exato \(deduzindo comissão, frete, imposto de 4% e descontos\)\n    const grossProfit = newSale\.status === \'refunded\' \? 0 : totalSaleValue - totalCostValue;\n    const shipRev = newSale\.shippingRevenue \|\| 0;\n    const taxAmount = totalSaleValue \* 0\.04;\n    const netProfit = newSale\.status === \'refunded\' \? -newSale\.shippingCost : \(totalSaleValue - newSale\.mlFee - newSale\.shippingCost - taxAmount \+ shipRev - totalCostValue\);')

replacement1 = """    const grossProfit = newSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
    const shipRev = newSale.shippingRevenue || 0;
    const taxAmount = totalSaleValue * 0.04;
    const aReceberML = totalSaleValue - newSale.mlFee + shipRev - newSale.shippingCost;
    const netProfit = newSale.status === 'refunded' ? -newSale.shippingCost : (aReceberML - taxAmount - totalCostValue);"""

content = re.sub(pattern1, replacement1, content)

# Fix handleEditSale
pattern2 = re.compile(r'        if \(updatedSale\.status === \'refunded\'\) \{\n          netProfit = -updatedSale\.shippingCost;\n          grossProfit = 0;\n        \} else \{\n          netProfit = totalSaleValue - updatedSale\.mlFee - updatedSale\.shippingCost - taxAmount \+ shipRev - totalCostValue;\n          grossProfit = totalSaleValue - totalCostValue;\n        \}', re.DOTALL)

replacement2 = """        if (updatedSale.status === 'refunded') {
          netProfit = -updatedSale.shippingCost;
          grossProfit = 0;
        } else {
          const aReceberML = totalSaleValue + (originalRecord ? (originalRecord.surchargeRevenue || 0) + (originalRecord.installmentFee || 0) : 0) - updatedSale.mlFee + shipRev - updatedSale.shippingCost;
          netProfit = aReceberML - taxAmount - totalCostValue;
          grossProfit = totalSaleValue - totalCostValue;
        }"""

content = re.sub(pattern2, replacement2, content)

# Fix fallback in handleEditSale
pattern3 = re.compile(r'    \} else \{\n      grossProfit = updatedSale\.status === \'refunded\' \? 0 : totalSaleValue - totalCostValue;\n      const taxAmount = totalSaleValue \* 0\.04;\n      netProfit = updatedSale\.status === \'refunded\' \? -updatedSale\.shippingCost : \(totalSaleValue - updatedSale\.mlFee - updatedSale\.shippingCost - taxAmount \+ shipRev - totalCostValue\);\n    \}')

replacement3 = """    } else {
      grossProfit = updatedSale.status === 'refunded' ? 0 : totalSaleValue - totalCostValue;
      const taxAmount = totalSaleValue * 0.04;
      const aReceberML = totalSaleValue - updatedSale.mlFee + shipRev - updatedSale.shippingCost;
      netProfit = updatedSale.status === 'refunded' ? -updatedSale.shippingCost : (aReceberML - taxAmount - totalCostValue);
    }"""

content = re.sub(pattern3, replacement3, content)

# Fix processMlCsv
pattern4 = re.compile(r'        const aReceberML = totalSaleValue \+ surchargeRev \+ installmentFee - mlFee \+ shipRev - shippingCost;\n        netProfit = aReceberML - taxAmount - totalCostValue;')

replacement4 = """        const aReceberML = totalSaleValue + surchargeRev + installmentFee - mlFee + shipRev - shippingCost;
        netProfit = aReceberML - taxAmount - totalCostValue;"""

content = re.sub(pattern4, replacement4, content)

with open("src/App.tsx", "w") as f:
    f.write(content)
