'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Product, Location } from '@/types';
import { X, Plus, Trash2, Save } from 'lucide-react';

interface LineItem { product_id: string; quantity: string; to_location_id: string; }
interface Props { onClose: () => void; onCreated: () => void; }

export default function NewReceiptModal({ onClose, onCreated }: Props) {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', quantity: '', to_location_id: '' }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('products').select('*').then(({ data }) => data && setProducts(data));
    supabase.from('locations').select('*').then(({ data }) => data && setLocations(data));
  }, []);

  const setLine = (i: number, field: keyof LineItem, val: string) =>
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const handleSubmit = async () => {
    setError('');
    if (!reference.trim()) { setError('Supplier name / Reference is required.'); return; }
    for (const [i, line] of lines.entries()) {
      if (!line.product_id) { setError(`Line ${i + 1}: select a product.`); return; }
      if (!line.to_location_id) { setError(`Line ${i + 1}: select a destination location.`); return; }
      if (isNaN(parseFloat(line.quantity)) || parseFloat(line.quantity) <= 0) {
        setError(`Line ${i + 1}: enter a valid quantity.`); return;
      }
    }
    setSubmitting(true);
    const { error: dbErr } = await supabase.from('stock_moves').insert(
      lines.map(line => ({
        product_id: line.product_id, 
        move_type: 'receipt', 
        status: 'draft',
        from_location: null, 
        to_location: line.to_location_id,
        quantity: parseFloat(line.quantity), 
        reference: reference.trim(),
      }))
    );
    setSubmitting(false);
    if (dbErr) { setError(`Database error: ${dbErr.message}`); return; }
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">New Inbound Receipt</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium">⚠ {error}</div>}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Supplier / Reference *</label>
            <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800" placeholder="e.g. Acme Corp PO-1029" value={reference} onChange={e => setReference(e.target.value)} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Products</label>
              <button onClick={() => setLines(p => [...p, { product_id: '', quantity: '', to_location_id: '' }])}
                className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold hover:text-emerald-800 cursor-pointer transition">
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Product</label>
                      <select className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={line.product_id} onChange={e => setLine(i, 'product_id', e.target.value)}>
                        <option value="">Select…</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.uom})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Quantity to Receive</label>
                      <input type="number" min="0.01" step="any" className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="0" value={line.quantity} onChange={e => setLine(i, 'quantity', e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Destination Location</label>
                      <select className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer" value={line.to_location_id} onChange={e => setLine(i, 'to_location_id', e.target.value)}>
                        <option value="">Select…</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                    {lines.length > 1 && <button onClick={() => setLines(p => p.filter((_, idx) => idx !== i))} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer shadow-sm flex items-center gap-2">
            <Save className="w-4 h-4" /> {submitting ? 'Saving…' : 'Save as Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
