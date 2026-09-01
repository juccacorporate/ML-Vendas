import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I want to extract the three boxes: 
# 1. Transacoes (from `Enviar Relatório de Transações` to its `</div>`)
# 2. Recebimentos (from `Relatório de Recebimentos` to its `</div>`)
# 3. Instrucoes (from `COMO OBTER O RELATÓRIO` to its `</div>`)

# It's better to just write the specific replacements.
