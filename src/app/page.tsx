'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ALL_COLUMNS,
  COLUMN_LABELS,
  CertificateFormData,
  EMPTY_FORM_DATA,
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  formToCertificatePayload,
  formToRegistryRow,
  normalizeServicesList,
} from '@/lib/certificateTypes';
import CertificateEditor from './components/CertificateEditor';
import { describeSupabaseError, getSupabaseConfigError, supabase } from '@/lib/supabase';
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
  'application_number',
  'date_from_day',
  'date_from_month',
  'date_from_year',
  'date_to_day',
  'date_to_month',
  'date_to_year',
  'cert_number',
  'patent_number',
  'issue_date',
  'amount',
];

const REGISTRY_FIELDS: {
  key: keyof CertificateFormData;
  label: string;
  placeholder?: string;
  multiline?: boolean;
}[] = [
  { key: 'cert_number', label: '№ свидетельства' },
  { key: 'application_number', label: '№ заявка' },
  {
    key: 'recipient_name',
    label: 'Получатель свидетельства',
    placeholder: 'Организация, предприятие или частное лицо',
    multiline: true,
  },
  { key: 'recipient_address', label: 'Адрес', multiline: true },
  { key: 'entrepreneur_name', label: 'Ф.И.О предприниматель' },
  { key: 'patent_number', label: '№ патента' },
  { key: 'issue_date', label: 'Дата выдачи', placeholder: 'например: 03.04.2026' },
  { key: 'inspector_name', label: 'Инспектор' },
  { key: 'amount', label: 'Сумма' },
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
      text_color_overrides:
        data.text_color_overrides && typeof data.text_color_overrides === 'object'
          ? data.text_color_overrides
          : EMPTY_FORM_DATA.text_color_overrides,
    };
  } catch {
    return null;
  }
}

function saveDraft(data: CertificateFormData) {
  try {
    localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({ version: FORM_DRAFT_VERSION, data }));
  } catch {}
}

function toTemplateData(data: CertificateFormData): Partial<CertificateFormData> {
  const templateData = { ...data } as Partial<CertificateFormData>;
  UNIQUE_FIELDS.forEach(field => delete templateData[field]);
  return templateData;
}

