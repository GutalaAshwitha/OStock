'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Save, AlertCircle } from 'lucide-react';
import { Product, ProductCategory } from '@/types';

interface ProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function ProductModal({ product, onClose, onSaved }: ProductModalProps) {
  const supabase = createClient();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<{ id: string, name: string }[]>([]);
  
  const [name, setName] = useState(product?.name || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [categoryId, setCategoryId] = useState(product?.category_id || '');
  const [uom, setUom] = useState(product?.uom || 'pcs');
  const [reorderPoint, setReorderPoint] = useState(product?.reorder_point?.toString() || '10');
  
  // Only for new products
  const [initialStock, setInitialStock] = useState('');
  const [stockLocationId, setStockLocationId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const [catsRes, locsRes] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('locations').select('*').order('name')
      ]);
      if (catsRes.data) {
        setCategories(catsRes.data);
        if (!categoryId && catsRes.data.length > 0 && !product) setCategoryId(catsRes.data[0].id);
      }
      if (locsRes.data) {
        setLocations(locsRes.data);
        if (locsRes.data.length > 0 && !product) setStockLocationId(locsRes.data[0].id);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim()) {
      setError("Name and SKU are required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check for SKU duplicate
      const { data: existingSku } = await supabase
        .from('products')
        .select('id')
        .eq('sku', sku.trim())
        .single();
        
      if (existingSku && existingSku.id !== product?.id) {
        throw new Error("SKU already exists. Please choose a unique SKU.");
      }

      if (product) {
        // Edit
        const { error: updateError } = await supabase
          .from('products')
          .update({ 
            name: name.trim(), 
            sku: sku.trim(),
            category_id: categoryId,
            uom: uom.trim(),
            reorder_point: parseInt(reorderPoint) || 0
          })
          .eq('id', product.id);
          
        if (updateError) throw updateError;
      } else {
        // Create
        const initialQty = parseInt(initialStock) || 0;
        if (initialQty < 0) throw new Error("Initial stock cannot be negative");

        // Insert product
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({ 
            name: name.trim(), 
            sku: sku.trim(),
            category_id: categoryId,
            uom: uom.trim(),
            reorder_point: parseInt(reorderPoint) || 0,
            qty_on_hand: initialQty // Set initial qty immediately
          })
          .select()
          .single();
          
        if (insertError) throw insertError;
        
        // If initial stock is provided, insert a stock move (adjustment)
        if (initialQty > 0 && stockLocationId && newProduct) {
          const { error: moveError } = await supabase
            .from('stock_moves')
            .insert({
              product_id: newProduct.id,
              move_type: 'adjustment',
              status: 'done',
              to_location: stockLocationId, // adjustment in
              quantity: initialQty,
              reference: 'Initial Stock setup'
            });
          if (moveError) console.error("Failed to insert initial stock move:", moveError);
          
          // Upsert stock_by_location
          const { error: sblError } = await supabase
            .from('stock_by_location')
            .upsert({
              product_id: newProduct.id,
              location_id: stockLocationId,
              qty: initialQty
            }, { onConflict: 'product_id,location_id' });
          if (sblError) console.error("Failed to upsert stock by location:", sblError);
        }
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {product ? 'Edit Product' : 'New Product'}
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-semibold text-slate-700">Product Name <span className="text-red-500">*</span></label>
              <input autoFocus type="text" required placeholder="e.g. Steel Rods" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-semibold text-slate-700">SKU / Code <span className="text-red-500">*</span></label>
              <input type="text" required placeholder="e.g. ST-ROD-01" value={sku} onChange={e => setSku(e.target.value.toUpperCase())}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-semibold text-slate-700">Category <span className="text-red-500">*</span></label>
              <select required value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition">
                <option value="" disabled>Select category...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <label className="text-sm font-semibold text-slate-700">Unit of Measure (UOM) <span className="text-red-500">*</span></label>
              <input type="text" required placeholder="kg, pcs, box..." value={uom} onChange={e => setUom(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Reorder Point</label>
            <input type="number" min="0" value={reorderPoint} onChange={e => setReorderPoint(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition" />
            <p className="text-xs text-slate-500">Alert triggers if stock falls at or below this number.</p>
          </div>

          {!product && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4 mt-2">
              <h3 className="text-sm font-semibold text-slate-800">Initial Stock Setup (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Starting Quantity</label>
                  <input type="number" min="0" placeholder="0" value={initialStock} onChange={e => setInitialStock(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Initial Location</label>
                  <select value={stockLocationId} onChange={e => setStockLocationId(e.target.value)} disabled={!initialStock || parseInt(initialStock) <= 0}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-blue-500 disabled:opacity-50">
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 mt-2">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-center">
              Cancel
            </button>
            <button type="submit" disabled={loading || categories.length === 0} 
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
