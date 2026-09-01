#!/bin/bash
sed -i 's/B: Nome Produto/A: Nome Produto/g' src/components/SheetsIntegration.tsx
sed -i 's/C: SKU \/ Código de Estoque/B: SKU \/ Código de Estoque/g' src/components/SheetsIntegration.tsx
sed -i 's/D: Preço de Compra/C: Preço de Compra/g' src/components/SheetsIntegration.tsx
sed -i 's/E: Preço de Venda/D: Preço de Venda/g' src/components/SheetsIntegration.tsx
sed -i 's/F: Diferença/E: Diferença/g' src/components/SheetsIntegration.tsx
