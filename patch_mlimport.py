import re

with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add handleFileUploadRecebimentos function right before `return (` (line 755)
# Actually, add it near handleFileChange

handle_receb = """
  const handleFileUploadRecebimentos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const matrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (matrix.length < 2) {
        setParseError('A planilha de recebimentos parece estar vazia.');
        return;
      }

      let bestHeaderRowIndex = -1;
      let maxMatches = 0;
      const keyHeaderWords = ['tipo de opera', 'numero da opera', 'numero do pacote', 'numero da venda', 'numero de envio'];

      for (let r = 0; r < Math.min(matrix.length, 20); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        let matches = 0;
        for (const cell of row) {
          const normCell = cleanStr(cell).toLowerCase();
          if (normCell && keyHeaderWords.some(k => normCell.includes(k))) {
            matches++;
          }
        }
        if (matches > maxMatches) {
          maxMatches = matches;
          bestHeaderRowIndex = r;
        }
      }

      if (bestHeaderRowIndex === -1) {
         bestHeaderRowIndex = 0;
      }

      const headers = (matrix[bestHeaderRowIndex] || []).map(h => cleanStr(h).toLowerCase());
      
      const idxTipoOp = headers.findIndex(h => h.includes('tipo de opera') || h.includes('status'));
      const idxId1 = headers.findIndex(h => h.includes('numero do pacote') || h.includes('numero de envio') || h.includes('venda'));
      const idxId2 = headers.findIndex(h => h.includes('numero da opera'));

      const records: { mlSaleId: string, status: string }[] = [];

      for (let i = bestHeaderRowIndex + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        let status = idxTipoOp !== -1 && row[idxTipoOp] !== undefined ? String(row[idxTipoOp]) : '';
        let mlSaleId = '';

        if (idxId1 !== -1 && row[idxId1]) mlSaleId = String(row[idxId1]);
        if (!mlSaleId && idxId2 !== -1 && row[idxId2]) mlSaleId = String(row[idxId2]);

        if (!status) {
          const strRow = row.map(c => String(c).toLowerCase());
          if (strRow.some(c => c.includes('libera'))) {
            status = 'liberação';
          }
        }
        if (!mlSaleId) {
           const idCell = row.find(c => String(c).length > 8 && /^\\d+$/.test(String(c)));
           if (idCell) mlSaleId = String(idCell);
        }

        if (status && mlSaleId) {
          records.push({ mlSaleId: mlSaleId.trim(), status: status.trim() });
        }
      }

      if (records.length > 0) {
         if (props.onImportRecebimentos) {
            props.onImportRecebimentos(records);
         }
      } else {
         setParseError('Não foi possível encontrar dados válidos de liberação na planilha.');
      }
    } catch (err: any) {
      setParseError('Erro ao ler arquivo: ' + err.message);
    } finally {
      setIsParsing(false);
      if (e.target) e.target.value = '';
    }
  };
"""

content = content.replace("const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {", handle_receb + "\n  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {")

# 2. Add to MLImportProps
props_replacement = """interface MLImportProps {
  products: Product[];
  mlRecords: MLImportRecord[];
  onImportRecords: (records: MLImportRecord[]) => void;
  onClearRecords: () => void;
  isSheetsConnected: boolean;
  onPushToCloud: () => void;
  isSyncing: boolean;
  onImportRecebimentos?: (records: { mlSaleId: string, status: string }[]) => void;
}"""
content = re.sub(r'interface MLImportProps \{[\s\S]*?\}', props_replacement, content)

# 3. Add Recebimentos Box to UI
box_receb = """
              {/* Box: Relatório de Recebimentos */}
              <div className="bg-[#121212] border border-white/5 rounded-3xl p-6 shadow-xl space-y-5 mt-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-4 h-4 text-emerald-400"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    Relatório de Recebimentos (Liberações)
                  </h3>
                  <span className="text-[10px] text-white/40 font-mono">Formatos: XLS, XLSX, CSV</span>
                </div>

                <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-4 mb-4">
                  <p className="text-xs text-emerald-400 font-bold mb-1">Baixa Automática (Dinheiro Entrou)</p>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Suba a planilha de Recebimentos. O sistema identificará automaticamente os status de <strong>"Liberação"</strong> e cruzará o número da operação (ID) para alterar o status das suas vendas para <strong>Concluída (Paga)</strong>.
                  </p>
                </div>

                <div className="border-2 border-dashed border-emerald-400/20 hover:border-emerald-400/40 bg-emerald-400/5 rounded-2xl p-8 text-center transition-all relative">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUploadRecebimentos}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center space-y-3 pointer-events-none">
                    <div className="bg-emerald-400/10 text-emerald-400 p-4 rounded-full">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-white">Arraste o relatório de Recebimentos aqui</p>
                    </div>
                  </div>
                </div>
              </div>
"""

content = content.replace("</textarea>\n              </div>\n            </div>", "</textarea>\n              </div>\n            </div>" + box_receb)

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
