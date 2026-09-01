import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'        var pSku = s\.productId \|\| "";.*?        if \(pSku\.indexOf\("prod_"\) === 0\) pSku = pSku\.replace\("prod_", ""\);\n        targetList\.push\(\[\n          pureSaleId \|\| s\.id,\n          pSku,\n          s\.productName,', re.DOTALL)

replacement = """        targetList.push([
          pureSaleId || s.id,
          s.productName,"""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
