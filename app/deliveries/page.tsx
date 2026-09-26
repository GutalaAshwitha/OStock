'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import FilterBar from '@/components/filters/FilterBar';
import NewDeliveryModal from './NewDeliveryModal';
import { Truck, Plus, Eye, Package } from 'lucide-react';
import { MoveStatus } from '@/types';

interface DeliveryRow {
  id: string;
  status: MoveStatus;
  quantity: number;
  reference: string | null;
  created_at: string;
  products: { name: string; uom: string } | null;
  locations: { name: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  draft:    'bg-slate-100 text-slate-600 border border-slate-200',
  waiting:  'bg-amber-50 text-amber-700 border border-amber-200',
  ready:    'bg-blue-50 text-blue-700 border border-blue-200',
  done:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
  canceled: 'bg-red-50 text-red-600 border border-red-200',
};

export default function DeliveriesPage() {
  const supabase = createClient();
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_moves')
      .select(`id, status, quantity, reference, created_at,
        products ( name, uom ),
        locations!stock_moves_from_location_fkey ( name )`)
      .eq('move_type', 'delivery')
      .order('created_at', { ascending: false });
    if (data) setDeliveries(data as unknown as DeliveryRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Delivery Orders</h1>
            </div>
            <p className="text-sm text-slate-500">Manage outgoing stock — pick, pack, validate</p>
          </div>
          <button
            id="btn-new-delivery"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition shadow-sm shadow-blue-200 cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> New Delivery
          </button>
        </div>

        {/* FilterBar — wired in from Person 2 */}
        <div className="mb-4">
          <FilterBar syncUrl={true} />
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Customer / Ref</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">From Location</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[140, 120, 60, 100, 80, 80, 50].map((w, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-3.5 bg-slate-100 rounded" style={{ width: w }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Package className="w-10 h-10 text-slate-300" />
                        <p className="font-semibold text-slate-500">No delivery orders yet</p>
                        <p className="text-xs text-slate-400">Create your first delivery to start shipping stock out.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  deliveries.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/60 transition cursor-pointer" onClick={() => window.location.href = `/deliveries/${d.id}`}>
                      <td className="px-5 py-3.5 font-semibold text-slate-800 break-words">{d.reference || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-700">
                        <span className="font-medium text-slate-800 break-words">{d.products?.name ?? '—'}</span>
                        <span className="text-slate-400 text-xs ml-1">{d.products?.uom}</span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-800 tabular-nums whitespace-nowrap">{d.quantity}</td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{d.locations?.name ?? '—'}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[d.status] || STATUS_STYLES.draft}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right">
                        <Link href={`/deliveries/${d.id}`} onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800 transition">
                          <Eye className="w-3.5 h-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && <NewDeliveryModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </AppShell>
  );
}
