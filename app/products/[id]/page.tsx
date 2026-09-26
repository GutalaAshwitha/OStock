'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import { Product, StockByLocation, StockMove } from '@/types';
import { ArrowLeft, Boxes, MapPin, Activity, AlertTriangle } from 'lucide-react';

interface StockByLocRow extends StockByLocation {
  locations?: { name: string };
}

interface MoveRow extends StockMove {
  from_loc?: { name: string };
  to_loc?: { name: string };
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const supabase = createClient();
  const [product, setProduct] = useState<(Product & { categories?: { name: string } }) | null>(null);
  const [stockByLocation, setStockByLocation] = useState<StockByLocRow[]>([]);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('id', resolvedParams.id)
        .single();
        
      if (prodErr || !prodData) {
        console.error(prodErr);
        router.push('/products');
        return;
      }
      
      setProduct(prodData as any);

      // Fetch stock by location
      const { data: stockData } = await supabase
        .from('stock_by_location')
        .select('*, locations(name)')
        .eq('product_id', resolvedParams.id);
        
      if (stockData) setStockByLocation(stockData as any);

      // Fetch recent moves (mini history)
      const { data: movesData } = await supabase
        .from('stock_moves')
        .select(`
          *,
          from_loc:locations!stock_moves_from_location_fkey(name),
          to_loc:locations!stock_moves_to_location_fkey(name)
        `)
        .eq('product_id', resolvedParams.id)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (movesData) setMoves(movesData as any);
      
      setLoading(false);
    };
    
    loadData();
  }, [resolvedParams.id, router, supabase]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-6 max-w-5xl mx-auto w-full animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-48 bg-slate-200 rounded-2xl" />
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!product) return null;

  const isLowStock = product.qty_on_hand <= product.reorder_point;

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {/* Back Link */}
        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </Link>

        {/* Product Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
                <Boxes className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">{product.name}</h1>
                <p className="text-slate-500 mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                  <span className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs break-all">{product.sku}</span>
                  <span>•</span>
                  <span>{product.categories?.name || 'Uncategorized'}</span>
                </p>
              </div>
            </div>
            
            <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between sm:justify-start pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Quantity on Hand</p>
              <div className="flex items-center sm:justify-end gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900">{product.qty_on_hand}</span>
                <span className="text-sm font-semibold text-slate-400 mt-1">{product.uom}</span>
              </div>
              {isLowStock && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200 mt-1 sm:mt-2">
                  <AlertTriangle className="w-3 h-3" /> Low Stock Alert
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock by Location */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <h2 className="font-bold text-slate-800">Stock by Location</h2>
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              {stockByLocation.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No stock recorded in any location yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stockByLocation.map(sbl => (
                    <li key={sbl.id} className="px-6 py-4 flex items-center justify-between">
                      <span className="font-medium text-slate-700">{sbl.locations?.name || 'Unknown Location'}</span>
                      <span className="font-bold text-slate-900 tabular-nums">
                        {sbl.qty} <span className="text-slate-400 text-xs font-normal">{product.uom}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Mini History */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-400" />
              <h2 className="font-bold text-slate-800">Recent Movements</h2>
            </div>
            <div className="p-0 overflow-y-auto max-h-[400px]">
              {moves.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No stock movements recorded yet.
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {moves.map(m => (
                    <li key={m.id} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="capitalize text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {m.move_type}
                        </span>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {new Date(m.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="text-sm text-slate-600 flex flex-col">
                          {m.from_loc && <span>From: <span className="font-medium">{m.from_loc.name}</span></span>}
                          {m.to_loc && <span>To: <span className="font-medium">{m.to_loc.name}</span></span>}
                          {!m.from_loc && !m.to_loc && <span>{m.reference || 'No details'}</span>}
                        </div>
                        <span className={`font-bold tabular-nums ${m.move_type === 'receipt' || (m.move_type === 'adjustment' && !m.from_location) ? 'text-emerald-600' : m.move_type === 'delivery' ? 'text-amber-600' : 'text-slate-700'}`}>
                          {m.move_type === 'receipt' ? '+' : m.move_type === 'delivery' ? '-' : ''}{m.quantity}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
               <Link href="/history" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition">View Full History &rarr;</Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
