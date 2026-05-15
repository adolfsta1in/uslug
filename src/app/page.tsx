'use client';

export const dynamic = 'force-dynamic';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  CertificateFormData,
  EMPTY_FORM_DATA,
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  formToRegistryRow,
  ALL_COLUMNS,
  COLUMN_LABELS,
  normalizeServicesList,
  serializeServicesList,
} from '@/lib/certificateTypes';
import CertificateEditor from './components/CertificateEditor';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import { applyAutoReplace, initAutoReplacements } from '@/lib/autoReplace';

interface CertTemplate {
  id: string;
  name: string;
  data: Partial<CertificateFormData>;
  created_at: string;
}

const UNIQUE_FIELDS: (keyof CertificateFormData)[] = [
  'blank_number',
  'date_from_day', 'date_from_month', 'date_from_year',
  'date_to_day', 'date_to_month', 'date_to_year',
  'cert_number',
];

function loadDraft(): CertificateFormData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== FORM_DRAFT_VERSION) return null;
    const data = parsed.data;
    if (!data || typeof data !== 'object') return null;
    return {
      ...EMPTY_FORM_DATA,
      ...data,
      services_list: normalizeServicesList(data.services_list),
      text_color_overrides: data.text_color_overrides && typeof data.text_color_overrides === 'object'
        ? data.text_color_overrides
        : EMPTY_FORM_DATA.text_color_overrides,
    };
  } catch {
    return null;
  }
}

function saveDraft(data: CertificateFormData) {
  try {
    localStorage.setItem(
      FORM_DRAFT_KEY,
      JSON.stringify({ version: FORM_DRAFT_VERSION, data }),
    );
  } catch {}
}

function toTemplateData(data: CertificateFormData): Partial<CertificateFormData> {
  const templateData = { ...data } as Partial<CertificateFormData>;
  UNIQUE_FIELDS.forEach(f => delete templateData[f]);
  return templateData;
}

