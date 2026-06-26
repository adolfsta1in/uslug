'use client';

export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellValueChangedEvent,
  type ColDef,
  type GridApi,
  type GridReadyEvent,
  type ICellRendererParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import * as XLSX from 'xlsx';
import {
  COLUMN_LABELS,
  EMPTY_FORM_DATA,
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  REGISTRY_COLUMNS,
  formToRegistryRow,
  normalizeServicesList,
  serializeServicesList,
} from '@/lib/certificateTypes';
import { supabase } from '@/lib/supabase';

ModuleRegistry.registerModules([AllCommunityModule]);

interface CertRow {
  id: string;
  created_at: string;
  blank_number: string | null;
  application_number: string | null;
  date_from_day: string | null;
  date_from_month: string | null;
  date_from_year: string | null;
  date_to_day: string | null;
  date_to_month: string | null;
  date_to_year: string | null;
  cert_number: string | null;
  recipient_name: string | null;
  recipient_address: string | null;
  entrepreneur_name: string | null;
  provider_name_address: string | null;
  director_name: string | null;
  services_list: string | null;
  patent_number: string | null;
  issue_date: string | null;
  inspector_name: string | null;
  amount: string | null;
  normative_documents: string | null;
  conclusion_doc: string | null;
  tax_certificate: string | null;
  inspection_body: string | null;
  head_name: string | null;
}

type RegistryGridRow = CertRow & {
  row_number: number;
  service_type: string;
};

function toGridRow(row: CertRow, index: number): RegistryGridRow {
  return {
    ...row,
    row_number: index + 1,
    service_type: normalizeServicesList(row.services_list).filter(Boolean).join(' | '),
  };
}

function toFormDraft(row: CertRow) {
  return {
    ...EMPTY_FORM_DATA,
    id: row.id,
    blank_number: row.blank_number || '',
    application_number: row.application_number || '',
    date_from_day: row.date_from_day || '',
    date_from_month: row.date_from_month || '',
    date_from_year: row.date_from_year || '',
    date_to_day: row.date_to_day || '',
    date_to_month: row.date_to_month || '',
    date_to_year: row.date_to_year || '',
    cert_number: row.cert_number || '',
    recipient_name: row.recipient_name || '',
    recipient_address: row.recipient_address || '',
    entrepreneur_name: row.entrepreneur_name || '',
    provider_name_address: row.provider_name_address || '',
    director_name: row.director_name || '',
    services_list: normalizeServicesList(row.services_list),
    patent_number: row.patent_number || '',
    issue_date: row.issue_date || '',
    inspector_name: row.inspector_name || '',
    amount: row.amount || '',
    normative_documents: row.normative_documents || '',
    conclusion_doc: row.conclusion_doc || '',
    tax_certificate: row.tax_certificate || '',
    inspection_body: row.inspection_body || '',
    head_name: row.head_name || '',
    text_color_overrides: {},
  };
}

