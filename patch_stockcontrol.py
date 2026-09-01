with open('src/components/StockControl.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("stock: replenishProduct.stock + replenishQuantity,", "")

with open('src/components/StockControl.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
