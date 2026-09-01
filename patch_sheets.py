with open('src/components/SheetsIntegration.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_logic = "var effectiveInitialStock = (incomingStock > 0) ? incomingStock : (savedSheetStock !== undefined ? savedSheetStock : incomingStock);"
new_logic = "var effectiveInitialStock = savedSheetStock !== undefined ? savedSheetStock : incomingStock;"

content = content.replace(old_logic, new_logic)

with open('src/components/SheetsIntegration.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
