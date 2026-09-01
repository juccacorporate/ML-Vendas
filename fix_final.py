with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.strip() == ')}' and '      {mlRecords.length > 0 && (' in ''.join(lines[i:i+5]):
        # This is the `)}` we just inserted.
        lines.pop(i)
        lines.insert(i-2, '          )}\n') # Move it up by 2 lines
        break

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
