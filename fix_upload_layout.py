import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

target = """          {/* Coluna Esquerda: Caixa de Importação e Drag-Drop */}
          <div className="lg:col-span-8 space-y-6">"""
replacement = """          {/* Coluna Esquerda: Caixa de Importação e Drag-Drop */}
          <div className={mlRecords.length === 0 ? "lg:col-span-8 space-y-6" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6"}>"""
content = content.replace(target, replacement)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