export default function Home() {
  const [formData, setFormData] = useState<CertificateFormData>(EMPTY_FORM_DATA);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [calibrationMode, setCalibrationMode] = useState(false);

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
    const timer = setTimeout(() => saveDraft(formData), 300);
    return () => clearTimeout(timer);
  }, [formData, draftLoaded]);

  useEffect(() => {
    if (!draftLoaded || !activeTemplateId) return;
    if (templateAutoSaveTimerRef.current) clearTimeout(templateAutoSaveTimerRef.current);

    templateAutoSaveTimerRef.current = setTimeout(async () => {
      setTemplateAutoSaveStatus('saving');
      const data = toTemplateData(formData);
      const { error: templateError } = await supabase
        .from('templates')
        .update({ data })
        .eq('id', activeTemplateId);

      if (templateError) {
        console.warn('Template autosave failed', templateError);
        setTemplateAutoSaveStatus('error');
        return;
      }

      setTemplates(prev => prev.map(template => (template.id === activeTemplateId ? { ...template, data } : template)));
      setTemplateAutoSaveStatus('saved');
      setTimeout(() => setTemplateAutoSaveStatus(status => (status === 'saved' ? 'idle' : status)), 2500);
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

  const updateArrayField = useCallback((key: 'services_list', index: number, value: string) => {
    setFormData(prev => {
      const next = [...prev[key]];
      next[index] = applyAutoReplace(value);
      return { ...prev, [key]: next };
    });
  }, []);

  const addArrayRow = useCallback((key: 'services_list') => {
    setFormData(prev => ({ ...prev, [key]: [...prev[key], ''] }));
  }, []);

  const removeArrayRow = useCallback((key: 'services_list', index: number) => {
    setFormData(prev => {
      if (prev[key].length <= 1) return prev;
      return { ...prev, [key]: prev[key].filter((_, itemIndex) => itemIndex !== index) };
    });
  }, []);

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
    const text = ALL_COLUMNS.map(column => row[column] || '').join('\t');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }, [formData]);

  const saveToRegistry = useCallback(async (): Promise<boolean> => {
    setSaved(false);
    setError(null);

    const configError = getSupabaseConfigError();
    if (configError) {
      setError(configError);
      return false;
    }

    try {
      const payload = formToCertificatePayload(formData);
      let saveError;
      let savedId: string | undefined;

      if (formData.id) {
        const { error: updateError } = await supabase.from('certificates').update(payload).eq('id', formData.id);
        saveError = updateError;
      } else {
        const { data, error: insertError } = await supabase.from('certificates').insert(payload).select('id').single();
        saveError = insertError;
        savedId = data?.id;
      }

      if (saveError) {
        setError('Ошибка при сохранении в реестр: ' + describeSupabaseError(saveError));
        return false;
      }

      if (savedId) {
        setFormData(prev => ({ ...prev, id: savedId }));
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      return true;
    } catch (err) {
      setError('Ошибка при сохранении в реестр: ' + describeSupabaseError(err));
      return false;
    }
  }, [formData]);

  const downloadExcel = useCallback(() => {
    const row = formToRegistryRow(formData);
    const headers = ALL_COLUMNS.map(column => COLUMN_LABELS[column]);
    const values = ALL_COLUMNS.map(column => row[column] || '');
    const ws = XLSX.utils.aoa_to_sheet([headers, values]);
    ws['!cols'] = ALL_COLUMNS.map(column => {
      if (['recipient_name', 'recipient_address', 'service_type'].includes(column)) return { wch: 42 };
      return { wch: 18 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'reestr_svidetelstv.xlsx');
  }, [formData]);

  const handlePrint = useCallback(async () => {
    setPrinting(true);
    const savedBeforePrint = await saveToRegistry();
    setPrinting(false);
    if (savedBeforePrint) {
      window.print();
    }
  }, [saveToRegistry]);

  const clearForm = useCallback(() => {
    setFormData(EMPTY_FORM_DATA);
    setError(null);
    setCopied(false);
    setSaved(false);
    setActiveTemplateId(null);
    setActiveTemplateName(null);
    setTemplateAutoSaveStatus('idle');
    try {
      localStorage.removeItem(FORM_DRAFT_KEY);
    } catch {}
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    const name = templateName.trim();
    if (!name) return;
    setTemplateSaving(true);
    const templateData = toTemplateData(formData);
    const { data } = await supabase.from('templates').insert({ name, data: templateData }).select().single();
    await loadTemplates();
    if (data?.id) {
      setActiveTemplateId(data.id);
      setActiveTemplateName(data.name);
    }
    setTemplateName('');
    setTemplateSaving(false);
  }, [formData, templateName, loadTemplates]);

  const handleLoadTemplate = useCallback((template: CertTemplate) => {
    const data = template.data || {};
    setFormData({
      ...EMPTY_FORM_DATA,
      ...data,
      services_list: normalizeServicesList(data.services_list),
      text_color_overrides:
        data.text_color_overrides && typeof data.text_color_overrides === 'object'
          ? data.text_color_overrides
          : EMPTY_FORM_DATA.text_color_overrides,
      blank_number: '',
      application_number: '',
      cert_number: '',
      patent_number: '',
      issue_date: '',
      amount: '',
      date_from_day: '',
      date_from_month: '',
      date_from_year: '',
      date_to_day: '',
      date_to_month: '',
      date_to_year: '',
    });
    setActiveTemplateId(template.id);
    setActiveTemplateName(template.name);
    setTemplateAutoSaveStatus('idle');
    setShowTemplatesPanel(false);
    setTemplateSearch('');
    setError(null);
  }, []);

  const handleDeleteTemplate = useCallback(
    async (id: string) => {
      await supabase.from('templates').delete().eq('id', id);
      setTemplates(prev => prev.filter(template => template.id !== id));
      if (activeTemplateId === id) {
        setActiveTemplateId(null);
        setActiveTemplateName(null);
        setTemplateAutoSaveStatus('idle');
      }
    },
    [activeTemplateId],
  );

  const filteredTemplates = templateSearch.trim()
    ? templates.filter(template => template.name.toLowerCase().includes(templateSearch.trim().toLowerCase()))
    : templates;

  return (
    <div className="min-h-screen bg-gray-50" onClick={() => showTemplatesPanel && setShowTemplatesPanel(false)}>
      <main className="mx-auto max-w-[1580px] p-4" onClick={event => event.stopPropagation()}>
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handlePrint}
            disabled={printing}
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {printing ? 'Сохраняю...' : 'Печать и в реестр'}
          </button>

          <button
            onClick={copyRow}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
              copied ? 'bg-blue-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {copied ? 'Скопировано' : 'Копировать строку'}
          </button>

          <button
            onClick={saveToRegistry}
            className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors ${
              saved ? 'bg-blue-600' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {saved ? 'Сохранено' : formData.id ? 'Обновить в реестре' : 'В реестр'}
          </button>

          <button
            onClick={downloadExcel}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            Excel
          </button>

          <button
            onClick={clearForm}
            className="rounded-lg bg-gray-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-600"
          >
            Очистить
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTemplatesPanel(value => !value)}
              className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
            >
              Шаблоны {templates.length > 0 && `(${templates.length})`}
            </button>
            {showTemplatesPanel && (
              <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-gray-200 bg-white shadow-xl">
                <div className="border-b p-3">
                  <p className="mb-2 text-xs text-gray-500">Загрузить шаблон без уникальных номеров, дат и суммы.</p>
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={event => setTemplateSearch(event.target.value)}
                    placeholder="Поиск"
                    autoFocus
                    className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-cyan-500"
                  />
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <p className="text-xs italic text-gray-400">Шаблонов нет</p>
                    ) : (
                      filteredTemplates.map(template => (
                        <div key={template.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
                          <button
                            onClick={() => handleLoadTemplate(template)}
                            className="flex-1 truncate text-left text-sm font-medium text-gray-800 hover:text-cyan-700"
                          >
                            {template.name}
                          </button>
                          <button onClick={() => handleDeleteTemplate(template.id)} className="text-xs text-red-500 hover:text-red-700">
                            Удалить
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-gray-600">Сохранить текущие данные как шаблон:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={event => setTemplateName(event.target.value)}
                      onKeyDown={event => event.key === 'Enter' && handleSaveTemplate()}
                      placeholder="Название"
                      className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || templateSaving}
                      className="rounded bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-700 disabled:opacity-40"
                    >
                      {templateSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeTemplateName && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
              Шаблон: <span className="font-semibold">{activeTemplateName}</span>
              {templateAutoSaveStatus === 'saving' && <span className="ml-2 text-amber-600">сохраняется...</span>}
              {templateAutoSaveStatus === 'saved' && <span className="ml-2 text-green-600">сохранен</span>}
              {templateAutoSaveStatus === 'error' && <span className="ml-2 text-red-600">ошибка сохранения</span>}
            </div>
          )}

          <button
            onClick={() => setCalibrationMode(value => !value)}
            className={`ml-auto rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              calibrationMode ? 'bg-yellow-500 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {calibrationMode ? 'Настройка полей включена' : 'Настройка полей'}
          </button>
        </div>

        {error && <div className="no-print mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <div className="flex items-start justify-center gap-4">
          <aside className="no-print sticky top-4 w-[330px] flex-shrink-0 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-gray-900">Данные для реестра</h2>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Эти поля раскладываются по колонкам Excel-реестра со скрина. Поля бланка остаются на листе A4.
              </p>
            </div>

            <div className="space-y-3">
              {REGISTRY_FIELDS.map(field => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-gray-700">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      value={String(formData[field.key] || '')}
                      onChange={event => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={2}
                      className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(formData[field.key] || '')}
                      onChange={event => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </label>
              ))}
            </div>
          </aside>

          <div className="flex-shrink-0">
            <div id="print-area-wrapper" className="border border-gray-300 bg-white shadow-lg">
              <CertificateEditor
                formData={formData}
                onFieldChange={updateField}
                onArrayFieldChange={(key, index, value) => updateArrayField(key as 'services_list', index, value)}
                onTextColorChange={updateTextColor}
                onAddArrayRow={() => addArrayRow('services_list')}
                onRemoveArrayRow={(key, index) => removeArrayRow(key as 'services_list', index)}
                calibrationMode={calibrationMode}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
