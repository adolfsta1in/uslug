CREATE TABLE IF NOT EXISTS public.templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blank_number TEXT,
    application_number TEXT,
    date_from_day TEXT,
    date_from_month TEXT,
    date_from_year TEXT,
    date_to_day TEXT,
    date_to_month TEXT,
    date_to_year TEXT,
    cert_number TEXT,
    recipient_name TEXT,
    recipient_address TEXT,
    entrepreneur_name TEXT,
    provider_name_address TEXT,
    director_name TEXT,
    services_list TEXT,
    patent_number TEXT,
    issue_date TEXT,
    inspector_name TEXT,
    amount TEXT,
    normative_documents TEXT,
    conclusion_doc TEXT,
    tax_certificate TEXT,
    inspection_body TEXT,
    head_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS application_number TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS recipient_address TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS entrepreneur_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS patent_number TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS issue_date TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS inspector_name TEXT;
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS amount TEXT;

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.templates FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.templates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON public.templates FOR DELETE USING (true);

CREATE POLICY "Enable read access for all users" ON public.certificates FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.certificates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.certificates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete access for all users" ON public.certificates FOR DELETE USING (true);
