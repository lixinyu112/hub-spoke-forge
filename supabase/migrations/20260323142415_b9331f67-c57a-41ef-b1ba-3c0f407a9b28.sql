
CREATE TABLE public.json_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  feishu_content TEXT,
  prompt_content TEXT,
  generated_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.json_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access on json_records"
ON public.json_records
FOR ALL
TO public
USING (true)
WITH CHECK (true);
