with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx_table = content.find('          {/* Tabela de Transações Importadas do Mercado Livre */}')
idx_bento = content.find('          {/* Seção Inferior de Bento Grid')
idx_end = content.find('        </div>\n      )}\n    </div>\n  );\n}')

print("Indices:", idx_table, idx_bento, idx_end)
