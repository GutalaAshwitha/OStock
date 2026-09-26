'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import { Product, Location } from '@/types';
import { Scale, TrendingUp, TrendingDown } from 'lucide-react';

interface RecentAdj {
  id: string; quantity: number; reference: string | null; created_at: string;
  products: { name: string; uom: string } | null;
  toLoc: { name: string } | null;
}

export default function AdjustmentsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [recent, setRecent] = useState<RecentAdj[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const [productId, setProductId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [countedQty, setCountedQty] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recordedQty, setRecordedQty] = useState<number | null>(null);
  const [loadingRecorded, setLoadingRecorded] = useState(false);

  const loadRecent = () => {
    setLoadingRecent(true);
    supabase.from('stock_moves').select(`id, quantity, reference, created_at,
      products ( name, uom ),
      toLoc:locations!stock_moves_to_location_fkey ( name )`)
      .eq('move_type', 'adjustment').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setRecent(data as unknown as RecentAdj[]); setLoadingRecent(false); });
  };

  useEffect(() => {
    supabase.from('products').select('*').then(({ data }) => data && setProducts(data));
    supabase.from('locations').select('*').then(({ data }) => data && setLocations(data));
    loadRecent();
  }, []);

  useEffect(() => {
    if (!productId || !locationId) { setRecordedQty(null); return; }
    setLoadingRecorded(true);
    supabase.from('stock_by_location').select('qty').eq('product_id', productId).eq('location_id', locationId).maybeSingle()
      .then(({ data }) => {
        if (data) { setRecordedQty(data.qty); }
        else {
          const p = products.find(p => p.id === productId);
          setRecordedQty(p?.qty_on_hand ?? 0);
        }
        setLoadingRecorded(false);
      });
  }, [productId, locationId, products]);

  const counted = parseFloat(countedQty);
  const delta = recordedQty !== null && !isNaN(counted) ? counted - recordedQty : null;
  const selectedProduct = products.find(p => p.id === productId);

  const handleSubmit = async () => {
    setError(''); setSuccess('');
    if (!productId) { setError('Select a product.'); return; }
    if (!locationId) { setError('Select a location.'); return; }
    if (isNaN(counted) || counted < 0) { setError('Enter a valid counted quantity (0 or more).'); return; }
    if (recordedQty === null) { setError('Could not load recorded quantity.'); return; }
    if (delta === 0) { setError('No change — counted matches recorded.'); return; }
    setSubmitting(true);

    // ADJUSTMENT LOGIC:
    // delta = counted_qty - recorded_qty (signed, negative = shrinkage)
    // stock_moves.quantity = delta
    // products.qty_on_hand += delta (NOT overwrite — other locations may hold stock)
    // stock_by_location.qty = counted_qty (exact match to physical count)
    // Test: on_hand=50, location=20, counted=17 → delta=-3, on_hand=47, location=17
    const { error: moveErr } = await supabase.from('stock_moves').insert({
      product_id: productId, move_type: 'adjustment', status: 'done',
      from_location: null, to_location: locationId,
      quantity: delta, reference: note.trim() || null,
    });
    if (moveErr) { setError(`Failed to log adjustment: ${moveErr.message}`); setSubmitting(false); return; }

    const currentProduct = products.find(p => p.id === productId);
    if (currentProduct) {
      await supabase.from('products').update({ qty_on_hand: currentProduct.qty_on_hand + (delta as number) }).eq('id', productId);
    }

    await supabase.from('stock_by_location').upsert(
      { product_id: productId, location_id: locationId, qty: counted },
      { onConflict: 'product_id,location_id' }
    );

    setSubmitting(false);
    setSuccess(`Adjustment saved: ${(delta as number) > 0 ? '+' : ''}${delta} ${selectedProduct?.uom}. New on-hand: ${(currentProduct?.qty_on_hand ?? 0) + (delta as number)} ${selectedProduct?.uom}.`);
    setProductId(''); setLocationId(''); setCountedQty(''); setNote(''); setRecordedQty(null);
    supabase.from('products').select('*').then(({ data }) => data && setProducts(data));
    loadRecent();
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h1 className="text-xl font-bold text-slate-900">Stock Adjustments</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Correct mismatches between system records and physical counts</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">New Adjustment</h2>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-medium break-words">⚠ {error}</div>}
              {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-medium break-words">✓ {success}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Product *</label>
                <select id="adj-product" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer" value={productId} onChange={e => setProductId(e.target.value)}>
                  <option value="">Select product…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku}) — On-Hand: {p.qty_on_hand} {p.uom}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Location *</label>
                <select id="adj-location" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer" value={locationId} onChange={e => setLocationId(e.target.value)}>
                  <option value="">Select location…</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              {productId && locationId && (
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">System-Recorded Quantity</p>
                  {loadingRecorded ? <div className="h-7 w-20 bg-blue-100 rounded animate-pulse" /> : (
                    <p className="text-2xl font-bold text-blue-600">{recordedQty} <span className="text-sm font-normal text-slate-500">{selectedProduct?.uom}</span></p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-0.5">From stock_by_location (or qty_on_hand if no location record)</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Physical Count (what you counted) *</label>
                <input id="adj-counted" type="number" min="0" step="any" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" placeholder="Enter counted quantity…" value={countedQty} onChange={e => setCountedQty(e.target.value)} />
              </div>

              {delta !== null && countedQty !== '' && (
                <div className={`p-3 rounded-xl border ${delta > 0 ? 'bg-emerald-50 border-emerald-200' : delta < 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-600" /> : delta < 0 ? <TrendingDown className="w-4 h-4 text-red-500" /> : null}
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Adjustment Delta</p>
                  </div>
                  <p className={`text-2xl font-bold ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {delta > 0 ? '+' : ''}{delta} <span className="text-sm font-normal text-slate-500">{selectedProduct?.uom}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{delta > 0 ? 'Stock will be increased' : delta < 0 ? 'Stock will be decreased (shrinkage/damage)' : 'No change'}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Note (optional)</label>
                <input id="adj-note" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800" placeholder="e.g. 3 units damaged, annual count…" value={note} onChange={e => setNote(e.target.value)} />
              </div>

              <button id="btn-submit-adjustment" onClick={handleSubmit} disabled={submitting || delta === null || delta === 0}
                className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer shadow-sm shadow-blue-200">
                {submitting ? '⏳ Saving…' : '✓ Save Adjustment'}
              </button>
            </div>
          </div>

          {/* Recent adjustments */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">Recent Adjustments</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Location</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Delta</th>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRecent ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {[100, 80, 50, 70].map((w, j) => <td key={j} className="px-4 py-3"><div className="h-3 bg-slate-100 rounded" style={{ width: w }} /></td>)}
                      </tr>
                    ))
                  ) : recent.length === 0 ? (
                    <tr><td colSpan={4}><div className="flex flex-col items-center py-10 text-slate-400 gap-2">
                      <Scale className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No adjustments yet</p>
                    </div></td></tr>
                  ) : (
                    recent.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-800 text-xs">{r.products?.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{r.toLoc?.name ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold text-xs tabular-nums ${r.quantity > 0 ? 'text-emerald-600' : r.quantity < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {r.quantity > 0 ? '+' : ''}{r.quantity} {r.products?.uom}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
