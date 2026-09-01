with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

idx_table = content.find('          {/* Tabela de Transações Importadas do Mercado Livre */}')
idx_bento = content.find('          {/* Seção Inferior de Bento Grid')
idx_end = content.find('        </div>\n      )}\n    </div>\n  );\n}')

if idx_table != -1 and idx_bento != -1 and idx_end != -1:
    table_content = content[idx_table:idx_bento]
    bento_content = content[idx_bento:idx_end]
    
    new_content = content[:idx_table] + bento_content + '\n' + table_content + content[idx_end:]
    
    with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Reordered successfully!")
else:
    print("Could not find the indices:", idx_table, idx_bento, idx_end)
