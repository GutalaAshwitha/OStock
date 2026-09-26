'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import AppShell from '@/components/navigation/AppShell';
import CategoryModal from './CategoryModal';
import { Tags, Plus, Edit2, Trash2, Package } from 'lucide-react';
import { ProductCategory } from '@/types';

export default function CategoriesPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ show: boolean, category: ProductCategory | null }>({ show: false, category: null });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the category "${name}"?`)) return;
    setIsDeleting(id);
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id));
    } else {
      alert("Error deleting category. It might be in use.");
    }
    setIsDeleting(null);
  };

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tags className="w-5 h-5 text-indigo-600 flex-shrink-0" />
              <h1 className="text-xl font-bold text-slate-900">Product Categories</h1>
            </div>
            <p className="text-sm text-slate-500">Organize your product catalog by functional groups and tags</p>
          </div>
          <button
            onClick={() => setModalState({ show: true, category: null })}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm shadow-indigo-200 cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> New Category
          </button>
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-1/3">Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-40" /></td>
                      <td className="px-5 py-4"><div className="h-3.5 bg-slate-100 rounded w-64" /></td>
                      <td className="px-5 py-4"></td>
                    </tr>
                  ))
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                        <Package className="w-10 h-10 text-slate-300" />
                        <p className="font-semibold text-slate-500">No categories found</p>
                        <p className="text-xs text-slate-400">Add categories to organize your products.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  categories.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition group">
                      <td className="px-5 py-3.5 font-semibold text-slate-800 break-words">{c.name}</td>
                      <td className="px-5 py-3.5 text-slate-500 break-words">{c.description || '—'}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setModalState({ show: true, category: c })}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(c.id, c.name)}
                            disabled={isDeleting === c.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalState.show && (
        <CategoryModal 
          category={modalState.category} 
          onClose={() => setModalState({ show: false, category: null })} 
          onSaved={() => { setModalState({ show: false, category: null }); load(); }} 
        />
      )}
    </AppShell>
  );
}
