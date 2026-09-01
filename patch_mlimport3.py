import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to extract the "Enviar Relatório de Transações" box and the "Relatório de Recebimentos" box
# and place them in a way that they are ALWAYS visible at the top, regardless of mlRecords.length === 0.

# Actually, it's easier to just change `mlRecords.length === 0 ? (` to always show the boxes, or just move the boxes outside the ternary.
# Let's see the structure of MLImport.tsx
