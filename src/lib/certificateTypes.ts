export interface CertificateFormData {
  id?: string;
  
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
  services_list: string[];
  normative_documents: string;
  conclusion_doc: string;
  tax_certificate: string;
  inspection_body: string;
  head_name: string;

  text_color_overrides: Record<string, Record<number, '#000' | '#fff'>>;
}

export const EMPTY_FORM_DATA: CertificateFormData = {
  blank_number: '',
  date_from_day: '',
  date_from_month: '',
  date_from_year: '',
  date_to_day: '',
  date_to_month: '',
  date_to_year: '',
  cert_number: '',
  provider_name_address: '',
  director_name: '',
  services_list: ['', '', ''],
  normative_documents: '',
  conclusion_doc: '',
  tax_certificate: '',
  inspection_body: 'Тоҷикстандарт',
  head_name: '',
  text_color_overrides: {},
};

export const ALL_COLUMNS = [
  'blank_number',
  'date_from',
  'date_to',
  'cert_number',
  'provider_name_address',
  'director_name',
  'services_list',
  'normative_documents',
  'conclusion_doc',
  'tax_certificate',
  'inspection_body',
  'head_name',
] as const;

export const COLUMN_LABELS: Record<string, string> = {
  blank_number: '№ Бланка',
  date_from: 'Дата начала',
  date_to: 'Дата окончания',
  cert_number: '№ Сертификата',
  provider_name_address: 'Исполнитель и адрес',
  director_name: 'ФИО Руководителя',
  services_list: 'Виды услуг',
  normative_documents: 'Нормативные документы',
  conclusion_doc: 'Документ-основание',
  tax_certificate: 'Справка НК',
  inspection_body: 'Орган инспекции',
  head_name: 'Руководитель органа',
};

export function formToRegistryRow(data: CertificateFormData): Record<string, string> {
  return {
    blank_number: data.blank_number,
    date_from: `${data.date_from_day} ${data.date_from_month} ${data.date_from_year}`,
    date_to: `${data.date_to_day} ${data.date_to_month} ${data.date_to_year}`,
    cert_number: data.cert_number,
    provider_name_address: data.provider_name_address,
    director_name: data.director_name,
    services_list: data.services_list.filter(Boolean).join(' | '),
    normative_documents: data.normative_documents,
    conclusion_doc: data.conclusion_doc,
    tax_certificate: data.tax_certificate,
    inspection_body: data.inspection_body,
    head_name: data.head_name,
  };
}
