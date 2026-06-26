export interface CertificateFormData {
  id?: string;

  blank_number: string;
  application_number: string;
  date_from_day: string;
  date_from_month: string;
  date_from_year: string;
  date_to_day: string;
  date_to_month: string;
  date_to_year: string;
  cert_number: string;
  recipient_name: string;
  recipient_address: string;
  entrepreneur_name: string;
  provider_name_address: string;
  director_name: string;
  services_list: string[];
  patent_number: string;
  issue_date: string;
  inspector_name: string;
  amount: string;
  normative_documents: string;
  conclusion_doc: string;
  tax_certificate: string;
  inspection_body: string;
  head_name: string;

  text_color_overrides: Record<string, Record<number, '#000' | '#fff'>>;
}

export const FORM_DRAFT_KEY = 'cert_form_draft_v2';
export const FORM_DRAFT_VERSION = '2';

export const EMPTY_FORM_DATA: CertificateFormData = {
  blank_number: '',
  application_number: '',
  date_from_day: '',
  date_from_month: '',
  date_from_year: '',
  date_to_day: '',
  date_to_month: '',
  date_to_year: '',
  cert_number: '',
  recipient_name: '',
  recipient_address: '',
  entrepreneur_name: '',
  provider_name_address: '',
  director_name: '',
  services_list: ['', '', ''],
  patent_number: '',
  issue_date: '',
  inspector_name: '',
  amount: '',
  normative_documents: '',
  conclusion_doc: '',
  tax_certificate: '',
  inspection_body: 'Точикстандарт',
  head_name: '',
  text_color_overrides: {},
};

export function normalizeServicesList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const normalized = value.map(item => String(item ?? ''));
    return normalized.length > 0 ? normalized : EMPTY_FORM_DATA.services_list;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return EMPTY_FORM_DATA.services_list;
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      const normalized = parsed.map(item => String(item ?? ''));
      return normalized.length > 0 ? normalized : EMPTY_FORM_DATA.services_list;
    }
  } catch {}

  const separator = value.includes('|') ? '|' : '\n';
  const normalized = value
    .split(separator)
    .map(item => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : EMPTY_FORM_DATA.services_list;
}

export function serializeServicesList(value: string[]): string {
  return JSON.stringify(value);
}

export function joinDateParts(day: string, month: string, year: string): string {
  return [day, month, year].map(part => part.trim()).filter(Boolean).join(' ');
}

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
  cert_number: '№ свидетельства',
  application_number: '№ заявка',
  recipient_name: 'Наименование предприятий, организаций, частных лиц, получивших свидетел.',
  recipient_address: 'Адрес',
  entrepreneur_name: 'Ф.И.О предприниматель',
  service_type: 'Вид услуга',
  patent_number: '№ патента',
  issue_date: 'Дата выдачи',
  inspector_name: 'Инспектор',
  amount: 'Сумма',
};

export function formToRegistryRow(data: CertificateFormData): Record<string, string> {
  return {
    cert_number: data.cert_number,
    application_number: data.application_number,
    recipient_name: data.recipient_name || data.provider_name_address,
    recipient_address: data.recipient_address,
    entrepreneur_name: data.entrepreneur_name || data.director_name,
    service_type: normalizeServicesList(data.services_list).filter(Boolean).join(' | '),
    patent_number: data.patent_number || data.tax_certificate,
    issue_date: data.issue_date || joinDateParts(data.date_from_day, data.date_from_month, data.date_from_year),
    inspector_name: data.inspector_name || data.inspection_body,
    amount: data.amount,
  };
}

export function formToCertificatePayload(data: CertificateFormData): Record<string, string | null> {
  return {
    blank_number: data.blank_number,
    application_number: data.application_number,
    date_from_day: data.date_from_day,
    date_from_month: data.date_from_month,
    date_from_year: data.date_from_year,
    date_to_day: data.date_to_day,
    date_to_month: data.date_to_month,
    date_to_year: data.date_to_year,
    cert_number: data.cert_number,
    recipient_name: data.recipient_name,
    recipient_address: data.recipient_address,
    entrepreneur_name: data.entrepreneur_name,
    provider_name_address: data.provider_name_address,
    director_name: data.director_name,
    services_list: serializeServicesList(data.services_list),
    patent_number: data.patent_number,
    issue_date: data.issue_date || joinDateParts(data.date_from_day, data.date_from_month, data.date_from_year),
    inspector_name: data.inspector_name,
    amount: data.amount,
    normative_documents: data.normative_documents,
    conclusion_doc: data.conclusion_doc,
    tax_certificate: data.tax_certificate,
    inspection_body: data.inspection_body,
    head_name: data.head_name,
  };
}

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
