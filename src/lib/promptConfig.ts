import { supabase } from "@/integrations/supabase/client";

export type PageType = "spoke" | "hub" | "browser";

/**
 * Load prompt config for a given project + page type
 */
export async function loadPromptConfig(projectId: string, pageType: PageType): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/prompt_configs?project_id=eq.${projectId}&page_type=eq.${pageType}&select=prompt_content&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    }
  );
  if (!res.ok) return "";
  const rows = await res.json();
  return rows?.[0]?.prompt_content || "";
}

/**
 * Save (upsert) prompt config
 */
export async function savePromptConfig(projectId: string, pageType: PageType, promptContent: string): Promise<void> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const res = await fetch(`${supabaseUrl}/rest/v1/prompt_configs`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      project_id: projectId,
      page_type: pageType,
      prompt_content: promptContent,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Failed to save prompt config:", errBody);
  }
}
