with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if line.strip() == '{mlRecords.length > 0 && (':
        print("Found at line:", i+1)
        for j in range(i-5, i+5):
            print(f"{j+1}: {lines[j].rstrip()}")
