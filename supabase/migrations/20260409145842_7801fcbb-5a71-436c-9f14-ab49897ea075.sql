
-- Blog groups table
CREATE TABLE public.blog_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.blog_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on blog_groups" ON public.blog_groups
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_blog_groups_updated_at
  BEFORE UPDATE ON public.blog_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blog posts table
CREATE TABLE public.blog_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.blog_groups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT,
  original_filename TEXT,
  json_data JSONB,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on blog_posts" ON public.blog_posts
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
