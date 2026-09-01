import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'      var formattedMatrix = payload\.entradaRawMatrix\.map\(function\(row\) \{\n        if \(\!Array\.isArray\(row\)\) return \[\];\n        var newRow = \[\];\n        for \(var j = 0; j < row\.length; j\+\+\) \{\n          if \(skuIndicesToRemove\.indexOf\(j\) !== -1\) continue;\n          var cell = row\[j\];\n          if \(cell === null \|\| cell === undefined\) return "";\n          var str = String\(cell\)\.trim\(\);\n          if \(\/^\\d\{10,24\}\$\/\.test\(str\)\) \{\n            return "\'" \+ str;\n          \}\n          return cell;\n        \}\);\n      \}\);', re.DOTALL)

replacement = r"""      var formattedMatrix = payload.entradaRawMatrix.map(function(row) {
        if (!Array.isArray(row)) return [];
        var newRow = [];
        for (var j = 0; j < row.length; j++) {
          if (skuIndicesToRemove.indexOf(j) !== -1) continue;
          var cell = row[j];
          if (cell === null || cell === undefined) cell = "";
          var str = String(cell).trim();
          if (/^\d{10,24}$/.test(str)) {
            newRow.push("'" + str);
          } else {
            newRow.push(cell);
          }
        }
        return newRow;
      });"""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
