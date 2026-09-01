with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '{mlRecords.length > 0 && (' in line:
        idx = i
        break

# The structure before idx is:
# idx-4:           </div>
# idx-3:           </div>
# idx-2:       </div>
# idx-1: 
# idx:       {mlRecords.length > 0 && (

# We want to replace idx-3 with `          )}` (or idx-2).
# Let's just insert `          )}` at idx-1.

lines.insert(idx - 1, '          )}\n')

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
