'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import { MoveStatus } from '@/types';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

interface DeliveryDetail {
  id: string; status: MoveStatus; quantity: number; reference: string | null;
  created_at: string; product_id: string; from_location: string | null;
  products: { name: string; sku: string; uom: string; qty_on_hand: number } | null;
  fromLoc: { id: string; name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600', waiting: 'bg-amber-50 text-amber-700',
  ready: 'bg-blue-50 text-blue-700', done: 'bg-emerald-50 text-emerald-700',
  canceled: 'bg-red-50 text-red-600',
};

const STEPS: MoveStatus[] = ['draft', 'waiting', 'ready', 'done'];
const STEP_LABELS: Record<string, string> = { draft: 'Draft', waiting: 'Picked', ready: 'Packed', done: 'Delivered' };

function StepBar({ status }: { status: MoveStatus }) {
  const cur = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 mt-4 mb-1">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${i <= cur ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
              {i < cur ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${i <= cur ? 'text-blue-600' : 'text-slate-400'}`}>{STEP_LABELS[step]}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < cur ? 'bg-blue-600' : 'bg-slate-200'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.from('stock_moves').select(`
      id, status, quantity, reference, created_at, product_id, from_location,
      products ( name, sku, uom, qty_on_hand ),
      fromLoc:locations!stock_moves_from_location_fkey ( id, name )
    `).eq('id', id).eq('move_type', 'delivery').single();
    if (data) setDelivery(data as unknown as DeliveryDetail);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const advance = async (s: MoveStatus) => {
    if (!delivery || updating) return;
    setUpdating(true); setError('');
    const { error: e } = await supabase.from('stock_moves').update({ status: s }).eq('id', id);
    if (e) { setError(e.message); setUpdating(false); return; }
    setDelivery(p => p ? { ...p, status: s } : p);
    setUpdating(false);
  };

  // CRITICAL VALIDATION — re-fetches stock fresh, blocks if qty > qty_on_hand, no DB write on failure
  // Test: 10 units / 50 on-hand → pass, leaves 40. 100 units / 50 on-hand → blocked with error.
  const handleValidate = async () => {
    if (!delivery || updating) return;
    setUpdating(true); setError('');
    const { data: fresh } = await supabase.from('products').select('qty_on_hand').eq('id', delivery.product_id).single();
    if (!fresh) { setError('Could not verify stock. Try again.'); setUpdating(false); return; }

    if (delivery.quantity > fresh.qty_on_hand) {
      setError(`Insufficient stock: need ${delivery.quantity} ${delivery.products?.uom} but only ${fresh.qty_on_hand} available. Receive more stock first.`);
      setUpdating(false); return;
    }

    await supabase.from('products').update({ qty_on_hand: fresh.qty_on_hand - delivery.quantity }).eq('id', delivery.product_id);

    if (delivery.from_location) {
      const { data: locStock } = await supabase.from('stock_by_location').select('qty').eq('product_id', delivery.product_id).eq('location_id', delivery.from_location).maybeSingle();
      const newLocQty = Math.max(0, (locStock?.qty ?? 0) - delivery.quantity);
      await supabase.from('stock_by_location').upsert({ product_id: delivery.product_id, location_id: delivery.from_location, qty: newLocQty }, { onConflict: 'product_id,location_id' });
    }

    await supabase.from('stock_moves').update({ status: 'done' }).eq('id', id);
    setUpdating(false);
    load();
  };

  if (loading) return <AppShell><div className="p-6 text-slate-500 text-sm">Loading…</div></AppShell>;
  if (!delivery) return <AppShell><div className="p-6"><div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">Delivery order not found.</div></div></AppShell>;

  const isDone = delivery.status === 'done';
  const isCanceled = delivery.status === 'canceled';

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <button onClick={() => router.push('/deliveries')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Deliveries
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 break-words">Delivery — {delivery.reference || 'No reference'}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[delivery.status]}`}>{delivery.status}</span>
        </div>
        <p className="text-xs text-slate-400 mb-2">Created {new Date(delivery.created_at).toLocaleString('en-IN')}</p>
        <div className="overflow-x-auto py-1">
          <StepBar status={delivery.status} />
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <div id="delivery-validate-error" className="p-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="flex items-start gap-2.5">
                <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-700">Cannot validate delivery</p>
                  <p className="text-sm text-red-600 mt-0.5 break-words">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">Order Details</h2>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                <p className="font-semibold text-slate-900 break-words">{delivery.products?.name}</p>
                <p className="text-xs text-slate-400 break-all">SKU: {delivery.products?.sku}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Quantity</p>
                <p className="text-2xl font-bold text-blue-600">{delivery.quantity} <span className="text-sm font-normal text-slate-500">{delivery.products?.uom}</span></p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Customer / Reference</p>
                <p className="font-medium text-slate-700 break-words">{delivery.reference || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">From Location</p>
                <p className="font-medium text-slate-700 break-words">{delivery.fromLoc?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current On-Hand Stock</p>
                <p className={`font-semibold ${(delivery.products?.qty_on_hand ?? 0) <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {delivery.products?.qty_on_hand ?? '—'} {delivery.products?.uom}
                </p>
              </div>
            </div>
          </div>

          {!isDone && !isCanceled && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Actions</h2>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                {delivery.status === 'draft' && (
                  <button id="btn-delivery-mark-picked" onClick={() => advance('waiting')} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 transition cursor-pointer text-center">
                    📦 Mark as Picked
                  </button>
                )}
                {delivery.status === 'waiting' && (
                  <button id="btn-delivery-mark-packed" onClick={() => advance('ready')} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition cursor-pointer text-center">
                    📫 Mark as Packed
                  </button>
                )}
                {delivery.status === 'ready' && (
                  <button id="btn-delivery-validate" onClick={handleValidate} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer text-center">
                    {updating ? '⏳ Validating…' : '✓ Validate Delivery'}
                  </button>
                )}
                <button id="btn-delivery-cancel" onClick={async () => { await supabase.from('stock_moves').update({ status: 'canceled' }).eq('id', id); load(); }} disabled={updating}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 transition cursor-pointer text-center">
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {isDone && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">Delivery Validated</p>
                <p className="text-sm text-emerald-600">{delivery.quantity} {delivery.products?.uom} dispatched. Stock has been decremented.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