export default function RegistryPage() {
  const [rows, setRows] = useState<RegistryGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState('');
  const [gridApi, setGridApi] = useState<GridApi<RegistryGridRow> | null>(null);
  const router = useRouter();

  const loadCerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('certificates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 4999);

    if (fetchError) {
      setError('Ошибка загрузки реестра: ' + fetchError.message);
      setRows([]);
    } else {
      setRows(((data || []) as CertRow[]).map(toGridRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const openInBlank = useCallback(
    (row: CertRow) => {
      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({ version: FORM_DRAFT_VERSION, data: toFormDraft(row) }));
      router.push('/');
    },
    [router],
  );

  const deleteCert = useCallback(
    async (row: CertRow) => {
      if (!confirm('Удалить эту запись из реестра?')) return;
      const { error: deleteError } = await supabase.from('certificates').delete().eq('id', row.id);
      if (deleteError) {
        alert('Ошибка удаления: ' + deleteError.message);
        return;
      }
      setRows(prev => prev.filter(item => item.id !== row.id).map((item, index) => ({ ...item, row_number: index + 1 })));
    },
    [],
  );

  const clearAll = useCallback(async () => {
    if (!confirm('Удалить все записи из реестра?')) return;
    const { error: deleteError } = await supabase
      .from('certificates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      alert('Ошибка очистки: ' + deleteError.message);
      return;
    }
    setRows([]);
  }, []);

  const exportExcel = useCallback(() => {
    if (!gridApi) return;
    const visibleRows: RegistryGridRow[] = [];
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node.data) visibleRows.push(node.data);
    });

    const headers = ['#', ...REGISTRY_COLUMNS.map(column => COLUMN_LABELS[column])];
    const data = visibleRows.map((row, index) => {
      const registryRow = formToRegistryRow(toFormDraft(row));
      return [index + 1, ...REGISTRY_COLUMNS.map(column => registryRow[column] || '')];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(header => {
      if (header.includes('Наименование')) return { wch: 42 };
      if (header === 'Адрес' || header === 'Вид услуга') return { wch: 34 };
      return { wch: 18 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'reestr_svidetelstv.xlsx');
  }, [gridApi]);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent<RegistryGridRow>) => {
    const field = event.colDef.field;
    if (!event.data || !field || event.newValue === event.oldValue) return;

    const nextValue = String(event.newValue ?? '');
    const updatePayload =
      field === 'service_type'
        ? { services_list: serializeServicesList(normalizeServicesList(nextValue)) }
        : { [field]: nextValue };

    setSavingCell(true);
    const { error: updateError } = await supabase.from('certificates').update(updatePayload).eq('id', event.data.id);
    setSavingCell(false);

    if (updateError) {
      alert('Ошибка сохранения ячейки: ' + updateError.message);
      event.node.setDataValue(field, event.oldValue);
      return;
    }

    if (field === 'service_type') {
      event.data.services_list = serializeServicesList(normalizeServicesList(nextValue));
      event.data.service_type = normalizeServicesList(nextValue).filter(Boolean).join(' | ');
    }
  }, []);

  const columnDefs = useMemo<ColDef<RegistryGridRow>[]>(
    () => [
      {
        headerName: '#',
        field: 'row_number',
        width: 76,
        pinned: 'left',
        sortable: false,
        filter: false,
        editable: false,
      },
      {
        headerName: COLUMN_LABELS.cert_number,
        field: 'cert_number',
        minWidth: 160,
        pinned: 'left',
      },
      {
        headerName: COLUMN_LABELS.application_number,
        field: 'application_number',
        minWidth: 150,
      },
      {
        headerName: COLUMN_LABELS.recipient_name,
        field: 'recipient_name',
        minWidth: 330,
        flex: 1.4,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: COLUMN_LABELS.recipient_address,
        field: 'recipient_address',
        minWidth: 240,
        flex: 1,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: COLUMN_LABELS.entrepreneur_name,
        field: 'entrepreneur_name',
        minWidth: 220,
      },
      {
        headerName: COLUMN_LABELS.service_type,
        field: 'service_type',
        minWidth: 260,
        flex: 1,
        wrapText: true,
        autoHeight: true,
      },
      {
        headerName: COLUMN_LABELS.patent_number,
        field: 'patent_number',
        minWidth: 150,
      },
      {
        headerName: COLUMN_LABELS.issue_date,
        field: 'issue_date',
        minWidth: 150,
      },
      {
        headerName: COLUMN_LABELS.inspector_name,
        field: 'inspector_name',
        minWidth: 170,
      },
      {
        headerName: COLUMN_LABELS.amount,
        field: 'amount',
        minWidth: 130,
      },
      {
        headerName: 'Действия',
        minWidth: 190,
        pinned: 'right',
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: (params: ICellRendererParams<RegistryGridRow>) => {
          if (!params.data) return null;
          return (
            <div className="flex h-full items-center gap-2">
              <button
                onClick={() => openInBlank(params.data as CertRow)}
                className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                В бланк
              </button>
              <button
                onClick={() => deleteCert(params.data as CertRow)}
                className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                Удалить
              </button>
            </div>
          );
        },
      },
    ],
    [deleteCert, openInBlank],
  );

  const defaultColDef = useMemo<ColDef<RegistryGridRow>>(
    () => ({
      editable: true,
      sortable: true,
      filter: true,
      floatingFilter: true,
      resizable: true,
      minWidth: 120,
      cellClass: 'leading-5',
    }),
    [],
  );

  const onGridReady = useCallback((event: GridReadyEvent<RegistryGridRow>) => {
    setGridApi(event.api);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-[1800px] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Реестр свидетельств</h2>
            <p className="mt-1 text-sm text-gray-500">
              {rows.length} записей. Сортировка, фильтры и поиск работают прямо в таблице.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={quickFilter}
              onChange={event => setQuickFilter(event.target.value)}
              placeholder="Общий поиск по реестру"
              className="w-72 max-w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={loadCerts}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Обновить
            </button>
            <button
              onClick={exportExcel}
              disabled={!rows.length}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              Скачать Excel
            </button>
            {rows.length > 0 && (
              <button
                onClick={clearAll}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Очистить реестр
              </button>
            )}
          </div>
        </div>

        {savingCell && <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">Сохраняю ячейку...</div>}

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
          <div className="ag-theme-quartz h-[calc(100dvh-190px)] min-h-[520px] w-full">
            <AgGridReact<RegistryGridRow>
              rowData={rows}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              loading={loading}
              pagination
              paginationPageSize={50}
              paginationPageSizeSelector={[25, 50, 100, 250]}
              quickFilterText={quickFilter}
              animateRows
              enableCellTextSelection
              stopEditingWhenCellsLoseFocus
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
