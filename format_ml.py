with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Remove the stray `)}` at line 875 (or near there).
for i in range(865, 885):
    if lines[i].strip() == ')}':
        lines.pop(i)
        break

# 2. Add `)}` before `{mlRecords.length > 0 && (` to close the previous conditional.
for i in range(1050, 1080):
    if '{mlRecords.length > 0 && (' in lines[i]:
        # Insert `)}` before the </div> that closes the grid
        lines.insert(i-1, '      )}\n')
        break

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
