export interface CertificateFormData {
  id?: string;

  certificateNumber: string;
  applicationNumber: string;
  organizationName: string;
  address: string;
  entrepreneurName: string;
  serviceType: string;
  patentNumber: string;
  issueDate: string;
  validTo: string;
  conclusionDate: string;
  inspectorName: string;
  amount: string;
  standard: string;
  inspectionBody: string;
  headName: string;

  text_color_overrides: Record<string, Record<number, '#000' | '#fff'>>;
}

export interface CertificateDbRow {
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
  valid_to: string | null;
  conclusion_date: string | null;
  inspector_name: string | null;
  amount: string | null;
  normative_documents: string | null;
  conclusion_doc: string | null;
  tax_certificate: string | null;
  inspection_body: string | null;
  head_name: string | null;
}

export const DEFAULT_STANDARD = 'СТ ҶТ 1037-2001';
export const DEFAULT_INSPECTION_BODY = 'Тоҷикстандарт';
export const DEFAULT_HEAD_NAME = 'Рахмон И.Х.';

export const FORM_DRAFT_KEY = 'cert_form_draft_v3';
export const FORM_DRAFT_VERSION = '3';

export const EMPTY_FORM_DATA: CertificateFormData = {
  certificateNumber: '',
  applicationNumber: '',
  organizationName: '',
  address: '',
  entrepreneurName: '',
  serviceType: '',
  patentNumber: '',
  issueDate: '',
  validTo: '',
  conclusionDate: '',
  inspectorName: '',
  amount: '',
  standard: DEFAULT_STANDARD,
  inspectionBody: DEFAULT_INSPECTION_BODY,
  headName: DEFAULT_HEAD_NAME,
  text_color_overrides: {},
};

export const REGISTRY_COLUMNS = [
  'cert_number',
  'application_number',
  'recipient_name',
  'recipient_address',
  'entrepreneur_name',
  'service_type',
  'patent_number',
  'issue_date',
  'inspector_name',
  'amount',
] as const;

export const ALL_COLUMNS = REGISTRY_COLUMNS;

export const COLUMN_LABELS: Record<string, string> = {
  cert_number: 'Номер свидетельства',
  application_number: 'Номер заявки',
  recipient_name: 'Наименование',
  recipient_address: 'Адрес',
  entrepreneur_name: 'ФИО предпринимателя',
  service_type: 'Вид услуги',
  patent_number: 'Номер патента',
  issue_date: 'Дата выдачи',
  inspector_name: 'Инспектор',
  amount: 'Сумма',
};

export const TAJIK_MONTHS = [
  'январ',
  'феврал',
  'март',
  'апрел',
  'май',
  'июн',
  'июл',
  'август',
  'сентябр',
  'октябр',
  'ноябр',
  'декабр',
];

export function normalizeServicesList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item ?? '')).filter(Boolean);
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item ?? '')).filter(Boolean);
    }
  } catch {}

  const separator = value.includes('|') ? '|' : '\n';
  return value
    .split(separator)
    .map(item => item.trim())
    .filter(Boolean);
}

export function serializeServicesList(value: string | string[]): string {
  const services = Array.isArray(value) ? value : normalizeServicesList(value);
  return JSON.stringify(services.length ? services : [String(value || '').trim()].filter(Boolean));
}

export function joinDateParts(day: string, month: string, year: string): string {
  return [day, month, year].map(part => part.trim()).filter(Boolean).join(' ');
}

export function parseDateParts(value: string) {
  if (!value) return { day: '', month: '', year: '' };

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const monthIndex = Number(iso[2]) - 1;
    return {
      day: iso[3],
      month: TAJIK_MONTHS[monthIndex] || '',
      year: iso[1],
    };
  }

  const dotted = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotted) {
    const monthIndex = Number(dotted[2]) - 1;
    return {
      day: dotted[1].padStart(2, '0'),
      month: TAJIK_MONTHS[monthIndex] || '',
      year: dotted[3],
    };
  }

  const split = value.trim().split(/\s+/);
  return {
    day: split[0] || '',
    month: split[1] || '',
    year: split[2] || '',
  };
}

