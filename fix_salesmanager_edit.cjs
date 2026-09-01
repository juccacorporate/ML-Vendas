const fs = require('fs');

let content = fs.readFileSync('src/components/SalesManager.tsx', 'utf8');

// 1. Add state for editProductId and editPurchasePrice
const targetState = `  const [editPrice, setEditPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(1);`;

const newState = `  const [editPrice, setEditPrice] = useState<number>(0);
  const [editPurchasePrice, setEditPurchasePrice] = useState<number>(0);
  const [editProductId, setEditProductId] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<number>(1);`;

content = content.replace(targetState, newState);

// 2. Add in handleOpenEditModal
const targetOpen = `    setEditingSale(sale);
    setEditPrice(sale.salePrice);
    setEditQuantity(sale.quantity);`;

const newOpen = `    setEditingSale(sale);
    setEditPrice(sale.salePrice);
    setEditPurchasePrice(sale.purchasePrice || 0);
    setEditProductId(sale.productId || '');
    setEditQuantity(sale.quantity);`;

content = content.replace(targetOpen, newOpen);

// 3. Add in handleSaveEdit
const targetSave = `    const updatedSale: Sale = {
      ...editingSale,
      salePrice: Number(editPrice),
      quantity: Number(editQuantity),`;

const newSave = `    const selectedProd = products.find(p => p.id === editProductId);
    const updatedSale: Sale = {
      ...editingSale,
      productId: editProductId || editingSale.productId,
      productName: selectedProd ? selectedProd.name : editingSale.productName,
      salePrice: Number(editPrice),
      purchasePrice: Number(editPurchasePrice),
      quantity: Number(editQuantity),`;

content = content.replace(targetSave, newSave);

// 4. In the modal UI, add the Product selector & Custo de Compra field
const targetUI = `                {/* Preço de Venda Unitário */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Venda Unitário (R$)</label>`;

const newUI = `                {/* Vincular Produto do Estoque */}
                <div className="sm:col-span-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  <label className="text-xs font-bold text-[#FFE600] block mb-1">Vincular a Produto do Estoque (Custo e SKU)</label>
                  <select
                    value={editProductId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setEditProductId(pId);
                      const prod = products.find(p => p.id === pId);
                      if (prod) {
                        setEditPurchasePrice(prod.purchasePrice);
                      }
                    }}
                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-xs text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FFE600]/30"
                  >
                    <option value="">-- Selecione o Produto no Estoque --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#141414] text-white">
                        {p.name} (SKU: {p.sku || 'S/N'} | Custo: R$ {p.purchasePrice.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preço de Compra (Custo Unitário) */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Compra Unitário (Custo R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPurchasePrice}
                    onChange={(e) => setEditPurchasePrice(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-emerald-400 font-extrabold focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  />
                </div>

                {/* Preço de Venda Unitário */}
                <div>
                  <label className="text-xs font-bold text-white/70 block mb-1">Preço de Venda Unitário (R$)</label>`;

content = content.replace(targetUI, newUI);

fs.writeFileSync('src/components/SalesManager.tsx', content);
console.log('SalesManager.tsx updated successfully');
