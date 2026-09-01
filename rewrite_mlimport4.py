import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace `{mlRecords.length === 0 ? (` with ``
# Replace the `      ) : (` at line 1065 with `      {mlRecords.length > 0 && (`
# Add `)}` at the end of the file where the original one was.

# First, find `{mlRecords.length === 0 ? (`
content = content.replace('{mlRecords.length === 0 ? (', '')

# Next, we need to wrap the `COMO OBTER O RELATÓRIO DO ML` column in `{mlRecords.length === 0 && (`
target_col = """          {/* Coluna Direita: Instruções e Manual */}
          <div className="lg:col-span-4 space-y-6">"""
replacement_col = """          {/* Coluna Direita: Instruções e Manual */}
          {mlRecords.length === 0 && (
          <div className="lg:col-span-4 space-y-6">"""
content = content.replace(target_col, replacement_col)

# Now, we need to close that `&&` block. The right column ends right before `      ) : (`
target_end_col = """            </div>
          </div>
      ) : ("""
replacement_end_col = """            </div>
          </div>
          )}
      </div>

      {mlRecords.length > 0 && ("""
content = content.replace(target_end_col, replacement_end_col)

# Also, there is a `      )}` at the very end of the component. It should remain correct.

# Now we need to fix the alert in handleFileUploadRecebimentos. 
# We'll replace the silent try/catch with alert(err.message).
alert_catch_target = """    } catch (err: any) {
      setParseError('Erro ao ler arquivo: ' + err.message);
    } finally {"""
alert_catch_replacement = """    } catch (err: any) {
      alert('Erro ao ler arquivo: ' + err.message);
      setParseError('Erro ao ler arquivo: ' + err.message);
    } finally {"""
content = content.replace(alert_catch_target, alert_catch_replacement)

# Also alert when "A planilha de recebimentos parece estar vazia."
empty_target = """      if (matrix.length < 2) {
        setParseError('A planilha de recebimentos parece estar vazia.');
        return;
      }"""
empty_replacement = """      if (matrix.length < 2) {
        alert('A planilha de recebimentos parece estar vazia.');
        setParseError('A planilha de recebimentos parece estar vazia.');
        return;
      }"""
content = content.replace(empty_target, empty_replacement)

# Also alert when no valid data
no_valid_target = """      } else {
         setParseError('Não foi possível encontrar dados válidos de liberação na planilha.');
      }"""
no_valid_replacement = """      } else {
         alert('Não foi possível encontrar dados válidos de liberação na planilha.');
         setParseError('Não foi possível encontrar dados válidos de liberação na planilha.');
      }"""
content = content.replace(no_valid_target, no_valid_replacement)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
