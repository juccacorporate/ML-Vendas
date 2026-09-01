import re

with open("src/components/MLImport.tsx", "r") as f:
    content = f.read()

# Replace rowNetProfit and netProfitML calculations
# First replace the netProfitML in the top loop
pattern_netprofit_loop = re.compile(r'netProfitML \+= \(r\.productRevenue - saleFee - shippingCost - taxML - discount \+ shippingRevenue\);')
replacement_netprofit_loop = r'''const aReceberML = r.productRevenue + (r.surchargeRevenue || 0) + (r.installmentFee || 0) - saleFee + shippingRevenue - shippingCost;
        netProfitML += (aReceberML - taxML);'''
content = re.sub(pattern_netprofit_loop, replacement_netprofit_loop, content)

# Now replace all rowNetProfit
pattern_rownetprofit = re.compile(r'const rowNetProfit = isCanceled \? -shippingCost : \(r\.productRevenue - saleFee - shippingCost - taxML - productCost - discount \+ shippingRevenue\);')
replacement_rownetprofit = r'''const aReceberML = r.productRevenue + (r.surchargeRevenue || 0) + (r.installmentFee || 0) - saleFee + shippingRevenue - shippingCost;
      const rowNetProfit = isCanceled ? -shippingCost : (aReceberML - taxML - productCost);'''
content = re.sub(pattern_rownetprofit, replacement_rownetprofit, content)

# Also fix the one in the render loop which uses isRefunded
pattern_rownetprofit_render = re.compile(r'const rowNetProfit = isRefunded\s*\? -shippingCost\s*: r\.productRevenue - saleFee - shippingCost - taxML - productCost - discount \+ shippingRevenue;')
replacement_rownetprofit_render = r'''const aReceberML = r.productRevenue + (r.surchargeRevenue || 0) + (r.installmentFee || 0) - saleFee + shippingRevenue - shippingCost;
                        const rowNetProfit = isRefunded ? -shippingCost : (aReceberML - taxML - productCost);'''
content = re.sub(pattern_rownetprofit_render, replacement_rownetprofit_render, content)

with open("src/components/MLImport.tsx", "w") as f:
    f.write(content)
