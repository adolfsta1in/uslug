'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_COLUMNS,
  COLUMN_LABELS,
  CertificateFormData,
  DEFAULT_HEAD_NAME,
  DEFAULT_INSPECTION_BODY,
  DEFAULT_STANDARD,
  EMPTY_FORM_DATA,
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  formToCertificatePayload,
  formToRegistryRow,
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
  'certificateNumber',
  'applicationNumber',
  'issueDate',
  'validTo',
  'conclusionDate',
  'amount',
];

const FORM_FIELDS: {
  key: keyof CertificateFormData;
  label: string;
  type?: 'text' | 'date' | 'number';
  placeholder?: string;
  multiline?: boolean;
}[] = [
  { key: 'certificateNumber', label: 'Номер свидетельства', placeholder: 'TJ.762.37100.01.016 — 2025' },
  { key: 'issueDate', label: 'Дата выдачи / действует с', type: 'date' },
  { key: 'validTo', label: 'Действует до', type: 'date' },
  { key: 'applicationNumber', label: 'Номер заявки / заключения', placeholder: '3703' },
  { key: 'conclusionDate', label: 'Дата заключения / основания', type: 'date' },
  { key: 'organizationName', label: 'Наименование', placeholder: 'Магозаи хӯрокворӣ', multiline: true },
  { key: 'address', label: 'Адрес', placeholder: 'шаҳри Душанбе, ноҳияи И. Сомонӣ, хиёбони Рӯдакӣ 185', multiline: true },
  { key: 'entrepreneurName', label: 'ФИО предпринимателя / руководителя', placeholder: 'Каримов Э.' },
  { key: 'serviceType', label: 'Вид услуги', placeholder: 'хизматрасонии савдои чакана', multiline: true },
  { key: 'patentNumber', label: 'Номер патента / документ права деятельности', placeholder: 'Шаҳодатномаи Кумитаи андоз', multiline: true },
  { key: 'standard', label: 'Стандарт', placeholder: DEFAULT_STANDARD },
  { key: 'inspectionBody', label: 'Орган инспекционного контроля', placeholder: DEFAULT_INSPECTION_BODY },
  { key: 'inspectorName', label: 'Инспектор' },
  { key: 'amount', label: 'Сумма', type: 'number' },
  { key: 'headName', label: 'Руководитель органа', placeholder: DEFAULT_HEAD_NAME },
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
      standard: data.standard || DEFAULT_STANDARD,
      inspectionBody: data.inspectionBody || DEFAULT_INSPECTION_BODY,
      headName: data.headName || DEFAULT_HEAD_NAME,
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
  delete templateData.id;
  return templateData;
}

