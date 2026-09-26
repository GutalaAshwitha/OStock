'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';

interface TransferDetail {
  id: string; status: string; quantity: number; reference: string | null; created_at: string;
  products: { name: string; sku: string; uom: string; qty_on_hand: number } | null;
  fromLoc: { name: string } | null;
  toLoc: { name: string } | null;
}

export default function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [transfer, setTransfer] = useState<TransferDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('stock_moves').select(`
      id, status, quantity, reference, created_at,
      products ( name, sku, uom, qty_on_hand ),
      fromLoc:locations!stock_moves_from_location_fkey ( name ),
      toLoc:locations!stock_moves_to_location_fkey ( name )
    `).eq('id', id).eq('move_type', 'internal').single()
      .then(({ data }) => { if (data) setTransfer(data as unknown as TransferDetail); setLoading(false); });
  }, [id]);

  if (loading) return <AppShell><div className="p-6 text-slate-500 text-sm">Loading…</div></AppShell>;
  if (!transfer) return <AppShell><div className="p-6"><div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">Transfer not found.</div></div></AppShell>;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full">
        <button onClick={() => router.push('/transfers')} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 font-medium mb-4 transition cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back to Transfers
        </button>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">Internal Transfer</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">{transfer.status}</span>
        </div>
        <p className="text-xs text-slate-400 mb-6">Created {new Date(transfer.created_at).toLocaleString('en-IN')}</p>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="text-sm font-bold text-slate-800">Transfer Details</h2>
            </div>
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Product</p>
                <p className="font-semibold text-slate-900 break-words">{transfer.products?.name}</p>
                <p className="text-xs text-slate-400 break-all">SKU: {transfer.products?.sku}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Quantity Moved</p>
                <p className="text-2xl font-bold text-blue-600">{transfer.quantity} <span className="text-sm font-normal text-slate-500">{transfer.products?.uom}</span></p>
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Route</p>
                <p className="font-medium text-slate-700 inline-flex flex-wrap items-center gap-2 break-words">
                  {transfer.fromLoc?.name ?? '—'} <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" /> {transfer.toLoc?.name ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Total On-Hand (unchanged)</p>
                <p className="font-semibold text-emerald-600">{transfer.products?.qty_on_hand} {transfer.products?.uom}
                  <span className="text-xs text-slate-400 font-normal ml-1 block sm:inline">— transfers never change this</span>
                </p>
              </div>
              {transfer.reference && (
                <div className="col-span-1 sm:col-span-2 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Note</p>
                  <p className="text-slate-600 break-words">{transfer.reference}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-700">Transfer Completed</p>
              <p className="text-sm text-emerald-600">{transfer.quantity} {transfer.products?.uom} moved from {transfer.fromLoc?.name} to {transfer.toLoc?.name}. Total inventory on-hand remains unchanged.</p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
