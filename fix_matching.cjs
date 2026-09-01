const fs = require('fs');

let typesContent = fs.readFileSync('src/types.ts', 'utf8');

const targetFunc = `export function findMatchingProduct(r: MLImportRecord, products: Product[]): Product | undefined {
  if (!products || products.length === 0) return undefined;

  const rSkuClean = (r.sku || '').trim().toLowerCase();
  const rAdIdClean = (r.adId || '').trim().toLowerCase();

  // 1. Busca por SKU exata no estoque
  if (rSkuClean && !['sim', 'não', 'nao', 'ml'].includes(rSkuClean)) {
    const matchBySku = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      return pSkuClean && pSkuClean === rSkuClean;
    });
    if (matchBySku) return matchBySku;
  }

  // 2. Busca por ID do anúncio (adId) na SKU do produto
  if (rAdIdClean && rAdIdClean.length > 3) {
    const matchByAdId = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      return pSkuClean && pSkuClean === rAdIdClean;
    });
    if (matchByAdId) return matchByAdId;
  }

  // NADA POR NOME. SE NÃO BATEU ID / SKU, RETORNA UNDEFINED.
  return undefined;
}`;

const newFunc = `export function findMatchingProduct(r: MLImportRecord, products: Product[]): Product | undefined {
  if (!products || products.length === 0) return undefined;

  const rSkuClean = (r.sku || '').trim().toLowerCase();
  const rAdIdClean = (r.adId || '').trim().toLowerCase();
  const rTitleClean = (r.adTitle || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');

  // 1. Busca por SKU exata no estoque
  if (rSkuClean && !['sim', 'não', 'nao', 'ml'].includes(rSkuClean)) {
    const matchBySku = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      return pSkuClean && pSkuClean === rSkuClean;
    });
    if (matchBySku) return matchBySku;
  }

  // 2. Busca por ID do anúncio (adId) na SKU do produto
  if (rAdIdClean && rAdIdClean.length > 3) {
    const matchByAdId = products.find(p => {
      const pSkuClean = (p.sku || '').trim().toLowerCase();
      return pSkuClean && pSkuClean === rAdIdClean;
    });
    if (matchByAdId) return matchByAdId;
  }

  // 3. Busca por Título Exato ou Normalizado no Estoque (Regra 1.2 e 6.2 do Manual)
  if (rTitleClean && rTitleClean.length > 3) {
    const matchByTitle = products.find(p => {
      const pNameClean = (p.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ');
      return pNameClean && (pNameClean === rTitleClean || (pNameClean.length > 10 && rTitleClean.includes(pNameClean)) || (rTitleClean.length > 10 && pNameClean.includes(rTitleClean)));
    });
    if (matchByTitle) return matchByTitle;
  }

  return undefined;
}`;

typesContent = typesContent.replace(targetFunc, newFunc);
fs.writeFileSync('src/types.ts', typesContent);
console.log('types.ts updated');