export default function Home() {
  const [formData, setFormData] = useState<CertificateFormData>(EMPTY_FORM_DATA);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [previewBackground, setPreviewBackground] = useState(false);

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
      const { error: templateError } = await supabase.from('templates').update({ data }).eq('id', activeTemplateId);

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
    XLSX.writeFile(wb, 'reestr_shahodatnoma.xlsx');
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
      id: undefined,
      certificateNumber: '',
      applicationNumber: '',
      issueDate: '',
      validTo: '',
      conclusionDate: '',
      amount: '',
      standard: data.standard || DEFAULT_STANDARD,
      inspectionBody: data.inspectionBody || DEFAULT_INSPECTION_BODY,
      headName: data.headName || DEFAULT_HEAD_NAME,
      text_color_overrides: {},
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

  const filteredTemplates = useMemo(
    () =>
      templateSearch.trim()
        ? templates.filter(template => template.name.toLowerCase().includes(templateSearch.trim().toLowerCase()))
        : templates,
    [templateSearch, templates],
  );

  return (
    <div className="min-h-screen bg-slate-100" onClick={() => showTemplatesPanel && setShowTemplatesPanel(false)}>
      <main className="mx-auto max-w-[1580px] p-4" onClick={event => event.stopPropagation()}>
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <button
            onClick={saveToRegistry}
            className={`rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
              saved ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-700'
            }`}
          >
            {saved ? 'Сохранено' : 'Сохранить'}
          </button>

          <button
            onClick={() => setPreviewBackground(value => !value)}
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
          >
            {previewBackground ? 'Скрыть фон бланка' : 'Показать фон бланка'}
          </button>

          <button
            onClick={handlePrint}
            disabled={printing}
            className="rounded-md bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
          >
            {printing ? 'Сохраняю...' : 'Печать сертификата'}
          </button>

          <button
            onClick={saveToRegistry}
            className="rounded-md bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-800"
          >
            Добавить в реестр
          </button>

          <button
            onClick={copyRow}
            className={`rounded-md px-5 py-2.5 text-sm font-semibold text-white transition-colors ${
              copied ? 'bg-emerald-600' : 'bg-cyan-700 hover:bg-cyan-800'
            }`}
          >
            {copied ? 'Скопировано' : 'Копировать строку'}
          </button>

          <button
            onClick={downloadExcel}
            className="rounded-md bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Excel
          </button>

          <button
            onClick={clearForm}
            className="rounded-md bg-slate-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-600"
          >
            Очистить
          </button>

          <div className="relative">
            <button
              onClick={() => setShowTemplatesPanel(value => !value)}
              className="rounded-md bg-slate-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Шаблоны {templates.length > 0 && `(${templates.length})`}
            </button>
            {showTemplatesPanel && (
              <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-slate-200 bg-white shadow-xl">
                <div className="border-b p-3">
                  <p className="mb-2 text-xs text-slate-500">Загрузить шаблон без номера, дат, заявки и суммы.</p>
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={event => setTemplateSearch(event.target.value)}
                    placeholder="Поиск"
                    autoFocus
                    className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-600"
                  />
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <p className="text-xs italic text-slate-400">Шаблонов нет</p>
                    ) : (
                      filteredTemplates.map(template => (
                        <div key={template.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                          <button
                            onClick={() => handleLoadTemplate(template)}
                            className="flex-1 truncate text-left text-sm font-medium text-slate-800 hover:text-slate-950"
                          >
                            {template.name}
                          </button>
                          <button onClick={() => handleDeleteTemplate(template.id)} className="text-xs text-red-600 hover:text-red-800">
                            Удалить
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="p-3">
                  <p className="mb-2 text-xs font-medium text-slate-600">Сохранить текущие данные как шаблон:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={templateName}
                      onChange={event => setTemplateName(event.target.value)}
                      onKeyDown={event => event.key === 'Enter' && handleSaveTemplate()}
                      placeholder="Название"
                      className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-slate-600"
                    />
                    <button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim() || templateSaving}
                      className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-40"
                    >
                      {templateSaving ? '...' : 'Сохранить'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeTemplateName && (
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              Шаблон: <span className="font-semibold">{activeTemplateName}</span>
              {templateAutoSaveStatus === 'saving' && <span className="ml-2 text-amber-600">сохраняется...</span>}
              {templateAutoSaveStatus === 'saved' && <span className="ml-2 text-emerald-600">сохранен</span>}
              {templateAutoSaveStatus === 'error' && <span className="ml-2 text-red-600">ошибка сохранения</span>}
            </div>
          )}
        </div>

        {error && <div className="no-print mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <div className="grid items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="no-print sticky top-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-950">Данные для «Шаҳодатнома»</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Инспектор и сумма сохраняются в реестр, но не печатаются на сертификате.
              </p>
            </div>

            <div className="space-y-3">
              {FORM_FIELDS.map(field => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-700">{field.label}</span>
                  {field.multiline ? (
                    <textarea
                      value={String(formData[field.key] || '')}
                      onChange={event => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={2}
                      className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={String(formData[field.key] || '')}
                      onChange={event => updateField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                  )}
                </label>
              ))}
            </div>
          </aside>

          <section className="min-w-0 overflow-auto">
            <div id="print-area-wrapper" className="mx-auto w-fit border border-slate-300 bg-white shadow-xl">
              <CertificateEditor formData={formData} previewBackground={previewBackground} />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
