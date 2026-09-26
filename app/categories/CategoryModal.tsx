'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { X, Save, AlertCircle } from 'lucide-react';

interface CategoryModalProps {
  category?: { id: string; name: string; description?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CategoryModal({ category, onClose, onSaved }: CategoryModalProps) {
  const supabase = createClient();
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      if (category) {
        // Edit
        const { error: updateError } = await supabase
          .from('categories')
          .update({ name, description })
          .eq('id', category.id);
          
        if (updateError) throw updateError;
      } else {
        // Create
        const { error: insertError } = await supabase
          .from('categories')
          .insert({ name, description });
          
        if (insertError) throw insertError;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {category ? 'Edit Category' : 'New Category'}
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Category Name <span className="text-red-500">*</span></label>
            <input 
              autoFocus
              type="text"
              required
              placeholder="e.g. Raw Materials"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Description (Optional)</label>
            <textarea 
              rows={3}
              placeholder="Brief description of products in this category..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition resize-none"
            />
          </div>
          
          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer text-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm shadow-blue-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
