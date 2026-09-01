const fs = require('fs');

let utilsContent = fs.readFileSync('src/utils.ts', 'utf8');

const targetFunc = `export function findProductForSale(s: Sale, productsList: Product[]): Product | undefined {
  if (!productsList || productsList.length === 0) return undefined;

  // 1. Tentar por ID de produto EXATO
  const sPid = String(s.productId || '').trim();
  if (sPid) {
    const matchById = productsList.find(p => String(p.id || '').trim() === sPid);
    if (matchById) return matchById;
  }

  // NADA POR NOME. SE NÃO ACHOU POR ID, RETORNA UNDEFINED.
  return undefined;
}`;

const newFunc = `export function findProductForSale(s: Sale, productsList: Product[]): Product | undefined {
  if (!productsList || productsList.length === 0) return undefined;

  // 1. Tentar por ID de produto EXATO
  const sPid = String(s.productId || '').trim();
  if (sPid) {
    const matchById = productsList.find(p => String(p.id || '').trim() === sPid);
    if (matchById) return matchById;
  }

  // 2. Tentar por SKU
  const sSku = String((s as any).sku || '').trim().toLowerCase();
  if (sSku && !['sim', 'não', 'nao', 'ml'].includes(sSku)) {
    const matchBySku = productsList.find(p => String(p.sku || '').trim().toLowerCase() === sSku);
    if (matchBySku) return matchBySku;
  }

  // 3. Tentar por Nome / Título Normalizado
  const sNameClean = (s.productName || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
  if (sNameClean && sNameClean.length > 3) {
    const matchByName = productsList.find(p => {
      const pNameClean = (p.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
      return pNameClean && (pNameClean === sNameClean || (pNameClean.length > 10 && sNameClean.includes(pNameClean)) || (sNameClean.length > 10 && pNameClean.includes(sNameClean)));
    });
    if (matchByName) return matchByName;
  }

  return undefined;
}`;

utilsContent = utilsContent.replace(targetFunc, newFunc);
fs.writeFileSync('src/utils.ts', utilsContent);
console.log('utils.ts updated');
