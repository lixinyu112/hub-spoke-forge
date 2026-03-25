import { supabase } from "@/integrations/supabase/client";

export async function fetchFeishuDocs(query?: string, folderToken?: string) {
  const action = query ? "search_docs" : "list_docs";
  const params = new URLSearchParams({ action });
  if (folderToken) params.set("folder_token", folderToken);
  if (query) params.set("query", query);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/functions/v1/feishu-docs?${params.toString()}`, {
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Feishu API error: ${errBody}`);
  }
  return res.json();
}

export async function fetchFeishuDocContent(docToken: string, docType: string = 'docx') {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const params = new URLSearchParams({ action: 'get_doc_content', doc_token: docToken, doc_type: docType });

  const res = await fetch(`${supabaseUrl}/functions/v1/feishu-docs?${params.toString()}`, {
    headers: {
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
  });
  
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Feishu doc content error: ${errBody}`);
  }
  return res.json();
}
