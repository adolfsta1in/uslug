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
  CertificateDbRow,
  FORM_DRAFT_KEY,
  FORM_DRAFT_VERSION,
  REGISTRY_COLUMNS,
  dbRowToFormData,
  formToRegistryRow,
  serializeServicesList,
} from '@/lib/certificateTypes';
import { describeSupabaseError, supabase } from '@/lib/supabase';

ModuleRegistry.registerModules([AllCommunityModule]);

type RegistryGridRow = CertificateDbRow & {
  row_number: number;
  service_type: string;
};

function toGridRow(row: CertificateDbRow, index: number): RegistryGridRow {
  return {
    ...row,
    row_number: index + 1,
    service_type: dbRowToFormData(row).serviceType,
  };
}

function updatePayloadForField(field: string, nextValue: string) {
  if (field === 'service_type') return { services_list: serializeServicesList(nextValue) };
  return { [field]: nextValue || null };
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
      setError('Ошибка загрузки реестра: ' + describeSupabaseError(fetchError));
      setRows([]);
    } else {
      setRows(((data || []) as CertificateDbRow[]).map(toGridRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  const openInBlank = useCallback(
    (row: CertificateDbRow) => {
      localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify({ version: FORM_DRAFT_VERSION, data: dbRowToFormData(row) }));
      router.push('/');
    },
    [router],
  );

  const deleteCert = useCallback(
    async (row: CertificateDbRow) => {
      if (!confirm('Удалить эту запись из реестра?')) return;
      const { error: deleteError } = await supabase.from('certificates').delete().eq('id', row.id);
      if (deleteError) {
        alert('Ошибка удаления: ' + describeSupabaseError(deleteError));
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
      alert('Ошибка очистки: ' + describeSupabaseError(deleteError));
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

    const headers = ['№', ...REGISTRY_COLUMNS.map(column => COLUMN_LABELS[column])];
    const data = visibleRows.map((row, index) => {
      const registryRow = formToRegistryRow(dbRowToFormData(row));
      return [index + 1, ...REGISTRY_COLUMNS.map(column => registryRow[column] || '')];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws['!cols'] = headers.map(header => {
      if (header === 'Наименование') return { wch: 42 };
      if (header === 'Адрес' || header === 'Вид услуги') return { wch: 34 };
      return { wch: 18 };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Реестр');
    XLSX.writeFile(wb, 'reestr_shahodatnoma.xlsx');
  }, [gridApi]);

  const onCellValueChanged = useCallback(async (event: CellValueChangedEvent<RegistryGridRow>) => {
    const field = event.colDef.field;
    if (!event.data || !field || event.newValue === event.oldValue) return;

    const nextValue = String(event.newValue ?? '');
    const updatePayload = updatePayloadForField(field, nextValue);

    setSavingCell(true);
    const { error: updateError } = await supabase.from('certificates').update(updatePayload).eq('id', event.data.id);
    setSavingCell(false);

    if (updateError) {
      alert('Ошибка сохранения ячейки: ' + describeSupabaseError(updateError));
      event.node.setDataValue(field, event.oldValue);
      return;
    }

    if (field === 'service_type') {
      event.data.services_list = serializeServicesList(nextValue);
      event.data.service_type = nextValue;
    } else {
      (event.data as unknown as Record<string, string | null>)[field] = nextValue || null;
    }
  }, []);

  const columnDefs = useMemo<ColDef<RegistryGridRow>[]>(
    () => [
      {
        headerName: '№',
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
        minWidth: 190,
        pinned: 'left',
      },
      {
        headerName: COLUMN_LABELS.application_number,
        field: 'application_number',
        minWidth: 160,
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
        minWidth: 260,
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
        minWidth: 190,
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
                onClick={() => openInBlank(params.data as CertificateDbRow)}
                className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                В бланк
              </button>
              <button
                onClick={() => deleteCert(params.data as CertificateDbRow)}
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
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto max-w-[1800px] p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Реестр свидетельств</h2>
            <p className="mt-1 text-sm text-slate-500">
              {rows.length} записей. Сортировка, фильтры и поиск работают прямо в таблице.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={quickFilter}
              onChange={event => setQuickFilter(event.target.value)}
              placeholder="Общий поиск по реестру"
              className="w-72 max-w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <button
              onClick={loadCerts}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Обновить
            </button>
            <button
              onClick={exportExcel}
              disabled={!rows.length}
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              Скачать Excel
            </button>
            {rows.length > 0 && (
              <button
                onClick={clearAll}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Очистить реестр
              </button>
            )}
          </div>
        </div>

        {savingCell && <div className="mb-3 rounded-md border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">Сохраняю ячейку...</div>}

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>}

        <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm">
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
