CREATE TABLE public.prompt_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  page_type text NOT NULL,
  prompt_content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, page_type)
);

ALTER TABLE public.prompt_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on prompt_configs" ON public.prompt_configs FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TRIGGER update_prompt_configs_updated_at BEFORE UPDATE ON public.prompt_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();