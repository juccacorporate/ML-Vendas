import re

with open("src/components/SheetsIntegration.tsx", "r") as f:
    content = f.read()

pattern = re.compile(r'          "=\(D" \+ rNum \+ "\*E" \+ rNum \+ "\)-\(J" \+ rNum \+ "\*D" \+ rNum \+ "\)",\n          "=\(D" \+ rNum \+ "\*E" \+ rNum \+ "\)-G" \+ rNum \+ "-H" \+ rNum \+ "\+I" \+ rNum \+ "-\(J" \+ rNum \+ "\*D" \+ rNum \+ "\)-M" \+ rNum,\n          "=\(D" \+ rNum \+ "\*E" \+ rNum \+ "\)\*4/100",')

replacement = """          "=(C" + rNum + "*D" + rNum + ")-(I" + rNum + "*C" + rNum + ")",
          "=(C" + rNum + "*D" + rNum + ")-F" + rNum + "-G" + rNum + "+H" + rNum + "-(I" + rNum + "*C" + rNum + ")-L" + rNum,
          "=(C" + rNum + "*D" + rNum + ")*4/100","""

content = re.sub(pattern, replacement, content)

with open("src/components/SheetsIntegration.tsx", "w") as f:
    f.write(content)
