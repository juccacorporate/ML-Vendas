import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

handler = """
  const handleImportRecebimentos = (records: { mlSaleId: string, status: string }[]) => {
    let changed = false;
    setSales(prev => {
      const updated = prev.map(s => {
        if (s.mlSaleId || s.id) {
          const mlId = s.mlSaleId || s.id;
          const rec = records.find(r => r.mlSaleId === mlId || mlId.includes(r.mlSaleId) || r.mlSaleId.includes(mlId));
          if (rec && rec.status.toLowerCase().includes('libera') && s.status !== 'completed' && s.status !== 'refunded') {
            changed = true;
            return { ...s, status: 'completed' as const };
          }
        }
        return s;
      });
      if (changed) {
        setHasPendingWrite(true);
      }
      return updated;
    });

    if (changed) {
      alert('Vendas atualizadas e marcadas como liberadas (concluídas) com sucesso!');
    } else {
      alert('Nenhuma venda pendente correspondente foi encontrada no relatório de recebimentos.');
    }
  };
"""

content = content.replace("const handleImportMLRecords =", handler + "\n  const handleImportMLRecords =")
content = content.replace("isSyncing={isCloudSyncing}", "isSyncing={isCloudSyncing}\n            onImportRecebimentos={handleImportRecebimentos}")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
