
CREATE TABLE public.generated_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dialogue',
  preset_id TEXT,
  host_text TEXT,
  collector_text TEXT,
  full_script TEXT,
  host_voice TEXT,
  collector_voice TEXT,
  engine TEXT NOT NULL DEFAULT 'cloud',
  audio_path TEXT,
  duration_seconds NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_files TO anon, authenticated;
GRANT ALL ON public.generated_files TO service_role;

ALTER TABLE public.generated_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view files" ON public.generated_files FOR SELECT USING (true);
CREATE POLICY "Public can insert files" ON public.generated_files FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update files" ON public.generated_files FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete files" ON public.generated_files FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_generated_files_updated_at
BEFORE UPDATE ON public.generated_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
