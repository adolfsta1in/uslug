'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CertificateFormData } from '@/lib/certificateTypes';
import DraggableField from './DraggableField';

export const LAYOUT_VERSION = '4'; // Bumped for new project

export interface FieldLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  bold: boolean;
  color?: string;
  multiline?: boolean;
}

export type Layouts = Record<string, FieldLayout>;

export const DEFAULT_LAYOUTS: Layouts = {
  blank_number: { x: 170, y: 40, width: 30, height: 8, fontSize: 14, align: 'right', bold: true, color: '#ff0000' },
  date_from_day: { x: 130, y: 70, width: 10, height: 6, fontSize: 12, align: 'center', bold: false },
  date_from_month: { x: 145, y: 70, width: 25, height: 6, fontSize: 12, align: 'center', bold: false },
  date_from_year: { x: 175, y: 70, width: 15, height: 6, fontSize: 12, align: 'center', bold: false },
  date_to_day: { x: 130, y: 80, width: 10, height: 6, fontSize: 12, align: 'center', bold: false },
  date_to_month: { x: 145, y: 80, width: 25, height: 6, fontSize: 12, align: 'center', bold: false },
  date_to_year: { x: 175, y: 80, width: 15, height: 6, fontSize: 12, align: 'center', bold: false },
  cert_number: { x: 20, y: 95, width: 80, height: 6, fontSize: 12, align: 'left', bold: true },
  provider_name_address: { x: 20, y: 110, width: 170, height: 12, fontSize: 12, align: 'center', bold: true, multiline: true },
  director_name: { x: 20, y: 130, width: 170, height: 6, fontSize: 12, align: 'center', bold: true },
  services_list_0: { x: 20, y: 160, width: 170, height: 6, fontSize: 11, align: 'center', bold: false },
  services_list_1: { x: 20, y: 170, width: 170, height: 6, fontSize: 11, align: 'center', bold: false },
  services_list_2: { x: 20, y: 180, width: 170, height: 6, fontSize: 11, align: 'center', bold: false },
  normative_documents: { x: 60, y: 200, width: 130, height: 12, fontSize: 11, align: 'left', bold: false, multiline: true },
  conclusion_doc: { x: 20, y: 220, width: 170, height: 12, fontSize: 11, align: 'left', bold: false, multiline: true },
  tax_certificate: { x: 80, y: 250, width: 110, height: 6, fontSize: 11, align: 'left', bold: false },
  inspection_body: { x: 80, y: 270, width: 80, height: 6, fontSize: 12, align: 'center', bold: true },
  head_name: { x: 140, y: 285, width: 50, height: 6, fontSize: 12, align: 'center', bold: true },
};

interface Props {
  formData: CertificateFormData;
  onFieldChange: (key: keyof CertificateFormData, value: string) => void;
  onArrayFieldChange: (key: string, index: number, value: string) => void;
  onTextColorChange?: (field: string, start: number, end: number, color: '#000' | '#fff') => void;
  onAddArrayRow: (key: string) => void;
  onRemoveArrayRow: (key: string, index: number) => void;
  calibrationMode: boolean;
}

