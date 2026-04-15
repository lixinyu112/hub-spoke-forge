
CREATE TABLE public.sitemap_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  base_url TEXT NOT NULL DEFAULT '',
  url_pattern_hub TEXT NOT NULL DEFAULT '/{lang}/{theme}',
  url_pattern_spoke TEXT NOT NULL DEFAULT '/{lang}/{theme}/{slug}',
  languages JSONB NOT NULL DEFAULT '["zh","en","es","ko","ru","pt","ja"]'::jsonb,
  changefreq TEXT DEFAULT NULL,
  priority TEXT DEFAULT NULL,
  include_hub BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);

ALTER TABLE public.sitemap_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on sitemap_configs"
ON public.sitemap_configs FOR ALL TO public
USING (true) WITH CHECK (true);