export function formatDateForText(value: string): string {
  if (!value) return '';
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}с.`;
  if (/с\.$/.test(value)) return value;
  return `${value}с.`;
}

export function formToRegistryRow(data: CertificateFormData): Record<string, string> {
  return {
    cert_number: data.certificateNumber,
    application_number: data.applicationNumber,
    recipient_name: data.organizationName,
    recipient_address: data.address,
    entrepreneur_name: data.entrepreneurName,
    service_type: data.serviceType,
    patent_number: data.patentNumber,
    issue_date: data.issueDate,
    inspector_name: data.inspectorName,
    amount: data.amount,
  };
}

export function formToCertificatePayload(data: CertificateFormData): Record<string, string | null> {
  const from = parseDateParts(data.issueDate);
  const to = parseDateParts(data.validTo);

  return {
    application_number: data.applicationNumber || null,
    date_from_day: from.day || null,
    date_from_month: from.month || null,
    date_from_year: from.year || null,
    date_to_day: to.day || null,
    date_to_month: to.month || null,
    date_to_year: to.year || null,
    cert_number: data.certificateNumber || null,
    recipient_name: data.organizationName || null,
    recipient_address: data.address || null,
    entrepreneur_name: data.entrepreneurName || null,
    provider_name_address: data.organizationName || null,
    director_name: data.entrepreneurName || null,
    services_list: serializeServicesList(data.serviceType),
    patent_number: data.patentNumber || null,
    issue_date: data.issueDate || null,
    valid_to: data.validTo || null,
    conclusion_date: data.conclusionDate || null,
    inspector_name: data.inspectorName || null,
    amount: data.amount || null,
    normative_documents: data.standard || DEFAULT_STANDARD,
    conclusion_doc: data.conclusionDate || null,
    tax_certificate: data.patentNumber || null,
    inspection_body: data.inspectionBody || DEFAULT_INSPECTION_BODY,
    head_name: data.headName || DEFAULT_HEAD_NAME,
  };
}

export function dbRowToFormData(row: Partial<CertificateDbRow>): CertificateFormData {
  const serviceType = normalizeServicesList(row.services_list).join(' | ');
  const issueDate =
    row.issue_date ||
    legacyDateToIso(row.date_from_day, row.date_from_month, row.date_from_year) ||
    '';
  const validTo =
    row.valid_to ||
    legacyDateToIso(row.date_to_day, row.date_to_month, row.date_to_year) ||
    '';

  return {
    ...EMPTY_FORM_DATA,
    id: row.id,
    certificateNumber: row.cert_number || '',
    applicationNumber: row.application_number || '',
    organizationName: row.recipient_name || row.provider_name_address || '',
    address: row.recipient_address || '',
    entrepreneurName: row.entrepreneur_name || row.director_name || '',
    serviceType,
    patentNumber: row.patent_number || row.tax_certificate || '',
    issueDate,
    validTo,
    conclusionDate: row.conclusion_date || row.conclusion_doc || '',
    inspectorName: row.inspector_name || '',
    amount: row.amount || '',
    standard: row.normative_documents || DEFAULT_STANDARD,
    inspectionBody: row.inspection_body || DEFAULT_INSPECTION_BODY,
    headName: row.head_name || DEFAULT_HEAD_NAME,
    text_color_overrides: {},
  };
}

function legacyDateToIso(day?: string | null, month?: string | null, year?: string | null) {
  if (!day || !month || !year) return '';
  const monthIndex = TAJIK_MONTHS.findIndex(item => item.toLowerCase() === month.toLowerCase());
  if (monthIndex < 0) return joinDateParts(day, month, year);
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(Number(day)).padStart(2, '0')}`;
}
