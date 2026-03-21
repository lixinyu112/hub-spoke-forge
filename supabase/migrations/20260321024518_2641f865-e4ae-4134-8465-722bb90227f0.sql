
CREATE TABLE public.publications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type text NOT NULL, -- 'hub' or 'spoke'
  source_id uuid NOT NULL,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'zh',
  json_data jsonb,
  status text NOT NULL DEFAULT 'published',
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on publications"
ON public.publications FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_publications_updated_at
BEFORE UPDATE ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
