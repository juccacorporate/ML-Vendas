with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove line 1069 (index 1068)
lines.pop(1068)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
