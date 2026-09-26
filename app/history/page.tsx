'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import FilterBar from '@/components/filters/FilterBar';
import { History, ArrowRight } from 'lucide-react';

interface MoveRow {
  id: string; move_type: string; status: string; quantity: number; reference: string | null; created_at: string;
  products: { name: string; uom: string } | null;
  fromLoc: { name: string } | null;
  toLoc: { name: string } | null;
}

const TYPE_STYLES: Record<string, string> = {
  delivery:   'bg-blue-50 text-blue-700 border border-blue-200',
  receipt:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  internal:   'bg-purple-50 text-purple-700 border border-purple-200',
  adjustment: 'bg-amber-50 text-amber-700 border border-amber-200',
};
const TYPE_LABELS: Record<string, string> = {
  delivery: 'Delivery', receipt: 'Receipt', internal: 'Transfer', adjustment: 'Adjustment',
};

export default function HistoryPage() {
  const supabase = createClient();
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('stock_moves')
      .select(`id, move_type, status, quantity, reference, created_at,
        products ( name, uom ),
        fromLoc:locations!stock_moves_from_location_fkey ( name ),
        toLoc:locations!stock_moves_to_location_fkey ( name )`)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setMoves(data as unknown as MoveRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Stat counts
  const totalMoves = moves.length;
  const totalDeliveries = moves.filter(m => m.move_type === 'delivery' && m.status === 'done').length;
  const totalTransfers = moves.filter(m => m.move_type === 'internal').length;
  const totalAdjustments = moves.filter(m => m.move_type === 'adjustment').length;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <h1 className="text-xl font-bold text-slate-900">Move History</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6">Full audit ledger of all stock movements</p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Moves', value: totalMoves, color: 'text-slate-800' },
            { label: 'Deliveries Done', value: totalDeliveries, color: 'text-blue-600' },
            { label: 'Transfers', value: totalTransfers, color: 'text-purple-600' },
            { label: 'Adjustments', value: totalAdjustments, color: 'text-amber-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1 truncate">{label}</p>
              <p className={`text-2xl sm:text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="mb-4"><FilterBar syncUrl={true} /></div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Product</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Route</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Reference</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {[80, 130, 50, 160, 100, 70, 80].map((w, j) => (
                        <td key={j} className="px-5 py-4"><div className="h-3 bg-slate-100 rounded" style={{ width: w }} /></td>
                      ))}
                    </tr>
                  ))
                ) : moves.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <History className="w-10 h-10 text-slate-300" />
                      <p className="font-semibold text-slate-500">No moves recorded yet</p>
                      <p className="text-xs text-slate-400">All deliveries, transfers, and adjustments will appear here.</p>
                    </div>
                  </td></tr>
                ) : (
                  moves.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_STYLES[m.move_type] || 'bg-slate-100 text-slate-600'}`}>
                          {TYPE_LABELS[m.move_type] || m.move_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-800 break-words">{m.products?.name ?? '—'}</td>
                      <td className={`px-5 py-3 font-bold tabular-nums whitespace-nowrap ${m.quantity < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity} <span className="text-slate-400 font-normal text-xs">{m.products?.uom}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {m.fromLoc?.name ?? '—'}
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          {m.toLoc?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs break-words">{m.reference ?? '—'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${m.status === 'done' ? 'bg-emerald-50 text-emerald-700' : m.status === 'canceled' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600'}`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
