'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  formToRegistryRow,
  ALL_COLUMNS,
  COLUMN_LABELS,
  TAJIK_MONTHS,
  normalizeServicesList,
} from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';

interface CertRow {
  id: string;
  created_at: string;
  blank_number: string;
  date_from_day: string;
  date_from_month: string;
  date_from_year: string;
  date_to_day: string;
  date_to_month: string;
  date_to_year: string;
  cert_number: string;
  provider_name_address: string;
  director_name: string;
  services_list: string;
  normative_documents: string;
  conclusion_doc: string;
  tax_certificate: string;
  inspection_body: string;
  head_name: string;
}

export default function RegistryPage() {
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [certNumberSearch, setCertNumberSearch] = useState('');
  const pageSize = 100;
  
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<CertRow>>({});
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  const router = useRouter();

  const loadCerts = useCallback(async (page: number, searchTerm: string) => {
    setLoading(true);
    setError(null);
    
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const normalizedSearch = searchTerm.trim();

    let query = supabase
      .from('certificates')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (normalizedSearch) {
      query = query.ilike('cert_number', `%${normalizedSearch}%`);
    }

    const { data, error: fetchError, count } = await query
      .range(from, to);

    if (fetchError) {
      setError('Ошибка загрузки: ' + fetchError.message);
    } else {
      setCerts(data || []);
      if (count !== null) setTotalCount(count);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCerts(currentPage, certNumberSearch);
  }, [loadCerts, currentPage, certNumberSearch]);

  const handleCertNumberSearchChange = useCallback((value: string) => {
    setCertNumberSearch(value);
    setCurrentPage(1);
  }, []);

  const deleteCert = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert('Ошибка удаления: ' + deleteError.message);
      return;
    }

    setCerts(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    if (!confirm('Удалить все сертификаты из реестра?')) return;

    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // удалить всё

    if (deleteError) {
      alert('Ошибка при очистке: ' + deleteError.message);
      return;
    }

    setCerts([]);
  }, []);

  const editCert = useCallback((cert: CertRow) => {
    const formData = {
      id: cert.id,
      blank_number: cert.blank_number || '',
      date_from_day: cert.date_from_day || '',
      date_from_month: cert.date_from_month || '',
      date_from_year: cert.date_from_year || '',
      date_to_day: cert.date_to_day || '',
      date_to_month: cert.date_to_month || '',
      date_to_year: cert.date_to_year || '',
      cert_number: cert.cert_number || '',
      provider_name_address: cert.provider_name_address || '',
      director_name: cert.director_name || '',
      services_list: normalizeServicesList(cert.services_list),
      normative_documents: cert.normative_documents || '',
      conclusion_doc: cert.conclusion_doc || '',
      tax_certificate: cert.tax_certificate || '',
      inspection_body: cert.inspection_body || '',
      head_name: cert.head_name || '',
      text_color_overrides: {},
    };
    
    // Save to draft and redirect
    localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({ version: FORM_DRAFT_VERSION, data: formData }));
    router.push('/');
  }, [router]);

  const startInlineEdit = useCallback((cert: CertRow) => {
    setEditingRowId(cert.id);
    setEditFormData({ ...cert });
  }, []);

  const cancelInlineEdit = useCallback(() => {
    setEditingRowId(null);
    setEditFormData({});
  }, []);

  const handleEditChange = useCallback((field: keyof CertRow, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!editingRowId) return;
    
    setLoading(true);
    const { error } = await supabase
      .from('certificates')
      .update(editFormData)
      .eq('id', editingRowId);

    if (error) {
      alert(`Ошибка при сохранении: ${error.message}`);
      setLoading(false);
      return;
    }

    await loadCerts(currentPage, certNumberSearch);
    setEditingRowId(null);
    setEditFormData({});
  }, [editingRowId, editFormData, loadCerts, currentPage, certNumberSearch]);

  const syncHorizontalScroll = useCallback((source: 'top' | 'table') => {
    const from = source === 'top' ? topScrollRef.current : tableScrollRef.current;
    const to = source === 'top' ? tableScrollRef.current : topScrollRef.current;
    if (!from || !to || to.scrollLeft === from.scrollLeft) return;
    to.scrollLeft = from.scrollLeft;
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-[1800px] mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-800">
            Реестр сертификатов (всего: {totalCount})
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 rounded bg-white border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                Пред.
              </button>
              <span className="text-sm font-medium text-gray-600">
                Стр. {currentPage} из {Math.max(1, Math.ceil(totalCount / pageSize))}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(totalCount / pageSize) || loading}
                className="px-3 py-1.5 rounded bg-white border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50"
              >
                След.
              </button>
            </div>
            <button
              onClick={() => loadCerts(currentPage, certNumberSearch)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            >
              Обновить
            </button>
            {certs.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Очистить реестр
              </button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="cert-number-search" className="text-sm font-medium text-gray-700">
            Поиск по № сертификата
          </label>
          <input
            id="cert-number-search"
            type="search"
            value={certNumberSearch}
            onChange={e => handleCertNumberSearchChange(e.target.value)}
            placeholder="Введите номер"
            className="w-80 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          {certNumberSearch && (
            <button
              onClick={() => handleCertNumberSearchChange('')}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Сбросить
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p>Загрузка...</p>
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Реестр пуст</p>
            <p className="text-sm mt-2">Сохраните сертификаты через главную страницу</p>
          </div>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden">
            <div
              ref={topScrollRef}
              onScroll={() => syncHorizontalScroll('top')}
              className="overflow-x-auto border-b border-gray-200"
            >
              <div className="h-3 min-w-[3600px]" />
            </div>
            <div
              ref={tableScrollRef}
              onScroll={() => syncHorizontalScroll('table')}
              className="overflow-x-auto"
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="bg-[#1d4ed8] text-white px-2 py-2 border border-blue-800 text-xs font-medium">
                      #
                    </th>
                    {ALL_COLUMNS.map(col => (
                      <th
                        key={col}
                        className="bg-[#1d4ed8] text-white px-2 py-2 border border-blue-800 text-center whitespace-nowrap text-xs font-medium"
                      >
                        {COLUMN_LABELS[col]}
                      </th>
                    ))}
                    <th className="bg-[#1d4ed8] text-white px-2 py-2 border border-blue-800 text-xs font-medium">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((cert, idx) => {
                    const isEditing = cert.id === editingRowId;
                    const row = formToRegistryRow({
                      blank_number: cert.blank_number || '',
                      date_from_day: cert.date_from_day || '',
                      date_from_month: cert.date_from_month || '',
                      date_from_year: cert.date_from_year || '',
                      date_to_day: cert.date_to_day || '',
                      date_to_month: cert.date_to_month || '',
                      date_to_year: cert.date_to_year || '',
                      cert_number: cert.cert_number || '',
                      provider_name_address: cert.provider_name_address || '',
                      director_name: cert.director_name || '',
                      services_list: normalizeServicesList(cert.services_list),
                      normative_documents: cert.normative_documents || '',
                      conclusion_doc: cert.conclusion_doc || '',
                      tax_certificate: cert.tax_certificate || '',
                      inspection_body: cert.inspection_body || '',
                      head_name: cert.head_name || '',
                      text_color_overrides: {},
                    });
                    
                    return (
                      <tr key={cert.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 border border-gray-300 text-center text-xs">
                          {idx + 1}
                        </td>
                        {ALL_COLUMNS.map(col => {
                          if (isEditing) {
                            if (col === 'blank_number') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-20 text-xs p-1 border rounded" value={editFormData.blank_number || ''} onChange={e => handleEditChange('blank_number', e.target.value)} /></td>;
                            if (col === 'cert_number') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-24 text-xs p-1 border rounded" value={editFormData.cert_number || ''} onChange={e => handleEditChange('cert_number', e.target.value)} /></td>;
                            if (col === 'date_from') return (
                              <td key={col} className="px-1 py-1 border border-gray-300 text-xs">
                                <div className="flex gap-1">
                                  <input className="w-8 p-1 border rounded text-center" value={editFormData.date_from_day || ''} onChange={e => handleEditChange('date_from_day', e.target.value)} placeholder="DD" />
                                  <select className="w-[80px] p-1 border rounded" value={editFormData.date_from_month || ''} onChange={e => handleEditChange('date_from_month', e.target.value)}>
                                     <option value="">Месяц</option>
                                     {TAJIK_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <input className="w-12 p-1 border rounded text-center" value={editFormData.date_from_year || ''} onChange={e => handleEditChange('date_from_year', e.target.value)} placeholder="YYYY" />
                                </div>
                              </td>
                            );
                            if (col === 'date_to') return (
                              <td key={col} className="px-1 py-1 border border-gray-300 text-xs">
                                <div className="flex gap-1">
                                  <input className="w-8 p-1 border rounded text-center" value={editFormData.date_to_day || ''} onChange={e => handleEditChange('date_to_day', e.target.value)} placeholder="DD" />
                                  <select className="w-[80px] p-1 border rounded" value={editFormData.date_to_month || ''} onChange={e => handleEditChange('date_to_month', e.target.value)}>
                                     <option value="">Месяц</option>
                                     {TAJIK_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                  </select>
                                  <input className="w-12 p-1 border rounded text-center" value={editFormData.date_to_year || ''} onChange={e => handleEditChange('date_to_year', e.target.value)} placeholder="YYYY" />
                                </div>
                              </td>
                            );
                            if (col === 'provider_name_address') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.provider_name_address || ''} onChange={e => handleEditChange('provider_name_address', e.target.value)} /></td>;
                            if (col === 'director_name') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.director_name || ''} onChange={e => handleEditChange('director_name', e.target.value)} /></td>;
                            if (col === 'services_list') return <td key={col} className="px-1 py-1 border border-gray-300 text-xs text-gray-500 italic">Редактируйте на бланке</td>;
                            if (col === 'normative_documents') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.normative_documents || ''} onChange={e => handleEditChange('normative_documents', e.target.value)} /></td>;
                            if (col === 'conclusion_doc') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.conclusion_doc || ''} onChange={e => handleEditChange('conclusion_doc', e.target.value)} /></td>;
                            if (col === 'tax_certificate') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.tax_certificate || ''} onChange={e => handleEditChange('tax_certificate', e.target.value)} /></td>;
                            if (col === 'inspection_body') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.inspection_body || ''} onChange={e => handleEditChange('inspection_body', e.target.value)} /></td>;
                            if (col === 'head_name') return <td key={col} className="px-1 py-1 border border-gray-300"><input className="w-32 text-xs p-1 border rounded" value={editFormData.head_name || ''} onChange={e => handleEditChange('head_name', e.target.value)} /></td>;
                            
                            return (
                              <td key={col} className="px-2 py-2 border border-gray-300 text-center text-xs bg-gray-100">
                                {row[col as keyof typeof row] || '\u00A0'}
                              </td>
                            );
                          } else {
                            return (
                              <td
                                key={col}
                                className="px-2 py-2 border border-gray-300 text-center text-xs max-w-[150px] truncate"
                                title={row[col as keyof typeof row] || ''}
                              >
                                {row[col as keyof typeof row] || '\u00A0'}
                              </td>
                            );
                          }
                        })}
                        {isEditing ? (
                          <td className="px-2 py-2 border border-gray-300 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={saveInlineEdit}
                              className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="text-gray-500 hover:text-gray-700 text-xs"
                            >
                              Отмена
                            </button>
                          </td>
                        ) : (
                          <td className="px-2 py-2 border border-gray-300 text-center space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => editCert(cert)}
                              className="text-green-600 hover:text-blue-800 text-xs"
                              title="Редактировать на бланке"
                            >
                              В бланк
                            </button>
                            <button
                              onClick={() => startInlineEdit(cert)}
                              className="text-blue-600 hover:text-blue-800 text-xs"
                              title="Редактировать в строке"
                            >
                              В строке
                            </button>
                            <button
                              onClick={() => deleteCert(cert.id)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Удалить
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
