'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import ProductModal from './ProductModal';
import { Boxes, Plus, Edit2, Package, Search, AlertTriangle, Eye } from 'lucide-react';
import { Product } from '@/types';

interface ProductRow extends Product {
  categories?: { name: string };
}

export default function ProductsPage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ show: boolean, product: ProductRow | null }>({ show: false, product: null });
  const [searchQuery, setSearchQuery] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select(`*, categories(name)`)
      .order('name');
    if (data) setProducts(data as unknown as ProductRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Boxes className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Product Catalog</h1>
            </div>
            <p className="text-sm text-slate-500">Manage items, SKUs, and monitor stock levels</p>
          </div>
          <button
            onClick={() => setModalState({ show: true, product: null })}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm shadow-indigo-200 cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> New Product
          </button>
        </div>

        {/* Toolbar */}
        <div className="mb-4 flex items-center gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by SKU or Name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-xs text-slate-900"
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SKU</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qty on Hand</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-24" /></td>
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-48" /></td>
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-32" /></td>
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-16 ml-auto" /></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-100 rounded-full w-20" /></td>
                      <td className="px-5 py-4"></td>
                    </tr>
                  ))
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Package className="w-10 h-10 text-slate-300" />
                        <p className="font-semibold text-slate-500">No products found</p>
                        {searchQuery ? (
                          <p className="text-xs text-slate-400">Try adjusting your search terms.</p>
                        ) : (
                          <p className="text-xs text-slate-400">Add a product to get started.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const isLowStock = p.qty_on_hand <= p.reorder_point;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition group cursor-pointer" onClick={() => window.location.href = `/products/${p.id}`}>
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">{p.sku}</td>
                        <td className="px-5 py-3.5 font-semibold text-slate-800 break-words">{p.name}</td>
                        <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{p.categories?.name || '—'}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-800 tabular-nums whitespace-nowrap">
                          {p.qty_on_hand} <span className="text-slate-400 text-xs font-normal">{p.uom}</span>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {isLowStock ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600 border border-red-200">
                              <AlertTriangle className="w-3 h-3" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                              Healthy
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setModalState({ show: true, product: p }); }}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <Link 
                              href={`/products/${p.id}`} 
                              onClick={e => e.stopPropagation()}
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalState.show && (
        <ProductModal 
          product={modalState.product} 
          onClose={() => setModalState({ show: false, product: null })} 
          onSaved={() => { setModalState({ show: false, product: null }); load(); }} 
        />
      )}
    </AppShell>
  );
}
