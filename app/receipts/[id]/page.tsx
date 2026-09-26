'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import { MoveStatus } from '@/types';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

interface ReceiptDetail {
  id: string; status: MoveStatus; quantity: number; reference: string | null;
  created_at: string; product_id: string; to_location: string | null;
  products: { name: string; sku: string; uom: string; qty_on_hand: number } | null;
  toLoc: { id: string; name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600', waiting: 'bg-amber-50 text-amber-700',
  ready: 'bg-blue-50 text-blue-700', done: 'bg-emerald-50 text-emerald-700',
  canceled: 'bg-red-50 text-red-600',
};

const STEPS: MoveStatus[] = ['draft', 'waiting', 'ready', 'done'];
const STEP_LABELS: Record<string, string> = { draft: 'Draft', waiting: 'In Transit', ready: 'Received', done: 'Validated' };

function StepBar({ status }: { status: MoveStatus }) {
  const cur = STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0 mt-4 mb-1">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${i <= cur ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}>
              {i < cur ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${i <= cur ? 'text-emerald-600' : 'text-slate-400'}`}>{STEP_LABELS[step]}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < cur ? 'bg-emerald-600' : 'bg-slate-200'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await supabase.from('stock_moves').select(`
      id, status, quantity, reference, created_at, product_id, to_location,
      products ( name, sku, uom, qty_on_hand ),
      toLoc:locations!stock_moves_to_location_fkey ( id, name )
    `).eq('id', id).eq('move_type', 'receipt').single();
    if (data) setReceipt(data as unknown as ReceiptDetail);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const advance = async (s: MoveStatus) => {
    if (!receipt || updating) return;
    setUpdating(true); setError('');
    const { error: e } = await supabase.from('stock_moves').update({ status: s }).eq('id', id);
    if (e) { setError(e.message); setUpdating(false); return; }
    setReceipt(p => p ? { ...p, status: s } : p);
    setUpdating(false);
  };

  // CRITICAL VALIDATION — increments stock
  const handleValidate = async () => {
    if (!receipt || updating) return;
    setUpdating(true); setError('');
    const { data: fresh } = await supabase.from('products').select('qty_on_hand').eq('id', receipt.product_id).single();
    if (!fresh) { setError('Could not verify product. Try again.'); setUpdating(false); return; }

    // Increment overall quantity
    await supabase.from('products').update({ qty_on_hand: fresh.qty_on_hand + receipt.quantity }).eq('id', receipt.product_id);

    // Upsert location stock
    if (receipt.to_location) {
      const { data: locStock } = await supabase.from('stock_by_location').select('qty').eq('product_id', receipt.product_id).eq('location_id', receipt.to_location).maybeSingle();
      const newLocQty = (locStock?.qty ?? 0) + receipt.quantity;
      await supabase.from('stock_by_location').upsert({ product_id: receipt.product_id, location_id: receipt.to_location, qty: newLocQty }, { onConflict: 'product_id,location_id' });
    }

    // Mark as done
    await supabase.from('stock_moves').update({ status: 'done' }).eq('id', id);
    setUpdating(false);
    load();
  };

  if (loading) return <AppShell><div className="p-6 text-slate-500 text-sm">Loading…</div></AppShell>;
  if (!receipt) return <AppShell><div className="p-6"><div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">Receipt not found.</div></div></AppShell>;

  const isDone = receipt.status === 'done';
  const isCanceled = receipt.status === 'canceled';

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <button onClick={() => router.push('/receipts')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Receipts
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 break-words">Receipt — {receipt.reference || 'No reference'}</h1>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[receipt.status]}`}>{receipt.status}</span>
        </div>
        <p className="text-xs text-slate-400 mb-2">Created {new Date(receipt.created_at).toLocaleString('en-IN')}</p>
        <div className="overflow-x-auto py-1">
          <StepBar status={receipt.status} />
        </div>

        <div className="mt-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-700">Cannot validate receipt</p>
                <p className="text-sm text-red-600 mt-0.5 break-words">{error}</p>
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
                <p className="font-semibold text-slate-900 break-words">{receipt.products?.name}</p>
                <p className="text-xs text-slate-400 break-all">SKU: {receipt.products?.sku}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Quantity</p>
                <p className="text-2xl font-bold text-emerald-600">+{receipt.quantity} <span className="text-sm font-normal text-slate-500">{receipt.products?.uom}</span></p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Supplier / Reference</p>
                <p className="font-medium text-slate-700 break-words">{receipt.reference || '—'}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Destination Location</p>
                <p className="font-medium text-slate-700 break-words">{receipt.toLoc?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Current On-Hand Stock</p>
                <p className="font-semibold text-slate-700">
                  {receipt.products?.qty_on_hand ?? '—'} {receipt.products?.uom}
                </p>
              </div>
            </div>
          </div>

          {!isDone && !isCanceled && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
              <h2 className="text-sm font-bold text-slate-800 mb-3">Actions</h2>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2.5">
                {receipt.status === 'draft' && (
                  <button onClick={() => advance('waiting')} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50 transition cursor-pointer text-center">
                    🚛 Mark as In Transit
                  </button>
                )}
                {receipt.status === 'waiting' && (
                  <button onClick={() => advance('ready')} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition cursor-pointer text-center">
                    📦 Mark as Received
                  </button>
                )}
                {receipt.status === 'ready' && (
                  <button onClick={handleValidate} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer shadow-sm shadow-emerald-200 text-center">
                    {updating ? '⏳ Validating…' : '✓ Validate Receipt'}
                  </button>
                )}
                {receipt.status === 'draft' && (
                  <button onClick={handleValidate} disabled={updating}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer shadow-sm shadow-emerald-200 text-center">
                    {updating ? '⏳ Validating…' : '⚡ Quick Validate'}
                  </button>
                )}
                <button onClick={async () => { await supabase.from('stock_moves').update({ status: 'canceled' }).eq('id', id); load(); }} disabled={updating}
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
                <p className="text-sm font-semibold text-emerald-700">Receipt Validated</p>
                <p className="text-sm text-emerald-600">{receipt.quantity} {receipt.products?.uom} added to stock.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