export default function CertificateEditor({
  formData,
  onFieldChange,
  onArrayFieldChange,
  onTextColorChange,
  onAddArrayRow,
  onRemoveArrayRow,
  calibrationMode,
}: Props) {
  const [layouts, setLayouts] = useState<Layouts>(DEFAULT_LAYOUTS);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cert_field_layouts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.version === LAYOUT_VERSION) {
          // Merge in case we added new default fields
          setLayouts({ ...DEFAULT_LAYOUTS, ...parsed.layouts });
        } else {
          setLayouts(DEFAULT_LAYOUTS);
        }
      }
    } catch {}
  }, []);

  const handleLayoutChange = (key: string, layout: Partial<FieldLayout>) => {
    setLayouts(prev => {
      const next = {
        ...prev,
        [key]: { ...prev[key], ...layout },
      };
      localStorage.setItem(
        'cert_field_layouts',
        JSON.stringify({ version: LAYOUT_VERSION, layouts: next }),
      );
      return next;
    });
  };

  const renderField = (
    key: string,
    value: string,
    onChange: (val: string) => void,
    placeholder: string = '',
  ) => {
    if (!layouts[key]) return null;
    return (
      <DraggableField
        key={key}
        id={key}
        value={value}
        onChange={onChange}
        layout={layouts[key]}
        onLayoutChange={l => handleLayoutChange(key, l)}
        calibrationMode={calibrationMode}
        placeholder={placeholder}
        containerRef={editorRef}
        textColorOverrides={formData.text_color_overrides[key]}
        onTextColorChange={onTextColorChange ? (start, end, color) => onTextColorChange(key, start, end, color) : undefined}
      />
    );
  };

  return (
    <div
      id="print-area"
      ref={editorRef}
      className="relative mx-auto bg-white"
      style={{
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
      }}
    >
      <div className="absolute inset-0 bg-white pointer-events-none" style={{ zIndex: 0 }}></div>
      <div className="absolute inset-0 z-10 print-text-layer">
        {renderField('blank_number', formData.blank_number, v => onFieldChange('blank_number', v), '№ 000000')}
        
        {renderField('date_from_day', formData.date_from_day, v => onFieldChange('date_from_day', v), 'ДД')}
        {renderField('date_from_month', formData.date_from_month, v => onFieldChange('date_from_month', v), 'ММММ')}
        {renderField('date_from_year', formData.date_from_year, v => onFieldChange('date_from_year', v), 'ГГГГ')}
        
        {renderField('date_to_day', formData.date_to_day, v => onFieldChange('date_to_day', v), 'ДД')}
        {renderField('date_to_month', formData.date_to_month, v => onFieldChange('date_to_month', v), 'ММММ')}
        {renderField('date_to_year', formData.date_to_year, v => onFieldChange('date_to_year', v), 'ГГГГ')}
        
        {renderField('cert_number', formData.cert_number, v => onFieldChange('cert_number', v), '№ Сертификата')}
        
        {renderField('provider_name_address', formData.provider_name_address, v => onFieldChange('provider_name_address', v), 'Исполнитель и адрес')}
        {renderField('director_name', formData.director_name, v => onFieldChange('director_name', v), 'ФИО руководителя')}
        
        {formData.services_list.map((val, i) =>
          renderField(
            `services_list_${i}`,
            val,
            v => onArrayFieldChange('services_list', i, v),
            `Виды услуг (строка ${i + 1})`
          )
        )}
        
        {renderField('normative_documents', formData.normative_documents, v => onFieldChange('normative_documents', v), 'Нормативные документы')}
        {renderField('conclusion_doc', formData.conclusion_doc, v => onFieldChange('conclusion_doc', v), 'Документ-основание')}
        {renderField('tax_certificate', formData.tax_certificate, v => onFieldChange('tax_certificate', v), 'Справка НК')}
        {renderField('inspection_body', formData.inspection_body, v => onFieldChange('inspection_body', v), 'Орган инспекции')}
        {renderField('head_name', formData.head_name, v => onFieldChange('head_name', v), 'ФИО руководителя органа')}
      </div>

      {calibrationMode && (
        <div className="absolute left-full top-0 ml-4 w-64 bg-white border border-gray-300 shadow-xl rounded-lg p-4 z-50 no-print">
          <h4 className="font-bold text-sm mb-3">Управление массивами</h4>
          
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold">Виды услуг</span>
              <div className="flex gap-1">
                <button
                  onClick={() => onAddArrayRow('services_list')}
                  className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200 text-xs font-medium"
                >
                  +
                </button>
                <button
                  onClick={() => onRemoveArrayRow('services_list', formData.services_list.length - 1)}
                  disabled={formData.services_list.length <= 1}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs font-medium disabled:opacity-50"
                >
                  -
                </button>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight">
              Добавляйте или удаляйте строки. Новые строки появятся на бланке.
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={() => {
                if (confirm('Сбросить все координаты к значениям по умолчанию?')) {
                  setLayouts(DEFAULT_LAYOUTS);
                  localStorage.removeItem('cert_field_layouts');
                }
              }}
              className="w-full py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded transition-colors"
            >
              Сброс координат
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
