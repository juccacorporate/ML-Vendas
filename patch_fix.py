with open('src/components/MLImport.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

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
         if (onImportRecebimentos) {
            onImportRecebimentos(records);
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

content = content.replace("const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {", handle_receb + "\n  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {")

with open('src/components/MLImport.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
