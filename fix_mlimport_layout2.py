import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We need to make sure the boxes are always visible.
# And they should be top level, not wrapped in `mlRecords.length === 0 ?`.
# Let's find exactly the ternary and replace it.

ternary_start_regex = r'\{\s*\/\*\s*Se não houver dados.*?\*\/\s*\}\s*\{mlRecords\.length === 0 \? \(\s*<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">'
replacement_start = """      {/* Interface de upload (agora sempre visível) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">"""
content = re.sub(ternary_start_regex, replacement_start, content, flags=re.DOTALL)

# And now find the `) : (` that closes it, which comes after `COMO OBTER O RELATÓRIO DO ML` column.
# The column right before it ends with:
#             </div>
#           </div>
#       ) : (
ternary_end_regex = r'(\s*)</div>\s*</div>\s*\) : \(\s*/\*\s*Se houver dados importados, exibe o Dashboard Completo\s*\*/\s*<div className="space-y-6">'
replacement_end = r'\1</div>\n          </div>\n      </div>\n\n      {mlRecords.length > 0 && (\n        <div className="space-y-6">'
content = re.sub(ternary_end_regex, replacement_end, content)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
