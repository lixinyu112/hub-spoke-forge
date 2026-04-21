
CREATE TABLE public.publish_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  theme_id UUID REFERENCES public.themes(id) ON DELETE SET NULL,
  theme_name TEXT,
  item_count INTEGER NOT NULL DEFAULT 0,
  languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  translate_enabled BOOLEAN NOT NULL DEFAULT true,
  total INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_publish_logs_project_created ON public.publish_logs(project_id, created_at DESC);

ALTER TABLE public.publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on publish_logs"
  ON public.publish_logs FOR ALL
  USING (true) WITH CHECK (true);