export default function Home() {
  const [formData, setFormData] = useState<CertificateFormData>(EMPTY_FORM_DATA);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeTemplateName, setActiveTemplateName] = useState<string | null>(null);
  const [templateAutoSaveStatus, setTemplateAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const templateAutoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) setFormData(draft);
    setDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => saveDraft(formData), 300);
    return () => clearTimeout(t);
  }, [formData, draftLoaded]);

  useEffect(() => {
    if (!draftLoaded || !activeTemplateId) return;
    if (templateAutoSaveTimerRef.current) clearTimeout(templateAutoSaveTimerRef.current);

    templateAutoSaveTimerRef.current = setTimeout(async () => {
      setTemplateAutoSaveStatus('saving');
      const data = toTemplateData(formData);
      const { error } = await supabase
        .from('templates')
        .update({ data })
        .eq('id', activeTemplateId);

      if (error) {
        console.warn('Template autosave failed', error);
        setTemplateAutoSaveStatus('error');
        return;
      }

      setTemplates(prev => prev.map(t => t.id === activeTemplateId ? { ...t, data } : t));
      setTemplateAutoSaveStatus('saved');
      setTimeout(() => setTemplateAutoSaveStatus(s => (s === 'saved' ? 'idle' : s)), 2500);
    }, 900);

    return () => {
      if (templateAutoSaveTimerRef.current) clearTimeout(templateAutoSaveTimerRef.current);
    };
  }, [formData, draftLoaded, activeTemplateId]);

  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .neq('name', '__system_auto_replacements__')
      .order('created_at', { ascending: false });
    setTemplates((data || []) as CertTemplate[]);
  }, []);

  useEffect(() => { 
    initAutoReplacements();
    loadTemplates(); 
  }, [loadTemplates]);

  const updateField = useCallback((key: keyof CertificateFormData, value: string) => {
    setFormData(prev => ({ ...prev, [key]: applyAutoReplace(value) }));
  }, []);

  const updateArrayField = useCallback(
    (key: 'services_list', index: number, value: string) => {
      setFormData(prev => {
        const arr = [...prev[key]];
        arr[index] = applyAutoReplace(value);
        return { ...prev, [key]: arr };
      });
    },
    [],
  );

  const addArrayRow = useCallback((key: 'services_list') => {
    setFormData(prev => ({ ...prev, [key]: [...prev[key], ''] }));
  }, []);

  const removeArrayRow = useCallback(
    (key: 'services_list', index: number) => {
      setFormData(prev => {
        if (prev[key].length <= 1) return prev;
        return { ...prev, [key]: prev[key].filter((_, i) => i !== index) };
      });
    },
    [],
  );

  const updateTextColor = useCallback((field: string, start: number, end: number, color: '#000' | '#fff') => {
    if (start === end) return;
    setFormData(prev => {
      const nextFieldColors = { ...(prev.text_color_overrides[field] || {}) };
      for (let i = Math.min(start, end); i < Math.max(start, end); i += 1) {
        nextFieldColors[i] = color;
      }
      return {
        ...prev,
        text_color_overrides: {
          ...prev.text_color_overrides,
          [field]: nextFieldColors,
        },
      };
    });
  }, []);

  const copyRow = useCallback(async () => {
    const row = formToRegistryRow(formData);
    const values = ALL_COLUMNS.map(col => row[col as keyof typeof row] || '');
    const text = values.join('\t');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [formData]);

  const saveToRegistry = useCallback(async () => {
    setSaved(false);
    setError(null);

    if (!isSupabaseConfigured) {
      setError('Ошибка при сохранении: Supabase не настроен. Добавьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в Vercel/локальный .env.local.');
      return;
    }

    try {
      const payload: Record<string, string | null> = {
        blank_number: formData.blank_number,
        date_from_day: formData.date_from_day,
        date_from_month: formData.date_from_month,
        date_from_year: formData.date_from_year,
        date_to_day: formData.date_to_day,
        date_to_month: formData.date_to_month,
        date_to_year: formData.date_to_year,
        cert_number: formData.cert_number,
        provider_name_address: formData.provider_name_address,
        director_name: formData.director_name,
        services_list: serializeServicesList(formData.services_list),
        normative_documents: formData.normative_documents,
        conclusion_doc: formData.conclusion_doc,
        tax_certificate: formData.tax_certificate,
        inspection_body: formData.inspection_body,
        head_name: formData.head_name,
      };

      let saveError;
      let savedId: string | undefined;
      if (formData.id) {
        const { error } = await supabase
          .from('certificates')
          .update(payload)
          .eq('id', formData.id);
        saveError = error;
      } else {
        const { data, error } = await supabase
          .from('certificates')
          .insert(payload)
          .select('id')
          .single();
        saveError = error;
        savedId = data?.id;
      }

      if (saveError) {
        setError('Ошибка при сохранении: ' + saveError.message);
        return;
      }

      if (savedId) {
        setFormData(prev => ({ ...prev, id: savedId }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setError(
        message.includes('Failed to fetch')
          ? 'Ошибка при сохранении: не удалось подключиться к Supabase. Проверьте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в Vercel/локальном .env.local.'
          : 'Не удалось сохранить в базу данных: ' + message,
      );
    }
  }, [formData]);

  const downloadExcel = useCallback(() => {
    const row = formToRegistryRow(formData);
    const headers = ALL_COLUMNS.map(col => COLUMN_LABELS[col]);
    const values = ALL_COLUMNS.map(col => row[col as keyof typeof row] || '');
    const ws = XLSX.utils.aoa_to_sheet([headers, values]);

    ws['!cols'] = ALL_COLUMNS.map(col => {
      if (['blank_number', 'date_from', 'date_to'].includes(col)) return { wch: 15 };
      if (['services_list', 'provider_name_address'].includes(col)) return { wch: 40 };
      return { wch: 20 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'реестр_сертификатов.xlsx');
  }, [formData]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const clearForm = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    setError(null);
    setCopied(false);
    setSaved(false);
    setActiveTemplateId(null);
    setActiveTemplateName(null);
    setTemplateAutoSaveStatus('idle');
    try { localStorage.removeItem(FORM_DRAFT_KEY); } catch {}
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) return;
    setTemplateSaving(true);
    const templateData = toTemplateData(formData);
    const { data } = await supabase
      .from('templates')
      .insert({ name, data: templateData })
      .select()
      .single();
    await loadTemplates();
    if (data?.id) {
      setActiveTemplateId(data.id);
      setActiveTemplateName(data.name);
    }
    setTemplateName('');
    setTemplateSaving(false);
  }, [formData, templateName, loadTemplates]);

  const handleLoadTemplate = useCallback((t: CertTemplate) => {
    const tData = t.data || {};
    setFormData({
      ...EMPTY_FORM_DATA,
      ...tData,
      services_list: normalizeServicesList(tData.services_list),
      text_color_overrides: tData.text_color_overrides && typeof tData.text_color_overrides === 'object'
        ? tData.text_color_overrides
        : EMPTY_FORM_DATA.text_color_overrides,
      blank_number: '',
      cert_number: '',
      date_from_day: '', date_from_month: '', date_from_year: '',
      date_to_day: '', date_to_month: '', date_to_year: '',
    });
    setActiveTemplateId(t.id);
    setActiveTemplateName(t.name);
    setTemplateAutoSaveStatus('idle');
    setShowTemplatesPanel(false);
    setTemplateSearch('');
    setError(null);
  }, []);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    await supabase.from('templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
      setActiveTemplateName(null);
      setTemplateAutoSaveStatus('idle');
    }
  }, [activeTemplateId]);

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => { if (showTemplatesPanel) setShowTemplatesPanel(false); }}>
      <main className="max-w-[1200px] mx-auto p-4" onClick={e => e.stopPropagation()}>
        {/* Top toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-4 no-print">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 rounded-lg font-medium bg-blue-700 text-white hover:bg-blue-800 transition-colors text-sm"
          >
            Печать
          </button>

          <button
            onClick={copyRow}
            className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors text-sm ${
              copied ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {copied ? 'Скопировано!' : 'Копировать строку'}
          </button>

          <button
            onClick={saveToRegistry}
            className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors text-sm ${
              saved ? 'bg-blue-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {saved ? 'Сохранено!' : (formData.id ? 'Обновить в реестре' : 'В реестр')}
          </button>

          <button
            onClick={downloadExcel}
            className="px-5 py-2.5 rounded-lg font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors text-sm"
          >
            Excel
          </button>

          <button
            onClick={clearForm}
            className="px-5 py-2.5 rounded-lg font-medium bg-gray-500 text-white hover:bg-gray-600 transition-colors text-sm"
          >
            Очистить
          </button>

          {/* Template buttons */}
          <div className="relative">
            <button
              onClick={() => setShowTemplatesPanel(v => !v)}
              className="px-5 py-2.5 rounded-lg font-medium bg-cyan-600 text-white hover:bg-cyan-700 transition-colors text-sm"
            >
              Шаблоны {templates.length > 0 && `(${templates.length})`}
            </button>
            {showTemplatesPanel && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl w-72">
                <div className="p-3 border-b">
                  <p className="text-xs text-gray-500 mb-2">Загрузить шаблон — заполнит форму без уникальных полей</p>
                  {templates.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Шаблонов нет. Сохраните первый.</p>
                  ) : (() => {
                    const q = templateSearch.trim().toLowerCase();
                    const filtered = q
                      ? templates.filter(t => t.name.toLowerCase().includes(q))
                      : templates;
                    return (
                      <>
                        <div className="relative mb-2">
                          <input
                            type="text"
                            value={templateSearch}
                            onChange={e => setTemplateSearch(e.target.value)}
                            placeholder="Поиск…"
                            autoFocus
                            className="w-full px-2 py-1.5 pr-6 border border-gray-300 rounded text-xs focus:border-cyan-500 focus:outline-none"
                          />
                          {templateSearch && (
                            <button
                              onClick={() => setTemplateSearch('')}
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs w-4 h-4 flex items-center justify-center"
                              title="Очистить"
                              type="button"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {filtered.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Ничего не найдено</p>
                        ) : (
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {filtered.map(t => (
                              <div key={t.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-gray-50">
                                <button
                                  onClick={() => handleLoadTemplate(t)}
                                  className="text-sm text-left text-gray-800 hover:text-cyan-700 font-medium flex-1 truncate"
                                >
                                  {t.name}
                                </button>
                                <button
                                  onClick={() => handleDeleteTemplate(t.id)}
                                  className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">Сохранить текущие данные как шаблон:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={e => setTemplateName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                      placeholder="Название (напр. Шаблон 1)"
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || templateSaving}
                      className="px-3 py-1.5 bg-cyan-600 text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-cyan-700"
                    >
                      {templateSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeTemplateName && (
            <div className="text-xs text-cyan-800 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-2">
              Шаблон: <span className="font-semibold">{activeTemplateName}</span>
              {templateAutoSaveStatus === 'saving' && <span className="ml-2 text-amber-600">сохраняется...</span>}
              {templateAutoSaveStatus === 'saved' && <span className="ml-2 text-green-600">сохранен</span>}
              {templateAutoSaveStatus === 'error' && <span className="ml-2 text-red-600">ошибка сохранения</span>}
            </div>
          )}

          <div className="ml-auto flex items-center gap-4">
            <button
              onClick={() => setCalibrationMode(!calibrationMode)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                calibrationMode
                  ? 'bg-yellow-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {calibrationMode ? 'Настройка полей (ВКЛ)' : 'Настройка полей'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg no-print">
            {error}
          </div>
        )}

        <div className="flex gap-4 justify-center">
          <div className="flex-shrink-0">
            <div
              id="print-area-wrapper"
              className="border border-gray-300 shadow-lg bg-white"
            >
              <CertificateEditor
                formData={formData}
                onFieldChange={updateField}
                onArrayFieldChange={(k, i, v) => updateArrayField(k as 'services_list', i, v)}
                onTextColorChange={updateTextColor}
                onAddArrayRow={() => addArrayRow('services_list')}
                onRemoveArrayRow={(k, i) => removeArrayRow(k as 'services_list', i)}
                calibrationMode={calibrationMode}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
