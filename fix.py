import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

# We want to find targetList.push([
#          pureSaleId || s.id,
#          var pSku ... pSku,
#          s.productName,
# And replace it cleanly.

pattern = re.compile(r'targetList\.push\(\[\s*pureSaleId \|\| s\.id,\s*var pSku.*?\s*pSku,\s*s\.productName,', re.DOTALL)

replacement = """        var pSku = s.productId || "";
        if (payload.products && payload.products.length > 0) {
          for (var p = 0; p < payload.products.length; p++) {
            if (payload.products[p].id === s.productId && payload.products[p].sku) {
              pSku = payload.products[p].sku;
              break;
            }
          }
        }
        if (pSku.indexOf("prod_") === 0) pSku = pSku.replace("prod_", "");
        targetList.push([
          pureSaleId || s.id,
          pSku,
          s.productName,"""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
