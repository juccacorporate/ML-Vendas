with open('src/components/SheetsIntegration.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("if (!isNaN(parsedVal) && parsedVal > 0) {", "if (!isNaN(parsedVal)) {")

with open('src/components/SheetsIntegration.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
